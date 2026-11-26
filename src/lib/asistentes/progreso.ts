/**
 * XP, niveles, vínculos, racha y logros (lógica pura, sin React).
 *
 * Los módulos no se tocan: `reconciliar` compara los datos actuales con los eventos de XP guardados.
 * Cada evento lleva el `refId` del elemento que lo originó (movimiento, registro de hábito, tarea…):
 *  - si el elemento se borra o se desmarca, el evento desaparece y su XP se revierte;
 *  - el mismo refId nunca suma dos veces;
 *  - los topes diarios se respetan por grupo de acción.
 * La fecha de un evento es la del registro (created_at), no la que el usuario escribe, para que no
 * se pueda rellenar el pasado.
 */
import type { Database } from "@/types/db";
import { isScheduled } from "@/modules/habits/selectors";
import { addDays, addMonths, fechaLocal, monthKey, weekdayMon } from "@/utils/dates";
import { sum } from "@/utils/money";
import { ASISTENTE_IDS, type AsistenteId } from "./tipos";

/* ═════════ Tabla de XP ═════════ */
export type TipoAccion =
  | "movimiento"
  | "ingreso"
  | "mes-verde"
  | "mes-rojo"
  | "habito"
  | "dia-perfecto"
  | "tarea"
  | "tarea-a-tiempo"
  | "proyecto"
  | "aporte-ahorro"
  | "meta-ahorro"
  | "avance-objetivo"
  | "objetivo"
  | "compra-planificada"
  | "revision-semanal"
  | "mision"
  | "misiones-dia"
  | "meta-diaria"
  | "hito-racha"
  | "reparar-racha"
  | "enfoque";

export const TABLA_XP: Record<TipoAccion, { xp: number; label: string; asistente: AsistenteId | "principal"; grupo: string; tope?: number }> = {
  movimiento: { xp: 5, label: "Registrar un gasto o una transferencia", asistente: "centavo", grupo: "movimiento", tope: 30 },
  ingreso: { xp: 10, label: "Registrar un ingreso", asistente: "centavo", grupo: "ingreso", tope: 20 },
  "mes-verde": { xp: 100, label: "Cerrar el mes en verde (ganaste más de lo que gastaste)", asistente: "centavo", grupo: "balance" },
  "mes-rojo": { xp: -50, label: "Cerrar el mes en rojo (gastaste más de lo que ganaste)", asistente: "centavo", grupo: "balance" },
  habito: { xp: 10, label: "Completar un hábito", asistente: "brote", grupo: "habito" },
  "dia-perfecto": { xp: 20, label: "Día perfecto", asistente: "brote", grupo: "dia-perfecto", tope: 20 },
  tarea: { xp: 10, label: "Completar una tarea", asistente: "tuerca", grupo: "tarea", tope: 80 },
  "tarea-a-tiempo": { xp: 5, label: "Tarea a tiempo (bonus)", asistente: "tic", grupo: "tarea", tope: 80 },
  proyecto: { xp: 50, label: "Terminar un proyecto", asistente: "tuerca", grupo: "proyecto" },
  "aporte-ahorro": { xp: 15, label: "Aporte a una meta de ahorro", asistente: "centavo", grupo: "aporte-ahorro", tope: 15 },
  "meta-ahorro": { xp: 100, label: "Meta de ahorro completada", asistente: "centavo", grupo: "meta-ahorro" },
  "avance-objetivo": { xp: 15, label: "Avance en un objetivo 2027", asistente: "cima", grupo: "avance-objetivo", tope: 15 },
  objetivo: { xp: 150, label: "Objetivo 2027 completado", asistente: "cima", grupo: "objetivo" },
  "compra-planificada": { xp: 30, label: "Comprar un deseo con su meta lista", asistente: "antojo", grupo: "compra-planificada" },
  "revision-semanal": { xp: 25, label: "Revisión semanal", asistente: "principal", grupo: "revision-semanal" },
  mision: { xp: 10, label: "Completar una misión del día", asistente: "principal", grupo: "mision" },
  "misiones-dia": { xp: 20, label: "Completar las 3 misiones del día (bonus)", asistente: "principal", grupo: "mision" },
  "meta-diaria": { xp: 10, label: "Cumplir tu meta diaria de XP", asistente: "principal", grupo: "meta-diaria" },
  "hito-racha": { xp: 0, label: "Llegar a un hito de racha (3, 7, 14, 30… días): de +10 a +500 XP", asistente: "brote", grupo: "racha" },
  "reparar-racha": { xp: -100, label: "Reparar la racha (por cada día perdido)", asistente: "principal", grupo: "racha" },
  enfoque: { xp: 10, label: "Completar un bloque de enfoque (máx. 4 al día)", asistente: "tuerca", grupo: "enfoque", tope: 40 },
};

/** Tipos que salen de las misiones y la meta: no cuentan para la meta diaria (evita el círculo) */
const TIPOS_DEL_DIA: TipoAccion[] = ["mision", "misiones-dia", "meta-diaria"];

export type EventoXP = { id: string; tipo: TipoAccion; xp: number; fecha: string; refId: string; asistente: AsistenteId };

/* ═════════ Logros ═════════ */
export type LogroId =
  | "primer-movimiento"
  | "racha-7"
  | "racha-30"
  | "racha-100"
  | "mes-verde"
  | "habitos-50"
  | "dia-perfecto"
  | "primer-proyecto"
  | "diez-tareas"
  | "sin-vencidas"
  | "agenda-al-dia"
  | "cero-tarde"
  | "primer-objetivo"
  | "primera-meta-ahorro"
  | "compra-planificada"
  | "nivel-10"
  | "nivel-20"
  | "leyenda"
  | "meta-7"
  | "misiones-30";

export interface Progreso {
  version: 1;
  /** Fuente de verdad: el XP total, los niveles y los vínculos se derivan de aquí */
  eventos: EventoXP[];
  racha: {
    actual: number;
    mejor: number;
    ultimoDia: string;
    protectores: number;
    diasActivos: string[];
    usados: string[];
    inicio?: string;
    reparados?: string[];
  };
  logros: Partial<Record<LogroId, string>>;
  ajustes: {
    gamificacion: boolean;
    celebraciones: "todas" | "solo-grandes" | "ninguna";
    negativas: boolean;
    saludo: boolean;
    metaDiaria: number;
    sonido: boolean;
    vibracion: boolean;
  };
  /** Último valor visto de ahorro y avance (para detectar aportes y avances) */
  snap: { ahorro: Record<string, number>; objetivos: Record<string, number> };
  /** Eventos de más de 90 días compactados por mes y tipo:asistente */
  historico: Record<string, Record<string, number>>;
  compactados: string[];
  /** nivelMax: el nivel nunca baja aunque el XP total caiga (mes en rojo). ultimoSaludo: día del pop-up de racha */
  ui: {
    ultimaNegativa?: string;
    ultimaRevision?: string;
    iniciado?: string;
    nivelMax?: number;
    ultimoSaludo?: string;
    /** Misiones elegidas para el día (se eligen una vez y no cambian aunque cambien tus datos) */
    misiones?: { fecha: string; ids: string[] };
  };
}

export function progresoVacio(): Progreso {
  return {
    version: 1,
    eventos: [],
    racha: { actual: 0, mejor: 0, ultimoDia: "", protectores: 0, diasActivos: [], usados: [] },
    logros: {},
    ajustes: { gamificacion: true, celebraciones: "todas", negativas: true, saludo: true, metaDiaria: 50, sonido: true, vibracion: true },
    snap: { ahorro: {}, objetivos: {} },
    historico: {},
    compactados: [],
    ui: {},
  };
}

/* ═════════ Niveles: 30 en 6 etapas ═════════
 * XP para pasar del nivel n al n+1 = round(90 · n^1.05).
 * Con un uso normal (~110 XP al día) el nivel 5 llega en unos 9 días y el 30 en poco más de un año. */
export const ETAPAS = ["Base", "Rutina", "Ritmo", "Disciplina", "Maestría", "Leyenda"] as const;
export type Etapa = (typeof ETAPAS)[number];
export const NIVEL_MAX = 30;
export const xpParaSubir = (n: number) => Math.round(90 * Math.pow(n, 1.05));
export const etapaDe = (nivel: number): Etapa => ETAPAS[Math.min(5, Math.floor((nivel - 1) / 5))];

export function nivelDeXP(total: number) {
  let nivel = 1;
  let restante = total;
  while (nivel < NIVEL_MAX && restante >= xpParaSubir(nivel)) {
    restante -= xpParaSubir(nivel);
    nivel += 1;
  }
  const meta = nivel >= NIVEL_MAX ? 0 : xpParaSubir(nivel);
  return { nivel, etapa: etapaDe(nivel), xpEnNivel: nivel >= NIVEL_MAX ? 0 : restante, xpParaSiguiente: meta, total };
}

/** XP acumulado necesario para estar en el nivel n */
export const xpHastaNivel = (n: number) => {
  let t = 0;
  for (let i = 1; i < Math.min(n, NIVEL_MAX); i++) t += xpParaSubir(i);
  return t;
};

/**
 * Nivel con piso: si el XP total cae por debajo del nivel ya alcanzado, el nivel se conserva y
 * la barra pide recuperar lo perdido antes de avanzar (xpParaSiguiente incluye ese déficit).
 */
export function nivelConPiso(total: number, piso = 1) {
  const n = nivelDeXP(total);
  if (n.nivel >= piso) return n;
  const nivel = Math.min(piso, NIVEL_MAX);
  const deficit = xpHastaNivel(nivel) - total;
  return { nivel, etapa: etapaDe(nivel), xpEnNivel: 0, xpParaSiguiente: nivel >= NIVEL_MAX ? 0 : xpParaSubir(nivel) + deficit, total };
}

/* ═════════ Vínculo por asistente (1 a 10) ═════════ */
export const xpVinculo = (v: number) => (v <= 1 ? 0 : Math.round(100 * Math.pow(v - 1, 1.6)));
export function vinculoDeXP(xp: number) {
  let v = 1;
  while (v < 10 && xp >= xpVinculo(v + 1)) v += 1;
  const desde = xpVinculo(v);
  const hasta = v >= 10 ? desde : xpVinculo(v + 1);
  return { nivel: v, xp, desde, hasta, pct: v >= 10 ? 100 : Math.round(((xp - desde) / (hasta - desde)) * 100) };
}

/** Lo que desbloquea cada nivel de vínculo en el editor */
export type Desbloqueo = { vinculo: number; tipo: "combinacion" | "accesorio" | "pose"; valor: string; label: string };
export const DESBLOQUEOS: Desbloqueo[] = [
  { vinculo: 2, tipo: "combinacion", valor: "1", label: "Segunda combinación de color" },
  { vinculo: 3, tipo: "accesorio", valor: "gafas", label: "Gafas" },
  { vinculo: 4, tipo: "combinacion", valor: "2", label: "Tercera combinación de color" },
  { vinculo: 5, tipo: "accesorio", valor: "gorro", label: "Gorro" },
  { vinculo: 6, tipo: "accesorio", valor: "audifonos", label: "Audífonos" },
  { vinculo: 7, tipo: "accesorio", valor: "bufanda", label: "Bufanda" },
  { vinculo: 8, tipo: "pose", valor: "idle-alterna", label: "Pose normal alternativa" },
  { vinculo: 9, tipo: "combinacion", valor: "3", label: "Cuarta combinación de color" },
  { vinculo: 10, tipo: "combinacion", valor: "dorada", label: "Combinación dorada" },
];
export const vinculoRequerido = (tipo: Desbloqueo["tipo"], valor: string) => DESBLOQUEOS.find((d) => d.tipo === tipo && d.valor === valor)?.vinculo ?? 1;

/* ═════════ Derivados ═════════ */
export function xpTotal(p: Progreso) {
  return sum(p.eventos.map((e) => e.xp)) + sum(Object.values(p.historico).flatMap((m) => Object.values(m)));
}
export function xpPorAsistente(p: Progreso): Record<AsistenteId, number> {
  const r = Object.fromEntries(ASISTENTE_IDS.map((id) => [id, 0])) as Record<AsistenteId, number>;
  // El vínculo nunca baja: los eventos negativos (mes en rojo) no cuentan aquí
  for (const e of p.eventos) if (e.xp > 0) r[e.asistente] += e.xp;
  for (const m of Object.values(p.historico))
    for (const [k, v] of Object.entries(m)) {
      const a = k.split(":")[1] as AsistenteId;
      if (a in r && v > 0) r[a] += v;
    }
  return r;
}

/**
 * Racha global: un día cuenta si hubo al menos una acción. Protector: 1 cada 7 días, máx. 2.
 * `reparados`: días perdidos que se recuperaron pagando XP (cuentan como activos).
 * `inicio`: primer día de la racha actual (sirve para no repetir los premios de hito).
 */
export function calcularRacha(diasActivos: string[], today: string, mejorPrevio = 0, reparados: string[] = []): Progreso["racha"] {
  const set = new Set([...diasActivos, ...reparados]);
  const ordenados = [...set].sort();
  if (!ordenados.length) return { actual: 0, mejor: mejorPrevio, ultimoDia: "", protectores: 0, diasActivos: [], usados: [], reparados: reparados.slice(-60) };
  let actual = 0;
  let mejor = mejorPrevio;
  let protectores = 0;
  let consecutivos = 0;
  let inicio = "";
  const usados: string[] = [];
  for (let d = ordenados[0]; d <= today; d = addDays(d, 1)) {
    if (set.has(d)) {
      if (actual === 0) inicio = d;
      actual += 1;
      consecutivos += 1;
      if (consecutivos % 7 === 0 && protectores < 2) protectores += 1;
    } else if (d === today) {
      // Hoy todavía no termina: no rompe la racha
    } else if (protectores > 0 && actual > 0) {
      protectores -= 1;
      usados.push(d);
      consecutivos = 0;
    } else {
      actual = 0;
      consecutivos = 0;
    }
    mejor = Math.max(mejor, actual);
  }
  return {
    actual,
    mejor,
    ultimoDia: ordenados.at(-1)!,
    protectores,
    diasActivos: ordenados.slice(-200),
    usados: usados.slice(-60),
    inicio: actual > 0 ? inicio : undefined,
    reparados: reparados.slice(-60),
  };
}

/* ═════════ Hitos de racha ═════════ */
export const HITOS_RACHA: { dias: number; xp: number }[] = [
  { dias: 3, xp: 10 },
  { dias: 7, xp: 25 },
  { dias: 14, xp: 40 },
  { dias: 30, xp: 75 },
  { dias: 50, xp: 100 },
  { dias: 100, xp: 200 },
  { dias: 150, xp: 250 },
  { dias: 200, xp: 250 },
  { dias: 365, xp: 500 },
];
export const proximoHito = (actual: number) => HITOS_RACHA.find((h) => h.dias > actual) ?? null;

/* ═════════ Reparar una racha rota ═════════
 * Si perdiste 1 o 2 días (sin protector) y la racha anterior era de 3 días o más, durante esos
 * 2 días puedes recuperarla pagando 100 XP por día perdido. El nivel no baja (tiene piso). */
export const COSTO_REPARAR_DIA = -TABLA_XP["reparar-racha"].xp;

export function rachaReparable(p: Progreso, today: string): { dias: string[]; anterior: number; costo: number; nueva: number } | null {
  const reparados = p.racha.reparados ?? [];
  const activos = new Set([...p.racha.diasActivos, ...reparados]);
  const protegidos = new Set(p.racha.usados);
  const cuentaHasta = (d: string) => {
    let n = 0;
    for (let x = d; activos.has(x) || protegidos.has(x); x = addDays(x, -1)) if (activos.has(x)) n += 1;
    return n;
  };
  const y1 = addDays(today, -1);
  const y2 = addDays(today, -2);
  const y3 = addDays(today, -3);
  const libre = (d: string) => !activos.has(d) && !protegidos.has(d);
  let dias: string[] = [];
  let anterior = 0;
  if (libre(y1) && activos.has(y2)) {
    dias = [y1];
    anterior = cuentaHasta(y2);
  } else if (libre(y1) && libre(y2) && activos.has(y3)) {
    dias = [y2, y1];
    anterior = cuentaHasta(y3);
  }
  if (!dias.length || anterior < 3) return null;
  const costo = dias.length * COSTO_REPARAR_DIA;
  if (xpTotal(p) < costo) return null;
  const nueva = anterior + dias.length + (activos.has(today) ? 1 : 0);
  return { dias, anterior, costo, nueva };
}

/* ═════════ Reconciliar datos → eventos ═════════ */
type Candidato = { refId: string; tipo: TipoAccion; fecha: string; asistente?: AsistenteId };
// Día en hora de Bogotá (no UTC): lo registrado de noche cuenta para ese mismo día
const fechaDe = (iso: string | undefined, today: string) => (iso ? fechaLocal(iso) : today);

function candidatos(db: Database, prev: Progreso, today: string): { lista: Candidato[]; snap: Progreso["snap"]; vivos: Set<string> } {
  const lista: Candidato[] = [];
  const vivos = new Set<string>(); // prefijos de elementos que siguen existiendo
  // Los pendientes (p. ej. pagos fijos que crea la app) no dan XP hasta que se confirman
  for (const t of db.transactions)
    if (t.status !== "pendiente") lista.push({ refId: `tx:${t.id}`, tipo: t.type === "ingreso" ? "ingreso" : "movimiento", fecha: fechaDe(t.created_at, today) });
  for (const l of db.habit_logs) lista.push({ refId: `hl:${l.id}`, tipo: "habito", fecha: fechaDe(l.created_at, today) });
  // Día perfecto: todos los hábitos programados de ese día marcados
  const porDia = new Map<string, Set<string>>();
  for (const l of db.habit_logs) porDia.set(l.date, (porDia.get(l.date) ?? new Set()).add(l.habit_id));
  for (const [d, hechos] of porDia) {
    const prog = db.habits.filter((h) => isScheduled(h, d));
    if (prog.length && prog.every((h) => hechos.has(h.id))) lista.push({ refId: `dp:${d}`, tipo: "dia-perfecto", fecha: d > today ? today : d });
  }
  const yaVisto = (ref: string) => prev.eventos.find((e) => e.refId === ref)?.fecha;
  // Balance del mes: cada mes cerrado desde el mes en que empezó la gamificación (sin premios ni
  // castigos retroactivos por meses con datos incompletos)
  if (prev.ui.iniciado) {
    const actual = monthKey(today);
    for (let k = monthKey(prev.ui.iniciado); k < actual; k = addMonths(k, 1)) {
      const delMes = db.transactions.filter((t) => t.date.startsWith(k) && t.status !== "pendiente");
      const ing = sum(delMes.filter((t) => t.type === "ingreso").map((t) => t.amount));
      const gas = sum(delMes.filter((t) => t.type === "gasto").map((t) => t.amount));
      if (gas > 0 && ing > gas) lista.push({ refId: `bmv:${k}`, tipo: "mes-verde", fecha: yaVisto(`bmv:${k}`) ?? today });
      else if (gas > ing) lista.push({ refId: `bmr:${k}`, tipo: "mes-rojo", fecha: yaVisto(`bmr:${k}`) ?? today });
    }
  }
  for (const t of db.tasks) {
    if (t.status !== "completada") continue;
    const f = yaVisto(`tk:${t.id}`) ?? today;
    lista.push({ refId: `tk:${t.id}`, tipo: "tarea", fecha: f });
    if (t.due_date && t.due_date >= f) lista.push({ refId: `tka:${t.id}`, tipo: "tarea-a-tiempo", fecha: f });
  }
  for (const p of db.projects) if (p.status === "completado") lista.push({ refId: `pj:${p.id}`, tipo: "proyecto", fecha: yaVisto(`pj:${p.id}`) ?? today });

  const snap: Progreso["snap"] = { ahorro: {}, objetivos: {} };
  for (const g of db.savings_goals) {
    vivos.add(`ah:${g.id}`);
    snap.ahorro[g.id] = g.current_amount;
    const antes = prev.snap.ahorro[g.id];
    if (antes !== undefined && g.current_amount > antes) lista.push({ refId: `ah:${g.id}:${today}`, tipo: "aporte-ahorro", fecha: today });
    if (g.target_amount > 0 && g.current_amount >= g.target_amount) lista.push({ refId: `ahc:${g.id}`, tipo: "meta-ahorro", fecha: yaVisto(`ahc:${g.id}`) ?? today });
  }
  for (const g of db.annual_goals) {
    vivos.add(`ob:${g.id}`);
    snap.objetivos[g.id] = g.progress;
    const antes = prev.snap.objetivos[g.id];
    if (antes !== undefined && g.progress > antes) lista.push({ refId: `ob:${g.id}:${today}`, tipo: "avance-objetivo", fecha: today });
    if (g.progress >= 100) lista.push({ refId: `obc:${g.id}`, tipo: "objetivo", fecha: yaVisto(`obc:${g.id}`) ?? today });
  }
  for (const w of db.wishlist_items) {
    if (w.status !== "comprado" || !w.savings_goal_id) continue;
    const g = db.savings_goals.find((x) => x.id === w.savings_goal_id);
    if (yaVisto(`ws:${w.id}`) || (g && g.current_amount >= w.price)) lista.push({ refId: `ws:${w.id}`, tipo: "compra-planificada", fecha: yaVisto(`ws:${w.id}`) ?? today });
  }
  return { lista, snap, vivos };
}

let seq = 0;
const nuevoId = () => `xp${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * Devuelve el progreso actualizado y los eventos nuevos (para reaccionar en la interfaz).
 * `principal` recibe el XP de la revisión semanal.
 */
export function reconciliar(prev: Progreso, db: Database, today: string, principal: AsistenteId): { next: Progreso; nuevos: EventoXP[]; quitados: EventoXP[] } {
  const { lista, snap, vivos } = candidatos(db, prev, today);
  const validos = new Set(lista.map((c) => c.refId));
  const compactados = new Set(prev.compactados);

  // 1) Quitar eventos cuyo elemento ya no existe o ya no cumple
  const quitados: EventoXP[] = [];
  const conservados = prev.eventos.filter((e) => {
    // Las misiones y la meta del día se revisan en el paso 3
    // Los hitos y las reparaciones de racha ya ganados/pagados no se revierten
    if (e.tipo === "revision-semanal" || e.tipo === "enfoque" || e.refId.startsWith("demo:") || TIPOS_DEL_DIA.includes(e.tipo) || e.tipo === "hito-racha" || e.tipo === "reparar-racha")
      return true;
    if (e.tipo === "aporte-ahorro" || e.tipo === "avance-objetivo") {
      const ok = vivos.has(e.refId.split(":").slice(0, 2).join(":"));
      if (!ok) quitados.push(e);
      return ok;
    }
    const ok = validos.has(e.refId);
    if (!ok) quitados.push(e);
    return ok;
  });

  // 2) Agregar candidatos nuevos con su tope diario
  const existentes = new Set(conservados.map((e) => e.refId));
  const eventos = [...conservados];
  const nuevos: EventoXP[] = [];
  for (const c of lista.sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    if (existentes.has(c.refId) || compactados.has(c.refId)) continue;
    const cfg = TABLA_XP[c.tipo];
    let xp = cfg.xp;
    if (cfg.tope) {
      const usado = sum(eventos.filter((e) => e.fecha === c.fecha && TABLA_XP[e.tipo].grupo === cfg.grupo).map((e) => e.xp));
      xp = Math.max(0, Math.min(xp, cfg.tope - usado));
    }
    const asistente = cfg.asistente === "principal" ? principal : cfg.asistente;
    const ev: EventoXP = { id: nuevoId(), tipo: c.tipo, xp, fecha: c.fecha, refId: c.refId, asistente };
    eventos.push(ev);
    existentes.add(c.refId);
    nuevos.push(ev);
  }

  // 3) Misiones y meta del día, evaluadas sobre los eventos ya actualizados. Si deshaces la acción
  //    (borras el movimiento, desmarcas el hábito), la misión de hoy vuelve a quedar pendiente.
  const ids = prev.ui.misiones?.fecha === today ? prev.ui.misiones.ids : elegirMisiones(db, today);
  const dia = evaluarDia(eventos, ids, today, prev.ajustes.metaDiaria ?? META_POR_DEFECTO);
  const validosDia = new Map<string, { tipo: TipoAccion; asistente: AsistenteId }>();
  for (const m of dia.misiones) if (m.hecha) validosDia.set(`ms:${today}:${m.def.id}`, { tipo: "mision", asistente: m.def.asistente });
  if (dia.misiones.length && dia.misiones.every((m) => m.hecha)) validosDia.set(`msc:${today}`, { tipo: "misiones-dia", asistente: principal });
  if (dia.xpHoy >= dia.meta) validosDia.set(`md:${today}`, { tipo: "meta-diaria", asistente: principal });
  for (let k = eventos.length - 1; k >= 0; k--) {
    const e = eventos[k];
    if (TIPOS_DEL_DIA.includes(e.tipo) && e.fecha === today && !validosDia.has(e.refId)) {
      quitados.push(e);
      eventos.splice(k, 1);
    }
  }
  const yaEstan = new Set(eventos.map((e) => e.refId));
  for (const [refId, d] of validosDia) {
    if (yaEstan.has(refId)) continue;
    const ev: EventoXP = { id: nuevoId(), tipo: d.tipo, xp: TABLA_XP[d.tipo].xp, fecha: today, refId, asistente: d.asistente };
    eventos.push(ev);
    nuevos.push(ev);
  }

  const racha = calcularRacha(
    [...eventos.map((e) => e.fecha), ...prev.racha.diasActivos.filter((d) => d < addDays(today, -90))],
    today,
    prev.racha.mejor,
    prev.racha.reparados ?? [],
  );

  // 4) Hitos de racha: una vez por hito en cada racha (la racha se identifica por su día de inicio)
  if (racha.inicio) {
    const ya = new Set([...eventos.map((e) => e.refId), ...prev.compactados]);
    for (const h of HITOS_RACHA) {
      const refId = `hr:${racha.inicio}:${h.dias}`;
      if (racha.actual < h.dias || ya.has(refId)) continue;
      const ev: EventoXP = { id: nuevoId(), tipo: "hito-racha", xp: h.xp, fecha: today, refId, asistente: "brote" };
      eventos.push(ev);
      nuevos.push(ev);
    }
  }

  const next = compactar({ ...prev, eventos, snap, racha, ui: { ...prev.ui, misiones: { fecha: today, ids } } }, today);
  return { next, nuevos, quitados };
}

/* ═════════ Meta diaria y misiones del día ═════════ */
export const META_POR_DEFECTO = 50;
export const METAS_DIARIAS = [
  { xp: 20, label: "Relajada", hint: "20 XP · un par de registros" },
  { xp: 50, label: "Normal", hint: "50 XP · un día ordenado" },
  { xp: 80, label: "Seria", hint: "80 XP · varios frentes al día" },
  { xp: 120, label: "Intensa", hint: "120 XP · todo al día" },
];

type Frente = "finanzas" | "habitos" | "tareas" | "metas";
export interface MisionDef {
  id: string;
  texto: string;
  meta: number;
  frente: Frente;
  asistente: AsistenteId;
  /** Qué eventos de hoy cuentan */
  tipos: TipoAccion[];
  /** Solo se propone si tiene sentido con tus datos de hoy */
  disponible: (db: Database, today: string) => boolean;
  href: string;
}

const habitosHoy = (db: Database, today: string) => db.habits.filter((h) => isScheduled(h, today)).length;
const tareasPendientes = (db: Database) => db.tasks.filter((t) => t.status !== "completada");

export const MISIONES: MisionDef[] = [
  { id: "mov-2", texto: "Registra 2 movimientos", meta: 2, frente: "finanzas", asistente: "centavo", tipos: ["movimiento", "ingreso"], disponible: () => true, href: "/finanzas" },
  { id: "mov-4", texto: "Registra 4 movimientos", meta: 4, frente: "finanzas", asistente: "centavo", tipos: ["movimiento", "ingreso"], disponible: (db) => db.transactions.length >= 10, href: "/finanzas" },
  { id: "ingreso", texto: "Registra un ingreso", meta: 1, frente: "finanzas", asistente: "centavo", tipos: ["ingreso"], disponible: (db) => db.transactions.some((t) => t.type === "ingreso"), href: "/finanzas" },
  { id: "habito-1", texto: "Cumple un hábito", meta: 1, frente: "habitos", asistente: "brote", tipos: ["habito"], disponible: (db, d) => habitosHoy(db, d) >= 1, href: "/salud" },
  { id: "habito-3", texto: "Cumple 3 hábitos", meta: 3, frente: "habitos", asistente: "brote", tipos: ["habito"], disponible: (db, d) => habitosHoy(db, d) >= 3, href: "/salud" },
  { id: "dia-perfecto", texto: "Cumple todos tus hábitos de hoy", meta: 1, frente: "habitos", asistente: "brote", tipos: ["dia-perfecto"], disponible: (db, d) => habitosHoy(db, d) >= 2, href: "/salud" },
  { id: "tarea-1", texto: "Completa una tarea", meta: 1, frente: "tareas", asistente: "tuerca", tipos: ["tarea"], disponible: (db) => tareasPendientes(db).length >= 1, href: "/proyectos" },
  { id: "tarea-2", texto: "Completa 2 tareas", meta: 2, frente: "tareas", asistente: "tuerca", tipos: ["tarea"], disponible: (db) => tareasPendientes(db).length >= 2, href: "/proyectos" },
  {
    id: "tarea-tiempo",
    texto: "Termina una tarea antes de su fecha",
    meta: 1,
    frente: "tareas",
    asistente: "tic",
    tipos: ["tarea-a-tiempo"],
    disponible: (db, d) => tareasPendientes(db).some((t) => t.due_date && t.due_date >= d),
    href: "/proyectos",
  },
  {
    id: "ahorro",
    texto: "Haz un aporte a una meta de ahorro",
    meta: 1,
    frente: "metas",
    asistente: "centavo",
    tipos: ["aporte-ahorro"],
    disponible: (db) => db.savings_goals.some((g) => g.current_amount < g.target_amount),
    href: "/finanzas",
  },
  {
    id: "objetivo",
    texto: "Avanza en un objetivo 2027",
    meta: 1,
    frente: "metas",
    asistente: "cima",
    tipos: ["avance-objetivo"],
    disponible: (db) => db.annual_goals.some((g) => g.progress < 100),
    href: "/objetivos",
  },
];

/** Pseudoaleatorio estable por día: las mismas misiones todo el día */
function semillaDe(texto: string) {
  let h = 2166136261;
  for (let k = 0; k < texto.length; k++) h = Math.imul(h ^ texto.charCodeAt(k), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Elige 3 misiones del día, de frentes distintos cuando se puede */
export function elegirMisiones(db: Database, today: string): string[] {
  const azar = semillaDe(`lifeos:${today}`);
  const posibles = MISIONES.filter((m) => m.disponible(db, today))
    .map((m) => ({ m, r: azar() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.m);
  const elegidas: MisionDef[] = [];
  for (const m of posibles) if (elegidas.length < 3 && !elegidas.some((e) => e.frente === m.frente)) elegidas.push(m);
  for (const m of posibles) if (elegidas.length < 3 && !elegidas.includes(m)) elegidas.push(m);
  return elegidas.map((m) => m.id);
}

export interface EstadoDia {
  xpHoy: number;
  meta: number;
  misiones: { def: MisionDef; cuenta: number; hecha: boolean }[];
}

/** Progreso de hoy: XP de acciones (sin contar misiones ni meta) y avance de cada misión */
export function evaluarDia(eventos: EventoXP[], ids: string[], today: string, meta: number): EstadoDia {
  const deHoy = eventos.filter((e) => e.fecha === today);
  // Los premios (misiones, meta, hitos) no cuentan para la meta: solo las acciones
  const xpHoy = sum(deHoy.filter((e) => e.xp > 0 && !TIPOS_DEL_DIA.includes(e.tipo) && e.tipo !== "hito-racha").map((e) => e.xp));
  const misiones = ids
    .map((id) => MISIONES.find((m) => m.id === id))
    .filter((m): m is MisionDef => !!m)
    .map((def) => {
      const cuenta = deHoy.filter((e) => def.tipos.includes(e.tipo)).length;
      return { def, cuenta: Math.min(cuenta, def.meta), hecha: cuenta >= def.meta };
    });
  return { xpHoy, meta, misiones };
}

/** Agrega un evento manual (p. ej. la revisión semanal). */
export function agregarEvento(prev: Progreso, tipo: TipoAccion, refId: string, today: string, asistente: AsistenteId): { next: Progreso; ev: EventoXP | null } {
  if (prev.eventos.some((e) => e.refId === refId)) return { next: prev, ev: null };
  // Tope diario por grupo (p. ej. el enfoque da XP hasta 4 bloques al día)
  const cfg = TABLA_XP[tipo];
  const usado = cfg.tope ? sum(prev.eventos.filter((e) => e.fecha === today && TABLA_XP[e.tipo]?.grupo === cfg.grupo).map((e) => e.xp)) : 0;
  const xp = cfg.tope ? Math.max(0, Math.min(cfg.xp, cfg.tope - usado)) : cfg.xp;
  const ev: EventoXP = { id: nuevoId(), tipo, xp, fecha: today, refId, asistente };
  const eventos = [...prev.eventos, ev];
  return {
    next: { ...prev, eventos, racha: calcularRacha(eventos.map((e) => e.fecha).concat(prev.racha.diasActivos), today, prev.racha.mejor, prev.racha.reparados ?? []) },
    ev,
  };
}

/** Compacta eventos de más de 90 días en totales por mes y tipo. */
export function compactar(p: Progreso, today: string): Progreso {
  const limite = addDays(today, -90);
  const viejos = p.eventos.filter((e) => e.fecha < limite);
  if (!viejos.length) return p;
  const historico = { ...p.historico };
  for (const e of viejos) {
    const mes = e.fecha.slice(0, 7);
    const k = `${e.tipo}:${e.asistente}`;
    historico[mes] = { ...(historico[mes] ?? {}), [k]: (historico[mes]?.[k] ?? 0) + e.xp };
  }
  return {
    ...p,
    eventos: p.eventos.filter((e) => e.fecha >= limite),
    historico,
    compactados: [...p.compactados, ...viejos.map((e) => e.refId)],
  };
}

/* ═════════ Logros ═════════ */
export interface LogroDef {
  id: LogroId;
  titulo: string;
  condicion: string;
  asistente: AsistenteId | "todos";
  grande?: boolean;
}

export const LOGROS: LogroDef[] = [
  { id: "primer-movimiento", titulo: "Primer movimiento", condicion: "Registra tu primer movimiento", asistente: "centavo" },
  { id: "racha-7", titulo: "Semana constante", condicion: "Mantén 7 días de racha", asistente: "brote" },
  { id: "racha-30", titulo: "Mes constante", condicion: "Mantén 30 días de racha", asistente: "brote", grande: true },
  { id: "racha-100", titulo: "Cien días", condicion: "Mantén 100 días de racha", asistente: "brote", grande: true },
  { id: "mes-verde", titulo: "Mes en verde", condicion: "Cierra un mes con gastos por debajo de los ingresos", asistente: "centavo" },
  { id: "habitos-50", titulo: "50 hábitos", condicion: "Cumple 50 hábitos", asistente: "brote" },
  { id: "dia-perfecto", titulo: "Día perfecto", condicion: "Cumple todos los hábitos de un día", asistente: "brote" },
  { id: "primer-proyecto", titulo: "Obra terminada", condicion: "Termina tu primer proyecto", asistente: "tuerca", grande: true },
  { id: "diez-tareas", titulo: "Diez tareas", condicion: "Completa 10 tareas", asistente: "tuerca" },
  { id: "sin-vencidas", titulo: "Sin vencidas", condicion: "Ten 3 tareas completadas y ninguna vencida", asistente: "tuerca" },
  { id: "agenda-al-dia", titulo: "Agenda al día", condicion: "Planea 5 eventos en tu calendario", asistente: "tic" },
  { id: "cero-tarde", titulo: "Cero tarde", condicion: "Completa 5 tareas antes de su fecha", asistente: "tic" },
  { id: "primer-objetivo", titulo: "Primera cumbre", condicion: "Completa un objetivo 2027", asistente: "cima", grande: true },
  { id: "primera-meta-ahorro", titulo: "Meta de ahorro", condicion: "Completa una meta de ahorro", asistente: "centavo", grande: true },
  { id: "compra-planificada", titulo: "Compra planificada", condicion: "Compra un deseo con su meta lista", asistente: "antojo" },
  { id: "nivel-10", titulo: "Nivel 10", condicion: "Llega al nivel 10", asistente: "todos", grande: true },
  { id: "nivel-20", titulo: "Nivel 20", condicion: "Llega al nivel 20", asistente: "todos", grande: true },
  { id: "leyenda", titulo: "Leyenda", condicion: "Llega a la etapa Leyenda (nivel 26)", asistente: "todos", grande: true },
  { id: "meta-7", titulo: "Semana en meta", condicion: "Cumple tu meta diaria 7 días", asistente: "todos" },
  { id: "misiones-30", titulo: "Cazador de misiones", condicion: "Completa 30 misiones del día", asistente: "todos", grande: true },
];

export function evaluarLogros(db: Database, p: Progreso, today: string): LogroId[] {
  const nivel = nivelConPiso(xpTotal(p), p.ui.nivelMax).nivel;
  const cuenta = (tipo: TipoAccion) => p.eventos.filter((e) => e.tipo === tipo).length;
  const key = monthKey(today);
  const mesVerde = [1, 2, 3, 4, 5, 6].some((i) => {
    const k = addMonths(key, -i);
    const g = sum(db.transactions.filter((t) => t.type === "gasto" && t.date.startsWith(k)).map((t) => t.amount));
    const ing = sum(db.transactions.filter((t) => t.type === "ingreso" && t.date.startsWith(k)).map((t) => t.amount));
    return g > 0 && ing > g;
  });
  const hechas = db.tasks.filter((t) => t.status === "completada").length;
  const vencidas = db.tasks.filter((t) => t.status !== "completada" && t.due_date && t.due_date < today).length;
  const ok: Record<LogroId, boolean> = {
    "primer-movimiento": db.transactions.length > 0,
    "racha-7": p.racha.mejor >= 7,
    "racha-30": p.racha.mejor >= 30,
    "racha-100": p.racha.mejor >= 100,
    "mes-verde": mesVerde,
    "habitos-50": db.habit_logs.length >= 50,
    "dia-perfecto": cuenta("dia-perfecto") > 0,
    "primer-proyecto": db.projects.some((x) => x.status === "completado"),
    "diez-tareas": hechas >= 10,
    "sin-vencidas": hechas >= 3 && vencidas === 0,
    "agenda-al-dia": db.calendar_events.length >= 5,
    "cero-tarde": cuenta("tarea-a-tiempo") >= 5,
    "primer-objetivo": db.annual_goals.some((g) => g.progress >= 100),
    "primera-meta-ahorro": db.savings_goals.some((g) => g.target_amount > 0 && g.current_amount >= g.target_amount),
    "compra-planificada": cuenta("compra-planificada") > 0,
    "nivel-10": nivel >= 10,
    "nivel-20": nivel >= 20,
    leyenda: nivel >= 26,
    "meta-7": cuenta("meta-diaria") >= 7,
    "misiones-30": cuenta("mision") >= 30,
  };
  return (Object.keys(ok) as LogroId[]).filter((id) => ok[id] && !p.logros[id]);
}

/** Semana ISO simple (lunes a domingo) para la revisión semanal */
export function semanaDe(today: string) {
  return addDays(today, -weekdayMon(today));
}
