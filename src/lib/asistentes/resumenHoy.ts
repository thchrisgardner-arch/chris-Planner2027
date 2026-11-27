/** Lo que queda pendiente hoy: lo usan el pop-up de racha y los avisos al celular. */
import type { Database } from "@/types/db";
import { isScheduled, logFor } from "@/modules/habits/selectors";

export interface ResumenHoy {
  habitosHoy: number;
  habitosPendientes: number;
  /** Tareas sin completar que vencen hoy o ya vencieron */
  tareasPendientes: number;
}

export function resumenHoy(db: Database, today: string): ResumenHoy {
  const programados = db.habits.filter((h) => isScheduled(h, today, db.habit_logs));
  const habitosPendientes = programados.filter((h) => !logFor(db.habit_logs, h.id, today)).length;
  const tareasPendientes = db.tasks.filter((t) => t.status !== "completada" && t.due_date && t.due_date <= today).length;
  return { habitosHoy: programados.length, habitosPendientes, tareasPendientes };
}

/** "2 hábitos y 1 tarea" (vacío si no hay nada) */
export function textoPendientes(r: ResumenHoy) {
  const partes: string[] = [];
  if (r.habitosPendientes) partes.push(`${r.habitosPendientes} ${r.habitosPendientes === 1 ? "hábito" : "hábitos"}`);
  if (r.tareasPendientes) partes.push(`${r.tareasPendientes} ${r.tareasPendientes === 1 ? "tarea" : "tareas"}`);
  return partes.join(" y ");
}
