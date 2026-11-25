import { cn } from "@/utils/cn";

/** Marca de LIFE OS: un anillo de progreso al 75 % dentro de un módulo. */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none" className={cn("shrink-0", className)} aria-hidden>
      <rect x="0.5" y="0.5" width="33" height="33" rx="10.5" fill="#111412" stroke="#111412" />
      <circle cx="17" cy="17" r="8.5" stroke="#2f3732" strokeWidth="3" />
      <path d="M17 8.5a8.5 8.5 0 1 1-8.5 8.5" stroke="#2EE56B" strokeWidth="3" strokeLinecap="round" />
      <circle cx="17" cy="17" r="2.4" fill="#F4F6F4" />
    </svg>
  );
}

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed ? (
        <div className="leading-none">
          <p className="text-[15px] font-medium tracking-[0.06em]">LIFE OS</p>
          <p className="mt-1 text-[10.5px] font-medium tracking-[0.18em] text-dim">2027</p>
        </div>
      ) : null}
    </div>
  );
}
