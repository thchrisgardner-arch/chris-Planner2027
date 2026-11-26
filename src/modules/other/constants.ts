import type { EventType, GoalArea, GoalStatus, WishClassification, WishStatus } from "@/types/db";

/* ── Wishlist ── */
export const WISH_CATEGORIES = ["Tecnología", "Ropa", "Accesorios", "Hogar", "Experiencias", "Viajes", "Educación", "Otros"];

export const WISH_CLASSIFICATIONS: { value: WishClassification; label: string }[] = [
  { value: "necesidad", label: "Necesidad" },
  { value: "gusto", label: "Gusto personal" },
  { value: "inversion", label: "Inversión" },
  { value: "experiencia", label: "Experiencia" },
];

export const WISH_STATUSES: { value: WishStatus; label: string }[] = [
  { value: "en_consideracion", label: "En consideración" },
  { value: "ahorrando", label: "Ahorrando" },
  { value: "listo", label: "Listo para comprar" },
  { value: "comprado", label: "Comprado" },
  { value: "descartado", label: "Descartado" },
];

export const wishStatusLabel = (s: WishStatus) => WISH_STATUSES.find((x) => x.value === s)?.label ?? s;
export const wishStatusTone = (s: WishStatus) =>
  (({ en_consideracion: "neutral", ahorrando: "info", listo: "brand", comprado: "violet", descartado: "neutral" }) as const)[s];

/* ── Objetivos ── */
export const GOAL_AREAS: { value: GoalArea; label: string; color: string }[] = [
  { value: "finanzas", label: "Finanzas", color: "#2ee56b" },
  { value: "profesional", label: "Profesional", color: "#9b82f6" },
  { value: "salud", label: "Salud", color: "#85e6a5" },
  { value: "personal", label: "Personal", color: "#f4a340" },
  { value: "aprendizaje", label: "Aprendizaje", color: "#66a9f7" },
  { value: "experiencias", label: "Experiencias", color: "#c4b5fd" },
  { value: "vehiculo", label: "Vehículo", color: "#5b6b7f" },
  { value: "viajes", label: "Viajes", color: "#38bdf8" },
  { value: "hogar", label: "Hogar", color: "#d4a373" },
  { value: "familia", label: "Familia", color: "#f472b6" },
  { value: "negocio", label: "Negocio", color: "#0ea5a4" },
  { value: "mascotas", label: "Mascotas", color: "#fbbf24" },
  { value: "espiritualidad", label: "Espiritualidad", color: "#a78bfa" },
];

export const GOAL_STATUSES: { value: GoalStatus; label: string }[] = [
  { value: "no_iniciado", label: "No iniciado" },
  { value: "en_progreso", label: "En progreso" },
  { value: "logrado", label: "Logrado" },
  { value: "pausado", label: "Pausado" },
];

export const goalArea = (a: GoalArea) => GOAL_AREAS.find((x) => x.value === a) ?? GOAL_AREAS[0];

/* ── Calendario ── */
/** Cada tipo tiene un punto de color, un fondo pastel y un texto legible sobre ese fondo. */
export const EVENT_TYPES: { value: EventType; label: string; color: string; bg: string; fg: string }[] = [
  { value: "personal", label: "Personal", color: "#66a9f7", bg: "#dcebff", fg: "#1e3a8a" },
  { value: "entrenamiento", label: "Entrenamiento", color: "#2ee56b", bg: "#d6f5e1", fg: "#14532d" },
  { value: "pago", label: "Pago", color: "#f4a340", bg: "#ffe8d1", fg: "#8a4b0b" },
  { value: "vencimiento", label: "Vencimiento", color: "#f0716b", bg: "#ffdfe3", fg: "#9f1239" },
  { value: "otro", label: "Otro", color: "#9ba59d", bg: "#ececea", fg: "#3b423d" },
];

/** Estilos de lo que no es un evento pero aparece en el calendario. */
export const CALENDAR_EXTRA = {
  tarea: { label: "Tarea", color: "#9b82f6", bg: "#ebe5ff", fg: "#4c1d95" },
  meta: { label: "Meta / objetivo", color: "#a3d65c", bg: "#eef7d6", fg: "#3f6212" },
  habito: { label: "Hábito", color: "#85e6a5", bg: "#e3f8ea", fg: "#14532d" },
} as const;

export const eventType = (t: EventType) => EVENT_TYPES.find((x) => x.value === t) ?? EVENT_TYPES[0];
