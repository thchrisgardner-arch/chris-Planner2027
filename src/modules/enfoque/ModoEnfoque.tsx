"use client";

/**
 * Modo enfoque (Pomodoro): bloques de trabajo y descanso (25/5 por defecto) vinculados a una tarea.
 * Pantalla mínima con Tuerca y el tiempo grande. Cada bloque completo da +10 XP (máx. 4 al día) y
 * suma horas de enfoque al proyecto de la tarea (`lifeos:enfoque`).
 */
import { MOMENTO_DE_LUGAR } from "@/lib/asistentes/momentos";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/misc";
import { Asistente } from "@/components/asistentes/Asistente";
import { useData } from "@/lib/store/DataProvider";
import { useAsistentes } from "@/lib/asistentes/estado";
import { useToday } from "@/hooks/useToday";
import { crearAlmacen } from "@/lib/almacenLocal";
import { useGamificacion } from "@/modules/asistentes/Gamificacion";

export interface SesionEnfoque {
  id: string;
  tareaId: string | null;
  proyectoId: string | null;
  fecha: string;
  minutos: number;
}
interface DatosEnfoque {
  version: 1;
  trabajo: number;
  descanso: number;
  sesiones: SesionEnfoque[];
}

export const almacenEnfoque = crearAlmacen<DatosEnfoque>(
  "lifeos:enfoque",
  () => ({ version: 1, trabajo: 25, descanso: 5, sesiones: [] }),
  (c) => ({
    version: 1,
    trabajo: Number(c.trabajo) || 25,
    descanso: Number(c.descanso) || 5,
    sesiones: Array.isArray(c.sesiones) ? (c.sesiones as SesionEnfoque[]) : [],
  }),
);

/** Horas de enfoque de un proyecto */
export function useHorasEnfoque(proyectoId: string) {
  const d = almacenEnfoque.useValor();
  return useMemo(() => d.sesiones.filter((s) => s.proyectoId === proyectoId).reduce((n, s) => n + s.minutos, 0) / 60, [d, proyectoId]);
}

/* ═════════ Abrir desde cualquier parte ═════════ */
let tareaActiva: string | null | undefined = undefined;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
/** Abre el modo enfoque (con una tarea, o null para un bloque libre) */
export function iniciarEnfoque(tareaId: string | null) {
  tareaActiva = tareaId;
  avisar();
}
function cerrarEnfoque() {
  tareaActiva = undefined;
  avisar();
}
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

const RITMOS = [
  { value: "25-5", label: "25 / 5" },
  { value: "50-10", label: "50 / 10" },
  { value: "15-3", label: "15 / 3" },
];

export function ModoEnfoque() {
  const tarea = useSyncExternalStore(suscribir, () => tareaActiva, () => undefined);
  if (tarea === undefined || typeof document === "undefined") return null;
  return createPortal(<Pantalla tareaId={tarea} />, document.body);
}

type Fase = "listo" | "trabajo" | "descanso";

function Pantalla({ tareaId }: { tareaId: string | null }) {
  const { db } = useData();
  const { estado } = useAsistentes();
  const g = useGamificacion();
  const today = useToday();
  const cfg = almacenEnfoque.useValor();
  const tuerca = estado.ajustes.tuerca;
  const tarea = tareaId ? db.tasks.find((t) => t.id === tareaId) : null;
  const [fase, setFase] = useState<Fase>("listo");
  const [fin, setFin] = useState(0);
  const [pausa, setPausa] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [inicioBloque, setInicioBloque] = useState(0);

  // Segundos que faltan: en pausa se congela lo que quedaba
  const restante = Math.ceil((pausa !== null ? pausa : Math.max(0, fin - ahora)) / 1000);
  const mm = String(Math.floor(restante / 60)).padStart(2, "0");
  const ss = String(restante % 60).padStart(2, "0");

  const guardarSesion = (minutos: number) => {
    if (minutos < 1) return;
    almacenEnfoque.cambiar((d) => ({
      ...d,
      sesiones: [...d.sesiones, { id: `ef${Date.now().toString(36)}`, tareaId, proyectoId: tarea?.project_id ?? null, fecha: today, minutos: Math.round(minutos) }].slice(-500),
    }));
  };

  const empezar = (f: "trabajo" | "descanso") => {
    const min = f === "trabajo" ? cfg.trabajo : cfg.descanso;
    setFase(f);
    setPausa(null);
    setFin(Date.now() + min * 60_000);
    setInicioBloque(Date.now());
    setAhora(Date.now());
    if (f === "trabajo") setMensaje(null);
  };

  // Reloj: se basa en la hora de fin (no se atrasa si el navegador duerme la pestaña)
  useEffect(() => {
    if (fase === "listo" || pausa !== null) return;
    const t = window.setInterval(() => setAhora(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [fase, pausa]);

  useEffect(() => {
    if (fase === "listo" || pausa !== null || ahora < fin) return;
    if (fase === "trabajo") {
      guardarSesion(cfg.trabajo);
      const xp = g.registrarEnfoque(`en:${today}:${Date.now().toString(36)}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- el bloque terminó: Tuerca aprueba
      setMensaje(xp ? `+${xp} XP. Bloque terminado: así se construye.` : "Bloque terminado. Hoy ya sumaste el máximo de XP por enfoque.");
      empezar("descanso");
    } else {
      setMensaje("Se acabó el descanso. ¿Otro bloque?");
      setFase("listo");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahora, fin, fase, pausa]);

  // Escape sale (guardando los minutos trabajados)
  const salir = () => {
    if (fase === "trabajo") guardarSesion((Date.now() - inicioBloque) / 60_000);
    cerrarEnfoque();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && salir();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, inicioBloque]);

  const pose = mensaje && fase !== "trabajo" ? "celebrando" : "idle";
  const etiqueta = fase === "trabajo" ? "Enfoque" : fase === "descanso" ? "Descanso" : "Listo para empezar";

  return (
    <div className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-bg px-6 animate-in" role="dialog" aria-modal="true" aria-labelledby="enfoque-titulo">
      <button type="button" onClick={salir} aria-label="Salir del modo enfoque" className="focus-ring absolute right-4 top-4 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-card">
        <X size={20} />
      </button>
      <Asistente id="tuerca" size={140} momento={pose === "celebrando" ? MOMENTO_DE_LUGAR["enfoque-listo"] : fase === "trabajo" ? MOMENTO_DE_LUGAR["enfoque-trabajo"] : "base"} colores={tuerca.colores} accesorio={tuerca.accesorio} nombre={`${tuerca.nombre}, ${pose === "celebrando" ? "aprobando" : "concentrado"}`} />
      <p className="mt-4 text-[13px] font-medium uppercase tracking-[0.08em] text-muted">{etiqueta}</p>
      <h2 id="enfoque-titulo" className="mt-1 max-w-[520px] text-center text-[18px] font-bold leading-snug">
        {tarea ? tarea.name : "Bloque libre"}
      </h2>
      <p className="figure mt-4 text-[88px] leading-none sm:text-[120px]" aria-live="off" role="timer" aria-label={`${mm} minutos y ${ss} segundos`}>
        {fase === "listo" ? `${String(cfg.trabajo).padStart(2, "0")}:00` : `${mm}:${ss}`}
      </p>
      <p className="mt-3 min-h-[22px] text-center text-[14px] text-muted" aria-live="polite">
        {mensaje ? `${tuerca.nombre}: ${mensaje}` : fase === "listo" ? `${tuerca.nombre}: una cosa a la vez.` : ""}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {fase === "listo" ? (
          <>
            <Segmented
              size="md"
              label="Ritmo de trabajo y descanso"
              value={`${cfg.trabajo}-${cfg.descanso}`}
              onChange={(v) => {
                const [t, d] = v.split("-").map(Number);
                almacenEnfoque.cambiar((x) => ({ ...x, trabajo: t, descanso: d }));
              }}
              options={RITMOS}
            />
            <Button variant="primary" onClick={() => empezar("trabajo")} data-autofocus>
              <Play size={18} /> Empezar
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              onClick={() => {
                if (pausa !== null) {
                  setFin(Date.now() + pausa);
                  setPausa(null);
                  setAhora(Date.now());
                } else setPausa(Math.max(0, fin - Date.now()));
              }}
            >
              {pausa !== null ? <Play size={18} /> : <Pause size={18} />} {pausa !== null ? "Seguir" : "Pausar"}
            </Button>
            {fase === "descanso" ? (
              <Button onClick={() => empezar("trabajo")}>Saltar descanso</Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
