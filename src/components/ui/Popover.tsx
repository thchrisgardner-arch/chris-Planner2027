"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

/** Menú desplegable simple: cierra con clic fuera o Escape. */
export function Popover({
  trigger,
  children,
  align = "end",
  side = "bottom",
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "start" | "end";
  side?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open ? (
        <div
          className={cn(
            "absolute z-[60] min-w-[220px] rounded-[24px] border border-line bg-card p-2 animate-in",
            align === "end" ? "right-0" : "left-0",
            side === "bottom" ? "top-[calc(100%+8px)]" : "bottom-[calc(100%+12px)] max-h-[70dvh] overflow-y-auto",
            className,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  icon,
  children,
  onClick,
  hint,
  danger,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "focus-ring flex h-11 w-full cursor-pointer items-center gap-3 rounded-[14px] px-3 text-left text-[14.5px] transition-colors",
        danger ? "text-danger hover:bg-danger/10" : "text-fg hover:bg-elev",
      )}
    >
      {icon ? <span className={cn("shrink-0", danger ? "text-danger" : "text-fg")}>{icon}</span> : null}
      <span className="flex-1">{children}</span>
      {hint ? <span className="text-[11.5px] text-dim">{hint}</span> : null}
    </button>
  );
}
