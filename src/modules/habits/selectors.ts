import type { Habit, HabitLog } from "@/types/db";
import { addDays, weekdayMon } from "@/utils/dates";

export const HABIT_COLORS = ["#2ee56b", "#85e6a5", "#66a9f7", "#9b82f6", "#f4a340"];

export function isScheduled(habit: Habit, iso: string) {
  return habit.days.includes(weekdayMon(iso));
}

export function logFor(logs: HabitLog[], habitId: string, iso: string) {
  return logs.find((l) => l.habit_id === habitId && l.date === iso);
}

/** Racha: días programados consecutivos cumplidos. Si hoy aún no se marca, cuenta desde ayer. */
export function streak(habit: Habit, logs: HabitLog[], today: string): number {
  const done = new Set(logs.filter((l) => l.habit_id === habit.id).map((l) => l.date));
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

/** % de cumplimiento entre dos fechas sobre los días programados. */
export function completion(habit: Habit, logs: HabitLog[], from: string, to: string) {
  const done = new Set(logs.filter((l) => l.habit_id === habit.id).map((l) => l.date));
  let scheduled = 0;
  let completed = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isScheduled(habit, d)) continue;
    scheduled++;
    if (done.has(d)) completed++;
  }
  return { scheduled, completed, pct: scheduled ? (completed / scheduled) * 100 : 0 };
}
