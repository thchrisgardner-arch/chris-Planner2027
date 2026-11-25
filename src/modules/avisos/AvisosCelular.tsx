"use client";

/**
 * Avisos al celular (Web Push).
 *  - AvisosCelular: tarjeta en Configuración → Progreso para activarlos, elegir horas y probarlos.
 *  - SincronizarAvisos: con los avisos activos, manda al servidor un resumen mínimo del día
 *    (racha y número de pendientes) para que el aviso diga qué falta y no moleste si ya cumpliste.
 * En iPhone solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4 o más).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Share, SquarePlus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { resumenHoy } from "@/lib/asistentes/resumenHoy";
import type { EstadoAvisos } from "@/lib/avisos/almacen";
import { useGamificacion } from "@/modules/asistentes/Gamificacion";
import { cn } from "@/utils/cn";

const CLAVE = "lifeos:avisos";
const HORAS = [7, 8, 9, 12, 15, 18, 20, 21, 22];
const POR_DEFECTO = [9, 20];
const LLAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type Config = { activo: boolean; horas: number[] };

function leerConfig(): Config {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
    if (c && Array.isArray(c.horas)) return { activo: !!c.activo, horas: c.horas };
  } catch {
    /* sin acceso al almacenamiento */
  }
  return { activo: false, horas: POR_DEFECTO };
}
function guardarConfig(c: Config) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(c));
  } catch {
    /* sin acceso al almacenamiento */
  }
}

const etiquetaHora = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "a. m." : "p. m."}`;

function base64ABytes(b64: string) {
  const relleno = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function suscripcionActual() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Resumen del día que viaja al servidor (sin montos ni nombres de tus registros) */
function useEstadoAvisos(): EstadoAvisos | null {
  const g = useGamificacion();
  const { db } = useData();
  const today = useToday();
  const { estado } = useAsistentes();
  return useMemo(() => {
    if (!today) return null;
    const r = resumenHoy(db, today);
    return {
      fecha: today,
      racha: g.progreso.racha.actual,
      hechoHoy: g.progreso.racha.diasActivos.includes(today),
      habitosPendientes: r.habitosPendientes,
      tareasPendientes: r.tareasPendientes,
      asistente: estado.ajustes[estado.principal].nombre,
    };
  }, [db, today, g.progreso.racha, estado]);
}

async function enviarAlServidor(sub: PushSubscription, horas: number[], estado: EstadoAvisos | null) {
  const r = await fetch("/api/avisos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), horas, estado }),
  });
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "No se pudo guardar.");
}

type Fase = "cargando" | "sin-soporte" | "instalar" | "sin-llave" | "denegado" | "inactivo" | "activo";

export function AvisosCelular() {
  const { mode } = useData();
  const { toast } = useFeedback();
  const estadoDia = useEstadoAvisos();
  const [fase, setFase] = useState<Fase>("cargando");
  const [horas, setHoras] = useState<number[]>(POR_DEFECTO);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const cfg = leerConfig();
      const ua = navigator.userAgent;
      const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const soporte = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      let f: Fase;
      if (!soporte) f = ios && !instalada ? "instalar" : "sin-soporte";
      else if (!LLAVE) f = "sin-llave";
      else if (Notification.permission === "denied") f = "denegado";
      else f = cfg.activo && (await suscripcionActual()) ? "activo" : "inactivo";
      if (!vivo) return;
      setHoras(cfg.horas);
      setFase(f);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const activar = async () => {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      await navigator.serviceWorker.ready;
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setFase(permiso === "denied" ? "denegado" : "inactivo");
        return;
      }
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ABytes(LLAVE) }));
      await enviarAlServidor(sub, horas, estadoDia);
      guardarConfig({ activo: true, horas });
      setFase("activo");
      toast("Avisos activados");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudieron activar los avisos");
    } finally {
      setOcupado(false);
    }
  };

  const desactivar = async () => {
    setOcupado(true);
    try {
      const sub = await suscripcionActual();
      if (sub) {
        await fetch("/api/avisos", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      guardarConfig({ activo: false, horas });
      setFase("inactivo");
      toast("Avisos desactivados");
    } finally {
      setOcupado(false);
    }
  };

  const probar = async () => {
    setOcupado(true);
    try {
      const sub = await suscripcionActual();
      if (!sub) throw new Error("Este dispositivo no tiene avisos activos.");
      const r = await fetch("/api/avisos/prueba", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "No se pudo enviar.");
      toast("Aviso de prueba enviado");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo enviar el aviso");
    } finally {
      setOcupado(false);
    }
  };

  const cambiarHora = async (h: number) => {
    const next = horas.includes(h) ? horas.filter((x) => x !== h) : [...horas, h].sort((a, b) => a - b);
    if (!next.length) return;
    setHoras(next);
    guardarConfig({ activo: fase === "activo", horas: next });
    if (fase === "activo") {
      const sub = await suscripcionActual();
      if (sub) await enviarAlServidor(sub, next, estadoDia).catch(() => toast("No se pudieron guardar las horas"));
    }
  };

  const demo = mode === "demo";

  return (
    <Card>
      <CardHeader title="Avisos en el celular" subtitle="Recordatorios de tu racha y de lo que te falta hoy, aunque la app esté cerrada" />
      {fase === "instalar" ? (
        <div className="rounded-[20px] bg-bg-2 p-4 text-[14px]">
          <p className="font-medium">Primero instala LIFE OS en tu iPhone</p>
          <ol className="mt-2 grid gap-2 text-muted">
            <li className="flex items-center gap-2">
              1. Toca <Share size={16} className="text-fg" aria-label="Compartir" /> Compartir en Safari.
            </li>
            <li className="flex items-center gap-2">
              2. Elige <SquarePlus size={16} className="text-fg" aria-hidden /> «Agregar a inicio».
            </li>
            <li>3. Abre LIFE OS desde el ícono nuevo y vuelve a esta sección.</li>
          </ol>
          <p className="mt-2 text-[12.5px] text-dim">Apple solo permite avisos a apps instaladas (iOS 16.4 o más).</p>
        </div>
      ) : fase === "sin-soporte" ? (
        <p className="rounded-[20px] bg-bg-2 p-4 text-[14px] text-muted">Este navegador no admite avisos. En iPhone, usa la app instalada desde Safari.</p>
      ) : fase === "sin-llave" ? (
        <p className="rounded-[20px] bg-bg-2 p-4 text-[14px] text-muted">Los avisos aún no están configurados en el servidor (faltan las llaves VAPID).</p>
      ) : fase === "denegado" ? (
        <p className="rounded-[20px] bg-bg-2 p-4 text-[14px] text-muted">
          Bloqueaste los avisos para LIFE OS. Actívalos en Ajustes del iPhone → Notificaciones → LIFE OS y vuelve aquí.
        </p>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-bg-2 p-4">
            <div className="flex items-center gap-3">
              <span className={cn("grid h-10 w-10 place-items-center rounded-full", fase === "activo" ? "bg-brand text-[#0a0a0a]" : "bg-card text-muted")}>
                <BellRing size={18} />
              </span>
              <div>
                <p className="text-[14.5px] font-medium">{fase === "activo" ? "Avisos activos en este dispositivo" : "Avisos apagados"}</p>
                <p className="text-[13px] text-muted">{demo ? "En modo demo no se pueden activar." : "Solo llega uno por hora elegida y nunca si ya cumpliste todo."}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {fase === "activo" ? (
                <>
                  <Button variant="secondary" className="bg-card" onClick={probar} disabled={ocupado}>
                    Probar
                  </Button>
                  <Button variant="secondary" className="bg-card" onClick={desactivar} disabled={ocupado}>
                    Desactivar
                  </Button>
                </>
              ) : (
                <Button variant="primary" onClick={activar} disabled={ocupado || demo || fase === "cargando"}>
                  Activar avisos
                </Button>
              )}
            </div>
          </div>
          <div className="rounded-[20px] bg-bg-2 p-4">
            <p className="text-[14.5px] font-medium">Horas de los avisos</p>
            <p className="mt-0.5 text-[13px] text-muted">Hora de Colombia. Puede llegar unos minutos tarde.</p>
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Horas de los avisos">
              {HORAS.map((h) => {
                const on = horas.includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={on}
                    disabled={demo}
                    onClick={() => cambiarHora(h)}
                    className={cn("focus-ring h-9 cursor-pointer rounded-full px-3 text-[13px] font-medium", on ? "bg-fg text-on-fg" : "bg-card hover:bg-elev")}
                  >
                    {etiquetaHora(h)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Mantiene al día el resumen que usan los avisos (solo con los avisos activos y fuera del modo demo). */
export function SincronizarAvisos() {
  const { mode } = useData();
  const estado = useEstadoAvisos();
  const ultimo = useRef("");
  const clave = estado ? JSON.stringify(estado) : "";

  useEffect(() => {
    if (mode === "demo" || !estado || clave === ultimo.current || !leerConfig().activo) return;
    const t = setTimeout(async () => {
      try {
        const sub = await suscripcionActual();
        if (!sub) return;
        await enviarAlServidor(sub, leerConfig().horas, estado);
        ultimo.current = clave;
      } catch {
        /* sin conexión: se reintenta en el próximo cambio */
      }
    }, 2500);
    return () => clearTimeout(t);
    // clave resume `estado`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, mode]);

  return null;
}
