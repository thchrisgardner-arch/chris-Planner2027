/**
 * Motor de mensajes de los asistentes (fase actual: reglas simples sobre los datos locales, sin IA).
 *
 * La interfaz `MotorAsistentes` está pensada para cambiar esta implementación por una llamada a la
 * API de Claude más adelante: misma entrada (id + contexto), misma salida (Mensaje).
 */
import type { Database } from "@/types/db";
import { accountBalance } from "@/modules/finance/selectors";
import { isScheduled, logFor, streak } from "@/modules/habits/selectors";
import { addDays, addMonths, bogotaHour, formatTime, monthKey, monthLabel, relativeDay } from "@/utils/dates";
import { formatKpiCOP, sum } from "@/utils/money";
import { FICHAS, type Datos, type Tono } from "./definiciones";
import type { AsistenteId, Expresion } from "./tipos";
import { animoDePuntaje, calcularSalud, poseDeAnimo, type Animo } from "./animo";
import { FRASES_ANIMO } from "./frasesAnimo";

export interface Mensaje {
  texto: string;
  expresion: Expresion;
  /** 0 = informativo · 1 = útil · 2 = aviso · 3 = urgente */
  prioridad: number;
  accion?: { label: string; href: string };
  /** Ánimo y salud del módulo (0 a 100, null sin datos) */
  animo?: Animo;
  salud?: number | null;
}

export interface ContextoAsistente {
  db: Database;
  today: string;
  tono: Tono;
  /** Minutos desde la medianoche en Bogotá (para la agenda) */
  ahoraMin?: number;
  /** Solo modo demo: fuerza la salud de un módulo para probar ánimos */
  forzarSalud?: Partial<Record<AsistenteId, number | null>>;
}

export interface MotorAsistentes {
  mensaje(id: AsistenteId, ctx: ContextoAsistente): Mensaje;
  responder(id: AsistenteId, pregunta: string, ctx: ContextoAsistente): Mensaje;
}

/* ───────── utilidades ───────── */
const t = (id: AsistenteId, regla: string, tono: Tono, d: Datos = {}) => FICHAS[id].plantillas[regla][tono](d);
const m = (texto: string, expresion: Expresion, prioridad: number, accion?: Mensaje["accion"]): Mensaje => ({ texto, expresion, prioridad, accion });
const toMin = (hhmm: string | null) => {
  if (!hhmm) return null;
  const [h, mm] = hhmm.split(":").map(Number);
  return h * 60 + (mm || 0);
};
const mesCorto = (key: string) => monthLabel(key).split(" ")[0].toLowerCase();
const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/* ───────── reglas por asistente ───────── */
function centavo({ db, today, tono }: ContextoAsistente): Mensaje {
  const key = monthKey(today);
  const prev = addMonths(key, -1);
  const gastos = db.transactions.filter((x) => x.type === "gasto");
  const delMes = gastos.filter((x) => x.date.startsWith(key));
  const ingresos = sum(db.transactions.filter((x) => x.type === "ingreso" && x.date.startsWith(key)).map((x) => x.amount));
  const totalMes = sum(delMes.map((x) => x.amount));
  const accion = { label: "Ver gastos", href: "/finanzas?tab=movimientos" };
  if (!db.transactions.length) return m(t("centavo", "sinDatos", tono), "idle", 0, { label: "Registrar", href: "/finanzas" });

  // Gasto de hoy muy por encima del promedio
  const promedio = gastos.length ? sum(gastos.map((x) => x.amount)) / gastos.length : 0;
  const altoHoy = delMes.filter((x) => x.date === today).sort((a, b) => b.amount - a.amount)[0];
  if (altoHoy && promedio && altoHoy.amount >= promedio * 2.5) return m(t("centavo", "gastoAlto", tono, { monto: formatKpiCOP(altoHoy.amount) }), "preocupado", 2, accion);

  // Categoría que sube mucho frente al mes anterior
  const porCat = (k: string) => {
    const r = new Map<string, number>();
    gastos.filter((x) => x.date.startsWith(k)).forEach((x) => r.set(x.category ?? "Otros", (r.get(x.category ?? "Otros") ?? 0) + x.amount));
    return r;
  };
  const ahora = porCat(key);
  const antes = porCat(prev);
  let peor: { cat: string; pct: number } | null = null;
  for (const [cat, v] of ahora) {
    const a = antes.get(cat) ?? 0;
    if (a >= 20_000 && v > a * 1.3) {
      const pct = Math.round((v / a - 1) * 100);
      if (!peor || pct > peor.pct) peor = { cat, pct };
    }
  }
  if (peor) return m(t("centavo", "categoriaSube", tono, { cat: peor.cat, pct: peor.pct, mes: mesCorto(prev) }), "preocupado", 2, accion);

  if (totalMes > ingresos && ingresos > 0) return m(t("centavo", "balanceNegativo", tono, { dif: formatKpiCOP(totalMes - ingresos) }), "preocupado", 2, accion);

  const cerca = db.savings_goals
    .map((g) => ({ g, pct: g.target_amount ? Math.round((g.current_amount / g.target_amount) * 100) : 0 }))
    .filter((x) => x.pct >= 80 && x.pct < 100)
    .sort((a, b) => b.pct - a.pct)[0];
  if (cerca) return m(t("centavo", "ahorroCerca", tono, { meta: cerca.g.name, pct: cerca.pct }), "feliz", 1, { label: "Ver ahorros", href: "/finanzas?tab=ahorros" });

  return m(t("centavo", "resumen", tono, { gastos: formatKpiCOP(totalMes) }), "idle", 0, accion);
}

function brote({ db, today, tono }: ContextoAsistente): Mensaje {
  const accion = { label: "Marcar hábito", href: "/salud" };
  if (!db.habits.length) return m(t("brote", "sinDatos", tono), "dormido", 0, { label: "Nuevo hábito", href: "/salud" });
  const deHoy = db.habits.filter((h) => isScheduled(h, today));
  const faltan = deHoy.filter((h) => !logFor(db.habit_logs, h.id, today));
  const rachas = db.habits.map((h) => ({ h, r: streak(h, db.habit_logs, today) })).sort((a, b) => b.r - a.r);

  const riesgo = faltan.map((h) => ({ h, r: streak(h, db.habit_logs, addDays(today, -1)) })).filter((x) => x.r >= 3).sort((a, b) => b.r - a.r)[0];
  if (riesgo && bogotaHour() >= 17) return m(t("brote", "rachaRiesgo", tono, { habito: riesgo.h.name, racha: riesgo.r }), "preocupado", 3, accion);
  if (faltan.length) return m(t("brote", "pendientes", tono, { n: faltan.length === 1 ? "1 hábito" : `${faltan.length} hábitos` }), "idle", 1, accion);
  if (deHoy.length) {
    if (rachas[0]?.r >= 5) return m(t("brote", "racha", tono, { racha: rachas[0].r, habito: rachas[0].h.name }), "feliz", 1, accion);
    return m(t("brote", "todoListo", tono), "feliz", 1, accion);
  }
  return m(t("brote", "descanso", tono), "dormido", 0);
}

function tuerca({ db, today, tono }: ContextoAsistente): Mensaje {
  const accion = { label: "Ver proyectos", href: "/proyectos" };
  if (!db.projects.length && !db.tasks.length) return m(t("tuerca", "sinDatos", tono), "idle", 0, { label: "Nuevo proyecto", href: "/proyectos" });
  const pendientes = db.tasks.filter((x) => x.status !== "completada");
  const vencida = pendientes.filter((x) => x.due_date && x.due_date < today).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0];
  if (vencida) return m(t("tuerca", "vencida", tono, { tarea: vencida.name, cuando: relativeDay(vencida.due_date!, today).toLowerCase() }), "molesto", 2, accion);

  for (const p of db.projects.filter((x) => x.status === "en_proceso")) {
    const tareas = db.tasks.filter((x) => x.project_id === p.id);
    if (!tareas.length) return m(t("tuerca", "sinTareas", tono, { proyecto: p.name }), "preocupado", 1, accion);
    const ultima = [p.created_at, ...tareas.map((x) => x.created_at)].sort().at(-1)!.slice(0, 10);
    const quieto = dias(ultima, today);
    if (quieto >= 7 && tareas.some((x) => x.status !== "completada")) return m(t("tuerca", "estancado", tono, { proyecto: p.name, dias: quieto }), "preocupado", 2, accion);
  }
  const siguiente = pendientes.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))[0];
  if (siguiente) return m(t("tuerca", "siguiente", tono, { tarea: siguiente.name }), "idle", 1, accion);
  return m(t("tuerca", "todoListo", tono), "feliz", 0, accion);
}

function tic({ db, today, tono, ahoraMin }: ContextoAsistente): Mensaje {
  const accion = { label: "Ver agenda", href: "/calendario" };
  const ahora = ahoraMin ?? bogotaHour() * 60;
  const hoy = db.calendar_events.filter((e) => e.date === today).sort((a, b) => (a.start_time ?? "99").localeCompare(b.start_time ?? "99"));
  const proximo = hoy.find((e) => {
    const s = toMin(e.start_time);
    return s !== null && s >= ahora && s - ahora <= 60;
  });
  if (proximo) {
    const hh = String(Math.floor(ahora / 60)).padStart(2, "0");
    const mm = String(ahora % 60).padStart(2, "0");
    return m(t("tic", "ahora", tono, { hora: formatTime(proximo.start_time), evento: proximo.title, ahora: formatTime(`${hh}:${mm}`) }), "preocupado", 3, accion);
  }
  // Choque de horario hoy
  const conHora = hoy.filter((e) => e.start_time);
  for (let i = 0; i < conHora.length - 1; i++) {
    const a = conHora[i];
    const b = conHora[i + 1];
    const finA = toMin(a.end_time) ?? (toMin(a.start_time)! + 60);
    if (toMin(b.start_time)! < finA) return m(t("tic", "choque", tono, { a: a.title, b: b.title }), "molesto", 2, accion);
  }
  const manana = addDays(today, 1);
  const vence =
    db.calendar_events.find((e) => e.date === manana && (e.type === "pago" || e.type === "vencimiento")) ??
    db.tasks.find((x) => x.due_date === manana && x.status !== "completada");
  if (vence) return m(t("tic", "manana", tono, { que: "title" in vence ? vence.title : vence.name }), "preocupado", 2, accion);
  if (hoy.length) {
    const primero = hoy.find((e) => e.start_time);
    return m(t("tic", "hoy", tono, { n: hoy.length === 1 ? "1 compromiso" : `${hoy.length} compromisos`, hora: primero ? formatTime(primero.start_time) : "todo el día" }), "idle", 1, accion);
  }
  if (!db.calendar_events.length) return m(t("tic", "sinDatos", tono), "idle", 0, { label: "Nuevo evento", href: "/calendario" });
  return m(t("tic", "libre", tono), "feliz", 0, accion);
}

function cima({ db, today, tono }: ContextoAsistente): Mensaje {
  const accion = { label: "Ver objetivos", href: "/objetivos" };
  const metas = db.annual_goals;
  if (!metas.length) return m(t("cima", "sinDatos", tono), "idle", 0, { label: "Nuevo objetivo", href: "/objetivos" });
  const reciente = metas.find((g) => g.status === "logrado" && g.progress >= 100);
  const avg = Math.round(metas.reduce((s, g) => s + g.progress, 0) / metas.length);
  const mesN = Number(today.slice(5, 7));
  const esperado = Math.round((mesN / 12) * 100);
  const mes = mesCorto(monthKey(today));
  if (reciente && metas.every((g) => g.progress < 100 || g === reciente)) return m(t("cima", "logrado", tono, { meta: reciente.title }), "feliz", 1, accion);
  if (avg < esperado - 10) return m(t("cima", "atrasado", tono, { pct: avg, mes }), "preocupado", 2, accion);
  if (avg > esperado + 10) return m(t("cima", "adelantado", tono, { pct: avg, mes }), "feliz", 1, accion);
  return m(t("cima", "enRitmo", tono, { pct: avg, mes }), "idle", 1, accion);
}

function antojo({ db, tono }: ContextoAsistente): Mensaje {
  const accion = { label: "Ver wishlist", href: "/wishlist" };
  const pendientes = db.wishlist_items.filter((w) => w.status !== "comprado" && w.status !== "descartado");
  if (!pendientes.length) return m(t("antojo", "sinDatos", tono), "idle", 0, { label: "Agregar deseo", href: "/wishlist" });
  const disponible = sum(db.accounts.map((a) => accountBalance(a, db.transactions)));
  const ahorro = sum(db.savings_goals.map((g) => g.current_amount));
  const libre = disponible - ahorro;
  const porPrecio = [...pendientes].sort((a, b) => a.price - b.price);
  const cabe = porPrecio.find((w) => w.price > 0 && w.price <= libre);
  if (cabe) return m(t("antojo", "alcanza", tono, { deseo: cabe.name }), "feliz", 1, accion);
  const conMeta = pendientes.find((w) => w.savings_goal_id);
  if (conMeta) {
    const g = db.savings_goals.find((x) => x.id === conMeta.savings_goal_id);
    const pct = g && conMeta.price ? Math.min(100, Math.round((g.current_amount / conMeta.price) * 100)) : 0;
    return m(t("antojo", "ahorrando", tono, { deseo: conMeta.name, pct }), "idle", 1, accion);
  }
  const w = porPrecio[0];
  return m(t("antojo", "esperar", tono, { deseo: w.name, falta: formatKpiCOP(Math.max(0, w.price - Math.max(0, libre))) }), "idle", 1, accion);
}

const REGLAS: Record<AsistenteId, (c: ContextoAsistente) => Mensaje> = { centavo, brote, tuerca, tic, cima, antojo };

/* ───────── respuestas de la barra de prueba (palabras clave simples) ───────── */
const PALABRAS: Record<AsistenteId, string[]> = {
  centavo: ["gasto", "gaste", "plata", "dinero", "ahorro", "mes", "cuanto", "presupuesto", "pago"],
  brote: ["habito", "racha", "hoy", "falta", "dia", "salud"],
  tuerca: ["tarea", "proyecto", "siguiente", "pendiente", "hacer", "avance"],
  tic: ["agenda", "hora", "evento", "hoy", "manana", "reunion", "cuando", "vence"],
  cima: ["meta", "objetivo", "avance", "2027", "vas", "porcentaje"],
  antojo: ["comprar", "compra", "deseo", "wishlist", "puedo", "alcanza", "antojo"],
};
const NO_SE: Record<Tono, string> = {
  seco: "Eso todavía no lo sé hacer.",
  motivador: "Eso aún no lo sé hacer, pero aprendo pronto.",
  tranquilo: "Por ahora no sé responder eso.",
};
const SALUDO: Record<Tono, (n: string) => string> = {
  seco: (n) => `Aquí ${n}. Pregunta rápido.`,
  motivador: (n) => `Hola, soy ${n}. ¿En qué te ayudo?`,
  tranquilo: (n) => `Hola, soy ${n}. Pregúntame por tu módulo.`,
};

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Ánimos que hablan por sí mismos cuando no hay un aviso más importante */
const ANIMO_HABLA: Animo[] = ["radiante", "preocupado", "triste", "dormido"];

export const motorLocal: MotorAsistentes = {
  mensaje(id, ctx) {
    const regla = REGLAS[id](ctx);
    const forzada = ctx.forzarSalud && id in ctx.forzarSalud;
    const salud = forzada ? (ctx.forzarSalud![id] ?? null) : calcularSalud(id, ctx.db, ctx.today).puntaje;
    const animo = animoDePuntaje(salud);
    const pose = poseDeAnimo(animo, ctx.today);
    // Los avisos (prioridad 2 o más) mandan; si no, el asistente habla y posa según su ánimo
    if (regla.prioridad >= 2 && !forzada) return { ...regla, animo, salud };
    if (ANIMO_HABLA.includes(animo) || forzada) return { texto: FRASES_ANIMO[id][animo][ctx.tono], expresion: pose, prioridad: animo === "dormido" ? 0 : 1, accion: regla.accion, animo, salud };
    return { ...regla, expresion: regla.expresion === "idle" ? pose : regla.expresion, animo, salud };
  },
  responder(id, pregunta, ctx) {
    const q = normalizar(pregunta.trim());
    if (!q) return m(NO_SE[ctx.tono], "idle", 0);
    if (/^(hola|buenas|hey|que mas)/.test(q)) return m(SALUDO[ctx.tono](FICHAS[id].nombre), "feliz", 0);
    if (PALABRAS[id].some((p) => q.includes(p))) return REGLAS[id](ctx);
    return m(NO_SE[ctx.tono], "dormido", 0);
  },
};

/** Atajo usado por la app. Cambiar `motorLocal` por un motor con IA no cambia a quien llama. */
export function getMensajeAsistente(id: AsistenteId, ctx: ContextoAsistente): Mensaje {
  return motorLocal.mensaje(id, ctx);
}
