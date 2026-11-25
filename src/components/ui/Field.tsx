import { forwardRef, useId } from "react";
import { cn } from "@/utils/cn";

const control =
  "w-full rounded-[14px] border border-transparent bg-elev px-4 text-[15px] text-fg outline-none placeholder:text-dim transition-colors duration-200 focus:border-fg aria-invalid:border-danger/70";

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  error?: string | null;
  hint?: string;
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] text-muted">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p className="text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-dim">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(control, "h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(control, "min-h-[84px] resize-y py-2.5", className)} {...props} />;
  },
);

/** Selector con el diseño de LIFE for LIFE (no el desplegable nativo). */
export { Select } from "./Select";

/** Grupo de opciones tipo "pastillas" para elegir una sola opción. */
export function ChoiceGroup<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; tone?: string }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} role="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "focus-ring h-9 cursor-pointer rounded-full px-4 text-[13.5px] transition-all duration-200",
              active
                ? "bg-fg text-on-fg font-medium"
                : "bg-elev text-fg hover:bg-line-strong",
              active && o.tone,
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
