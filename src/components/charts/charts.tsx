"use client";

import { formatCOP } from "@/utils/money";

/** Medidor semicircular segmentado (progreso de ahorro). */
export function SegmentedGauge({
  value,
  segments = 26,
  color = "var(--color-brand)",
  children,
}: {
  value: number;
  segments?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * segments);
  const cx = 120;
  const cy = 120;
  const rOuter = 108;
  const rInner = 82;
  const gap = 2.2; // grados
  const step = 180 / segments;
  const bars = Array.from({ length: segments }, (_, i) => {
    const a0 = 180 + i * step + gap / 2;
    const a1 = 180 + (i + 1) * step - gap / 2;
    const pt = (r: number, a: number) => {
      const rad = (a * Math.PI) / 180;
      return `${(cx + r * Math.cos(rad)).toFixed(2)} ${(cy + r * Math.sin(rad)).toFixed(2)}`;
    };
    const d = `M ${pt(rInner, a0)} L ${pt(rOuter, a0)} A ${rOuter} ${rOuter} 0 0 1 ${pt(rOuter, a1)} L ${pt(rInner, a1)} A ${rInner} ${rInner} 0 0 0 ${pt(rInner, a0)} Z`;
    return { d, on: i < filled, i };
  });
  return (
    <div className="relative mx-auto w-full max-w-[260px]">
      <svg viewBox="0 0 240 128" className="w-full" role="img" aria-label={`Progreso ${Math.round(value)} %`}>
        {bars.map((b) => (
          <path
            key={b.i}
            d={b.d}
            fill={b.on ? color : "var(--color-elev)"}
            style={{ transition: `fill 300ms ${b.i * 18}ms` }}
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">{children}</div>
    </div>
  );
}

/** Anillo de progreso. */
export function Ring({
  value,
  size = 64,
  stroke = 7,
  color = "var(--color-brand)",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-elev)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (v / 100) * c}
          style={{ transition: "stroke-dashoffset 600ms var(--ease-os)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

/** Tooltip oscuro para Recharts. */
export function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; payload?: { hint?: string } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const hint = payload[0]?.payload?.hint;
  return (
    <div className="rounded-[12px] border border-line bg-elev px-3 py-2.5 text-[12.5px]">
      <p className="mb-1.5 font-medium text-fg">
        {label}
        {hint && hint !== label ? <span className="ml-1.5 font-normal text-dim">{hint}</span> : null}
      </p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="capitalize">{p.name}</span>
          <span className="num ml-auto pl-4 font-medium text-fg">{formatCOP(p.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}
