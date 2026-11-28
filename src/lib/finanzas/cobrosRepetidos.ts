/**
 * Suscripciones olvidadas: cobros que se repiten cada mes en los movimientos (Netflix, Spotify, gimnasio…)
 * y que no están registrados como gasto fijo. Un concepto cuenta si:
 *  - se cobró al menos 2 veces, con unos 30 días entre cobros (24 a 38),
 *  - el monto es parecido cada vez (±15 % del monto típico),
 *  - el último cobro fue hace menos de 40 días (sigue activo).
 * El concepto se reconoce con la misma normalización de «¿En qué se va tu plata?». Funciones puras.
 */
import type { Transaction } from "../../types/db";
import { diffDays, parseISO } from "../../utils/dates";
import { crearAlmacen } from "../almacenLocal";
import { normalizarConcepto } from "./conceptos";

export interface CobroRepetido {
  clave: string;
  nombre: string;
  /** Monto típico (mediana) de cada cobro */
  monto: number;
  veces: number;
  /** Último cobro (YYYY-MM-DD) y su movimiento */
  ultimo: string;
  ultimoId: string;
  /** Día del mes del último cobro (para registrarlo como gasto fijo) */
  dia: number;
  alAnio: number;
  categoria: string | null;
  cuentaId: string;
}

const mediana = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** `excluir`: claves (normalizadas) que ya son gasto fijo o que la persona marcó como «no es fijo» */
export function cobrosRepetidos(txs: Transaction[], hoy: string, excluir: Set<string> = new Set()): CobroRepetido[] {
  const grupos = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.type !== "gasto" || t.status !== "completado" || t.date > hoy || diffDays(hoy, t.date) > 400) continue;
    const clave = normalizarConcepto(t.description);
    if (clave === "sin descripcion" || excluir.has(clave)) continue;
    grupos.set(clave, [...(grupos.get(clave) ?? []), t]);
  }
  const out: CobroRepetido[] = [];
  for (const [clave, lista] of grupos) {
    if (lista.length < 2) continue;
    const orden = [...lista].sort((a, b) => a.date.localeCompare(b.date));
    const ultimo = orden[orden.length - 1];
    if (diffDays(hoy, ultimo.date) > 40) continue;
    const mensual = orden.slice(1).every((t, i) => {
      const d = diffDays(t.date, orden[i].date);
      return d >= 24 && d <= 38;
    });
    if (!mensual) continue;
    const monto = mediana(orden.map((t) => t.amount));
    if (!orden.every((t) => Math.abs(t.amount - monto) <= monto * 0.15)) continue;
    out.push({
      clave,
      nombre: capital(clave),
      monto: Math.round(monto),
      veces: orden.length,
      ultimo: ultimo.date,
      ultimoId: ultimo.id,
      dia: parseISO(ultimo.date).getUTCDate(),
      alAnio: Math.round(monto) * 12,
      categoria: ultimo.category,
      cuentaId: ultimo.account_id,
    });
  }
  return out.sort((a, b) => b.alAnio - a.alAnio);
}

/** Conceptos que la persona marcó como «no es un gasto fijo» (`lifeos:cobros-ignorados`, solo en este dispositivo) */
export const almacenCobrosIgnorados = crearAlmacen<{ version: 1; claves: string[] }>("lifeos:cobros-ignorados", () => ({ version: 1, claves: [] }), (c) => ({
  version: 1,
  claves: Array.isArray(c.claves) ? (c.claves as string[]) : [],
}));
