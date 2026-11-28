import { cn } from "@/utils/cn";
import { flechasGrupo } from "@/utils/teclado";

/* ── Chip (antes Badge): píldora pequeña para metadatos ── */
type Tone = "neutral" | "brand" | "violet" | "warn" | "info" | "danger" | "ink";
const tones: Record<Tone, string> = {
  neutral: "bg-elev text-fg",
  brand: "bg-brand text-[#0a0a0a]",
  violet: "bg-elev text-fg",
  warn: "bg-warn-fill text-[#0a0a0a]",
  info: "bg-elev text-fg",
  danger: "bg-danger/12 text-danger",
  ink: "bg-fg text-on-fg",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium", tones[tone], className)}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  );
}
export const Chip = Badge;

/* ── Barra de progreso fina ── */
export function Progress({
  value,
  color = "var(--color-fg)",
  className,
  label,
}: {
  value: number;
  color?: string;
  className?: string;
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-elev", className)}
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full transition-[width] duration-500 ease-(--ease-os)" style={{ width: `${v}%`, background: color }} />
    </div>
  );
}

/**
 * Estado vacío compacto: una sola línea y como máximo un botón.
 * (Las tarjetas que lo necesitan muestran además su estructura "fantasma".)
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-bg-2 px-4 py-3", className)}>
      <p className="min-w-0 text-[13.5px] text-muted">
        <span className="text-fg">{title}</span>
        {/* En el celular la descripción va en otra línea (antes se ocultaba y se perdía la explicación) */}
        {description ? (
          <>
            <span className="hidden sm:inline"> · </span>
            <span className="block sm:inline">{description}</span>
          </>
        ) : null}
      </p>
      {action}
    </div>
  );
}

/**
 * Estado vacío de un módulo: tarjeta gris con estructura "fantasma" (qué aparecerá aquí),
 * un mensaje, el CTA y un espacio opcional para el asistente del módulo.
 */
export function EmptyCard({
  title,
  description,
  action,
  ghost = "list",
  aside,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  ghost?: "list" | "grid" | "bars" | "cards";
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card relative overflow-hidden p-5 sm:p-6", className)}>
      <div aria-hidden className="pointer-events-none select-none">
        <GhostShape kind={ghost} />
      </div>
      <div className="relative mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {aside ? <div className="shrink-0">{aside}</div> : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px]">{title}</h2>
          {description ? <p className="mt-1 text-[14px] text-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

function GhostShape({ kind }: { kind: "list" | "grid" | "bars" | "cards" }) {
  if (kind === "bars") return <GhostBars />;
  if (kind === "grid") {
    // Cuadrícula de días (hábitos)
    return (
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 21 }, (_, i) => (
          <span key={i} className={cn("h-7 rounded-[10px]", [2, 5, 9, 13, 16].includes(i) ? "bg-line-strong/60" : "bg-elev/80")} />
        ))}
      </div>
    );
  }
  if (kind === "cards") {
    // Tarjetas con imagen (wishlist) u objetivos
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("rounded-[18px] bg-bg-2 p-3", i === 2 && "hidden sm:block")}>
            <div className="h-20 rounded-[12px] bg-elev/80" />
            <div className="mt-3 h-2.5 w-3/4 rounded-full bg-elev" />
            <div className="mt-2 h-2.5 w-1/2 rounded-full bg-elev/70" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {[70, 52, 62].map((w, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[16px] bg-bg-2 px-3 py-3">
          <span className="h-6 w-6 shrink-0 rounded-full border-[1.5px] border-line-strong" />
          <span className="h-2.5 rounded-full bg-elev" style={{ width: `${w}%` }} />
          <span className="ml-auto h-2.5 w-10 rounded-full bg-elev/70" />
        </div>
      ))}
    </div>
  );
}

/** Barras horizontales fantasma (p. ej. "Gastos por categoría" sin datos). */
export function GhostBars({ rows = [88, 64, 46, 30] }: { rows?: number[] }) {
  return (
    <ul aria-hidden className="flex flex-col gap-3">
      {rows.map((w, i) => (
        <li key={i}>
          <div className="mb-1.5 flex justify-between">
            <span className="h-2.5 w-20 rounded-full bg-elev" />
            <span className="h-2.5 w-12 rounded-full bg-elev/70" />
          </div>
          <div className="h-3 rounded-full bg-elev/60">
            <div className="h-full rounded-full bg-elev" style={{ width: `${w}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── Skeleton ── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/* ── Selector segmentado en píldora ── */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "sm",
  label,
  desplazable = false,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  size?: "sm" | "md";
  label?: string;
  /** En una sola fila que se desplaza de lado (el contenedor lleva overflow-x-auto); si no, pasan a otra fila */
  desplazable?: boolean;
}) {
  // Por defecto, si no caben en una fila (celular), pasan a una segunda fila completas: nada queda cortado
  return (
    <div
      className={cn("inline-flex gap-y-1 rounded-[22px] bg-elev p-1", desplazable ? "flex-nowrap" : "max-w-full flex-wrap", className)}
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => flechasGrupo(e, options.map((o) => o.value), value, onChange)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          // Desplazable: la pestaña elegida siempre queda a la vista (solo se mueve la fila, no la página)
          ref={
            desplazable && o.value === value
              ? (el) => {
                  if (el) mostrarEnFila(el);
                }
              : undefined
          }
          type="button"
          role="tab"
          aria-selected={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          className={cn(
            "focus-ring cursor-pointer whitespace-nowrap rounded-full font-medium transition-all duration-200",
            size === "sm" ? "h-7 px-3 text-[12.5px]" : "h-9 px-4 text-[13.5px]",
            o.value === value ? "bg-bg text-fg" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Desplaza de lado el contenedor con scroll más cercano para que `el` quede visible */
function mostrarEnFila(el: HTMLElement) {
  let fila = el.parentElement;
  while (fila && fila.scrollWidth <= fila.clientWidth) fila = fila.parentElement;
  if (!fila || fila === document.documentElement || fila === document.body) return;
  const f = fila.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (r.left < f.left + 16) fila.scrollLeft += r.left - f.left - 16;
  else if (r.right > f.right - 16) fila.scrollLeft += r.right - f.right + 16;
}

/* ── Variación vs. periodo anterior (texto discreto, sin colores de fondo) ── */
export function Delta({
  value,
  invert,
  className,
  suffix,
  inverse,
}: {
  value: number | null;
  invert?: boolean;
  className?: string;
  /** p. ej. "vs. octubre" */
  suffix?: string;
  /** sobre tarjeta negra */
  inverse?: boolean;
}) {
  if (value === null || !Number.isFinite(value)) {
    return <span className={cn("text-[13px]", inverse ? "text-on-fg/50" : "text-dim", className)}>Sin mes anterior para comparar</span>;
  }
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span className={cn("num inline-flex items-center gap-1.5 text-[13px]", inverse ? "text-on-fg/70" : "text-muted", className)}>
      <span className={cn("font-medium", good ? (inverse ? "text-brand" : "text-brand-soft") : inverse ? "text-on-fg" : "text-fg")}>
        {value >= 0 ? "↗ +" : "↘ "}
        {value.toFixed(1).replace(".", ",")} %
      </span>
      {suffix}
    </span>
  );
}
