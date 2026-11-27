/**
 * Reuniones de un proyecto (Paneles, Fase A). Una reunión ES un evento del calendario
 * (calendar_events) con `project_id` y datos extra en `meeting`: modalidad, enlace o lugar,
 * asistentes, agenda, notas y acuerdos. La fecha y la hora viven solo en el evento, así lo que se
 * cambia en el calendario general se ve en el proyecto y al revés.
 * La nota de voz vinculada es una nota de voz con `reunionId` = id del evento.
 */
import type { CalendarEvent, NewRow } from "@/types/db";
import type { Modalidad, Reunion } from "./espacio";

export interface Acuerdo {
  id: string;
  texto: string;
  /** Tarea creada desde el acuerdo («Volver tarea») */
  tareaId?: string | null;
}

export interface DatosReunion {
  modalidad: Modalidad;
  enlace: string;
  lugar: string;
  participantes: string[];
  agenda: string;
  notas: string;
  acuerdos: Acuerdo[];
  /** Reunión del espacio de la que salió (migración): evita duplicarla si la migración se repite */
  origen?: string;
}

export type ReunionEvento = CalendarEvent & { project_id: string; meeting: DatosReunion };

export const esReunion = (e: CalendarEvent): e is ReunionEvento => !!e.project_id && !!e.meeting;

export const PREFIJO = "Reunión: ";
/** En el calendario general el título lleva «Reunión: »; en el proyecto, solo el nombre */
export const tituloReunion = (e: Pick<CalendarEvent, "title">) => (e.title.startsWith(PREFIJO) ? e.title.slice(PREFIJO.length) : e.title);

/** Texto que ve el calendario general en las notas del evento */
export function notasEvento(proyecto: string, d: Pick<DatosReunion, "modalidad" | "enlace" | "lugar" | "agenda">) {
  return [`Proyecto: ${proyecto}`, d.modalidad === "video" && d.enlace ? `Enlace: ${d.enlace}` : "", d.modalidad === "presencial" && d.lugar ? `Lugar: ${d.lugar}` : "", d.agenda.trim()]
    .filter(Boolean)
    .join("\n");
}

/* ═════════ Cuenta regresiva (hora de Bogotá) ═════════ */
function minutosHasta(fecha: string, hora: string | null, ahora: number) {
  const objetivo = new Date(`${fecha}T${hora || "00:00"}:00-05:00`).getTime();
  return Math.round((objetivo - ahora) / 60000);
}

export function cuenta(e: Pick<CalendarEvent, "date" | "start_time" | "end_time">, ahora = Date.now()): { texto: string; tono: "ahora" | "pronto" | "luego" | "pasada" } {
  const m = minutosHasta(e.date, e.start_time, ahora);
  const fin = minutosHasta(e.date, e.end_time || e.start_time || "23:59", ahora);
  if (m <= 0 && fin >= 0) return { texto: "Ahora", tono: "ahora" };
  if (fin < 0) return { texto: "Terminó", tono: "pasada" };
  if (m < 60) return { texto: `En ${m} min`, tono: "pronto" };
  if (m < 60 * 24) return { texto: `En ${Math.round(m / 60)} h`, tono: "pronto" };
  const d = Math.round(m / (60 * 24));
  return { texto: d === 1 ? "Mañana" : `En ${d} días`, tono: "luego" };
}

export const ordenarReuniones = (a: CalendarEvent, b: CalendarEvent) => `${a.date}${a.start_time ?? ""}`.localeCompare(`${b.date}${b.start_time ?? ""}`);

/* ═════════ Migración: reuniones del espacio → eventos ═════════ */
export interface PlanMigracion {
  actualizar: { eventoId: string; reunionId: string; patch: Partial<NewRow<"calendar_events">> }[];
  crear: { reunionId: string; fila: NewRow<"calendar_events"> }[];
  /** Reuniones que ya tenían su evento migrado (la migración se repitió) */
  hechas: Record<string, string>;
}

const datosDe = (r: Reunion): DatosReunion => ({
  modalidad: r.modalidad,
  enlace: r.enlace,
  lugar: r.lugar,
  participantes: r.participantes,
  agenda: r.agenda,
  notas: "",
  acuerdos: [],
  origen: r.id,
});

export function planMigracionReuniones(reuniones: Reunion[], eventos: CalendarEvent[], proyectos: { id: string; name: string }[]): PlanMigracion {
  const plan: PlanMigracion = { actualizar: [], crear: [], hechas: {} };
  const porOrigen = new Map(eventos.filter((e) => e.meeting?.origen).map((e) => [e.meeting!.origen!, e.id]));
  const ids = new Set(eventos.map((e) => e.id));
  for (const r of reuniones) {
    const ya = porOrigen.get(r.id);
    if (ya) {
      plan.hechas[r.id] = ya;
      continue;
    }
    const nombre = proyectos.find((p) => p.id === r.proyectoId)?.name ?? "";
    const datos = datosDe(r);
    const base = {
      title: `${PREFIJO}${r.titulo}`,
      date: r.fecha,
      start_time: r.inicio || null,
      end_time: r.fin || null,
      notes: notasEvento(nombre, datos),
      project_id: r.proyectoId,
      meeting: datos,
    };
    if (r.eventoId && ids.has(r.eventoId)) plan.actualizar.push({ eventoId: r.eventoId, reunionId: r.id, patch: base });
    else plan.crear.push({ reunionId: r.id, fila: { ...base, type: "personal" } });
  }
  return plan;
}
