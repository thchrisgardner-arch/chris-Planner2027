"use client";

import { useState } from "react";
import { cn } from "@/utils/cn";
import { Card, ArrowLink } from "./Card";

/* ═════════ StatCard: etiqueta arriba, cifra grande abajo ═════════ */
export function StatCard({
  label,
  value,
  meta,
  href,
  variant = "default",
  muted,
  className,
  action,
}: {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  href?: string;
  variant?: "default" | "inverse" | "warm";
  /** Valor en cero: se muestra en gris tenue */
  muted?: boolean;
  className?: string;
  action?: React.ReactNode;
}) {
  const inverse = variant === "inverse";
  return (
    <Card variant={variant} className={cn("flex min-h-[176px] flex-col", className)}>
      <div className="flex items-start justify-between gap-3">
        <h2 className={cn("text-[15px]", inverse ? "text-on-fg" : "text-fg")}>{label}</h2>
        <div className="flex items-center gap-1.5">
          {action}
          {href ? <ArrowLink href={href} label={`Ver ${label.toLowerCase()}`} inverse={inverse} /> : null}
        </div>
      </div>
      <p
        className={cn(
          "figure mt-auto pt-6 text-[44px] sm:text-[52px]",
          inverse ? "text-on-fg" : muted ? "text-dim" : "text-fg",
        )}
      >
        {value}
      </p>
      {meta ? <div className={cn("mt-2 text-[13px]", inverse ? "text-on-fg/65" : "text-muted")}>{meta}</div> : null}
    </Card>
  );
}

/* ═════════ BarChart: barras redondeadas, la activa en lima con tooltip negro ═════════ */
export interface BarDatum {
  label: string;
  /** Una o dos series (p. ej. ingresos y gastos) */
  values: number[];
  hint?: string;
}

const GHOST = [38, 58, 44, 72, 52, 84, 48, 66, 40, 60, 46, 70];

export function BarChart({
  data,
  activeIndex,
  formatTooltip,
  height = 210,
  seriesLabels,
}: {
  data: BarDatum[];
  /** Barra resaltada por defecto (p. ej. el mes actual) */
  activeIndex?: number;
  formatTooltip?: (d: BarDatum) => React.ReactNode;
  height?: number;
  seriesLabels?: string[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...data.flatMap((d) => d.values));
  const empty = max === 0;
  const active = hover ?? activeIndex ?? data.length - 1;
  const series = Math.max(1, ...data.map((d) => d.values.length));

  return (
    <div className="w-full" role="img" aria-label={empty ? "Gráfico sin datos todavía" : `Gráfico de barras: ${data.map((d) => d.label).join(", ")}`}>
      <div className="relative flex items-end gap-2 sm:gap-3" style={{ height }}>
        {data.map((d, i) => {
          const isActive = !empty && i === active;
          return (
            <div
              key={`${d.label}-${i}`}
              className="relative flex h-full min-w-0 flex-1 items-end justify-center gap-1"
              onMouseEnter={() => !empty && setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {isActive && formatTooltip ? (
                <div
                  className={cn(
                    "pointer-events-none absolute z-10 whitespace-nowrap rounded-full bg-fg px-3 py-1.5 text-[12px] font-medium text-on-fg",
                    // En los extremos el globo se alinea al borde para no salirse de la tarjeta
                    i >= data.length - 2 ? "right-0" : i <= 1 ? "left-0" : "left-1/2 -translate-x-1/2",
                  )}
                  style={{ bottom: `calc(${(Math.max(...d.values) / max) * 100}% + 10px)` }}
                >
                  {formatTooltip(d)}
                </div>
              ) : null}
              {Array.from({ length: series }, (_, s) => {
                const v = d.values[s] ?? 0;
                const h = empty ? GHOST[(i + s * 3) % GHOST.length] : Math.max(4, (v / max) * 100);
                const fill = empty ? "bg-elev/70" : isActive ? (s === 0 ? "bg-brand" : "bg-fg") : s === 0 ? "bg-elev" : "bg-line-strong";
                return (
                  <div
                    key={s}
                    className={cn("w-full max-w-[34px] rounded-full transition-[height,background-color] duration-300 ease-(--ease-os)", fill)}
                    style={{ height: `${h}%` }}
                    title={seriesLabels ? `${seriesLabels[s]}: ${v}` : undefined}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2 sm:gap-3">
        {data.map((d, i) => (
          <span
            key={`${d.label}-l-${i}`}
            className={cn("min-w-0 flex-1 truncate text-center text-[12px]", !empty && i === active ? "font-medium text-brand-soft" : "text-dim")}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═════════ HeatGrid: cuadrícula de celdas redondeadas ═════════ */
export type HeatState = "done" | "missed" | "today" | "future" | "off";

export interface HeatRow {
  key: string;
  label: string;
  cells: { key: string; state: HeatState; title: string; onClick?: () => void }[];
}

const HEAT: Record<HeatState, string> = {
  done: "bg-brand",
  missed: "bg-elev",
  today: "bg-fg",
  future: "bg-elev/45",
  off: "bg-transparent border border-dashed border-line-strong",
};

export function HeatGrid({ rows, columns, labelWidth = 112 }: { rows: HeatRow[]; columns: string[]; labelWidth?: number }) {
  return (
    <div className="w-full">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `${labelWidth}px repeat(${columns.length}, minmax(0, 1fr))` }}>
        <span />
        {columns.map((c, i) => (
          <span key={`${c}-${i}`} className="pb-1 text-center text-[12px] text-dim">
            {c}
          </span>
        ))}
        {rows.map((r) => (
          <HeatRowView key={r.key} row={r} />
        ))}
      </div>
    </div>
  );
}

function HeatRowView({ row }: { row: HeatRow }) {
  return (
    <>
      <span className="flex items-center truncate pr-2 text-[13px] text-fg">{row.label}</span>
      {row.cells.map((c) =>
        c.onClick ? (
          <button
            key={c.key}
            type="button"
            onClick={c.onClick}
            title={c.title}
            aria-label={c.title}
            aria-pressed={c.state === "done"}
            className={cn("focus-ring h-9 cursor-pointer rounded-[12px] transition-transform duration-150 hover:scale-[1.04]", HEAT[c.state])}
          />
        ) : (
          <span key={c.key} title={c.title} aria-label={c.title} className={cn("h-9 rounded-[12px]", HEAT[c.state])} />
        ),
      )}
    </>
  );
}

/* ═════════ ProgressCard: el fondo se rellena según el porcentaje ═════════ */
export function ProgressCard({
  label,
  pct,
  meta,
  fill = "accent",
  onClick,
  className,
}: {
  label: string;
  pct: number;
  meta?: React.ReactNode;
  fill?: "accent" | "warn";
  onClick?: () => void;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, pct));
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={cn(
        "relative flex w-full items-end justify-between gap-3 overflow-hidden rounded-[20px] bg-bg-2 px-4 py-3.5 text-left",
        onClick && "focus-ring cursor-pointer transition-transform duration-200 hover:scale-[1.01]",
        className,
      )}
      aria-label={`${label}: ${Math.round(v)} %`}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 transition-[width] duration-500 ease-(--ease-os)", fill === "accent" ? "bg-brand" : "bg-warn-fill")}
        style={{ width: `${v}%` }}
      />
      <span className="relative min-w-0">
        <span className="block truncate text-[14px] font-medium" style={{ color: v > 35 ? "#0a0a0a" : "var(--color-fg)" }}>
          {label}
        </span>
        {meta ? (
          <span className="block truncate text-[12.5px]" style={{ color: v > 35 ? "rgb(10 10 10 / 0.65)" : "var(--color-muted)" }}>
            {meta}
          </span>
        ) : null}
      </span>
      <span className="figure relative text-[30px]" style={{ color: v > 80 ? "#0a0a0a" : "var(--color-fg)" }}>
        {Math.round(v)}
        <span className="text-[16px]">%</span>
      </span>
    </Tag>
  );
}
