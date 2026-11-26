"use client";

/**
 * Gesto de deslizar (solo táctil; con mouse no hace nada y no cambia el aspecto):
 *  - Hacia la izquierda: muestra acciones (p. ej. Editar y Borrar) detrás de la fila.
 *  - Hacia la derecha: dispara una acción directa (p. ej. marcar un hábito como hecho).
 * Las mismas acciones existen siempre en botones visibles; el gesto es un atajo.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

export interface AccionDeslizar {
  label: string;
  icono: React.ReactNode;
  tono?: "neutro" | "peligro" | "marca";
  onAccion: () => void;
}

const ANCHO = 72;
const UMBRAL_DERECHA = 84;

export function Deslizable({
  children,
  acciones = [],
  derecha,
  className,
  redondeo = 0,
  fondo = "bg-card",
}: {
  /** Fondo de la fila mientras se desliza (tapa las acciones de atrás) */
  fondo?: string;
  children: React.ReactNode;
  /** Se revelan al deslizar a la izquierda */
  acciones?: AccionDeslizar[];
  /** Se ejecuta al deslizar a la derecha */
  derecha?: AccionDeslizar | null;
  className?: string;
  redondeo?: number;
}) {
  const [dx, setDx] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const inicio = useRef<{ x: number; y: number; base: number; id: number; horizontal: boolean | null } | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const max = acciones.length * ANCHO;

  // Tocar fuera cierra las acciones abiertas
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) {
        setAbierto(false);
        setDx(0);
      }
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);

  if (!acciones.length && !derecha) return <div className={className}>{children}</div>;

  const soltar = () => {
    const s = inicio.current;
    inicio.current = null;
    setArrastrando(false);
    if (!s?.horizontal) return;
    if (derecha && dx >= UMBRAL_DERECHA) {
      derecha.onAccion();
      setDx(0);
      setAbierto(false);
      return;
    }
    const abrir = max > 0 && dx <= -max / 2;
    setAbierto(abrir);
    setDx(abrir ? -max : 0);
  };

  return (
    // Solo recorta mientras se desliza: en reposo la fila se ve exactamente igual que antes
    <div ref={caja} className={cn("relative", dx !== 0 && "overflow-hidden", className)} style={{ borderRadius: dx !== 0 && redondeo ? redondeo : undefined }}>
      {dx < 0 ? (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: max }}>
          {acciones.map((a) => (
            <button
              key={a.label}
              type="button"
              tabIndex={abierto ? 0 : -1}
              onClick={() => {
                setAbierto(false);
                setDx(0);
                a.onAccion();
              }}
              className={cn(
                "focus-ring flex h-full flex-1 cursor-pointer flex-col items-center justify-center gap-1 text-[11.5px] font-medium",
                a.tono === "peligro" ? "bg-danger text-white" : a.tono === "marca" ? "bg-brand text-[#0a0a0a]" : "bg-elev text-fg",
              )}
            >
              {a.icono}
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
      {dx > 0 && derecha ? (
        <div
          aria-hidden
          className={cn("absolute inset-y-0 left-0 flex items-center gap-2 px-5 text-[13px] font-medium transition-colors", dx >= UMBRAL_DERECHA ? "bg-brand text-[#0a0a0a]" : "bg-elev text-muted")}
          style={{ width: Math.max(dx, 0) }}
        >
          {derecha.icono}
          <span className="whitespace-nowrap">{derecha.label}</span>
        </div>
      ) : null}
      <div
        className={cn(dx !== 0 && "relative", dx !== 0 && fondo, !arrastrando && dx !== 0 && "transition-transform duration-200 ease-(--ease-os)")}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, touchAction: "pan-y" }}
        onPointerDown={(e) => {
          if (e.pointerType !== "touch") return;
          inicio.current = { x: e.clientX, y: e.clientY, base: abierto ? -max : 0, id: e.pointerId, horizontal: null };
        }}
        onPointerMove={(e) => {
          const s = inicio.current;
          if (!s || e.pointerId !== s.id) return;
          const mx = e.clientX - s.x;
          const my = e.clientY - s.y;
          if (s.horizontal === null) {
            if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
            s.horizontal = Math.abs(mx) > Math.abs(my);
            if (!s.horizontal) return;
            setArrastrando(true);
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }
          if (!s.horizontal) return;
          const limiteDer = derecha ? 140 : 0;
          setDx(Math.max(-max - 16, Math.min(limiteDer, s.base + mx)));
        }}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onClickCapture={(e) => {
          // Un deslizamiento no cuenta como toque sobre lo que hay debajo
          if (arrastrando || abierto) {
            e.stopPropagation();
            e.preventDefault();
            if (abierto) {
              setAbierto(false);
              setDx(0);
            }
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
