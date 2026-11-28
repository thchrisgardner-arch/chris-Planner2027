/**
 * Presupuestos por categoría (`lifeos:presupuestos`, versión 1): un tope de gasto al mes por categoría
 * (p. ej. Alimentación $800.000). Se sincroniza entre dispositivos (user_state, clave «presupuestos») y
 * viaja en el respaldo. Cuenta los gastos completados del mes, como el resto de Finanzas.
 * Centavo avisa al llegar al 80 % y al pasarse del 100 %.
 */
import type { Database } from "../../types/db";
import { daysInMonth, monthKey } from "../../utils/dates";
import { crearAlmacen } from "../almacenLocal";

export interface DatosPresupuestos {
  version: 1;
  /** Categoría → tope mensual en pesos */
  topes: Record<string, number>;
}

export const almacenPresupuestos = crearAlmacen<DatosPresupuestos>("lifeos:presupuestos", () => ({ version: 1, topes: {} }), (c) => {
  const topes: Record<string, number> = {};
  for (const [k, v] of Object.entries((c.topes as Record<string, unknown>) ?? {})) if (typeof v === "number" && v > 0) topes[k] = v;
  return { version: 1, topes };
});

export const UMBRAL_AVISO = 80;

export type NivelPresupuesto = "ok" | "cerca" | "pasado";
export interface EstadoPresupuesto {
  categoria: string;
  tope: number;
  gastado: number;
  /** % usado (puede pasar de 100) */
  pct: number;
  nivel: NivelPresupuesto;
  restante: number;
  /** Días que quedan del mes contando hoy */
  diasRestantes: number;
  /** Cuánto se puede gastar al día de aquí a fin de mes sin pasarse (0 si ya se pasó) */
  porDia: number;
}

export function estadoPresupuestos(db: Pick<Database, "transactions">, topes: Record<string, number>, hoy: string): EstadoPresupuesto[] {
  const mes = monthKey(hoy);
  const diasRestantes = daysInMonth(mes) - Number(hoy.slice(8, 10)) + 1;
  return Object.entries(topes)
    .filter(([, tope]) => tope > 0)
    .map(([categoria, tope]) => {
      const gastado = db.transactions
        .filter((t) => t.type === "gasto" && t.status === "completado" && t.category === categoria && t.date.startsWith(mes) && t.date <= hoy)
        .reduce((s, t) => s + t.amount, 0);
      const pct = Math.round((gastado / tope) * 100);
      const restante = tope - gastado;
      return {
        categoria,
        tope,
        gastado,
        pct,
        nivel: (pct >= 100 ? "pasado" : pct >= UMBRAL_AVISO ? "cerca" : "ok") as NivelPresupuesto,
        restante,
        diasRestantes,
        porDia: restante > 0 ? Math.floor(restante / diasRestantes / 100) * 100 : 0,
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

/** El presupuesto que más necesita atención (pasado o cerca), o null */
export function presupuestoEnRiesgo(lista: EstadoPresupuesto[]): EstadoPresupuesto | null {
  return lista.find((p) => p.nivel !== "ok") ?? null;
}
