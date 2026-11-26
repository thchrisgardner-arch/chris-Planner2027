"use client";

/**
 * Pop-up diario de racha (estilo Duolingo): la primera vez que abres la app cada día el asistente
 * principal te muestra tu racha, la semana y lo que queda pendiente hoy.
 */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Check, ShieldCheck, Wrench } from "lucide-react";
import { Asistente } from "@/components/asistentes/Asistente";
import { Button } from "@/components/ui/Button";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { resumenHoy, textoPendientes } from "@/lib/asistentes/resumenHoy";
import { addDays, weekdayMon } from "@/utils/dates";
import { proximoHito } from "@/lib/asistentes/progreso";
import { useReparar } from "./RepararRacha";
import { cn } from "@/utils/cn";
import { useGamificacion } from "./Gamificacion";
import { IconoRacha } from "./Protagonismo";
import { useChequeoEnCurso } from "./ChequeoAnimo";
import { esSesionDeBienvenida, tutorialPendiente, useTutorialActivo } from "@/modules/tutorial/Tutorial";

const DIAS = ["L", "M", "M", "J", "V", "S", "D"];

export function SaludoDiario() {
  const g = useGamificacion();
  const { db } = useData();
  const today = useToday();
  const { estado } = useAsistentes();
  const panel = useRef<HTMLDivElement>(null);
  const tutorial = useTutorialActivo();
  const reparar = useReparar();
  // Espera a que termine el tutorial, no sale el día en que el tutorial está por empezar y no sale
  // en la misma sesión que la bienvenida o el tutorial (aparece en la siguiente apertura)
  const chequeo = useChequeoEnCurso();
  // …y espera a que se responda el chequeo de ánimo (nunca dos pop-ups juntos)
  const visible = g.saludoVisible && !tutorial && !tutorialPendiente() && !esSesionDeBienvenida() && !chequeo;

  useEffect(() => {
    if (!visible) return;
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && g.cerrarSaludo();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [visible, g]);

  if (!visible || !today || typeof document === "undefined") return null;

  const r = g.progreso.racha;
  const activos = new Set(r.diasActivos);
  const protegidos = new Set(r.usados);
  const hoyHecho = activos.has(today);
  const lunes = addDays(today, -weekdayMon(today));
  const semana = DIAS.map((label, i) => {
    const d = addDays(lunes, i);
    return { label, d, hecho: activos.has(d), protegido: protegidos.has(d), hoy: d === today, futuro: d > today };
  });
  const pend = resumenHoy(db, today);
  const faltan = textoPendientes(pend);

  const id = estado.principal;
  const a = estado.ajustes[id];
  let titulo: string;
  let sub: string;
  let pose: "celebrando" | "orgulloso" | "feliz" | "triste" = "feliz";
  const rep = g.reparable;
  const hito = proximoHito(r.actual);
  if (rep) {
    titulo = `Se rompió tu racha de ${rep.anterior} días`;
    sub = `Puedes repararla por ${rep.costo} XP y volver a ${rep.nueva} ${rep.nueva === 1 ? "día" : "días"}. Solo hoy y mañana; tu nivel no baja.`;
    pose = "triste";
  } else if (hoyHecho) {
    titulo = r.actual === 1 ? "Empezó tu racha" : `${r.actual} días seguidos`;
    sub = faltan ? `Ya sumaste hoy. Te quedan ${faltan}.` : "Ya sumaste hoy y no tienes nada pendiente. Así se hace.";
    pose = "celebrando";
  } else if (r.actual > 0) {
    titulo = `${r.actual} ${r.actual === 1 ? "día" : "días"} de racha`;
    sub = `Registra algo hoy y llegas a ${r.actual + 1}.${faltan ? ` Tienes ${faltan} para hoy.` : ""}`;
    pose = "orgulloso";
  } else if (r.mejor > 0) {
    titulo = "Tu racha se reinició";
    sub = `Tu mejor racha fue de ${r.mejor} días. Hoy empieza otra: registra un movimiento, un hábito o una tarea.`;
    pose = "triste";
  } else {
    titulo = "Empieza tu racha hoy";
    sub = "Cada día que registres algo (un movimiento, un hábito o una tarea) suma un día a tu racha.";
  }

  return createPortal(
    <div className="fixed inset-0 z-[96] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px] animate-in" onClick={g.cerrarSaludo} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="saludo-titulo"
        aria-describedby="saludo-sub"
        className="relative w-full max-w-[420px] overflow-hidden rounded-[28px] bg-bg px-6 pb-6 pt-5 text-center animate-in"
      >
        <div className="mx-auto flex items-end justify-center gap-1">
          <Asistente id={id} size={150} pose={pose} colores={a.colores} accesorio={a.accesorio} mostrarProp={a.mostrarProp} nombre={a.nombre} />
          <div className="mb-4 flex flex-col items-center">
            <IconoRacha size={60} apagado={!hoyHecho && r.actual === 0} />
            <span className="figure mt-1 text-[34px] leading-none" aria-label={`Racha de ${r.actual} días`}>
              {r.actual}
            </span>
          </div>
        </div>

        <h2 id="saludo-titulo" className="mt-3 text-[26px] leading-tight tracking-[-0.02em]">
          {titulo}
        </h2>
        <p id="saludo-sub" className="mx-auto mt-2 max-w-[330px] text-[15px] text-muted">
          {sub}
        </p>

        <ol className="mt-5 grid grid-cols-7 gap-1.5" aria-label="Tu semana">
          {semana.map((s) => (
            <li key={s.d} className="flex flex-col items-center gap-1.5">
              <span className={cn("text-[12px] font-medium", s.hoy ? "text-fg" : "text-dim")}>{s.label}</span>
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full",
                  s.hecho ? "bg-[var(--char-yellow)] text-[#0a0a0a]" : s.protegido ? "bg-[#DCEBFF] text-[#2563eb]" : "bg-card text-dim",
                  s.hoy && !s.hecho && "ring-2 ring-[var(--char-yellow)] ring-offset-2 ring-offset-bg",
                  s.futuro && "opacity-50",
                )}
                role="img"
                aria-label={`${s.d}: ${s.hecho ? "hecho" : s.protegido ? "protegido" : s.futuro ? "por venir" : "sin actividad"}`}
              >
                {s.hecho ? <Check size={17} strokeWidth={3} /> : s.protegido ? <ShieldCheck size={16} /> : null}
              </span>
            </li>
          ))}
        </ol>

        {r.protectores > 0 ? (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-muted">
            <ShieldCheck size={15} className="text-[#2563eb]" />
            {r.protectores === 1 ? "Tienes 1 protector de racha" : `Tienes ${r.protectores} protectores de racha`}
          </p>
        ) : null}
        {!rep && hito ? (
          <p className="mt-2 text-[13px] text-muted">
            Próximo hito: <span className="font-medium text-fg">{hito.dias} días</span> · faltan {hito.dias - r.actual} (+{hito.xp} XP)
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {rep ? (
            <>
              <Button variant="secondary" className="bg-card" onClick={g.cerrarSaludo}>
                Ahora no
              </Button>
              <Button
                variant="primary"
                data-autofocus
                onClick={() => {
                  g.cerrarSaludo();
                  reparar();
                }}
              >
                <Wrench size={17} /> Reparar por {rep.costo} XP
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/progreso"
                onClick={g.cerrarSaludo}
                className="focus-ring inline-flex h-11 items-center rounded-full bg-card px-5 text-[14px] font-medium hover:bg-elev"
              >
                Ver progreso
              </Link>
              <Button variant="primary" data-autofocus onClick={g.cerrarSaludo}>
                {hoyHecho ? "Seguir" : "¡Vamos!"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
