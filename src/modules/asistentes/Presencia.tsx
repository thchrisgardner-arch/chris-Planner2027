"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { Asistente } from "@/components/asistentes/Asistente";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { FICHAS } from "@/lib/asistentes/definiciones";
import { getMensajeAsistente, type Mensaje } from "@/lib/asistentes/motor";
import type { AsistenteId } from "@/lib/asistentes/tipos";
import { cn } from "@/utils/cn";

/** Minutos desde la medianoche en Bogotá */
function ahoraBogota() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === "hour")?.value ?? 0) * 60 + Number(parts.find((p) => p.type === "minute")?.value ?? 0);
}

/** Mensaje actual del asistente según los datos (se recalcula al cambiar los datos). */
function useMensaje(id: AsistenteId): Mensaje {
  const { db } = useData();
  const today = useToday();
  const { estado } = useAsistentes();
  const tono = estado.ajustes[id].tono;
  return useMemo(() => getMensajeAsistente(id, { db, today, tono, ahoraMin: ahoraBogota() }), [id, db, today, tono]);
}

/* ═════════ Inicio: tarjeta del asistente principal ═════════ */
export function TarjetaAsistentePrincipal() {
  const { estado, ocultarInicioHoy } = useAsistentes();
  const today = useToday();
  const id = estado.principal;
  const a = estado.ajustes[id];
  const msg = useMensaje(id);
  if (estado.ocultoInicio === today) return null;
  const conAvisos = a.avisos !== "nunca";

  return (
    <div className="card relative flex items-center gap-4 overflow-hidden py-4 pl-3 pr-12 sm:gap-5 sm:pl-4">
      <Asistente
        id={id}
        size={96}
        colores={a.colores}
        expresion={a.expresion !== "neutral" ? a.expresion : msg.expresion}
        accesorio={a.accesorio}
        mostrarProp={a.mostrarProp}
        nombre={a.nombre}
        interactivo
      />
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-muted">
          {a.nombre} · {FICHAS[id].modulo}
        </p>
        {conAvisos ? (
          <p aria-live="polite" className="mt-1 text-[16px] font-medium leading-snug text-fg sm:text-[18px]">
            {msg.texto}
          </p>
        ) : (
          <p className="mt-1 text-[15px] text-fg">Aquí estoy si me necesitas.</p>
        )}
        {msg.accion ? (
          <Link href={msg.accion.href} className="focus-ring mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-fg px-4 text-[13px] font-medium text-on-fg">
            {msg.accion.label} <ArrowUpRight size={15} />
          </Link>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => ocultarInicioHoy(today)}
        aria-label={`Ocultar a ${a.nombre} por hoy`}
        title="Ocultar por hoy"
        className="focus-ring absolute right-3 top-3 grid h-9 w-9 cursor-pointer place-items-center rounded-full text-muted hover:bg-bg hover:text-fg"
      >
        <X size={17} />
      </button>
    </div>
  );
}

/* ═════════ Cabecera de módulo: asistente a 48 px con burbuja compacta ═════════ */
/** `oculto`: el módulo está vacío y su asistente ya aparece en la tarjeta del estado vacío. */
export function AsistenteModulo({ id, celebrar, oculto }: { id: AsistenteId; celebrar?: number; oculto?: boolean }) {
  const { estado } = useAsistentes();
  const a = estado.ajustes[id];
  const msg = useMensaje(id);
  const [abierto, setAbierto] = useState(false);
  if (!a.activo || oculto) return null;

  // Sin nada relevante o con avisos apagados: solo el personaje, sin burbuja
  const conBurbuja = a.avisos !== "nunca" && msg.prioridad > 0;
  const expresion = celebrar ? "contento" : a.expresion !== "neutral" ? a.expresion : conBurbuja ? msg.expresion : "neutral";

  return (
    <div className="mt-4 flex items-center gap-2.5">
      <Asistente id={id} size={48} colores={a.colores} expresion={expresion} accesorio={a.accesorio} mostrarProp={a.mostrarProp} nombre={a.nombre} interactivo celebrar={celebrar} />
      {conBurbuja ? (
        <button
          type="button"
          onClick={() => setAbierto((o) => !o)}
          aria-expanded={abierto}
          className={cn(
            "focus-ring relative min-w-0 max-w-[520px] cursor-pointer rounded-[18px] bg-card px-3.5 py-2 text-left text-[13.5px] leading-snug text-fg transition-colors hover:bg-elev",
            !abierto && "truncate",
          )}
        >
          <span aria-live="polite">{msg.texto}</span>
          {abierto && msg.accion ? (
            <Link href={msg.accion.href} onClick={(e) => e.stopPropagation()} className="mt-2 flex w-fit items-center gap-1 rounded-full bg-fg px-3 py-1.5 text-[12.5px] font-medium text-on-fg">
              {msg.accion.label} <ArrowUpRight size={14} />
            </Link>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}

/* ═════════ Estado vacío: asistente del módulo + su frase ═════════ */
export function useVacioAsistente(id: AsistenteId) {
  const { estado } = useAsistentes();
  const a = estado.ajustes[id];
  return {
    frase: FICHAS[id].vacio[a.tono],
    aside: a.activo ? (
      <Asistente id={id} size={88} colores={a.colores} expresion="dormido" accesorio={a.accesorio} mostrarProp={a.mostrarProp} nombre={a.nombre} interactivo />
    ) : null,
  };
}

/** Cuenta que sube cuando `valor` aumenta (para disparar celebraciones). */
export function useCelebracion(valor: number) {
  const prev = useRef<number | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (prev.current !== null && valor > prev.current) {
      setN((x) => x + 1);
    }
    prev.current = valor;
  }, [valor]);
  return n;
}
