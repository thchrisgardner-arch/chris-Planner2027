/**
 * Orden de las tareas (Fase 2). Cada tarea tiene `sort_order` (orden manual entre sus hermanas:
 * mismo proyecto y misma tarea madre). Es el mismo en el panel del proyecto y en la lista de
 * Proyectos. También se puede ver por fecha o por prioridad sin tocar el orden manual.
 * Funciones puras.
 */
import type { Task } from "../../types/db";

export type ModoOrden = "manual" | "fecha" | "prioridad";

export const MODOS_ORDEN: { value: ModoOrden; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "fecha", label: "Por fecha" },
  { value: "prioridad", label: "Por prioridad" },
];

const PESO = { alta: 0, media: 1, baja: 2 } as const;

/** Orden manual: por sort_order; las que no lo tienen (recién creadas) van al final, por antigüedad */
export function compararManual(a: Task, b: Task) {
  const x = a.sort_order ?? Number.POSITIVE_INFINITY;
  const y = b.sort_order ?? Number.POSITIVE_INFINITY;
  if (x !== y) return x < y ? -1 : 1;
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
}

export function ordenarTareas(tareas: Task[], modo: ModoOrden = "manual"): Task[] {
  const copia = [...tareas];
  if (modo === "fecha") return copia.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || compararManual(a, b));
  if (modo === "prioridad") return copia.sort((a, b) => PESO[a.priority] - PESO[b.priority] || compararManual(a, b));
  return copia.sort(compararManual);
}

export const PASO = 1024;

/**
 * Mueve una tarea a otra posición entre sus hermanas (`hermanas`, en cualquier orden).
 * `antesDe`: id de la tarea que quedará justo después; null = al final.
 * Devuelve solo los cambios necesarios ({ id, sort_order }).
 */
export function mover(hermanas: Task[], id: string, antesDe: string | null): { id: string; sort_order: number }[] {
  const lista = ordenarTareas(hermanas).filter((t) => t.id !== id);
  const movida = hermanas.find((t) => t.id === id);
  if (!movida) return [];
  const i = antesDe ? lista.findIndex((t) => t.id === antesDe) : -1;
  lista.splice(i < 0 ? lista.length : i, 0, movida);
  return lista.map((t, k) => ({ id: t.id, sort_order: (k + 1) * PASO })).filter((c) => (hermanas.find((t) => t.id === c.id)?.sort_order ?? null) !== c.sort_order);
}

/** Mover arriba / abajo / al principio / al final (menú y Alt+↑ / Alt+↓) */
export function moverA(hermanas: Task[], id: string, a: "arriba" | "abajo" | "principio" | "final") {
  const lista = ordenarTareas(hermanas);
  const i = lista.findIndex((t) => t.id === id);
  if (i < 0) return [];
  if (a === "principio") return i === 0 ? [] : mover(hermanas, id, lista[0].id);
  if (a === "final") return i === lista.length - 1 ? [] : mover(hermanas, id, null);
  if (a === "arriba") return i === 0 ? [] : mover(hermanas, id, lista[i - 1].id);
  return i === lista.length - 1 ? [] : mover(hermanas, id, lista[i + 2]?.id ?? null);
}

/** Hermanas de una tarea: mismo proyecto y misma tarea madre */
export const hermanasDe = (todas: Task[], t: Pick<Task, "project_id" | "parent_task_id">) =>
  todas.filter((x) => (x.project_id ?? null) === (t.project_id ?? null) && (x.parent_task_id ?? null) === (t.parent_task_id ?? null));

/**
 * Migración (versión 1): numera las tareas que aún no tienen sort_order respetando el orden en que
 * se veían (el de creación). Las que ya tienen orden no se tocan.
 */
export function migrarOrden(todas: Task[]): { id: string; sort_order: number }[] {
  const grupos = new Map<string, Task[]>();
  for (const t of todas) {
    const k = `${t.project_id ?? ""}|${t.parent_task_id ?? ""}`;
    grupos.set(k, [...(grupos.get(k) ?? []), t]);
  }
  const out: { id: string; sort_order: number }[] = [];
  for (const g of grupos.values()) {
    if (g.every((t) => t.sort_order != null)) continue;
    // El orden que se veía: el del arreglo (creación); las que ya tenían número conservan su lugar relativo
    g.forEach((t, k) => {
      const v = (k + 1) * PASO;
      if (t.sort_order !== v) out.push({ id: t.id, sort_order: v });
    });
  }
  return out;
}
