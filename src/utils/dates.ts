/**
 * Fechas en Poku Poku: siempre se trabaja con strings "YYYY-MM-DD" en hora de Bogotá,
 * así un movimiento del 31 a las 11 p. m. no salta al mes siguiente.
 */
export const TIMEZONE = "America/Bogota";

const isoFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayISO(now: Date = new Date()): string {
  return isoFmt.format(now);
}

/**
 * Día (YYYY-MM-DD, hora de Bogotá) de una marca de tiempo ISO como `created_at`.
 * `iso.slice(0, 10)` da el día en UTC: lo hecho después de las 7 p. m. caería al día siguiente.
 */
export function fechaLocal(iso: string): string {
  if (iso.length <= 10) return iso;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : todayISO(d);
}

export function bogotaHour(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", hourCycle: "h23" }).format(now),
  );
}

/** Crea un Date al mediodía UTC para operar con días sin problemas de zona. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86_400_000);
}

/** 0 = lunes … 6 = domingo */
export function weekdayMon(iso: string): number {
  return (parseISO(iso).getUTCDay() + 6) % 7;
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayMon(iso));
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function addMonths(key: string, n: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  return toISO(d).slice(0, 7);
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function endOfMonth(key: string): string {
  return `${key}-${String(daysInMonth(key)).padStart(2, "0")}`;
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const WEEKDAYS_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
export const WEEKDAYS_MED = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function monthShort(key: string): string {
  return MONTHS_SHORT[Number(key.slice(5, 7)) - 1];
}

export function monthLabel(key: string): string {
  const m = MONTHS_LONG[Number(key.slice(5, 7)) - 1];
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${key.slice(0, 4)}`;
}

export function formatLongDate(iso: string): string {
  const d = parseISO(iso);
  const s = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatShortDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/** "Hoy", "Mañana", "Ayer", "En 3 días", "Hace 2 días", o fecha corta */
export function relativeDay(iso: string, today: string = todayISO()): string {
  const diff = diffDays(iso, today);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  if (diff > 1 && diff <= 6) return `En ${diff} días`;
  if (diff < -1 && diff >= -6) return `Hace ${-diff} días`;
  return formatShortDate(iso);
}

export function formatTime(t: string | null | undefined): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "p. m." : "a. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}
