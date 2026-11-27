"use client";

import { useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { ChoiceGroup, Field, Input } from "@/components/ui/Field";
import { useData } from "@/lib/store/DataProvider";
import type { Habit } from "@/types/db";
import { WEEKDAYS_MED } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { HABIT_COLORS } from "./selectors";
import { ColorPicker } from "@/components/ui/ColorPicker";

const SUGGESTIONS = ["Entrenar", "Tomar agua", "Leer", "Dormir a tiempo", "Comer saludable", "Organizar el espacio de trabajo"];

export function HabitForm({ open, onClose, record }: { open: boolean; onClose: () => void; record?: Habit }) {
  const { insert, update } = useData();
  const [name, setName] = useState(record?.name ?? "");
  const [days, setDays] = useState<number[]>(record?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [color, setColor] = useState(record?.color ?? HABIT_COLORS[0]);
  // Frecuencia: días fijos (lo de siempre) o «X veces por semana»
  const [modo, setModo] = useState<"dias" | "semana">(record?.weekly_target ? "semana" : "dias");
  const [veces, setVeces] = useState(record?.weekly_target ?? 3);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Escribe el nombre del hábito.";
    if (modo === "dias" && days.length === 0) e.days = "Elige al menos un día.";
    setErrors(e);
    if (Object.keys(e).length) return false;
    // En «veces por semana» los días quedan como sugeridos (la rutina de entrenamiento los usa)
    const data = { name: name.trim(), days: modo === "semana" && !days.length ? [0, 1, 2, 3, 4, 5, 6] : days, color, weekly_target: modo === "semana" ? veces : null };
    if (record) {
      await update("habits", record.id, data);
      return "Hábito actualizado.";
    }
    await insert("habits", data);
    return "Hábito creado.";
  };

  return (
    <FormModal open={open} onClose={onClose} title={record ? "Editar hábito" : "Nuevo hábito"} onSubmit={submit} size="sm">
      <Field label="Nombre" error={errors.name}>
        {(id) => <Input id={id} value={name} placeholder="Ej. Leer 20 minutos" onChange={(e) => setName(e.target.value)} />}
      </Field>
      {!record ? (
        <div className="-mt-1 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setName(s)}
              className="cursor-pointer rounded-full border border-line px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-brand/40 hover:text-fg"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <Field label="Frecuencia">
        {() => (
          <ChoiceGroup
            value={modo}
            onChange={setModo}
            options={[
              { value: "dias", label: "Días fijos" },
              { value: "semana", label: "Veces por semana" },
            ]}
          />
        )}
      </Field>
      {modo === "semana" ? (
        <Field label="¿Cuántas veces por semana?" hint="Cualquier día cuenta; la semana se cumple al llegar a la cantidad.">
          {() => (
            <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Veces por semana">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={veces === n}
                  onClick={() => setVeces(n)}
                  className={cn(
                    "focus-ring h-10 cursor-pointer rounded-[10px] border text-[12.5px] font-medium transition-all",
                    veces === n ? "border-brand/50 bg-brand/15 text-brand-soft" : "border-line bg-bg-2 text-dim hover:text-muted",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
        </Field>
      ) : null}
      <Field label={modo === "semana" ? "Días sugeridos (opcional)" : "Días programados"} error={errors.days}>
        {() => (
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS_MED.map((d, i) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(i)}
                onClick={() => toggleDay(i)}
                className={cn(
                  "focus-ring h-10 cursor-pointer rounded-[10px] border text-[12.5px] font-medium transition-all",
                  days.includes(i) ? "border-brand/50 bg-brand/15 text-brand-soft" : "border-line bg-bg-2 text-dim hover:text-muted",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </Field>
      <Field label="Color">{() => <ColorPicker value={color} onChange={setColor} />}</Field>
    </FormModal>
  );
}
