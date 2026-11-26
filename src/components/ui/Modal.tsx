"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/utils/cn";

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  // onClose cambia en cada render de muchos padres: se lee de una ref para no re-ejecutar el efecto
  // (si se re-ejecutara, el foco saltaría al primer campo mientras escribes).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const onKey = (e: KeyboardEvent) => {
      // Solo el modal de más arriba responde (p. ej. la confirmación sobre un formulario)
      const modales = document.querySelectorAll("[data-modal]");
      if (modales[modales.length - 1] !== panel) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      // Trampa de foco: Tab no sale del modal
      const items = [...panel.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((el) => el.offsetParent !== null);
      if (!items.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const first = panel?.querySelector<HTMLElement>("input, select, textarea, button[data-autofocus]");
    // Si no hay campo, el foco va al panel (así el lector de pantalla anuncia el diálogo)
    (first ?? panel)?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      // Si queda otro modal abierto debajo (p. ej. el formulario tras cerrar una confirmación), no se libera el scroll
      if (!document.querySelector("[data-modal]")) document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      {/* Fondo: se cierra con clic, pero no es un botón (no entra en el orden de tabulación) */}
      <div aria-hidden="true" className="absolute inset-0 bg-black/40 backdrop-blur-[3px] animate-in" onClick={() => onCloseRef.current()} />
      <div
        ref={panelRef}
        data-modal
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-bg outline-none animate-in sm:rounded-[28px]",
          size === "sm" && "sm:max-w-[420px]",
          size === "md" && "sm:max-w-[560px]",
          size === "lg" && "sm:max-w-[760px]",
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
          <div>
            <h2 id={titleId} className="text-[22px] font-bold tracking-[-0.02em]">{title}</h2>
            {description ? (
              <p id={descId} className="mt-1 text-[13px] text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            className="focus-ring -mr-2 grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-card text-fg transition-colors hover:bg-elev"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
