import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/utils/cn";

type Variant = "default" | "inverse" | "warm";

/** Tarjeta: plano de color, sin borde ni sombra. `inverse` = la tarjeta negra destacada (máx. una por pantalla). */
export function Card({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div
      className={cn(
        "card animate-in p-5 sm:p-6",
        variant === "inverse" && "card-inverse",
        variant === "warm" && "card-warm",
        className,
      )}
      {...props}
    />
  );
}

/** Botón circular ↗ que lleva al detalle. */
export function ArrowLink({ href, label, inverse }: { href: string; label: string; inverse?: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full transition-transform duration-200 hover:scale-105",
        inverse ? "bg-on-fg text-fg" : "bg-bg text-fg",
      )}
    >
      <ArrowUpRight size={18} />
    </Link>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  href,
  hrefLabel,
  inverse,
  className,
}: {
  title: string;
  subtitle?: string;
  /** Acciones en píldora (selector, filtros, +) */
  action?: React.ReactNode;
  /** Si existe, muestra el botón circular ↗ hacia el detalle */
  href?: string;
  hrefLabel?: string;
  inverse?: boolean;
  /** Compatibilidad: el ícono ya no se muestra en el encabezado */
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className={cn("truncate text-[16px] font-bold tracking-[-0.01em]", inverse ? "text-on-fg" : "text-fg")}>{title}</h2>
        {subtitle ? <p className={cn("mt-0.5 truncate text-[13px]", inverse ? "text-on-fg/60" : "text-muted")}>{subtitle}</p> : null}
      </div>
      {action || href ? (
        <div className="flex shrink-0 items-center gap-1.5">
          {action}
          {href ? <ArrowLink href={href} label={hrefLabel ?? `Ver ${title.toLowerCase()}`} inverse={inverse} /> : null}
        </div>
      ) : null}
    </div>
  );
}
