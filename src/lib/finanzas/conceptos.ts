/**
 * ¿En qué se va tu plata? (Fase 3): gastos agrupados por concepto. Funciones puras.
 *  - Normalización: minúsculas, sin tildes, sin números de referencia ni asteriscos
 *    ("RAPPI*1234", "Rappi" y "rappi" son lo mismo). Si se reconoce el comercio, se usa su nombre.
 *  - Uniones manuales: "almuerzo oficina" → "almuerzo" (se recuerdan y se pueden deshacer).
 *  - Comparación con el periodo anterior del mismo largo.
 * Los totales cuadran exactamente con los gastos del periodo (completados, como en el resto de Finanzas).
 */
import type { Transaction } from "../../types/db";
import { addDays, addMonths, endOfMonth, monthKey, monthLabel } from "../../utils/dates";
import { detectStoreInText } from "../../modules/other/stores";

export type PeriodoConceptos = "mes" | "trimestre" | "anio";

export const PERIODOS_CONCEPTOS: { value: PeriodoConceptos; label: string }[] = [
  { value: "mes", label: "Mes" },
  { value: "trimestre", label: "3 meses" },
  { value: "anio", label: "Año" },
];

/** Palabras que no dicen qué se compró ("compra", "pago", sufijos de razón social…) */
const RUIDO = new Set(["compra", "compras", "pago", "pagos", "pse", "datafono", "debito", "credito", "tarjeta", "sas", "s.a.s", "ltda", "sa", "co", "col", "colombia", "www", "com"]);

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Clave del concepto: "RAPPI*1234 BOG" → "rappi" · "Almuerzo  oficina 12" → "almuerzo oficina" */
export function normalizarConcepto(descripcion: string): string {
  const tienda = detectStoreInText(descripcion);
  if (tienda) return sinTildes(tienda.name.toLowerCase());
  let s = sinTildes(descripcion.toLowerCase());
  // Lo que va después de un asterisco suele ser una referencia ("uber *trip 8h2k" → "uber")
  s = s.replace(/\*.*$/, " ");
  const palabras = s
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !/\d/.test(w) && !RUIDO.has(w));
  return palabras.join(" ").trim() || "sin descripcion";
}

const capital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Sigue las uniones hasta el concepto final (sin ciclos) */
export function claveFinal(clave: string, uniones: Record<string, string>): string {
  let k = clave;
  const vistos = new Set<string>();
  while (uniones[k] && !vistos.has(k)) {
    vistos.add(k);
    k = uniones[k];
  }
  return k;
}

export interface Concepto {
  clave: string;
  nombre: string;
  total: number;
  veces: number;
  categorias: string[];
  /** Claves que se unieron a este concepto */
  unidos: string[];
}

const esGasto = (t: Transaction, desde: string, hasta: string) => t.type === "gasto" && t.status === "completado" && t.date >= desde && t.date <= hasta;

/** Agrupa los gastos del rango por concepto (de mayor a menor). Opcional: solo una categoría. */
export function agruparConceptos(txs: Transaction[], desde: string, hasta: string, uniones: Record<string, string> = {}, categoria?: string | null): Concepto[] {
  const mapa = new Map<string, { total: number; veces: number; cats: Map<string, number>; nombres: Map<string, number>; unidos: Set<string> }>();
  for (const t of txs) {
    if (!esGasto(t, desde, hasta)) continue;
    if (categoria && (t.category ?? "Sin categoría") !== categoria) continue;
    const propia = normalizarConcepto(t.description);
    const k = claveFinal(propia, uniones);
    const g = mapa.get(k) ?? { total: 0, veces: 0, cats: new Map(), nombres: new Map(), unidos: new Set() };
    g.total += Math.round(t.amount);
    g.veces += 1;
    g.cats.set(t.category ?? "Sin categoría", (g.cats.get(t.category ?? "Sin categoría") ?? 0) + t.amount);
    if (propia !== k) g.unidos.add(propia);
    mapa.set(k, g);
  }
  return [...mapa.entries()]
    .map(([clave, g]) => {
      const tienda = detectStoreInText(clave);
      return {
        clave,
        nombre: tienda?.name ?? capital(clave),
        total: g.total,
        veces: g.veces,
        categorias: [...g.cats.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c),
        unidos: [...g.unidos],
      };
    })
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
}

/** Total de gastos del rango (para cuadrar el ranking) */
export const totalGastos = (txs: Transaction[], desde: string, hasta: string, categoria?: string | null) =>
  txs.filter((t) => esGasto(t, desde, hasta) && (!categoria || (t.category ?? "Sin categoría") === categoria)).reduce((n, t) => n + Math.round(t.amount), 0);

export interface Rango {
  desde: string;
  hasta: string;
  /** "octubre", "ago–oct", "2025" */
  nombre: string;
}

/** Rango del periodo que termina hoy y el anterior del mismo largo */
export function rangos(periodo: PeriodoConceptos, hoy: string): { actual: Rango; anterior: Rango } {
  const mes = monthKey(hoy);
  const nombreMes = (k: string) => monthLabel(k).split(" ")[0].toLowerCase();
  if (periodo === "mes") {
    const ant = addMonths(mes, -1);
    // El mes anterior hasta el mismo día, para comparar parejo
    const dia = Number(hoy.slice(8));
    const finAnt = endOfMonth(ant) < `${ant}-${String(dia).padStart(2, "0")}` ? endOfMonth(ant) : `${ant}-${String(dia).padStart(2, "0")}`;
    return { actual: { desde: `${mes}-01`, hasta: hoy, nombre: nombreMes(mes) }, anterior: { desde: `${ant}-01`, hasta: finAnt, nombre: nombreMes(ant) } };
  }
  const meses = periodo === "trimestre" ? 3 : 12;
  const ini = addMonths(mes, -(meses - 1));
  const iniAnt = addMonths(ini, -meses);
  const finAnt = addDays(`${ini}-01`, -1);
  const nombre = (a: string, b: string) => (periodo === "anio" ? `los 12 meses hasta ${nombreMes(b)}` : `${nombreMes(a).slice(0, 3)}–${nombreMes(b).slice(0, 3)}`);
  return {
    actual: { desde: `${ini}-01`, hasta: hoy, nombre: nombre(ini, mes) },
    anterior: { desde: `${iniAnt}-01`, hasta: finAnt, nombre: nombre(iniAnt, monthKey(finAnt)) },
  };
}

/** "+40 % que octubre" · "−15 % que octubre" · "Nuevo" (sin gasto antes) · null (igual) */
export function comparacion(actual: number, anterior: number, nombreAnterior: string): string | null {
  if (anterior <= 0) return actual > 0 ? `Nuevo frente a ${nombreAnterior}` : null;
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  if (pct === 0) return `Igual que ${nombreAnterior}`;
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)} % que ${nombreAnterior}`;
}
