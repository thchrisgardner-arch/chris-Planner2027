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
  evaluarLogros,
  nivelDeXP,
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
import { ASISTENTE_IDS, type AsistenteId } from "@/lib/asistentes/tipos";

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
  | { tipo: "desbloqueo"; asistente: AsistenteId; item: Desbloqueo };

interface Valor {
  progreso: Progreso;
  activo: boolean;
  xp: number;
  nivel: ReturnType<typeof nivelDeXP>;
  vinculos: Record<AsistenteId, ReturnType<typeof vinculoDeXP>>;
  saludes: Record<AsistenteId, SaludModulo>;
  general: { puntaje: number | null; animo: Animo };
  reacciones: Reaccion[];
  cerrarReaccion: (id: number) => void;
  celebraciones: Celebracion[];
  cerrarCelebraciones: () => void;
  revisionPendiente: boolean;
  completarRevision: () => void;
  posponerRevision: () => void;
  negativaHoy: () => boolean;
  marcarNegativa: () => void;
  cambiarAjustes: (p: Partial<Progreso["ajustes"]>) => void;
  /* Solo modo demo */
  demo: boolean;
  forzarSalud: Partial<Record<AsistenteId, number | null>>;
  setForzarSalud: (v: Partial<Record<AsistenteId, number | null>>) => void;
  sumarXPDemo: (xp: number, asistente: AsistenteId) => void;
  celebrarDemo: (c: Celebracion) => void;
  romperRachaDemo: (conProtector: boolean) => void;
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
  const [revisionOculta, setRevisionOculta] = useState(false);
  const [negativaDemo, setNegativaDemo] = useState(0);
  const seqR = useRef(0);
  const principal = estado.principal;

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      puntero.x = e.clientX;
      puntero.y = e.clientY;
      puntero.t = Date.now();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
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
      // Celebraciones grandes: nivel, etapa, logro, desbloqueo
      const pref = next.ajustes.celebraciones;
      if (pref === "ninguna") return;
      const cola: Celebracion[] = [];
      const nA = nivelDeXP(xpTotal(prev));
      const nB = nivelDeXP(xpTotal(next));
      if (nB.nivel > nA.nivel) cola.push({ tipo: "nivel", nivel: nB.nivel, etapa: nB.etapa, cambioEtapa: nB.etapa !== nA.etapa });
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
      }
      if (cola.length) setCelebraciones((c) => [...c, ...cola]);
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
    const next: Progreso = { ...r.next, logros, ui: { ...r.next.ui, iniciado: r.next.ui.iniciado ?? today } };
    const cambio = JSON.stringify(next) !== JSON.stringify(prev);
    if (cambio) guardar(next);
    emitir(prev, next, r.nuevos, silencio);
  }, [db, status, today, principal, emitir]);

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
  const nivel = nivelDeXP(xp);
  const vinculos = useMemo(() => {
    const porA = xpPorAsistente(progreso);
    return Object.fromEntries(ASISTENTE_IDS.map((id) => [id, vinculoDeXP(porA[id])])) as Record<AsistenteId, ReturnType<typeof vinculoDeXP>>;
  }, [progreso]);
  const general = animoGeneral(ASISTENTE_IDS.filter((id) => estado.ajustes[id].activo).map((id) => saludes[id]));
  const semana = today ? semanaDe(today) : "";
  const revisionPendiente =
    progreso.ajustes.gamificacion && !revisionOculta && status === "ready" && progreso.ui.iniciado !== undefined && progreso.ui.iniciado < today && progreso.ui.ultimaRevision !== semana;

  const valor: Valor = {
    progreso,
    activo: progreso.ajustes.gamificacion,
    xp,
    nivel,
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
    sumarXPDemo: (cantidad, asistente) => {
      if (mode !== "demo") return;
      const prev = leer();
      const ev: EventoXP = { id: `demo${Date.now()}`, tipo: "habito", xp: cantidad, fecha: today, refId: `demo:${Date.now()}`, asistente };
      const next = { ...prev, eventos: [...prev.eventos, ev] };
      const logros = { ...next.logros };
      for (const id of evaluarLogros(db, next, today)) logros[id] = today;
      const n2 = { ...next, logros };
      guardar(n2);
      emitir(prev, n2, [ev], false);
    },
    celebrarDemo: (c) => mode === "demo" && setCelebraciones((x) => [...x, c]),
    romperRachaDemo: (conProtector) => {
      if (mode !== "demo") return;
      const prev = leer();
      const ayer = new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10);
      const racha = conProtector
        ? { ...prev.racha, actual: Math.max(prev.racha.actual, 9), mejor: Math.max(prev.racha.mejor, 9), protectores: 0, usados: [...prev.racha.usados, ayer] }
        : { ...prev.racha, actual: 0, mejor: Math.max(prev.racha.mejor, 10), protectores: 0, diasActivos: prev.racha.diasActivos.filter((d) => d !== ayer && d !== today) };
      guardar({ ...prev, racha, ui: { ...prev.ui, ultimaNegativa: undefined } });
      if (!conProtector) setNegativaDemo((n) => n + 1);
    },
    negativaDemo,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useGamificacion() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGamificacion debe usarse dentro de <GamificacionProvider>");
  return v;
}

export { TABLA_XP };
