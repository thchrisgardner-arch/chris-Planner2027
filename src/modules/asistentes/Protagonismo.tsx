"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/Enlace";
import { ArrowUpRight, X } from "lucide-react";
import { Asistente } from "@/components/asistentes/Asistente";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { FICHAS } from "@/lib/asistentes/definiciones";
import { getMensajeAsistente } from "@/lib/asistentes/motor";
import { ANIMO_LABEL, poseDeAnimo } from "@/lib/asistentes/animo";
import { REACCION } from "@/lib/asistentes/reacciones";
import { ASISTENTE_IDS, type AsistenteId } from "@/lib/asistentes/tipos";
import { addDays, relativeDay } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { useGamificacion, type Reaccion } from "./Gamificacion";
import { almacenAnimo, diaDificil } from "@/lib/animoUsuario";

/* ═════════ Ícono propio de racha (llama geométrica) ═════════ */
export function IconoRacha({ size = 20, apagado, className }: { size?: number; apagado?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={className}>
      <path d="M12 2c1 3.6 5.5 6.2 5.5 11.2A5.5 5.5 0 0 1 12 22a5.5 5.5 0 0 1-5.5-5.6c0-2.6 1.4-4.3 2.6-5.6.4 1.6 1.2 2.6 2.3 3C11 10 10.6 5.6 12 2Z" style={{ fill: apagado ? "var(--color-elev)" : "var(--char-yellow)" }} />
      <path d="M12 13.5c.6 1.4 2.6 2.4 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.5.8-2.4 1.6-3 .1.9.5 1.3 1 1.5-.3-1-.4-2.1 0-3.1Z" style={{ fill: apagado ? "var(--color-line-strong)" : "var(--char-yellow-shade)" }} />
    </svg>
  );
}

/** Barra de XP: relleno lima sobre gris, radio completo */
export function BarraXP({ valor, max, className, grosor = "h-2.5" }: { valor: number; max: number; className?: string; grosor?: string }) {
  const pct = max ? Math.min(100, Math.round((valor / max) * 100)) : 100;
  return (
    <div className={cn("overflow-hidden rounded-full bg-elev", grosor, className)} role="progressbar" aria-label="XP hacia el siguiente nivel" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={max}>
      <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ═════════ Inicio: tarjeta héroe ═════════ */
export function HeroAsistente({ nombreUsuario }: { nombreUsuario?: string }) {
  const { db } = useData();
  const today = useToday();
  const { estado } = useAsistentes();
  const g = useGamificacion();
  const [elegido, setElegido] = useState<AsistenteId | null>(null);
  const activos = ASISTENTE_IDS.filter((id) => estado.ajustes[id].activo);
  const id = elegido && estado.ajustes[elegido].activo ? elegido : estado.principal;
  const a = estado.ajustes[id];
  const msg = useMemo(() => getMensajeAsistente(id, { db, today, tono: a.tono, forzarSalud: g.demo ? g.forzarSalud : undefined }), [id, db, today, a.tono, g.demo, g.forzarSalud]);
  const pose = a.expresion !== "idle" ? a.expresion : msg.expresion;
  const radiante = g.general.animo === "radiante";
  const animo = msg.animo ? ANIMO_LABEL[msg.animo].toLowerCase() : "";

  return (
    <section aria-label={`${a.nombre}, tu asistente`} className={cn("card relative mt-12 grid gap-5 p-5 sm:p-6 lg:grid-cols-[220px_minmax(0,1fr)_260px] lg:items-center", radiante && "card-warm")}>
      {/* Personaje grande que sobresale del borde superior */}
      <div className="-mt-16 flex justify-center lg:-mt-24 lg:justify-start">
        <div className="hidden lg:block">
          <Asistente id={id} size={230} pose={pose} colores={a.colores} accesorio={a.accesorio} mostrarProp={a.mostrarProp} nombre={a.nombre} interactivo celebrar={elegido ? 1 : 0} />
        </div>
        <div className="lg:hidden">
          <Asistente id={id} size={168} pose={pose} colores={a.colores} accesorio={a.accesorio} mostrarProp={a.mostrarProp} nombre={a.nombre} interactivo />
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-[13px] text-muted">
          {nombreUsuario ? `Hola, ${nombreUsuario} · ` : ""}
          {a.nombre} · {FICHAS[id].modulo}
          {animo ? ` · ${animo}` : ""}
        </p>
        {a.avisos !== "nunca" ? (
          <p aria-live="polite" className="mt-2 text-[20px] font-normal leading-snug text-fg sm:text-[22px]">
            {msg.texto}
          </p>
        ) : (
          <p className="mt-2 text-[20px] font-normal text-fg sm:text-[22px]">Aquí estoy si me necesitas.</p>
        )}
        {msg.accion ? (
          <Link href={msg.accion.href} className="focus-ring mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-fg px-4 text-[13.5px] font-medium text-on-fg">
            {msg.accion.label} <ArrowUpRight size={15} />
          </Link>
        ) : null}
        {/* Ánimo de cada módulo: clic para darle el protagonismo */}
        <div className="mt-5 flex flex-wrap gap-1.5" role="group" aria-label="Ánimo de tus asistentes">
          {activos.map((x) => {
            const s = g.saludes[x];
            const sel = x === id;
            return (
              <button
                key={x}
                type="button"
                aria-pressed={sel}
                aria-label={`Ver a ${estado.ajustes[x].nombre}, ${ANIMO_LABEL[s.animo].toLowerCase()}`}
                title={`${estado.ajustes[x].nombre} · ${ANIMO_LABEL[s.animo]}${s.puntaje !== null ? ` · ${s.puntaje}` : ""}`}
                onClick={() => setElegido(x)}
                className={cn("focus-ring grid h-11 w-11 cursor-pointer place-items-center rounded-full transition-colors", sel ? "bg-bg ring-2 ring-fg" : "bg-bg/70 hover:bg-bg")}
              >
                <Asistente id={x} size={32} pose={poseDeAnimo(s.animo, today)} colores={estado.ajustes[x].colores} animado={false} fx={false} decorativo />
              </button>
            );
          })}
        </div>
      </div>

      {g.activo ? (
        <Link href="/progreso" aria-label="Ver tu progreso" className="focus-ring flex flex-col gap-4 rounded-[20px] bg-bg p-4 transition-colors hover:bg-bg/80">
          <div>
            <p className="figure text-[40px]">Nivel {g.nivel.nivel}</p>
            <p className="mt-1 text-[13px] text-muted">{g.nivel.etapa}</p>
          </div>
          <div>
            <BarraXP valor={g.nivel.xpEnNivel} max={g.nivel.xpParaSiguiente} />
            <p className="num mt-1.5 text-[12.5px] text-muted">{g.nivel.xpParaSiguiente ? `${g.nivel.xpEnNivel} / ${g.nivel.xpParaSiguiente} XP` : "Nivel máximo"}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <IconoRacha size={30} apagado={!g.progreso.racha.actual} />
            <p>
              <span className="figure text-[30px]">{g.progreso.racha.actual}</span>
              <span className="ml-1.5 text-[13px] text-muted">{g.progreso.racha.actual === 1 ? "día de racha" : "días de racha"}</span>
            </p>
          </div>
        </Link>
      ) : null}
    </section>
  );
}

/* ═════════ Encabezado: píldoras de racha y nivel ═════════ */
export function PildorasProgreso({ compacto }: { compacto?: boolean }) {
  const g = useGamificacion();
  if (!g.activo) return null;
  const pct = g.nivel.xpParaSiguiente ? Math.round((g.nivel.xpEnNivel / g.nivel.xpParaSiguiente) * 100) : 100;
  return (
    <Link href="/progreso" aria-label={`Racha de ${g.progreso.racha.actual} días, nivel ${g.nivel.nivel}. Ver progreso`} className="focus-ring flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-card px-3 text-[13.5px] font-medium hover:bg-elev">
      <span className="flex items-center gap-1">
        <IconoRacha size={18} apagado={!g.progreso.racha.actual} />
        <span className="num">{g.progreso.racha.actual}</span>
      </span>
      <span className="h-4 w-px bg-line-strong" aria-hidden />
      <span className="flex items-center gap-1.5">
        <span className="num">Nv. {g.nivel.nivel}</span>
        {!compacto ? (
          <span className="h-1.5 w-12 overflow-hidden rounded-full bg-elev" aria-hidden>
            <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/* ═════════ Reacciones inmediatas (+XP y aviso del asistente) ═════════ */
export function CapaReacciones() {
  const g = useGamificacion();
  const { estado } = useAsistentes();
  return (
    <>
      <div aria-live="polite" className="sr-only">
        {g.reacciones.map((r) => `+${r.xp} XP`).join(". ")}
      </div>
      {g.reacciones.map((r) =>
        r.x !== undefined && r.y !== undefined ? (
          <span key={`f${r.id}`} aria-hidden className="xp-flotante pointer-events-none fixed z-[90] -translate-x-1/2 text-[15px] font-bold text-brand-soft" style={{ left: r.x, top: r.y - 12 }}>
            +{r.xp} XP
          </span>
        ) : null,
      )}
      <div className="pointer-events-none fixed inset-x-3 bottom-24 z-[85] flex flex-col items-center gap-2 md:inset-x-auto md:bottom-6 md:right-6 md:items-end">
        {g.reacciones.map((r) => (
          <ToastReaccion key={r.id} r={r} tono={estado.ajustes[r.asistente].tono} onClose={() => g.cerrarReaccion(r.id)} />
        ))}
      </div>
    </>
  );
}

function ToastReaccion({ r, tono, onClose }: { r: Reaccion; tono: "seco" | "motivador" | "tranquilo"; onClose: () => void }) {
  const { estado } = useAsistentes();
  const a = estado.ajustes[r.asistente];
  const cfg = REACCION[r.tipo];
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [r.id, onClose]);
  return (
    <div role="status" className="pointer-events-auto flex w-full max-w-[360px] items-center gap-3 rounded-[22px] bg-bg py-2 pl-2 pr-3 shadow-[0_0_0_1px_var(--color-line)] animate-in">
      <Asistente id={r.asistente} size={56} pose={r.xp >= 30 ? "celebrando" : cfg.pose} momento={r.tipo === "habito" && r.xp < 30 ? "aprobando" : undefined} colores={a.colores} accesorio={a.accesorio} mostrarProp={a.mostrarProp} decorativo celebrar={r.id} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-fg">{cfg.frase[tono]}</p>
        <p className="num text-[12.5px] text-brand-soft">
          +{r.xp} XP{r.cantidad > 1 ? ` · ${r.cantidad} ${cfg.plural[1]}` : ""}
        </p>
      </div>
      <button type="button" onClick={onClose} aria-label="Cerrar" className="focus-ring grid h-8 w-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-card">
        <X size={15} />
      </button>
    </div>
  );
}

/* ═════════ Reacción negativa puntual (máx. 1 al día, siempre con salida) ═════════ */
export function ReaccionNegativa() {
  const { db } = useData();
  const today = useToday();
  const { estado } = useAsistentes();
  const g = useGamificacion();
  const [visible, setVisible] = useState<null | { id: AsistenteId; texto: string; accion: { label: string; href: string }; pose: "triste" | "molesto" }>(null);

  useEffect(() => {
    const forzada = g.demo && g.negativaDemo > 0;
    if (!g.activo || !g.progreso.ajustes.negativas || (!forzada && g.negativaHoy()) || !g.progreso.ui.iniciado) return;
    // Día difícil (chequeo de ánimo): ese día no hay reacciones negativas
    if (!forzada && diaDificil(almacenAnimo.leer(), today)) return;
    const ayer = addDays(today, -1);
    const pago = db.calendar_events.find((e) => (e.type === "pago" || e.type === "vencimiento") && e.date < today && e.date >= addDays(today, -7));
    const r = g.progreso.racha;
    let v: typeof visible = null;
    if (pago && estado.ajustes.tic.activo) {
      v = { id: "tic", pose: "molesto", texto: `${pago.title} venció ${relativeDay(pago.date, today).toLowerCase()}. Yo avisé.`, accion: { label: "Ver agenda", href: "/calendario" } };
    } else if (r.mejor >= 3 && r.actual === 0 && !r.diasActivos.includes(ayer) && estado.ajustes.brote.activo) {
      v = { id: "brote", pose: "triste", texto: "Se rompió la racha. Mañana arrancamos. Despacio.", accion: { label: "Marcar hábito", href: "/salud" } };
    }
    if (v) {
      g.marcarNegativa();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(v);
    }
    // Solo al abrir la app
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.progreso.ui.iniciado, g.negativaDemo]);

  if (!visible) return null;
  const a = estado.ajustes[visible.id];
  return (
    <div className="fixed inset-x-3 bottom-24 z-[85] flex justify-center md:inset-x-auto md:bottom-6 md:right-6">
      <div role="status" aria-live="polite" className="flex w-full max-w-[380px] items-center gap-3 rounded-[22px] bg-bg p-3 shadow-[0_0_0_1px_var(--color-line)] animate-in">
        <Asistente id={visible.id} size={64} pose={visible.pose} colores={a.colores} accesorio={a.accesorio} mostrarProp={a.mostrarProp} decorativo />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-fg">{visible.texto}</p>
          <Link href={visible.accion.href} onClick={() => setVisible(null)} className="focus-ring mt-2 inline-flex h-8 items-center gap-1 rounded-full bg-fg px-3 text-[12.5px] font-medium text-on-fg">
            {visible.accion.label} <ArrowUpRight size={14} />
          </Link>
        </div>
        <button type="button" onClick={() => setVisible(null)} aria-label="Cerrar" className="focus-ring grid h-8 w-8 shrink-0 cursor-pointer place-items-center self-start rounded-full text-muted hover:bg-card">
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
