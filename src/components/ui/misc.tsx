import { cn } from "@/utils/cn";

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
        {description ? <span className="hidden sm:inline"> · {description}</span> : null}
      </p>
      {action}
    </div>
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
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  size?: "sm" | "md";
  label?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-full bg-elev p-1", className)} role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
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
