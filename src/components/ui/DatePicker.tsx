"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  WEEKDAYS_SHORT,
  addDays,
  addMonths,
  daysInMonth,
  monthKey,
  monthLabel,
  parseISO,
  todayISO,
  weekdayMon,
} from "@/utils/dates";
import { Select } from "./Select";

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function display(iso: string) {
  const d = parseISO(iso);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const PANEL_W = 304;
const PANEL_H = 372;

export interface DatePickerProps {
  id?: string;
  /** "YYYY-MM-DD" o "" */
  value: string;
  /** Misma forma que un input nativo: e.target.value */
  onChange: (e: { target: { value: string } }) => void;
  placeholder?: string;
  /** Muestra "Borrar" para dejar la fecha vacía (desactívalo en campos obligatorios) */
  clearable?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
}

/** Selector de fecha con el diseño de LIFE OS (reemplaza el calendario nativo del navegador). */
export function DatePicker({ id, value, onChange, placeholder = "Elegir fecha", clearable = true, className, ...aria }: DatePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [focused, setFocused] = useState(value || todayISO());
  const view = monthKey(focused);
  const today = todayISO();

  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = vh - r.bottom;
    const top = below < PANEL_H + 12 && r.top > below ? Math.max(8, r.top - PANEL_H - 6) : r.bottom + 6;
    const left = Math.min(Math.max(8, r.left), vw - PANEL_W - 8);
    setPos({ top, left });
  }, []);

  const openPanel = () => {
    setFocused(value || todayISO());
    place();
    setOpen(true);
  };
  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);
  const pick = (iso: string) => {
    onChange({ target: { value: iso } });
    close();
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) close(false);
    };
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  // El foco del teclado sigue al día enfocado
  useLayoutEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus();
  }, [open, focused]);

  const onPanelKey = (e: React.KeyboardEvent) => {
    const step: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => shiftMonth(focused, -1),
      PageDown: () => shiftMonth(focused, 1),
      Home: () => addDays(focused, -weekdayMon(focused)),
      End: () => addDays(focused, 6 - weekdayMon(focused)),
    };
    if (step[e.key]) {
      e.preventDefault();
      setFocused(step[e.key]());
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.nativeEvent.stopPropagation(); // que no cierre también el modal
      close();
    } else if (e.key === "Tab") {
      // mantener el foco dentro del calendario mientras está abierto
      const items = [...(panelRef.current?.querySelectorAll<HTMLElement>("button:not([tabindex='-1'])") ?? [])];
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (items.length) {
        e.preventDefault();
        items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus();
      }
    }
  };

  // Celdas: semanas de lunes a domingo
  const first = `${view}-01`;
  const lead = weekdayMon(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i - lead));
  const trimmed = cells.slice(0, Math.ceil((lead + daysInMonth(view)) / 7) * 7);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={aria["aria-label"]}
        data-invalid={aria["aria-invalid"] || undefined}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openPanel();
          }
        }}
        className={cn(
          "focus-ring flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-[12px] border border-line bg-bg-2 px-3.5 text-left text-[14.5px] transition-colors duration-200 hover:border-line-strong data-invalid:border-danger/70",
          open && "border-fg/30 bg-card",
          className,
        )}
      >
        <span className={cn("num truncate", value ? "text-fg" : "text-dim")}>{value ? display(value) : placeholder}</span>
        <CalendarDays size={18} className={cn("shrink-0 transition-colors", "text-fg")} />
      </button>

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Elegir fecha"
              onKeyDown={onPanelKey}
              style={{ position: "fixed", top: pos.top, left: pos.left, width: PANEL_W }}
              className="z-[95] rounded-[20px] border border-line bg-card p-3.5 animate-in"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="pl-1.5 text-[15px] font-semibold tracking-[-0.01em]">{monthLabel(view)}</p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Mes anterior"
                    onClick={() => setFocused(shiftMonth(focused, -1))}
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] text-muted transition-colors hover:bg-elev hover:text-fg"
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Mes siguiente"
                    onClick={() => setFocused(shiftMonth(focused, 1))}
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] text-muted transition-colors hover:bg-elev hover:text-fg"
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 text-center text-[11.5px] font-medium text-dim">
                {WEEKDAYS_SHORT.map((d) => (
                  <span key={d} className="py-1.5">
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5" role="grid">
                {trimmed.map((d) => {
                  const inMonth = d.startsWith(view);
                  const isSel = d === value;
                  const isToday = d === today;
                  return (
                    <button
                      key={d}
                      type="button"
                      data-day={d}
                      tabIndex={d === focused ? 0 : -1}
                      aria-pressed={isSel}
                      aria-label={display(d)}
                      onClick={() => pick(d)}
                      className={cn(
                        "num relative mx-auto grid h-9 w-9 cursor-pointer place-items-center rounded-full text-[13.5px] outline-none transition-colors duration-150",
                        isSel
                          ? "bg-fg font-semibold text-on-fg"
                          : inMonth
                            ? "text-fg hover:bg-elev"
                            : "text-dim/60 hover:bg-elev",
                        !isSel && isToday && "font-semibold ring-1 ring-fg/25",
                        d === focused && !isSel && "bg-elev",
                        "focus-visible:ring-2 focus-visible:ring-fg/50",
                      )}
                    >
                      {parseISO(d).getUTCDate()}
                      {isToday && !isSel ? <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand" /> : null}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
                {clearable && value ? (
                  <button
                    type="button"
                    onClick={() => pick("")}
                    className="cursor-pointer rounded-[10px] px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-elev hover:text-fg"
                  >
                    Borrar
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => pick(today)}
                  className="cursor-pointer rounded-[10px] bg-elev px-3.5 py-1.5 text-[13px] font-medium text-fg transition-colors hover:bg-line"
                >
                  Hoy
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Mueve una fecha N meses conservando el día (ajustado al último día del mes). */
function shiftMonth(iso: string, n: number) {
  const key = addMonths(monthKey(iso), n);
  const day = Math.min(Number(iso.slice(8, 10)), daysInMonth(key));
  return `${key}-${String(day).padStart(2, "0")}`;
}

/* ───────── Hora ───────── */
function timeLabel(t: string) {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "p. m." : "a. m.";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

const SLOTS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

/** Selector de hora en intervalos de 15 minutos, con el mismo estilo de los desplegables. */
export function TimeSelect({
  id,
  value,
  onChange,
  emptyLabel = "Sin hora",
}: {
  id?: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  emptyLabel?: string;
}) {
  const v = value ? value.slice(0, 5) : "";
  const slots = v && !SLOTS.includes(v) ? [...SLOTS, v].sort() : SLOTS;
  return (
    <Select id={id} value={v} onChange={onChange}>
      <option value="">{emptyLabel}</option>
      {slots.map((t) => (
        <option key={t} value={t}>
          {timeLabel(t)}
        </option>
      ))}
    </Select>
  );
}
