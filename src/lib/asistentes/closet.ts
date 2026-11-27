/**
 * Clóset (Fase 5): accesorios que se ganan usando la app. Clave `lifeos:closet` (versionada).
 *  - Por racha (mejor racha alcanzada): 7 gafas de sol · 15 helado · 30 bufanda · 60 audífonos · 100 capa.
 *  - Por logro: dedo de espuma (Obra terminada).
 *  - De temporada: gorro navideño (se gana usando la app en diciembre y queda para siempre).
 *  - Por vínculo con cada personaje: chef 3 · patines 5 · fedora 7 · corona 10.
 * Las piezas globales (racha, logro, temporada) se guardan con su fecha; las de vínculo se calculan
 * con el vínculo de cada asistente, que nunca baja.
 * Modelo listo para packs cosméticos (fuente "pack"), sin pagos.
 */
import { crearAlmacen, type Versionado } from "@/lib/almacenLocal";
import type { LogroId } from "./progreso";
import { ACCESORIO_LABEL, type Accesorio } from "./tipos";

export type FuentePieza = "racha" | "logro" | "temporada" | "vinculo" | "pack";

export type PiezaCloset =
  | { acc: Accesorio; fuente: "racha"; dias: number }
  | { acc: Accesorio; fuente: "logro"; logro: LogroId; titulo: string }
  | { acc: Accesorio; fuente: "temporada"; mes: number; nombreMes: string }
  | { acc: Accesorio; fuente: "vinculo"; vinculo: number }
  | { acc: Accesorio; fuente: "pack"; pack: string };

export const CATALOGO_CLOSET: PiezaCloset[] = [
  { acc: "gafas-sol", fuente: "racha", dias: 7 },
  { acc: "helado", fuente: "racha", dias: 15 },
  { acc: "bufanda", fuente: "racha", dias: 30 },
  { acc: "audifonos", fuente: "racha", dias: 60 },
  { acc: "capa", fuente: "racha", dias: 100 },
  { acc: "dedo-espuma", fuente: "logro", logro: "primer-proyecto", titulo: "Obra terminada" },
  { acc: "gorro-navidad", fuente: "temporada", mes: 12, nombreMes: "diciembre" },
  { acc: "chef", fuente: "vinculo", vinculo: 3 },
  { acc: "patines", fuente: "vinculo", vinculo: 5 },
  { acc: "fedora", fuente: "vinculo", vinculo: 7 },
  { acc: "corona", fuente: "vinculo", vinculo: 10 },
];

export const piezaDe = (acc: Accesorio) => CATALOGO_CLOSET.find((p) => p.acc === acc);

export function condicionPieza(p: PiezaCloset): string {
  switch (p.fuente) {
    case "racha":
      return `Racha de ${p.dias} días`;
    case "logro":
      return `Logro «${p.titulo}»`;
    case "temporada":
      return `Usa la app en ${p.nombreMes}`;
    case "vinculo":
      return p.vinculo >= 10 ? "Vínculo 10 (Rey)" : `Vínculo ${p.vinculo}`;
    case "pack":
      return `Pack ${p.pack}`;
  }
}

/* ═════════ Almacén ═════════ */
export interface Closet extends Versionado {
  version: 1;
  /** Piezas globales ganadas: accesorio → fecha y fuente */
  piezas: Partial<Record<Accesorio, { fecha: string; fuente: FuentePieza }>>;
}

const vacio = (): Closet => ({ version: 1, piezas: {} });

export const almacenCloset = crearAlmacen<Closet>("lifeos:closet", vacio, (crudo) => {
  const piezas = (crudo.piezas && typeof crudo.piezas === "object" ? crudo.piezas : {}) as Closet["piezas"];
  const limpias: Closet["piezas"] = {};
  for (const [acc, v] of Object.entries(piezas)) if (acc in ACCESORIO_LABEL && v && typeof v.fecha === "string") limpias[acc as Accesorio] = v;
  return { version: 1, piezas: limpias };
});

export const useCloset = almacenCloset.useValor;

/** ¿Este asistente puede usar el accesorio? (los del editor de siempre siguen con sus reglas de vínculo) */
export function enCloset(acc: Accesorio, closet: Closet, vinculo: number): boolean {
  if (closet.piezas[acc]) return true;
  const p = piezaDe(acc);
  return p?.fuente === "vinculo" ? vinculo >= p.vinculo : false;
}

/** Piezas globales que se acaban de ganar con el progreso actual */
export function piezasNuevas(closet: Closet, x: { mejorRacha: number; logros: Partial<Record<LogroId, string>>; hoy: string }): PiezaCloset[] {
  const mes = Number(x.hoy.slice(5, 7));
  return CATALOGO_CLOSET.filter((p) => {
    if (closet.piezas[p.acc]) return false;
    if (p.fuente === "racha") return x.mejorRacha >= p.dias;
    if (p.fuente === "logro") return !!x.logros[p.logro];
    if (p.fuente === "temporada") return mes === p.mes;
    return false;
  });
}

export function ganarPiezas(piezas: PiezaCloset[], hoy: string) {
  if (!piezas.length) return;
  almacenCloset.cambiar((c) => ({ ...c, piezas: { ...c.piezas, ...Object.fromEntries(piezas.map((p) => [p.acc, { fecha: hoy, fuente: p.fuente }])) } }));
}

/** Solo demo: todo el clóset abierto */
export function abrirTodoElCloset(hoy: string) {
  almacenCloset.guardar({ version: 1, piezas: Object.fromEntries(CATALOGO_CLOSET.map((p) => [p.acc, { fecha: hoy, fuente: p.fuente }])) });
}
