/**
 * Conexiones entre módulos: lo que solo se ve porque el dinero, los hábitos, las tareas y la agenda
 * viven juntos. Cada regla la dicen dos asistentes. Funciones puras: reciben los datos y hoy, y
 * devuelven las conexiones válidas ordenadas por prioridad (el dashboard muestra máximo 1 al día).
 */
import type { Database } from "../../types/db";
import type { AsistenteId } from "./tipos";
import { accountBalance, totalBalance } from "../../modules/finance/selectors";
import { completion } from "../../modules/habits/selectors";
import { addDays, addMonths, diffDays, monthKey, monthLabel, parseISO, startOfWeek, weekdayMon } from "../../utils/dates";
import { formatCOP } from "../../utils/money";

export interface Conexion {
  id: string;
  asistentes: [AsistenteId, AsistenteId];
  texto: string;
  accion: { label: string; href: string };
  prioridad: number;
}

/** Eventos de XP de tareas completadas (fecha) para medir tareas por semana */
export interface EntradaConexiones {
  db: Database;
  hoy: string;
  tareasCompletadas: { fecha: string }[];
}

const DIA_LARGO = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
const mesNombre = (key: string) => monthLabel(key).split(" ")[0].toLowerCase();
function cuandoTexto(fecha: string, hoy: string) {
  const d = diffDays(fecha, hoy);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d < 7) return `el ${DIA_LARGO[weekdayMon(fecha)]}`;
  return `el ${parseISO(fecha).getUTCDate()}`;
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ═════════ Reglas ═════════ */

/** Tic + Centavo: un pago fijo por salir y la cuenta no alcanza */
function pagoSinSaldo({ db, hoy }: EntradaConexiones): Conexion | null {
  const pendientes = db.transactions
    .filter((t) => t.status === "pendiente" && t.type === "gasto" && t.date >= hoy && t.date <= addDays(hoy, 2))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const t of pendientes) {
    const cuenta = db.accounts.find((a) => a.id === t.account_id);
    if (!cuenta || cuenta.type === "tarjeta_credito") continue;
    const saldo = accountBalance(cuenta, db.transactions);
    if (saldo >= t.amount) continue;
    return {
      id: `pago-sin-saldo:${t.id}`,
      asistentes: ["tic", "centavo"],
      texto: `${capital(cuandoTexto(t.date, hoy))} sale ${t.description.toLowerCase()} y ${cuenta.name} tiene ${formatCOP(t.amount - saldo)} menos de lo necesario.`,
      accion: { label: "Ver pagos fijos", href: "/finanzas?tab=fijos" },
      prioridad: 100,
    };
  }
  return null;
}

/** Tuerca + Tic: un día con muchas tareas y la agenda llena */
function agendaLlena({ db, hoy }: EntradaConexiones): Conexion | null {
  for (let k = 1; k <= 6; k++) {
    const d = addDays(hoy, k);
    const tareas = db.tasks.filter((t) => t.status !== "completada" && t.due_date === d).length;
    const eventos = db.calendar_events.filter((e) => e.date === d).length;
    if (tareas >= 3 && eventos >= 2) {
      const cuando = cuandoTexto(d, hoy);
      return {
        id: `agenda-llena:${d}`,
        asistentes: ["tuerca", "tic"],
        texto: `Tienes ${tareas} tareas para ${cuando} y ${cuando} ya está lleno de eventos (${eventos}). ¿Movemos alguna?`,
        accion: { label: "Ver tareas", href: "/proyectos" },
        prioridad: 80,
      };
    }
  }
  return null;
}

/** Antojo + Centavo: un deseo que alcanza si esperas al próximo ingreso */
function deseoEsperar({ db, hoy }: EntradaConexiones): Conexion | null {
  const ingresos = db.transactions
    .filter((t) => t.type === "ingreso" && t.status !== "pendiente" && t.date >= addDays(hoy, -45) && t.date <= hoy)
    .sort((a, b) => b.amount - a.amount);
  const sueldo = ingresos.find((t) => t.category === "Salario") ?? ingresos[0];
  if (!sueldo) return null;
  const diaPago = parseISO(sueldo.date).getUTCDate();
  let proximo = `${monthKey(hoy)}-${String(diaPago).padStart(2, "0")}`;
  if (proximo <= hoy) proximo = `${addMonths(monthKey(hoy), 1)}-${String(diaPago).padStart(2, "0")}`;
  const pendientesAntes = db.transactions.filter((t) => t.status === "pendiente" && t.type === "gasto" && t.date < proximo).reduce((n, t) => n + t.amount, 0);
  const ahorro = db.savings_goals.reduce((n, g) => n + g.current_amount, 0);
  const libre = totalBalance(db.accounts, db.transactions) - ahorro - pendientesAntes;
  const deseo = db.wishlist_items
    .filter((w) => w.status !== "comprado" && w.status !== "descartado" && w.price > Math.max(0, libre) && w.price <= Math.max(0, libre) + sueldo.amount)
    .sort((a, b) => a.price - b.price)[0];
  if (!deseo) return null;
  return {
    id: `deseo-esperar:${deseo.id}:${proximo}`,
    asistentes: ["antojo", "centavo"],
    texto: `Si esperas al ${parseISO(proximo).getUTCDate()}, compras ${deseo.name} sin tocar el ahorro.`,
    accion: { label: "Ver wishlist", href: "/wishlist" },
    prioridad: 60,
  };
}

/** Cima + Centavo: cuándo llega una meta de ahorro y cuánto se adelanta con $50.000 más al mes */
function metaRitmo({ db, hoy }: EntradaConexiones): Conexion | null {
  const EXTRA = 50_000;
  for (const g of db.savings_goals) {
    const falta = g.target_amount - g.current_amount;
    if (falta <= 0 || g.current_amount <= 0) continue;
    const meses = Math.max(1, diffDays(hoy, g.created_at.slice(0, 10)) / 30);
    const ritmo = g.current_amount / meses;
    if (ritmo <= 0) continue;
    const m1 = Math.ceil(falta / ritmo);
    const m2 = Math.ceil(falta / (ritmo + EXTRA));
    if (m2 >= m1 || m1 > 36) continue;
    const k1 = addMonths(monthKey(hoy), m1);
    const k2 = addMonths(monthKey(hoy), m2);
    return {
      id: `meta-ritmo:${g.id}`,
      asistentes: ["cima", "centavo"],
      texto: `Al ritmo actual, tu meta ${g.name} llega en ${mesNombre(k1)}. Con ${formatCOP(EXTRA)} más al mes, en ${mesNombre(k2)}.`,
      accion: { label: "Ver ahorros", href: "/finanzas?tab=ahorros" },
      prioridad: 50,
    };
  }
  return null;
}

/** Brote + Tuerca: las semanas con hábitos cumplidos terminas más tareas (con datos suficientes) */
function habitosTareas({ db, hoy, tareasCompletadas }: EntradaConexiones): Conexion | null {
  if (!db.habits.length) return null;
  const gym = db.habits.find((h) => /gym|gimnasio|entren/i.test(h.name));
  const habitos = gym ? [gym] : db.habits;
  const semanas: { cumple: boolean; tareas: number }[] = [];
  const lunes = startOfWeek(hoy);
  for (let w = 1; w <= 8; w++) {
    const ini = addDays(lunes, -7 * w);
    const fin = addDays(ini, 6);
    const pcts = habitos.map((h) => completion(h, db.habit_logs, ini, fin)).filter((c) => c.scheduled > 0);
    if (!pcts.length) continue;
    const pct = pcts.reduce((n, c) => n + c.pct, 0) / pcts.length;
    const tareas = tareasCompletadas.filter((t) => t.fecha >= ini && t.fecha <= fin).length;
    semanas.push({ cumple: pct >= 70, tareas });
  }
  const altas = semanas.filter((s) => s.cumple);
  const bajas = semanas.filter((s) => !s.cumple);
  if (altas.length < 2 || bajas.length < 2) return null;
  const prom = (x: typeof semanas) => x.reduce((n, s) => n + s.tareas, 0) / x.length;
  const a = prom(altas);
  const b = prom(bajas);
  if (b <= 0 || a / b < 1.2) return null;
  const pct = Math.round((a / b - 1) * 100);
  return {
    id: `habitos-tareas:${lunes}`,
    asistentes: ["brote", "tuerca"],
    texto: `Las semanas que cumples ${gym ? gym.name.toLowerCase() : "tus hábitos"} terminas un ${pct} % más de tareas.`,
    accion: { label: "Ver hábitos", href: "/salud?vista=habitos" },
    prioridad: 40,
  };
}

/** Brote + Centavo: cocinar más y gastar menos en domicilios */
function cocinaDomicilios({ db, hoy }: EntradaConexiones): Conexion | null {
  const cocinar = db.habits.find((h) => /cocin/i.test(h.name));
  if (!cocinar) return null;
  const mes = monthKey(hoy);
  const logs = db.habit_logs.filter((l) => l.habit_id === cocinar.id && l.date.startsWith(mes)).length;
  if (logs < 3) return null;
  const dia = hoy.slice(8);
  const anterior = addMonths(mes, -1);
  const esDomicilio = (d: string) => /domicilio|rappi|ifood|didi food|restaurante/i.test(d);
  const gasto = (desde: string, hasta: string) =>
    db.transactions.filter((t) => t.type === "gasto" && t.status !== "pendiente" && t.date >= desde && t.date <= hasta && esDomicilio(t.description)).reduce((n, t) => n + t.amount, 0);
  const ahora = gasto(`${mes}-01`, hoy);
  const antes = gasto(`${anterior}-01`, `${anterior}-${dia}`);
  if (antes <= 0 || ahora > antes * 0.8) return null;
  const pct = Math.round((1 - ahora / antes) * 100);
  return {
    id: `cocina-domicilios:${mes}`,
    asistentes: ["brote", "centavo"],
    texto: `Este mes gastaste ${pct} % menos en domicilios desde que cocinas ${logs} veces. Sigue así.`,
    accion: { label: "Ver gastos", href: "/finanzas?tab=movimientos" },
    prioridad: 30,
  };
}

const REGLAS = [pagoSinSaldo, agendaLlena, deseoEsperar, metaRitmo, habitosTareas, cocinaDomicilios];

/** Todas las conexiones válidas hoy, de mayor a menor prioridad */
export function calcularConexiones(e: EntradaConexiones): Conexion[] {
  return REGLAS.map((r) => r(e))
    .filter((c): c is Conexion => c !== null)
    .sort((a, b) => b.prioridad - a.prioridad);
}

/** Ejemplos para el panel de pruebas del modo demo */
export const CONEXIONES_DEMO: Conexion[] = [
  { id: "demo:1", asistentes: ["antojo", "centavo"], texto: "Si esperas al 15, compras los audífonos sin tocar el ahorro.", accion: { label: "Ver wishlist", href: "/wishlist" }, prioridad: 60 },
  { id: "demo:2", asistentes: ["tic", "centavo"], texto: "Mañana sale el arriendo y la cuenta tiene $80.000 menos de lo necesario.", accion: { label: "Ver pagos fijos", href: "/finanzas?tab=fijos" }, prioridad: 100 },
  { id: "demo:3", asistentes: ["brote", "tuerca"], texto: "Las semanas que cumples el gym terminas un 30 % más de tareas.", accion: { label: "Ver hábitos", href: "/salud" }, prioridad: 40 },
  { id: "demo:4", asistentes: ["cima", "centavo"], texto: "Al ritmo actual, tu meta de viaje llega en marzo. Con $50.000 más al mes, en enero.", accion: { label: "Ver ahorros", href: "/finanzas?tab=ahorros" }, prioridad: 50 },
  { id: "demo:5", asistentes: ["tuerca", "tic"], texto: "Tienes 3 tareas para el viernes y el viernes ya está lleno de eventos.", accion: { label: "Ver tareas", href: "/proyectos" }, prioridad: 80 },
  { id: "demo:6", asistentes: ["brote", "centavo"], texto: "Este mes gastaste 40 % menos en domicilios desde que cocinas 3 veces por semana.", accion: { label: "Ver gastos", href: "/finanzas" }, prioridad: 30 },
];
