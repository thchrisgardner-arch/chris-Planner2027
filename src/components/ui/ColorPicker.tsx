import { Check } from "lucide-react";
import { cn } from "@/utils/cn";

/** Paleta compartida de proyectos y hábitos: colores de marca + pasteles. */
export const COLOR_SWATCHES: { value: string; name: string }[] = [
  // Vivos (identidad LIFE for LIFE)
  { value: "#9b82f6", name: "Violeta" },
  { value: "#2ee56b", name: "Verde" },
  { value: "#66a9f7", name: "Azul" },
  { value: "#f4a340", name: "Naranja" },
  { value: "#f0716b", name: "Coral" },
  // Pasteles
  { value: "#c9b8ff", name: "Lavanda" },
  { value: "#e3d5f7", name: "Lila" },
  { value: "#bcdcff", name: "Cielo" },
  { value: "#d0d9f2", name: "Pervinca" },
  { value: "#b5ece6", name: "Agua" },
  { value: "#b9f0cc", name: "Menta" },
  { value: "#d4ecb0", name: "Pistacho" },
  { value: "#ffe69a", name: "Mantequilla" },
  { value: "#f3dcc4", name: "Arena" },
  { value: "#ffd1b3", name: "Durazno" },
  { value: "#ffc2d4", name: "Rosa" },
  { value: "#f8c8e8", name: "Chicle" },
];

export function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
      {COLOR_SWATCHES.map((c) => {
        const active = value.toLowerCase() === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c.name}
            title={c.name}
            onClick={() => onChange(c.value)}
            className={cn(
              "focus-ring grid h-8 w-8 cursor-pointer place-items-center rounded-full transition-transform duration-200 hover:scale-110",
              active ? "ring-2 ring-fg ring-offset-2 ring-offset-card" : "ring-1 ring-inset ring-black/5",
            )}
            style={{ background: c.value }}
          >
            {active ? <Check size={14} strokeWidth={2.5} className="text-fg/80" /> : null}
          </button>
        );
      })}
    </div>
  );
}
