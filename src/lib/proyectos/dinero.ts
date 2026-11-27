/**
 * Dinero de un proyecto: presupuesto, gastos e ingresos usando los MISMOS movimientos de Finanzas.
 *  - Un gasto del proyecto es un movimiento con `project_id`. No hay cuentas ni saldos aparte.
 *  - El presupuesto es informativo: no separa ni bloquea dinero de ninguna cuenta.
 *  - Los pendientes no cuentan (igual que en Finanzas) y las transferencias no son gasto ni ingreso.
 * Funciones puras (sin React): las usan el panel Dinero, el encabezado, los avisos de Centavo,
 * la conexión Centavo + Tuerca y el cierre del proyecto.
 */
import type { Project, Transaction } from "../../types/db";
import { addDays, diffDays, endOfMonth, monthKey, parseISO } from "../../utils/dates";
import { formatCOP } from "../../utils/money";

export type PeriodoPresupuesto = "total" | "mensual";

/** `projects.money` (jsonb). Todo es opcional para tolerar datos viejos o a medio llenar. */
export interface DineroProyecto {
  presupuesto?: { monto: number; periodo: PeriodoPresupuesto } | null;
  /** Cliente, emprendimiento o venta: muestra ingresos, balance y valor por hora */
  generaIngresos?: boolean;
  /** Porcentajes del presupuesto en los que avisa Centavo */
  alertas?: number[];
  /** Meta de ahorro existente con la que se paga el proyecto */
  metaAhorroId?: string | null;
}

export const ALERTAS_POR_DEFECTO = [80, 100];
export const OPCIONES_ALERTA = [50, 80, 90, 100];
/** Mínimos para mostrar la proyección y el valor por hora */
export const MIN_MOVIMIENTOS_PROYECCION = 3;
export const MIN_DIAS_PROYECCION = 14;
export const MIN_HORAS_VALOR = 5;

export interface DineroResuelto {
  presupuesto: { monto: number; periodo: PeriodoPresupuesto } | null;
  generaIngresos: boolean;
  alertas: number[];
  metaAhorroId: string | null;
}

/** Lo que dice el proyecto, con valores por defecto. Sin `money`, el «presupuesto estimado» de siempre cuenta como total. */
export function dineroDe(p: Pick<Project, "budget"> & { money?: DineroProyecto | null }): DineroResuelto {
  const m = p.money;
  const pres = m ? (m.presupuesto ?? null) : p.budget && p.budget > 0 ? { monto: p.budget, periodo: "total" as const } : null;
  const alertas = m?.alertas?.length ? [...new Set(m.alertas.filter((a) => a > 0 && a <= 200))].sort((a, b) => a - b) : ALERTAS_POR_DEFECTO;
  return {
    presupuesto: pres && pres.monto > 0 ? { monto: Math.round(pres.monto), periodo: pres.periodo === "mensual" ? "mensual" : "total" } : null,
    generaIngresos: !!m?.generaIngresos,
    alertas,
    metaAhorroId: m?.metaAhorroId ?? null,
  };
}

/**
 * Migración (versión 1 del dinero de proyectos): el «presupuesto estimado» que ya existía pasa a
 * `money.presupuesto` (total). Devuelve el cambio, o null si no hace falta. Es segura de repetir.
 */
export function migrarDineroProyecto(p: Pick<Project, "budget"> & { money?: DineroProyecto | null }): { money: DineroProyecto } | null {
  if (p.money || !p.budget || p.budget <= 0) return null;
  return { money: { presupuesto: { monto: Math.round(p.budget), periodo: "total" }, generaIngresos: false, alertas: [...ALERTAS_POR_DEFECTO] } };
}

/** Cambio a guardar en el proyecto: `money` y el `budget` de siempre (para que lo demás lo siga mostrando igual) */
export function cambioDinero(actual: DineroResuelto, cambio: Partial<DineroResuelto>): { money: DineroProyecto; budget: number | null } {
  const n = { ...actual, ...cambio };
  return {
    money: { presupuesto: n.presupuesto, generaIngresos: n.generaIngresos, alertas: n.alertas, metaAhorroId: n.metaAhorroId },
    budget: n.presupuesto?.monto ?? null,
  };
}

/** Movimientos del proyecto (sin transferencias), en el orden en que vengan */
export const deProyecto = (txs: Transaction[], proyectoId: string) => txs.filter((t) => t.project_id === proyectoId && t.type !== "transferencia");

export interface ResumenDinero {
  presupuesto: number | null;
  periodo: PeriodoPresupuesto;
  /** "total" o el mes (YYYY-MM) de un presupuesto mensual */
  clave: string;
  gastado: number;
  ingresos: number;
  balance: number;
  disponible: number | null;
  /** Porcentaje usado del presupuesto (puede pasar de 100) */
  pct: number | null;
  /** Movimientos del periodo (incluye pendientes, que no suman) */
  movimientos: Transaction[];
}

export function resumenDinero(p: Pick<Project, "id" | "budget"> & { money?: DineroProyecto | null }, txs: Transaction[], hoy: string, mes?: string): ResumenDinero {
  const d = dineroDe(p);
  const periodo = d.presupuesto?.periodo ?? "total";
  const clave = periodo === "mensual" ? (mes ?? monthKey(hoy)) : "total";
  const todos = deProyecto(txs, p.id);
  const movimientos = periodo === "mensual" ? todos.filter((t) => t.date.startsWith(clave)) : todos;
  let gastado = 0;
  let ingresos = 0;
  for (const t of movimientos) {
    if (t.status === "pendiente") continue;
    if (t.type === "gasto") gastado += Math.round(t.amount);
    else if (t.type === "ingreso") ingresos += Math.round(t.amount);
  }
  const presupuesto = d.presupuesto?.monto ?? null;
  return {
    presupuesto,
    periodo,
    clave,
    gastado,
    ingresos,
    balance: ingresos - gastado,
    disponible: presupuesto !== null ? presupuesto - gastado : null,
    pct: presupuesto ? (gastado / presupuesto) * 100 : null,
    movimientos,
  };
}

/** "64 %" con el estilo de la app (espacio fino antes del signo) */
export const porcentaje = (n: number) => `${Math.round(n)} %`;

/** Línea compacta del encabezado: "$320.000 de $500.000 · 64 %" */
export function lineaPresupuesto(r: ResumenDinero): string | null {
  if (r.presupuesto === null || r.pct === null) return null;
  return `${formatCOP(r.gastado)} de ${formatCOP(r.presupuesto)} · ${porcentaje(r.pct)}`;
}

const fechaLarga = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "UTC" }).format(parseISO(iso));

export type Proyeccion = { tipo: "llega"; fecha: string; texto: string } | { tipo: "bien"; pctFinal: number; texto: string };

/**
 * Proyección al ritmo actual. Necesita al menos 3 gastos y 14 días de datos; si no, null.
 * Con fecha de cierre (fin del mes en un presupuesto mensual, o la entrega del proyecto) dice si se
 * llega al 100 % antes; sin ella, cuándo se llegaría.
 */
export function proyeccion(p: Pick<Project, "id" | "budget" | "due_date"> & { money?: DineroProyecto | null }, txs: Transaction[], hoy: string): Proyeccion | null {
  const r = resumenDinero(p, txs, hoy);
  if (r.presupuesto === null || r.pct === null || r.pct >= 100) return null;
  const gastos = deProyecto(txs, p.id).filter((t) => t.type === "gasto" && t.status !== "pendiente" && t.date <= hoy);
  if (gastos.length < MIN_MOVIMIENTOS_PROYECCION) return null;
  const primero = gastos.reduce((m, t) => (t.date < m ? t.date : m), hoy);
  const dias = diffDays(hoy, primero) + 1;
  if (dias < MIN_DIAS_PROYECCION) return null;
  // Ritmo diario: en un mensual, lo de los últimos 30 días; en uno total, todo desde el primer gasto
  const ventana = r.periodo === "mensual" ? Math.min(30, dias) : dias;
  const desde = addDays(hoy, -(ventana - 1));
  const base = r.periodo === "mensual" ? gastos.filter((t) => t.date >= desde).reduce((n, t) => n + t.amount, 0) : r.gastado;
  const ritmo = base / ventana;
  if (ritmo <= 0) return null;
  const falta = r.presupuesto - r.gastado;
  const fecha100 = addDays(hoy, Math.max(1, Math.ceil(falta / ritmo)));
  const fin = r.periodo === "mensual" ? endOfMonth(r.clave) : p.due_date && p.due_date > hoy ? p.due_date : null;
  if (fin && fecha100 > fin) {
    const pctFinal = Math.round(((r.gastado + ritmo * diffDays(fin, hoy)) / r.presupuesto) * 100);
    return { tipo: "bien", pctFinal, texto: `Vas bien: terminarías en ${porcentaje(pctFinal)}.` };
  }
  return { tipo: "llega", fecha: fecha100, texto: `Al ritmo actual llegas al 100 % el ${fechaLarga(fecha100)}.` };
}

/** Gastos del proyecto por categoría (de mayor a menor), con la misma forma que Finanzas */
export function gastosPorCategoria(movs: Transaction[]): { name: string; value: number }[] {
  const m = new Map<string, number>();
  for (const t of movs) if (t.type === "gasto" && t.status !== "pendiente") m.set(t.category ?? "Otros", (m.get(t.category ?? "Otros") ?? 0) + t.amount);
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

/** Balance ÷ horas de enfoque (solo con 5 horas o más) */
export function valorPorHora(balance: number, horas: number): number | null {
  if (horas < MIN_HORAS_VALOR) return null;
  return Math.round(balance / horas);
}

/* ═════════ Avisos de Centavo ═════════ */

/** Umbrales que el porcentaje ya alcanzó */
export const umbralesAlcanzados = (pct: number, alertas: number[]) => alertas.filter((a) => pct >= a);

/**
 * Umbral que toca avisar ahora: el más alto ya alcanzado que no se haya avisado en este periodo.
 * (Si se cruzan dos de una vez, sale un solo aviso: el más alto.)
 */
export function umbralPorAvisar(pct: number, alertas: number[], avisados: number[]): number | null {
  const pendientes = umbralesAlcanzados(pct, alertas).filter((a) => !avisados.includes(a));
  return pendientes.length ? pendientes[pendientes.length - 1] : null;
}

/** Al bajar del umbral (subió el presupuesto o se quitó un gasto) se olvida: un nuevo cruce vuelve a avisar */
export const avisadosVigentes = (pct: number, avisados: number[]) => avisados.filter((a) => pct >= a);

export interface TextoAviso {
  pose: "pensativo" | "preocupado";
  texto: string;
  pasado: boolean;
}

/** Sin culpa: dice dónde va y qué queda. Con un día difícil (chequeo de ánimo) usa el tono tranquilo. */
export function textoAviso(nombre: string, umbral: number, r: ResumenDinero, tranquilo: boolean): TextoAviso {
  const pct = Math.round(r.pct ?? 0);
  const sobra = Math.max(0, -(r.disponible ?? 0));
  if (umbral >= 100) {
    if (tranquilo)
      return { pose: "preocupado", pasado: true, texto: sobra ? `${nombre} pasó el presupuesto por ${formatCOP(sobra)}. Cuando quieras lo revisamos con calma.` : `${nombre} llegó al presupuesto. Cuando quieras lo revisamos con calma.` };
    return {
      pose: "preocupado",
      pasado: true,
      texto: sobra ? `Nos pasamos ${formatCOP(sobra)} en ${nombre}. ¿Ajustamos el presupuesto o recortamos algo?` : `${nombre} llegó al 100 % del presupuesto. ¿Ajustamos el presupuesto o recortamos algo?`,
    };
  }
  const queda = formatCOP(Math.max(0, r.disponible ?? 0));
  if (tranquilo) return { pose: "pensativo", pasado: false, texto: `${nombre} lleva el ${porcentaje(pct)} del presupuesto. Quedan ${queda}, sin afán.` };
  return { pose: "pensativo", pasado: false, texto: `${nombre} va en ${porcentaje(pct)} del presupuesto. Quedan ${queda} para lo que falta.` };
}

/* ═════════ Cierre del proyecto ═════════ */
export interface FilaCierre {
  label: string;
  valor: string;
}

export function filasCierre(p: Pick<Project, "id" | "budget"> & { money?: DineroProyecto | null }, txs: Transaction[], hoy: string, horas: number): FilaCierre[] {
  const d = dineroDe(p);
  // El cierre mira todo el proyecto, aunque el presupuesto sea mensual
  const r = resumenDinero({ ...p, money: { ...d, presupuesto: d.presupuesto ? { ...d.presupuesto, periodo: "total" } : null } }, txs, hoy);
  const filas: FilaCierre[] = [];
  if (d.presupuesto?.periodo === "total") {
    filas.push({ label: "Presupuesto", valor: formatCOP(d.presupuesto.monto) });
    filas.push({ label: "Gastado", valor: `${formatCOP(r.gastado)} · ${porcentaje(r.pct ?? 0)}` });
  } else filas.push({ label: "Gastado en total", valor: formatCOP(r.gastado) });
  if (d.generaIngresos) {
    filas.push({ label: "Ingresos", valor: formatCOP(r.ingresos) });
    filas.push({ label: "Balance", valor: formatCOP(r.balance) });
  }
  const h = Math.round(horas * 10) / 10;
  filas.push({ label: "Horas de enfoque", valor: `${h.toLocaleString("es-CO")} h` });
  const vph = d.generaIngresos ? valorPorHora(r.balance, horas) : null;
  if (vph !== null) filas.push({ label: "Valor por hora", valor: formatCOP(vph) });
  return filas;
}

export function tituloCierre(p: Pick<Project, "name" | "id" | "budget"> & { money?: DineroProyecto | null }, txs: Transaction[], hoy: string): string {
  const d = dineroDe(p);
  const r = resumenDinero({ ...p, money: { ...d, presupuesto: d.presupuesto ? { ...d.presupuesto, periodo: "total" } : null } }, txs, hoy);
  if (d.generaIngresos && r.ingresos > 0) return r.balance >= 0 ? `${p.name} terminado y en verde` : `${p.name} terminado`;
  if (d.presupuesto?.periodo === "total" && r.pct !== null) return r.pct <= 100 ? `${p.name} terminado dentro del presupuesto` : `${p.name} terminado`;
  return `${p.name} terminado`;
}
