"use client";

/**
 * Gamificación: guarda el progreso (lifeos:progreso; en modo demo solo en memoria), lo reconcilia
 * con los datos después de cada cambio y expone reacciones (+XP) y celebraciones a la interfaz.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { animoGeneral, calcularTodas, guardarHistorial, type Animo, type SaludModulo } from "@/lib/asistentes/animo";
import {
  DESBLOQUEOS,
  LOGROS,
  TABLA_XP,
  agregarEvento,
  calcularRacha,
  elegirMisiones,
  evaluarDia,
  rachaReparable,
  evaluarLogros,
  META_POR_DEFECTO,
  nivelConPiso,
  type EstadoDia,
  progresoVacio,
  reconciliar,
  semanaDe,
  vinculoDeXP,
  xpPorAsistente,
  xpTotal,
  type Desbloqueo,
  type EventoXP,
  type LogroDef,
  type Progreso,
} from "@/lib/asistentes/progreso";
import { ASISTENTE_IDS, type Accesorio, type AsistenteId } from "@/lib/asistentes/tipos";
import { CrecimientoCtx, crecimientoDeVinculo, type EtapaCrecimiento } from "@/lib/asistentes/crecimiento";
import { almacenCloset, condicionPieza, ganarPiezas, piezasNuevas } from "@/lib/asistentes/closet";
import { prepararAudio, retro } from "@/lib/asistentes/sonido";

export const CLAVE_PROGRESO = "lifeos:progreso";

/* ═════════ Almacén ═════════ */
const enDemo = () => typeof window !== "undefined" && !!window.sessionStorage.getItem("lifeos-demo");
let cache: Progreso | null = null;
const SERVIDOR = progresoVacio();
const oyentes = new Set<() => void>();

function leer(): Progreso {
  if (cache) return cache;
  if (typeof window === "undefined") return SERVIDOR;
  if (enDemo()) return (cache = progresoVacio());
  try {
    const raw = window.localStorage.getItem(CLAVE_PROGRESO);
    const base = progresoVacio();
    cache = raw ? { ...base, ...JSON.parse(raw), ajustes: { ...base.ajustes, ...(JSON.parse(raw).ajustes ?? {}) } } : base;
  } catch {
    cache = progresoVacio();
  }
  return cache!;
}
function guardar(p: Progreso) {
  cache = p;
  if (typeof window !== "undefined" && !enDemo()) {
    try {
      window.localStorage.setItem(CLAVE_PROGRESO, JSON.stringify(p));
    } catch {
      /* almacenamiento lleno: queda en memoria */
    }
  }
  oyentes.forEach((f) => f());
}
function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}
export function exportarProgreso() {
  return leer();
}
export function borrarProgreso() {
  if (typeof window !== "undefined" && !enDemo()) {
    window.localStorage.removeItem(CLAVE_PROGRESO);
    window.localStorage.removeItem("lifeos:animo-historial");
  }
  cache = null;
  oyentes.forEach((f) => f());
}

/* ═════════ Tipos de la interfaz ═════════ */
export type Reaccion = { id: number; asistente: AsistenteId; xp: number; cantidad: number; tipo: EventoXP["tipo"]; x?: number; y?: number };
export type Celebracion =
  | { tipo: "nivel"; nivel: number; etapa: string; cambioEtapa: boolean }
  | { tipo: "logro"; logro: LogroDef }
  | { tipo: "desbloqueo"; asistente: AsistenteId; item: Desbloqueo }
  | { tipo: "balance"; mes: string; verde: boolean; xp: number }
  | { tipo: "meta"; meta: number }
  | { tipo: "misiones" }
  | { tipo: "hito"; dias: number; xp: number }
  | { tipo: "reparada"; dias: number }
  /* Fase 5 */
  | { tipo: "coronacion"; asistente: AsistenteId }
  | { tipo: "closet"; acc: Accesorio; condicion: string };

interface Valor {
  progreso: Progreso;
  activo: boolean;
  xp: number;
  nivel: ReturnType<typeof nivelConPiso>;
  /** Meta diaria y misiones de hoy */
  dia: EstadoDia;
  /** Racha rota que todavía se puede reparar pagando XP (null si no aplica) */
  reparable: ReturnType<typeof rachaReparable>;
  repararRacha: () => void;
  /** Pop-up diario de racha (una vez al día al abrir la app) */
  saludoVisible: boolean;
  cerrarSaludo: () => void;
  saludoDemo: () => void;
  vinculos: Record<AsistenteId, ReturnType<typeof vinculoDeXP>>;
  saludes: Record<AsistenteId, SaludModulo>;
  general: { puntaje: number | null; animo: Animo };
  reacciones: Reaccion[];
  cerrarReaccion: (id: number) => void;
  celebraciones: Celebracion[];
  cerrarCelebraciones: () => void;
  revisionPendiente: boolean;
  completarRevision: () => void;
  /** Bloque de enfoque terminado: +10 XP con tope diario. Devuelve la XP ganada. */
  registrarEnfoque: (refId: string) => number;
  /** Día difícil (chequeo de ánimo): hoy solo 2 misiones en vez de 3 */
  suavizarDia: () => void;
  posponerRevision: () => void;
  negativaHoy: () => boolean;
  marcarNegativa: () => void;
  cambiarAjustes: (p: Partial<Progreso["ajustes"]>) => void;
  /* Solo modo demo */
  demo: boolean;
  forzarSalud: Partial<Record<AsistenteId, number | null>>;
  setForzarSalud: (v: Partial<Record<AsistenteId, number | null>>) => void;
  /** Etapa de crecimiento de cada asistente (vínculo 1–10); en demo se puede forzar */
  crecimientos: Record<AsistenteId, EtapaCrecimiento>;
  forzarCrecimiento: Partial<Record<AsistenteId, EtapaCrecimiento>>;
  setForzarCrecimiento: (v: Partial<Record<AsistenteId, EtapaCrecimiento>>) => void;
  sumarXPDemo: (xp: number, asistente: AsistenteId) => void;
  celebrarDemo: (c: Celebracion) => void;
  romperRachaDemo: (modo: boolean | "reparable") => void;
  /** Sube para forzar la reacción negativa en modo demo */
  negativaDemo: number;
}

const Ctx = createContext<Valor | null>(null);

/** Última posición del puntero, para que el "+XP" salga desde el botón usado */
const puntero = { x: 0, y: 0, t: 0 };

export function GamificacionProvider({ children }: { children: React.ReactNode }) {
  const { db, status, mode } = useData();
  const today = useToday();
  const { estado } = useAsistentes();
  const progreso = useSyncExternalStore(suscribir, leer, () => SERVIDOR);
  const [reacciones, setReacciones] = useState<Reaccion[]>([]);
  const [celebraciones, setCelebraciones] = useState<Celebracion[]>([]);
  const [forzarSalud, setForzarSalud] = useState<Partial<Record<AsistenteId, number | null>>>({});
  const [forzarCrecimiento, setForzarCrecimiento] = useState<Partial<Record<AsistenteId, EtapaCrecimiento>>>({});
  const [revisionOculta, setRevisionOculta] = useState(false);
  const [negativaDemo, setNegativaDemo] = useState(0);
  const [saludoForzado, setSaludoForzado] = useState(false);
  const seqR = useRef(0);
  const principal = estado.principal;

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      puntero.x = e.clientX;
      puntero.y = e.clientY;
      puntero.t = Date.now();
    };
    window.addEventListener("pointerdown", onDown, true);
    const soltarAudio = prepararAudio();
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      soltarAudio();
    };
  }, []);

  const emitir = useCallback(
    (prev: Progreso, next: Progreso, nuevos: EventoXP[], silencio: boolean) => {
      if (silencio || !next.ajustes.gamificacion) return;
      // Reacción inmediata: se agrupan las acciones seguidas por asistente
      const conXP = nuevos.filter((e) => e.xp > 0);
      if (conXP.length) {
        const cerca = Date.now() - puntero.t < 2500;
        const porAsis = new Map<AsistenteId, EventoXP[]>();
        for (const e of conXP) porAsis.set(e.asistente, [...(porAsis.get(e.asistente) ?? []), e]);
        setReacciones((r) => {
          let out = [...r];
          for (const [asistente, evs] of porAsis) {
            const previa = out.find((x) => x.asistente === asistente);
            const xp = evs.reduce((s, e) => s + e.xp, 0);
            if (previa) out = out.map((x) => (x === previa ? { ...x, xp: x.xp + xp, cantidad: x.cantidad + evs.length, id: ++seqR.current } : x));
            else out.push({ id: ++seqR.current, asistente, xp, cantidad: evs.length, tipo: evs[0].tipo, x: cerca ? puntero.x : undefined, y: cerca ? puntero.y : undefined });
          }
          return out.slice(-3);
        });
      }
      // Sonido/vibración corta para las reacciones; si hay celebración, suena la celebración
      const sonarPequeno = () => {
        if (!conXP.length) return;
        retro(conXP.some((e) => e.tipo === "mision" || e.tipo === "misiones-dia" || e.tipo === "meta-diaria") ? "mision" : "xp", next.ajustes);
      };
      // Celebraciones grandes: nivel, etapa, logro, desbloqueo
      const pref = next.ajustes.celebraciones;
      if (pref === "ninguna") return sonarPequeno();
      const cola: Celebracion[] = [];
      const nA = nivelConPiso(xpTotal(prev), prev.ui.nivelMax);
      const nB = nivelConPiso(xpTotal(next), next.ui.nivelMax);
      if (nB.nivel > nA.nivel) cola.push({ tipo: "nivel", nivel: nB.nivel, etapa: nB.etapa, cambioEtapa: nB.etapa !== nA.etapa });
      // Hito de racha: se celebra el más alto alcanzado
      const hitos = nuevos.filter((e) => e.tipo === "hito-racha");
      if (hitos.length) {
        const mayor = hitos.reduce((a, b) => (Number(b.refId.split(":")[2]) > Number(a.refId.split(":")[2]) ? b : a));
        cola.push({ tipo: "hito", dias: Number(mayor.refId.split(":")[2]), xp: mayor.xp });
      }
      // Meta diaria y misiones del día: celebraciones pequeñas (solo con "Todas")
      if (pref === "todas") {
        if (nuevos.some((e) => e.tipo === "meta-diaria")) cola.push({ tipo: "meta", meta: next.ajustes.metaDiaria ?? META_POR_DEFECTO });
        if (nuevos.some((e) => e.tipo === "misiones-dia")) cola.push({ tipo: "misiones" });
      }
      // Cierre de mes: en verde se celebra; en rojo solo si las reacciones negativas están activas
      for (const e of nuevos) {
        if (e.tipo === "mes-verde" || (e.tipo === "mes-rojo" && next.ajustes.negativas)) {
          cola.push({ tipo: "balance", mes: e.refId.split(":")[1], verde: e.tipo === "mes-verde", xp: e.xp });
        }
      }
      for (const id of Object.keys(next.logros)) {
        if (prev.logros[id as keyof Progreso["logros"]]) continue;
        const def = LOGROS.find((l) => l.id === id);
        if (def && (pref === "todas" || def.grande)) cola.push({ tipo: "logro", logro: def });
      }
      const vA = xpPorAsistente(prev);
      const vB = xpPorAsistente(next);
      for (const id of ASISTENTE_IDS) {
        const a = vinculoDeXP(vA[id]).nivel;
        const b = vinculoDeXP(vB[id]).nivel;
        if (b > a) for (const d of DESBLOQUEOS.filter((x) => x.vinculo > a && x.vinculo <= b)) cola.push({ tipo: "desbloqueo", asistente: id, item: d });
        if (a < 10 && b >= 10) cola.push({ tipo: "coronacion", asistente: id });
      }
      if (cola.length) setCelebraciones((c) => [...c, ...cola]);
      else sonarPequeno();
    },
    [],
  );

  // Reconciliar después de cada cambio de datos
  useEffect(() => {
    if (status !== "ready") return;
    const prev = leer();
    const silencio = !prev.ui.iniciado;
    const r = reconciliar(prev, db, today, principal);
    const logros = { ...r.next.logros };
    for (const id of evaluarLogros(db, r.next, today)) logros[id] = today;
    // El nivel alcanzado queda como piso: un mes en rojo frena el avance, pero no baja el nivel
    const nivelMax = Math.max(prev.ui.nivelMax ?? 1, nivelConPiso(xpTotal(r.next), prev.ui.nivelMax).nivel);
    const next: Progreso = { ...r.next, logros, ui: { ...r.next.ui, iniciado: r.next.ui.iniciado ?? today, nivelMax } };
    const cambio = JSON.stringify(next) !== JSON.stringify(prev);
    if (cambio) guardar(next);
    emitir(prev, next, r.nuevos, silencio);
  }, [db, status, today, principal, emitir]);

  // Clóset: guarda las piezas nuevas (racha, logro, temporada) y las celebra
  useEffect(() => {
    if (status !== "ready" || !today || !progreso.ajustes.gamificacion) return;
    const nuevas = piezasNuevas(almacenCloset.leer(), { mejorRacha: Math.max(progreso.racha.mejor, progreso.racha.actual), logros: progreso.logros, hoy: today });
    if (!nuevas.length) return;
    ganarPiezas(nuevas, today);
    if (progreso.ui.iniciado === undefined || progreso.ajustes.celebraciones === "ninguna") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- celebración por un cambio del progreso
    setCelebraciones((c) => [...c, ...nuevas.map((p) => ({ tipo: "closet" as const, acc: p.acc, condicion: condicionPieza(p) }))]);
  }, [status, today, progreso]);

  const saludes = useMemo(() => {
    const base = calcularTodas(db, today || "2000-01-01");
    for (const [id, v] of Object.entries(forzarSalud) as [AsistenteId, number | null][]) {
      base[id] = { ...base[id], puntaje: v, animo: v === null ? "dormido" : v >= 85 ? "radiante" : v >= 65 ? "feliz" : v >= 45 ? "tranquilo" : v >= 25 ? "preocupado" : "triste" };
    }
    return base;
  }, [db, today, forzarSalud]);

  // Histórico diario del ánimo
  useEffect(() => {
    if (status === "ready") guardarHistorial(today, saludes);
  }, [status, today, saludes]);

  const xp = xpTotal(progreso);
  const nivel = nivelConPiso(xp, progreso.ui.nivelMax);
  const dia = useMemo(() => {
    const ids = progreso.ui.misiones?.fecha === today ? progreso.ui.misiones.ids : today ? elegirMisiones(db, today) : [];
    return evaluarDia(progreso.eventos, ids, today, progreso.ajustes.metaDiaria ?? META_POR_DEFECTO);
  }, [progreso, db, today]);
  const saludoVisible =
    saludoForzado ||
    (progreso.ajustes.gamificacion && progreso.ajustes.saludo !== false && status === "ready" && !!today && progreso.ui.iniciado !== undefined && progreso.ui.ultimoSaludo !== today);
  const vinculos = useMemo(() => {
    const porA = xpPorAsistente(progreso);
    return Object.fromEntries(ASISTENTE_IDS.map((id) => [id, vinculoDeXP(porA[id])])) as Record<AsistenteId, ReturnType<typeof vinculoDeXP>>;
  }, [progreso]);
  const crecimientos = useMemo(
    () =>
      Object.fromEntries(
        ASISTENTE_IDS.map((id) => [id, forzarCrecimiento[id] ?? (progreso.ajustes.gamificacion ? crecimientoDeVinculo(vinculos[id].nivel) : "inicial")]),
      ) as Record<AsistenteId, EtapaCrecimiento>,
    [vinculos, forzarCrecimiento, progreso.ajustes.gamificacion],
  );
  const reparable = useMemo(() => (today && progreso.ajustes.gamificacion ? rachaReparable(progreso, today) : null), [progreso, today]);
  const general = animoGeneral(ASISTENTE_IDS.filter((id) => estado.ajustes[id].activo).map((id) => saludes[id]));
  const semana = today ? semanaDe(today) : "";
  const revisionPendiente =
    progreso.ajustes.gamificacion && !revisionOculta && status === "ready" && progreso.ui.iniciado !== undefined && progreso.ui.iniciado < today && progreso.ui.ultimaRevision !== semana;

  const valor: Valor = {
    progreso,
    activo: progreso.ajustes.gamificacion,
    xp,
    nivel,
    dia,
    reparable,
    repararRacha: () => {
      const prev = leer();
      const info = today ? rachaReparable(prev, today) : null;
      if (!info) return;
      const pagos: EventoXP[] = info.dias.map((d) => ({
        id: `rr${Date.now().toString(36)}${d}`,
        tipo: "reparar-racha",
        xp: TABLA_XP["reparar-racha"].xp,
        fecha: today,
        refId: `rr:${d}`,
        asistente: principal,
      }));
      const eventos = [...prev.eventos, ...pagos];
      const reparados = [...(prev.racha.reparados ?? []), ...info.dias];
      const racha = calcularRacha([...prev.racha.diasActivos, ...eventos.map((e) => e.fecha)], today, prev.racha.mejor, reparados);
      guardar({ ...prev, eventos, racha });
      setCelebraciones((c) => [...c, { tipo: "reparada", dias: racha.actual }]);
    },
    saludoVisible,
    cerrarSaludo: () => {
      setSaludoForzado(false);
      const p = leer();
      if (p.ui.ultimoSaludo !== today) guardar({ ...p, ui: { ...p.ui, ultimoSaludo: today } });
    },
    saludoDemo: () => mode === "demo" && setSaludoForzado(true),
    vinculos,
    saludes,
    general,
    reacciones,
    cerrarReaccion: (id) => setReacciones((r) => r.filter((x) => x.id !== id)),
    celebraciones,
    cerrarCelebraciones: () => setCelebraciones([]),
    revisionPendiente,
    completarRevision: () => {
      const prev = leer();
      const { next, ev } = agregarEvento(prev, "revision-semanal", `rs:${semana}`, today, principal);
      const n2 = { ...next, ui: { ...next.ui, ultimaRevision: semana } };
      guardar(n2);
      emitir(prev, n2, ev ? [ev] : [], false);
    },
    registrarEnfoque: (refId) => {
      const prev = leer();
      const { next, ev } = agregarEvento(prev, "enfoque", refId, today, "tuerca");
      if (!ev) return 0;
      guardar(next);
      emitir(prev, next, [ev], false);
      return ev.xp;
    },
    suavizarDia: () => {
      const p = leer();
      const ids = p.ui.misiones?.fecha === today ? p.ui.misiones.ids : elegirMisiones(db, today);
      if (ids.length <= 2) return;
      guardar({ ...p, ui: { ...p.ui, misiones: { fecha: today, ids: ids.slice(0, 2) } } });
    },
    posponerRevision: () => setRevisionOculta(true),
    negativaHoy: () => leer().ui.ultimaNegativa === today,
    marcarNegativa: () => {
      const p = leer();
      guardar({ ...p, ui: { ...p.ui, ultimaNegativa: today } });
    },
    cambiarAjustes: (a) => {
      const p = leer();
      guardar({ ...p, ajustes: { ...p.ajustes, ...a } });
    },
    demo: mode === "demo",
    forzarSalud,
    setForzarSalud,
    crecimientos,
    forzarCrecimiento,
    setForzarCrecimiento,
    sumarXPDemo: (cantidad, asistente) => {
      if (mode !== "demo") return;
      const prev = leer();
      const ev: EventoXP = { id: `demo${Date.now()}`, tipo: "habito", xp: cantidad, fecha: today, refId: `demo:${Date.now()}`, asistente };
      // Pasa por la reconciliación para que cuente en las misiones y la meta del día
      const r = reconciliar({ ...prev, eventos: [...prev.eventos, ev] }, db, today, principal);
      const logros = { ...r.next.logros };
      for (const id of evaluarLogros(db, r.next, today)) logros[id] = today;
      const n2 = { ...r.next, logros };
      guardar(n2);
      emitir(prev, n2, [ev, ...r.nuevos], false);
    },
    celebrarDemo: (c) => mode === "demo" && setCelebraciones((x) => [...x, c]),
    romperRachaDemo: (conProtector) => {
      if (mode !== "demo") return;
      const prev = leer();
      const ayer = new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10);
      if (conProtector === "reparable") {
        // Racha de 5 días que se cortó ayer: se puede reparar
        const dias = [2, 3, 4, 5, 6].map((k) => new Date(Date.parse(today) - k * 86_400_000).toISOString().slice(0, 10));
        guardar({ ...prev, racha: { ...prev.racha, actual: 0, mejor: Math.max(prev.racha.mejor, 5), protectores: 0, usados: [], reparados: [], diasActivos: dias.sort() } });
        return;
      }
      const racha = conProtector
        ? { ...prev.racha, actual: Math.max(prev.racha.actual, 9), mejor: Math.max(prev.racha.mejor, 9), protectores: 0, usados: [...prev.racha.usados, ayer] }
        : { ...prev.racha, actual: 0, mejor: Math.max(prev.racha.mejor, 10), protectores: 0, diasActivos: prev.racha.diasActivos.filter((d) => d !== ayer && d !== today) };
      guardar({ ...prev, racha, ui: { ...prev.ui, ultimaNegativa: undefined } });
      if (!conProtector) setNegativaDemo((n) => n + 1);
    },
    negativaDemo,
  };

  return (
    <Ctx.Provider value={valor}>
      <CrecimientoCtx.Provider value={crecimientos}>{children}</CrecimientoCtx.Provider>
    </Ctx.Provider>
  );
}

export function useGamificacion() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGamificacion debe usarse dentro de <GamificacionProvider>");
  return v;
}

export { TABLA_XP };
