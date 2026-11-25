import { forwardRef } from "react";
import { cn } from "@/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "icon" | "icon-sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/** Botones en píldora. Primario negro (uno por pantalla), secundario en plano gris, fantasma, ícono circular. */
const variants: Record<Variant, string> = {
  primary: "bg-fg text-on-fg hover:bg-fg/85 font-medium",
  secondary: "bg-card text-fg hover:bg-elev",
  ghost: "text-fg hover:bg-elev",
  danger: "bg-danger/10 text-danger hover:bg-danger/15",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-full",
  md: "h-11 px-5 text-[14px] gap-2 rounded-full",
  icon: "h-10 w-10 rounded-full",
  "icon-sm": "h-9 w-9 rounded-full",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "focus-ring inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap transition-all duration-200 ease-(--ease-os) disabled:cursor-not-allowed disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> : null}
      {children}
    </button>
  );
});
