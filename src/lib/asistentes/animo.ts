/**
 * Motor de salud y ánimo por módulo (0 a 100).
 *
 * Principio: el ánimo premia el COMPORTAMIENTO (registrar, cumplir, ser constante, mejorar frente a
 * uno mismo), nunca cuánto dinero hay. Las comparaciones de dinero son solo contra el propio promedio.
 */
import type { Database } from "@/types/db";
import { isScheduled, logFor, streak } from "@/modules/habits/selectors";
import { addDays, addMonths, bogotaHour, monthKey } from "@/utils/dates";
import { sum } from "@/utils/money";
import { ASISTENTE_IDS, type AsistenteId, type Pose } from "./tipos";

export type Animo = "radiante" | "feliz" | "tranquilo" | "preocupado" | "triste" | "dormido";

export const ANIMO_LABEL: Record<Animo, string> = {
  radiante: "Radiante",
  feliz: "Feliz",
  tranquilo: "Tranquilo",
  preocupado: "Preocupado",
  triste: "Triste",
  dormido: "Dormido",
};

export interface Senal {
  label: string;
  /** 0 a 1 */
  valor: number;
  peso: number;
}

export interface SaludModulo {
  id: AsistenteId;
  /** null = sin datos o inactivo */
  puntaje: number | null;
  animo: Animo;
  senales: Senal[];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function animoDePuntaje(p: number | null): Animo {
  if (p === null) return "dormido";
  if (p >= 85) return "radiante";
  if (p >= 65) return "feliz";
  if (p >= 45) return "tranquilo";
  if (p >= 25) return "preocupado";
  return "triste";
}

/** Pose base de cada ánimo. Radiante alterna orgulloso/feliz según el día. */
export function poseDeAnimo(animo: Animo, today = ""): Pose {
  switch (animo) {
    case "radiante":
      return Number(today.slice(-1)) % 2 ? "feliz" : "orgulloso";
    case "feliz":
      return "feliz";
    case "tranquilo":
      return "idle";
    case "preocupado":
      return "preocupado";
    case "triste":
      return "triste";
    default:
      return "dormido";
  }
}

function resultado(id: AsistenteId, senales: Senal[] | null): SaludModulo {
  if (!senales) return { id, puntaje: null, animo: "dormido", senales: [] };
  const total = sum(senales.map((s) => s.peso));
  const puntaje = Math.round((sum(senales.map((s) => s.valor * s.peso)) / (total || 1)) * 100);
  return { id, puntaje, animo: animoDePuntaje(puntaje), senales };
}

/* ───────── Centavo · finanzas ───────── */
function centavo(db: Database, today: string): Senal[] | null {
  if (!db.transactions.length) return null;
  const ultima = db.transactions.map((t) => t.date).sort().at(-1)!;
  const sinRegistrar = dias(ultima, today);
  if (sinRegistrar >= 7) return null; // una semana sin registrar: duerme (antes se preocupa)
  const key = monthKey(today);
  const diaMes = Number(today.slice(8, 10));
  const diasMes = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate();
  const gastoDe = (k: string) => sum(db.transactions.filter((t) => t.type === "gasto" && t.date.startsWith(k)).map((t) => t.amount));
  const ingresoDe = (k: string) => sum(db.transactions.filter((t) => t.type === "ingreso" && t.date.startsWith(k)).map((t) => t.amount));
  const previos = [1, 2, 3].map((i) => gastoDe(addMonths(key, -i))).filter((v) => v > 0);
  const promedio = previos.length ? sum(previos) / previos.length : 0;
  // Gasto del mes frente a su propio promedio, prorrateado al día de hoy
  const esperado = promedio * (diaMes / diasMes);
  const ratio = esperado ? gastoDe(key) / esperado : 0;
  const ritmo = !promedio ? 0.7 : ratio <= 0.9 ? 1 : ratio <= 1.1 ? 0.75 : ratio <= 1.3 ? 0.4 : 0.1;
  const registro = sinRegistrar <= 2 ? 1 : sinRegistrar <= 4 ? 0.55 : 0.2;
  const ahorro = ingresoDe(key) > gastoDe(key) ? 1 : 0.3;
  const vencidos = db.calendar_events.filter((e) => (e.type === "pago" || e.type === "vencimiento") && e.date < today && e.date >= addDays(today, -3)).length;
  return [
    { label: "Registros recientes", valor: registro, peso: 35 },
    { label: "Gasto frente a tu promedio", valor: ritmo, peso: 35 },
    { label: "Ahorro del mes", valor: ahorro, peso: 20 },
    { label: "Pagos al día", valor: vencidos ? 0.4 : 1, peso: 10 },
  ];
}

/* ───────── Brote · hábitos ───────── */
function brote(db: Database, today: string): Senal[] | null {
  if (!db.habits.length) return null;
  const ultimo = db.habit_logs.map((l) => l.date).sort().at(-1);
  if (!ultimo || dias(ultimo, today) >= 3) return null; // 3 días sin marcar nada: duerme
  const deHoy = db.habits.filter((h) => isScheduled(h, today));
  const hechosHoy = deHoy.filter((h) => logFor(db.habit_logs, h.id, today)).length;
  const pctHoy = deHoy.length ? hechosHoy / deHoy.length : 1;
  let prog = 0;
  let hechos = 0;
  for (let i = 1; i <= 7; i++) {
    const d = addDays(today, -i);
    for (const h of db.habits) {
      if (!isScheduled(h, d)) continue;
      prog += 1;
      if (logFor(db.habit_logs, h.id, d)) hechos += 1;
    }
  }
  const semana = prog ? hechos / prog : 0.5;
  const racha = Math.max(0, ...db.habits.map((h) => streak(h, db.habit_logs, today)));
  const tarde = bogotaHour() >= 18;
  return [
    { label: "Hábitos de hoy", valor: pctHoy, peso: tarde ? 45 : 20 },
    { label: "Racha", valor: clamp01(racha / 14), peso: 20 },
    { label: "Últimos 7 días", valor: semana, peso: tarde ? 35 : 60 },
  ];
}

/* ───────── Tuerca · proyectos ───────── */
function tuerca(db: Database, today: string): Senal[] | null {
  if (!db.projects.length && !db.tasks.length) return null;
  const pendientes = db.tasks.filter((t) => t.status !== "completada");
  const vencidas = pendientes.filter((t) => t.due_date && t.due_date < today).length;
  const hechas = db.tasks.filter((t) => t.status === "completada").length;
  const avance = db.tasks.length ? hechas / db.tasks.length : 0.5;
  const quietos = db.projects.filter((p) => {
    if (p.status !== "en_proceso") return false;
    const fechas = [p.created_at, ...db.tasks.filter((t) => t.project_id === p.id).map((t) => t.created_at)].map((f) => f.slice(0, 10)).sort();
    return dias(fechas.at(-1)!, today) >= 7;
  }).length;
  return [
    { label: "Tareas sin vencer", valor: clamp01(1 - vencidas / 4), peso: 45 },
    { label: "Tareas completadas", valor: avance, peso: 30 },
    { label: "Proyectos con movimiento", valor: clamp01(1 - quietos / 3), peso: 25 },
  ];
}

/* ───────── Tic · calendario ───────── */
function tic(db: Database, today: string): Senal[] | null {
  if (!db.calendar_events.length) return null;
  const semana = db.calendar_events.filter((e) => e.date >= today && e.date <= addDays(today, 7));
  // Choques: eventos con hora que se cruzan en los próximos 7 días
  let choques = 0;
  const porDia = new Map<string, { s: number; e: number }[]>();
  for (const ev of semana) {
    if (!ev.start_time) continue;
    const [h, m] = ev.start_time.split(":").map(Number);
    const s = h * 60 + m;
    const [eh, em] = (ev.end_time ?? ev.start_time).split(":").map(Number);
    const e = ev.end_time ? eh * 60 + em : s + 60;
    const l = porDia.get(ev.date) ?? [];
    if (l.some((x) => s < x.e && e > x.s)) choques += 1;
    l.push({ s, e });
    porDia.set(ev.date, l);
  }
  const tareasVencidasSemana = db.tasks.filter((t) => t.status !== "completada" && t.due_date && t.due_date < today && t.due_date >= addDays(today, -7)).length;
  return [
    { label: "Vencimientos a tiempo", valor: clamp01(1 - tareasVencidasSemana / 3), peso: 50 },
    { label: "Sin choques de horario", valor: clamp01(1 - choques / 2), peso: 30 },
    { label: "Agenda planeada", valor: semana.length ? 1 : 0.6, peso: 20 },
  ];
}

/* ───────── Cima · objetivos ───────── */
function cima(db: Database, today: string): Senal[] | null {
  const metas = db.annual_goals;
  if (!metas.length) return null;
  const mes = Number(today.slice(5, 7));
  const esperado = (mes / 12) * 100;
  // Cada objetivo frente al avance esperado según la fecha del año
  const vals = metas.map((g) => (g.progress >= 100 ? 1 : clamp01(0.6 + (g.progress - esperado) / 60)));
  return [{ label: "Avance frente a lo esperado", valor: sum(vals) / vals.length, peso: 100 }];
}

/* ───────── Antojo · wishlist ───────── */
function antojo(db: Database): Senal[] | null {
  const deseos = db.wishlist_items.filter((w) => w.status !== "descartado");
  if (!deseos.length) return null;
  const pendientes = deseos.filter((w) => w.status !== "comprado");
  const conMeta = pendientes.filter((w) => w.savings_goal_id).length;
  const comprados = deseos.filter((w) => w.status === "comprado");
  const planeados = comprados.filter((w) => {
    const g = db.savings_goals.find((x) => x.id === w.savings_goal_id);
    return g && g.current_amount >= w.price;
  }).length;
  return [
    { label: "Deseos con meta de ahorro", valor: pendientes.length ? conMeta / pendientes.length : 1, peso: 60 },
    { label: "Compras planificadas", valor: comprados.length ? planeados / comprados.length : 0.7, peso: 40 },
  ];
}

export function calcularSalud(id: AsistenteId, db: Database, today: string): SaludModulo {
  const s =
    id === "centavo" ? centavo(db, today) : id === "brote" ? brote(db, today) : id === "tuerca" ? tuerca(db, today) : id === "tic" ? tic(db, today) : id === "cima" ? cima(db, today) : antojo(db);
  return resultado(id, s);
}

export function calcularTodas(db: Database, today: string): Record<AsistenteId, SaludModulo> {
  return Object.fromEntries(ASISTENTE_IDS.map((id) => [id, calcularSalud(id, db, today)])) as Record<AsistenteId, SaludModulo>;
}

/** Ánimo general: promedio ponderado de los módulos activos con datos. */
export function animoGeneral(saludes: SaludModulo[]): { puntaje: number | null; animo: Animo } {
  const PESO: Record<AsistenteId, number> = { centavo: 3, brote: 3, tuerca: 2, tic: 1, cima: 2, antojo: 1 };
  const con = saludes.filter((s) => s.puntaje !== null);
  if (!con.length) return { puntaje: null, animo: "dormido" };
  const tot = sum(con.map((s) => PESO[s.id]));
  const p = Math.round(sum(con.map((s) => s.puntaje! * PESO[s.id])) / tot);
  return { puntaje: p, animo: animoDePuntaje(p) };
}

/* ───────── Histórico diario (lifeos:animo-historial, últimos 90 días) ───────── */
export const CLAVE_HISTORIAL = "lifeos:animo-historial";
export type HistorialAnimo = { version: 1; dias: Record<string, Partial<Record<AsistenteId, number | null>>> };

export function guardarHistorial(today: string, saludes: Record<AsistenteId, SaludModulo>) {
  if (typeof window === "undefined" || window.sessionStorage.getItem("lifeos-demo")) return;
  try {
    const raw = window.localStorage.getItem(CLAVE_HISTORIAL);
    const h: HistorialAnimo = raw ? JSON.parse(raw) : { version: 1, dias: {} };
    h.dias[today] = Object.fromEntries(ASISTENTE_IDS.map((id) => [id, saludes[id].puntaje]));
    const limite = addDays(today, -90);
    for (const d of Object.keys(h.dias)) if (d < limite) delete h.dias[d];
    window.localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(h));
  } catch {
    /* sin almacenamiento */
  }
}

export function leerHistorial(): HistorialAnimo {
  if (typeof window === "undefined") return { version: 1, dias: {} };
  try {
    const raw = window.localStorage.getItem(CLAVE_HISTORIAL);
    return raw ? JSON.parse(raw) : { version: 1, dias: {} };
  } catch {
    return { version: 1, dias: {} };
  }
}
