/**
 * Resumen del domingo (paso «Tu semana en cifras» de la revisión semanal): gasto de los últimos 7 días
 * frente a los 7 anteriores, entrenamientos de la semana y la meta de ahorro más cerca de cumplirse.
 * Se usan los últimos 7 días (no la semana de calendario) porque la revisión también se abre el lunes.
 * Función pura.
 */
import type { Database } from "../../types/db";
import { addDays, startOfWeek, weekdayMon } from "../../utils/dates";
import { habitoDeEntreno } from "../salud/entrenamiento";
import { diasDeSemana, rachaSemanasEntreno } from "../salud/semanaEntreno";
import { esFlexible } from "../../modules/habits/selectors";

export interface ResumenSemanal {
  gasto: number;
  gastoAnterior: number;
  /** % de cambio frente a los 7 días anteriores (null si antes no hubo gastos) */
  variacion: number | null;
  entreno: { hechos: number; meta: number; rachaSemanas: number } | null;
  meta: { nombre: string; pct: number; falta: number } | null;
}

export function resumenSemanal(db: Database, hoy: string): ResumenSemanal {
  const gastoEntre = (desde: string, hasta: string) =>
    db.transactions.filter((t) => t.type === "gasto" && t.status !== "pendiente" && t.date >= desde && t.date <= hasta).reduce((s, t) => s + t.amount, 0);
  const gasto = gastoEntre(addDays(hoy, -6), hoy);
  const gastoAnterior = gastoEntre(addDays(hoy, -13), addDays(hoy, -7));
  const variacion = gastoAnterior > 0 ? Math.round(((gasto - gastoAnterior) / gastoAnterior) * 100) : null;

  // Entrenamiento: la semana que termina (si es lunes, la semana pasada; si no, la actual)
  const h = habitoDeEntreno(db.habits);
  let entreno: ResumenSemanal["entreno"] = null;
  if (h) {
    const lunes = weekdayMon(hoy) === 0 ? addDays(startOfWeek(hoy), -7) : startOfWeek(hoy);
    const dias = diasDeSemana(h, db.habit_logs, lunes, hoy);
    const meta = esFlexible(h) ? h.weekly_target! : dias.filter((d) => d.planeado).length;
    if (meta > 0) entreno = { hechos: dias.filter((d) => d.hecho).length, meta, rachaSemanas: rachaSemanasEntreno(h, db.habit_logs, hoy).actual };
  }

  // Meta de ahorro más cerca de cumplirse (sin contar las ya cumplidas)
  const cerca = db.savings_goals
    .filter((g) => g.target_amount > 0 && g.current_amount < g.target_amount)
    .map((g) => ({ nombre: g.name, pct: Math.floor((g.current_amount / g.target_amount) * 100), falta: g.target_amount - g.current_amount }))
    .sort((a, b) => b.pct - a.pct)[0];

  return { gasto, gastoAnterior, variacion, entreno, meta: cerca ?? null };
}
