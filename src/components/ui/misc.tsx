import { cn } from "@/utils/cn";

/* ── Badge ── */
type Tone = "neutral" | "brand" | "violet" | "warn" | "info" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-elev text-muted border-line",
  brand: "bg-brand/12 text-brand-soft border-brand/25",
  violet: "bg-violet/12 text-violet border-violet/25",
  warn: "bg-warn/12 text-warn border-warn/25",
  info: "bg-info/12 text-info border-info/25",
  danger: "bg-danger/12 text-danger border-danger/25",
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
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11.5px] font-medium",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/* ── Barra de progreso ── */
export function Progress({
  value,
  color = "var(--color-brand)",
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
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-(--ease-os)"
        style={{ width: `${v}%`, background: color }}
      />
    </div>
  );
}

/* ── Estado vacío ── */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[18px] border border-dashed border-line bg-bg-2/50 text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-10",
        className,
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-[14px] border border-line bg-card text-fg">
        {icon}
      </span>
      <div>
        <p className="text-[14.5px] font-medium text-fg">{title}</p>
        {description ? <p className="mx-auto mt-1 max-w-[300px] text-[12.5px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/* ── Skeleton ── */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/* ── Selector segmentado ── */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "sm",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("inline-flex rounded-[12px] border border-line bg-bg-2 p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "focus-ring cursor-pointer whitespace-nowrap rounded-[9px] font-medium transition-all duration-200",
            size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3.5 text-[13px]",
            o.value === value ? "bg-card text-fg" : "text-dim hover:text-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Indicador de variación ── */
export function Delta({ value, invert, className }: { value: number | null; invert?: boolean; className?: string }) {
  if (value === null || !Number.isFinite(value)) {
    return <span className={cn("text-[12px] text-dim", className)}>Sin mes anterior para comparar</span>;
  }
  const positive = invert ? value <= 0 : value >= 0;
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold",
        positive ? "bg-brand/12 text-brand-soft" : "bg-warn/12 text-warn",
        className,
      )}
    >
      {value >= 0 ? "↗" : "↘"} {value >= 0 ? "+" : ""}
      {value.toFixed(1).replace(".", ",")} %
    </span>
  );
}
