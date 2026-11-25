import type { Priority, Project, ProjectStatus, Task, TaskStatus } from "@/types/db";

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "ideas", label: "Ideas" },
  { value: "pendiente", label: "Pendiente" },
  { value: "en_proceso", label: "En proceso" },
  { value: "en_pausa", label: "En pausa" },
  { value: "completado", label: "Completado" },
];

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_proceso", label: "En proceso" },
  { value: "completada", label: "Completada" },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];

export const PROJECT_COLORS = ["#9b82f6", "#2ee56b", "#66a9f7", "#f4a340", "#85e6a5", "#c4b5fd"];

export const projectStatusLabel = (s: ProjectStatus) => PROJECT_STATUSES.find((x) => x.value === s)?.label ?? s;
export const taskStatusLabel = (s: TaskStatus) => TASK_STATUSES.find((x) => x.value === s)?.label ?? s;
export const priorityLabel = (p: Priority) => PRIORITIES.find((x) => x.value === p)?.label ?? p;

export const priorityTone = (p: Priority) => (p === "alta" ? "warn" : p === "media" ? "info" : "neutral") as
  | "warn"
  | "info"
  | "neutral";

export const projectStatusTone = (s: ProjectStatus) =>
  (({ ideas: "neutral", pendiente: "info", en_proceso: "violet", en_pausa: "warn", completado: "brand" }) as const)[s];

/** Progreso automático: tareas completadas / tareas totales del proyecto. */
export function projectProgress(project: Project, tasks: Task[]): { pct: number; done: number; total: number } {
  const own = tasks.filter((t) => t.project_id === project.id);
  if (own.length === 0) return { pct: project.status === "completado" ? 100 : 0, done: 0, total: 0 };
  const done = own.filter((t) => t.status === "completada").length;
  return { pct: (done / own.length) * 100, done, total: own.length };
}
