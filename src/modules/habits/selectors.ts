import type { Habit, HabitLog } from "@/types/db";
import { addDays, fechaLocal, startOfWeek, weekdayMon } from "@/utils/dates";

export const HABIT_COLORS = ["#2ee56b", "#85e6a5", "#66a9f7", "#9b82f6", "#f4a340"];

/**
 * Frecuencia de un hábito:
 *  - Días fijos (lo de siempre): `days` dice qué días toca.
 *  - «X veces por semana» (`weekly_target`): cualquier día sirve; la semana (lunes a domingo) se
 *    cumple al llegar a la cantidad. Sin `weekly_target`, el hábito es de días fijos (así quedan los
 *    que ya existían).
 */
export const esFlexible = (habit: Pick<Habit, "weekly_target">) => !!habit.weekly_target && habit.weekly_target > 0;

const fechasDe = (logs: HabitLog[], habitId: string) => new Set(logs.filter((l) => l.habit_id === habitId).map((l) => l.date));

/** Veces registradas en la semana (lunes a domingo) de `iso` */
export function vecesEnSemana(habit: Habit, logs: HabitLog[], iso: string) {
  const ini = startOfWeek(iso);
  const fin = addDays(ini, 6);
  return logs.filter((l) => l.habit_id === habit.id && l.date >= ini && l.date <= fin).length;
}

/**
 * ¿Toca el hábito ese día? En días fijos, si el día está en `days`. En «X veces por semana», mientras
 * la semana no se haya cumplido antes de ese día (o si ese día ya se marcó). Sin registros (`logs`),
 * un hábito flexible cuenta como posible todos los días.
 */
export function isScheduled(habit: Habit, iso: string, logs?: HabitLog[]) {
  if (!esFlexible(habit)) return habit.days.includes(weekdayMon(iso));
  if (!logs) return true;
  const ini = startOfWeek(iso);
  let antes = 0;
  for (const l of logs) {
    if (l.habit_id !== habit.id || l.date < ini || l.date > iso) continue;
    if (l.date === iso) return true;
    antes++;
  }
  return antes < habit.weekly_target!;
}

export function logFor(logs: HabitLog[], habitId: string, iso: string) {
  return logs.find((l) => l.habit_id === habitId && l.date === iso);
}

/**
 * Racha. Días fijos: días programados consecutivos cumplidos (si hoy aún no se marca, cuenta desde
 * ayer). «X veces por semana»: las veces de las semanas seguidas que se cumplieron, más las de la
 * semana en curso (que no rompe la racha mientras no termine).
 */
export function streak(habit: Habit, logs: HabitLog[], today: string): number {
  const done = fechasDe(logs, habit.id);
  if (esFlexible(habit)) {
    const meta = habit.weekly_target!;
    const enSemana = (ini: string) => {
      let n = 0;
      for (let k = 0; k < 7; k++) {
        const d = addDays(ini, k);
        if (d <= today && done.has(d)) n++;
      }
      return n;
    };
    const lunes = startOfWeek(today);
    let count = enSemana(lunes);
    for (let w = 1; w <= 60; w++) {
      const n = enSemana(addDays(lunes, -7 * w));
      if (n < meta) break;
      count += n;
    }
    return count;
  }
  if (habit.days.length === 0) return 0;
  let day = today;
  if (!done.has(today)) day = addDays(today, -1);
  let count = 0;
  for (let i = 0; i < 400; i++) {
    if (isScheduled(habit, day)) {
      if (!done.has(day)) break;
      count++;
    }
    day = addDays(day, -1);
  }
  return count;
}

/**
 * % de cumplimiento entre dos fechas. Días fijos: sobre los días programados. «X veces por semana»:
 * cada semana pide su cantidad (proporcional si la semana entra a medias en el rango); la semana en
 * curso no resta mientras no termine.
 */
export function completion(habit: Habit, logs: HabitLog[], from: string, to: string) {
  const done = fechasDe(logs, habit.id);
  let scheduled = 0;
  let completed = 0;
  // No cuenta días anteriores a que existiera el hábito (salvo que tenga registros más viejos, p. ej. importados)
  const primero = [fechaLocal(habit.created_at), ...done].sort()[0];
  const inicio = primero > from ? primero : from;
  if (esFlexible(habit)) {
    const meta = habit.weekly_target!;
    for (let sem = startOfWeek(inicio); sem <= to; sem = addDays(sem, 7)) {
      const ini = sem < inicio ? inicio : sem;
      const finSem = addDays(sem, 6);
      const fin = finSem > to ? to : finSem;
      let n = 0;
      let dias = 0;
      for (let d = ini; d <= fin; d = addDays(d, 1)) {
        dias++;
        if (done.has(d)) n++;
      }
      const enCurso = finSem > to;
      const pide = enCurso ? Math.min(meta, n) : Math.round((meta * dias) / 7);
      scheduled += pide;
      completed += Math.min(n, pide);
    }
    return { scheduled, completed, pct: scheduled ? (completed / scheduled) * 100 : 0 };
  }
  for (let d = inicio; d <= to; d = addDays(d, 1)) {
    if (!isScheduled(habit, d)) continue;
    scheduled++;
    if (done.has(d)) completed++;
  }
  return { scheduled, completed, pct: scheduled ? (completed / scheduled) * 100 : 0 };
}
