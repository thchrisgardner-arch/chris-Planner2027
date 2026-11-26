"use client";

/**
 * Avisos al celular (Web Push).
 *  - AvisosCelular: tarjeta en Configuración → Progreso para activarlos, elegir los recordatorios y probarlos.
 *  - SincronizarAvisos: con los avisos activos, manda al servidor un resumen mínimo (conteos y horas,
 *    nunca nombres ni montos) para que cada asistente avise solo lo que falta.
 * En iPhone solo funcionan con la app instalada en la pantalla de inicio (iOS 16.4 o más).
 * El permiso se pide solo al tocar "Activar avisos", nunca al abrir la app.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Share, SquarePlus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { Asistente } from "@/components/asistentes/Asistente";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { resumenHoy } from "@/lib/asistentes/resumenHoy";
import { ASISTENTE_IDS, type AsistenteId } from "@/lib/asistentes/tipos";
import type { DiaAvisos, EstadoAvisos } from "@/lib/avisos/almacen";
import { horasDeRecordatorios } from "@/lib/avisos/mensajes";
import { registrarSW } from "@/lib/pwa";
import { isScheduled } from "@/modules/habits/selectors";
import { useGamificacion } from "@/modules/asistentes/Gamificacion";
import { addDays } from "@/utils/dates";
import type { Database } from "@/types/db";
import { cn } from "@/utils/cn";

const CLAVE = "lifeos:avisos";
const LLAVE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const HORAS_OPC = Array.from({ length: 17 }, (_, i) => i + 6); // 6 a. m. a 10 p. m.

type Recordatorios = NonNullable<EstadoAvisos["recordatorios"]>;
type Config = { activo: boolean; horas: number[]; recordatorios: Recordatorios };
const REC_DEFECTO: Recordatorios = { habitos: 19, agenda: 8, racha: true };

function leerConfig(): Config {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE) ?? "null");
    if (c && Array.isArray(c.horas)) {
      // Migración: la versión anterior solo tenía horas sueltas
      const rec: Recordatorios = c.recordatorios ?? { ...REC_DEFECTO, agenda: (c.horas as number[]).find((h) => h < 12) ?? REC_DEFECTO.agenda };
      return { activo: !!c.activo, horas: c.horas, recordatorios: rec };
    }
  } catch {
    /* sin acceso al almacenamiento */
  }
  return { activo: false, horas: [], recordatorios: REC_DEFECTO };
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

/** Conteos de un día: eventos, pagos fijos pendientes y hábitos programados */
function diaAvisos(db: Database, fecha: string): DiaAvisos {
  const eventos = db.calendar_events.filter((e) => e.date === fecha);
  const horas = eventos.map((e) => e.start_time?.slice(0, 5)).filter((h): h is string => !!h).sort();
  const pendientes = db.transactions.filter((t) => t.status === "pendiente");
  return {
    eventos: eventos.length,
    primerEvento: horas[0] ?? null,
    pagosVencen: pendientes.filter((t) => t.date >= fecha && t.date <= addDays(fecha, 2)).length,
    pagosVencidos: pendientes.filter((t) => t.date < fecha).length,
    habitos: db.habits.filter((h) => isScheduled(h, fecha)).length,
  };
}

/** Resumen que viaja al servidor (sin montos ni nombres de tus registros) */
function useEstadoAvisos(recordatorios: Recordatorios): EstadoAvisos | null {
  const g = useGamificacion();
  const { db } = useData();
  const today = useToday();
  const { estado } = useAsistentes();
  return useMemo(() => {
    if (!today) return null;
    const r = resumenHoy(db, today);
    const voces: EstadoAvisos["voces"] = {};
    for (const id of ASISTENTE_IDS) {
      const a = estado.ajustes[id];
      if (a.activo) voces[id] = { nombre: a.nombre, modo: a.avisos };
    }
    return {
      version: 2,
      fecha: today,
      racha: g.progreso.racha.actual,
      hechoHoy: g.progreso.racha.diasActivos.includes(today),
      habitosPendientes: r.habitosPendientes,
      tareasPendientes: r.tareasPendientes,
      asistente: estado.ajustes[estado.principal].nombre,
      principal: estado.principal,
      voces,
      recordatorios,
      hoy: diaAvisos(db, today),
      manana: diaAvisos(db, addDays(today, 1)),
    };
  }, [db, today, g.progreso.racha, estado, recordatorios]);
}

async function enviarAlServidor(sub: PushSubscription, estado: EstadoAvisos | null, recordatorios: Recordatorios) {
  const horas = horasDeRecordatorios({ recordatorios, voces: estado?.voces });
  const r = await fetch("/api/avisos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), horas: horas.length ? horas : [20], estado }),
  });
  if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "No se pudo guardar.");
}

type Fase = "cargando" | "sin-soporte" | "instalar" | "sin-llave" | "denegado" | "inactivo" | "activo";

export function AvisosCelular() {
  const { mode } = useData();
  const { toast } = useFeedback();
  const { estado: asistentes } = useAsistentes();
  const [fase, setFase] = useState<Fase>("cargando");
  const [rec, setRec] = useState<Recordatorios>(REC_DEFECTO);
  const estadoDia = useEstadoAvisos(rec);
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
      setRec(cfg.recordatorios);
      setFase(f);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const activar = async () => {
    setOcupado(true);
    try {
      const reg = (await registrarSW())!;
      await navigator.serviceWorker.ready;
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setFase(permiso === "denied" ? "denegado" : "inactivo");
        return;
      }
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ABytes(LLAVE) }));
      await enviarAlServidor(sub, estadoDia, rec);
      guardarConfig({ activo: true, horas: horasDeRecordatorios({ recordatorios: rec, voces: estadoDia?.voces }), recordatorios: rec });
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
      guardarConfig({ ...leerConfig(), activo: false, recordatorios: rec });
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

  const cambiar = async (patch: Partial<Recordatorios>) => {
    const next = { ...rec, ...patch };
    setRec(next);
    guardarConfig({ ...leerConfig(), activo: fase === "activo", recordatorios: next });
    if (fase === "activo") {
      const sub = await suscripcionActual();
      if (sub) await enviarAlServidor(sub, estadoDia && { ...estadoDia, recordatorios: next }, next).catch(() => toast("No se pudieron guardar los recordatorios"));
    }
  };

  const demo = mode === "demo";
  const silenciado = (id: AsistenteId) => !asistentes.ajustes[id].activo || asistentes.ajustes[id].avisos === "nunca";
  const filas: { id: AsistenteId; titulo: string; detalle: string; control: React.ReactNode }[] = [
    {
      id: "brote",
      titulo: "Hábitos pendientes",
      detalle: "Solo si te falta alguno ese día.",
      control: (
        <Select aria-label="Hora del recordatorio de hábitos" value={rec.habitos === null ? "" : String(rec.habitos)} onChange={(e) => cambiar({ habitos: e.target.value === "" ? null : Number(e.target.value) })} disabled={demo}>
          <option value="">Apagado</option>
          {HORAS_OPC.map((h) => (
            <option key={h} value={String(h)}>
              {etiquetaHora(h)}
            </option>
          ))}
        </Select>
      ),
    },
    {
      id: "tic",
      titulo: "Agenda del día",
      detalle: "Eventos de hoy y pagos fijos por vencer.",
      control: (
        <Select aria-label="Hora del recordatorio de la agenda" value={rec.agenda === null ? "" : String(rec.agenda)} onChange={(e) => cambiar({ agenda: e.target.value === "" ? null : Number(e.target.value) })} disabled={demo}>
          <option value="">Apagado</option>
          {HORAS_OPC.map((h) => (
            <option key={h} value={String(h)}>
              {etiquetaHora(h)}
            </option>
          ))}
        </Select>
      ),
    },
    {
      id: asistentes.principal,
      titulo: "Racha en riesgo",
      detalle: "A las 8:00 p. m., si ese día no has registrado nada.",
      control: <Switch checked={rec.racha} onChange={(v) => cambiar({ racha: v })} label="Recordatorio de racha en riesgo" disabled={demo} />,
    },
  ];

  return (
    <Card>
      <CardHeader title="Avisos en el celular" subtitle="Cada asistente te recuerda lo suyo, aunque la app esté cerrada" />
      {fase === "instalar" ? (
        <div className="rounded-[20px] bg-bg-2 p-4 text-[14px]">
          <p className="font-medium">Primero instala LIFE for LIFE en tu iPhone</p>
          <ol className="mt-2 grid gap-2 text-muted">
            <li className="flex items-center gap-2">
              1. Toca <Share size={16} className="text-fg" aria-label="Compartir" /> Compartir en Safari.
            </li>
            <li className="flex items-center gap-2">
              2. Elige <SquarePlus size={16} className="text-fg" aria-hidden /> «Agregar a inicio».
            </li>
            <li>3. Abre LIFE for LIFE desde el ícono nuevo y vuelve a esta sección.</li>
          </ol>
          <p className="mt-2 text-[12.5px] text-dim">Apple solo permite avisos a apps instaladas (iOS 16.4 o más).</p>
        </div>
      ) : fase === "sin-soporte" ? (
        <p className="rounded-[20px] bg-bg-2 p-4 text-[14px] text-muted">Este navegador no admite avisos. En iPhone, usa la app instalada desde Safari.</p>
      ) : fase === "sin-llave" ? (
        <p className="rounded-[20px] bg-bg-2 p-4 text-[14px] text-muted">Los avisos aún no están configurados en el servidor (faltan las llaves VAPID).</p>
      ) : fase === "denegado" ? (
        <p className="rounded-[20px] bg-bg-2 p-4 text-[14px] text-muted">
          Bloqueaste los avisos para LIFE for LIFE. Actívalos en Ajustes del iPhone → Notificaciones → LIFE for LIFE y vuelve aquí.
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
                <p className="text-[13px] text-muted">{demo ? "En modo demo no se pueden activar." : "Nunca llega un aviso si ya cumpliste."}</p>
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
            <p className="text-[14.5px] font-medium">Recordatorios</p>
            <p className="mt-0.5 text-[13px] text-muted">Hora de Colombia; pueden llegar unos minutos tarde. Para silenciar a un asistente, elige «Nunca» en sus avisos (Configuración → Asistentes).</p>
            <ul className="mt-3 grid gap-2">
              {filas.map((f) => {
                const a = asistentes.ajustes[f.id];
                return (
                  <li key={f.titulo} className={cn("flex flex-wrap items-center gap-3 rounded-[16px] bg-card px-3 py-2.5", silenciado(f.id) && "opacity-60")}>
                    <Asistente id={f.id} size={40} colores={a.colores} accesorio={a.accesorio} decorativo animado={false} />
                    <div className="min-w-0 flex-1 basis-[160px]">
                      <p className="text-[14px] font-medium">
                        {a.nombre} · {f.titulo}
                      </p>
                      <p className="text-[12.5px] text-muted">{silenciado(f.id) ? `${a.nombre} tiene los avisos en «Nunca».` : f.detalle}</p>
                    </div>
                    <div className="w-[160px] shrink-0">{f.control}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

/** Mantiene al día el resumen que usan los avisos (solo con los avisos activos y fuera del modo demo). */
export function SincronizarAvisos() {
  const { mode } = useData();
  const [rec] = useState(() => (typeof window === "undefined" ? REC_DEFECTO : leerConfig().recordatorios));
  const estado = useEstadoAvisos(rec);
  const ultimo = useRef("");
  const clave = estado ? JSON.stringify(estado) : "";

  useEffect(() => {
    if (mode === "demo" || !estado || clave === ultimo.current || !leerConfig().activo) return;
    const t = setTimeout(async () => {
      try {
        const sub = await suscripcionActual();
        if (!sub) return;
        const cfg = leerConfig();
        await enviarAlServidor(sub, { ...estado, recordatorios: cfg.recordatorios }, cfg.recordatorios);
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
