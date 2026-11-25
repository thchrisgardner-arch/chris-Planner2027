"use client";

/**
 * Entrenamiento: rutina recomendada de lunes a domingo según los días de tu hábito de entrenar.
 * Hoy queda abierto y se puede marcar como hecho (marca el hábito y suma XP).
 */
import { useState } from "react";
import { Check, ChevronDown, Clock, Dumbbell, Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, Field } from "@/components/ui/Field";
import { useData } from "@/lib/store/DataProvider";
import { useForms } from "@/components/providers/FormsProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useToday } from "@/hooks/useToday";
import { habitoDeEntreno, rutinaSemanal } from "@/lib/salud/entrenamiento";
import { guardarPerfil, usePerfilFisico, type Lugar, type Nivel } from "@/lib/salud/perfil";
import { logFor } from "@/modules/habits/selectors";
import { WEEKDAYS_MED, addDays, startOfWeek, weekdayMon } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { OBJETIVOS } from "./PerfilFisicoCard";

const LUGARES: { value: Lugar; label: string }[] = [
  { value: "gym", label: "Gimnasio" },
  { value: "casa", label: "Casa" },
];
const NIVELES: { value: Nivel; label: string }[] = [
  { value: "principiante", label: "Principiante" },
  { value: "intermedio", label: "Intermedio" },
  { value: "avanzado", label: "Avanzado" },
];
const DIAS_LARGOS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function EntrenamientoPanel() {
  const { db, insert, remove } = useData();
  const open = useForms();
  const { toast } = useFeedback();
  const today = useToday();
  const p = usePerfilFisico();
  const habito = habitoDeEntreno(db.habits);
  const hoy = today ? weekdayMon(today) : 0;
  const [abierto, setAbierto] = useState<number | null>(null);
  const [nuevosDias, setNuevosDias] = useState<number[]>([0, 2, 4]);
  const [ocupado, setOcupado] = useState(false);

  const preferencias = (
    <div className="grid gap-4 md:grid-cols-3">
      <Field label="Dónde entrenas">{() => <ChoiceGroup value={p.lugar} onChange={(v) => guardarPerfil({ lugar: v })} options={LUGARES} />}</Field>
      <Field label="Tu nivel">{() => <ChoiceGroup value={p.nivel} onChange={(v) => guardarPerfil({ nivel: v })} options={NIVELES} />}</Field>
      <Field label="Objetivo">{() => <ChoiceGroup value={p.objetivo} onChange={(v) => guardarPerfil({ objetivo: v })} options={OBJETIVOS} />}</Field>
    </div>
  );

  if (!habito) {
    const crear = async () => {
      if (!nuevosDias.length) return toast("Elige al menos un día.", "error");
      setOcupado(true);
      try {
        await insert("habits", { name: "Entrenar", days: nuevosDias, color: "#5ce65c" });
        toast("Rutina creada: ya tienes el hábito Entrenar.");
      } finally {
        setOcupado(false);
      }
    };
    return (
      <Card>
        <CardHeader title="Arma tu rutina" subtitle="Te recomiendo qué hacer cada día" />
        <div className="grid grid-cols-1 gap-4">
          <Field label="¿Qué días quieres entrenar?">
            {() => (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días de entrenamiento">
                {WEEKDAYS_MED.map((d, i) => {
                  const on = nuevosDias.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setNuevosDias((x) => (on ? x.filter((y) => y !== i) : [...x, i].sort()))}
                      className={cn("focus-ring h-10 min-w-12 cursor-pointer rounded-full px-3 text-[13.5px] font-medium", on ? "bg-fg text-on-fg" : "bg-bg hover:bg-elev")}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
          {preferencias}
          <Button variant="primary" className="justify-self-start" onClick={crear} disabled={ocupado}>
            <Plus size={18} /> Crear mi rutina
          </Button>
          <p className="text-[12.5px] text-dim">Se crea el hábito «Entrenar» con esos días; al marcarlo sumas XP y racha.</p>
        </div>
      </Card>
    );
  }

  const semana = rutinaSemanal(habito.days, p.lugar, p.nivel, p.objetivo);
  const lunes = today ? startOfWeek(today) : "";
  const fechaDe = (d: number) => (lunes ? addDays(lunes, d) : "");
  const hechoHoy = today ? !!logFor(db.habit_logs, habito.id, today) : false;
  const diasEntreno = semana.filter((d) => d.entrena).length;

  const marcarHoy = async () => {
    if (!today) return;
    setOcupado(true);
    try {
      const log = logFor(db.habit_logs, habito.id, today);
      if (log) await remove("habit_logs", log.id);
      else {
        await insert("habit_logs", { habit_id: habito.id, date: today });
        toast("Entrenamiento de hoy cumplido.");
      }
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold">Tu semana de entrenamiento</h2>
            <p className="mt-0.5 text-[13px] text-muted">
              {diasEntreno} {diasEntreno === 1 ? "día" : "días"} según tu hábito «{habito.name}»: {habito.days.map((d) => WEEKDAYS_MED[d]).join(", ")}
            </p>
          </div>
          <Button variant="secondary" className="bg-bg" onClick={() => open({ kind: "habit", record: habito })}>
            Cambiar días
          </Button>
        </div>
        <div className="mt-4">{preferencias}</div>
      </Card>

      <ol className="grid grid-cols-1 gap-2">
        {semana.map((d) => {
          const esHoy = d.dia === hoy;
          const desplegado = abierto === null ? esHoy : abierto === d.dia;
          return (
            <li key={d.dia} className={cn("card overflow-hidden p-0", esHoy && "ring-2 ring-[var(--color-brand)]")}>
              <button
                type="button"
                onClick={() => setAbierto(desplegado ? -1 : d.dia)}
                aria-expanded={desplegado}
                className="focus-ring flex w-full cursor-pointer items-center gap-3 p-4 text-left"
              >
                <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", d.entrena ? "bg-fg text-on-fg" : "bg-elev text-muted")}>
                  {d.entrena ? <Dumbbell size={19} /> : <span className="text-[12px] font-bold">{WEEKDAYS_MED[d.dia]}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                    {DIAS_LARGOS[d.dia]}
                    {esHoy ? <span className="rounded-full bg-brand px-2 py-0.5 text-[11.5px] font-medium text-[#0a0a0a]">Hoy</span> : null}
                    {fechaDe(d.dia) ? <span className="num text-dim">{fechaDe(d.dia).slice(8)}</span> : null}
                  </span>
                  <span className="block truncate text-[15.5px] font-bold">{d.titulo}</span>
                  <span className="block truncate text-[12.5px] text-muted">{d.enfoque}</span>
                </span>
                <span className="num hidden shrink-0 items-center gap-1 text-[12.5px] text-muted sm:flex">
                  <Clock size={14} /> {d.minutos} min
                </span>
                <ChevronDown size={18} className={cn("shrink-0 text-dim transition-transform", desplegado && "rotate-180")} />
              </button>
              {desplegado ? (
                <div className="border-t border-line px-4 pb-4 pt-3">
                  {d.ejercicios.length ? (
                    <ul className="grid gap-1.5">
                      {d.ejercicios.map((e, k) => (
                        <li key={k} className="flex items-center justify-between gap-3 rounded-[14px] bg-bg-2 px-3 py-2.5">
                          <span className="min-w-0 truncate text-[14px]">{e.nombre}</span>
                          <span className="num shrink-0 text-[13px] font-medium">
                            {e.series} × {e.reps}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {d.extra ? <p className={cn("text-[13px] text-muted", d.ejercicios.length && "mt-3")}>{d.extra}</p> : null}
                  {esHoy && d.entrena ? (
                    <Button variant={hechoHoy ? "secondary" : "primary"} className={cn("mt-3", hechoHoy && "bg-bg")} onClick={marcarHoy} disabled={ocupado}>
                      <Check size={17} /> {hechoHoy ? "Entrenamiento hecho (deshacer)" : "Marcar entrenamiento de hoy"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="text-center text-[12.5px] text-dim">
        Rutina orientativa. Calienta 5–10 minutos antes y, si tienes una lesión o condición médica, consulta a un profesional.
      </p>
    </div>
  );
}
