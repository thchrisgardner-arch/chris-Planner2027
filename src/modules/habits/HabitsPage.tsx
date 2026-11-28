"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { Deslizable } from "@/components/ui/Deslizable";
import { AsistenteModulo, useCelebracion, useVacioAsistente } from "@/modules/asistentes/Presencia";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyCard, Segmented } from "@/components/ui/misc";
import { useRouter, useSearchParams } from "next/navigation";
import { EntrenamientoPanel } from "@/modules/salud/EntrenamientoPanel";
import { AlimentacionPanel } from "@/modules/salud/AlimentacionPanel";
import { RowActions, useDeleteRecord } from "@/components/ui/RowActions";
import { useForms } from "@/components/providers/FormsProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import type { Habit } from "@/types/db";
import { WEEKDAYS_MED, WEEKDAYS_SHORT, addDays, monthKey, monthLabel, parseISO, startOfWeek, daysInMonth, weekdayMon } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { completion, isScheduled, logFor, streak } from "./selectors";

type Vista = "habitos" | "entrenamiento" | "alimentacion";
const VISTAS: { value: Vista; label: string }[] = [
  { value: "habitos", label: "Hábitos" },
  { value: "entrenamiento", label: "Entrenamiento" },
  { value: "alimentacion", label: "Alimentación" },
];

export function HabitsPage() {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("vista");
  const vista: Vista = VISTAS.some((v) => v.value === raw) ? (raw as Vista) : "habitos";
  const elegir = (v: Vista) => router.replace(v === "habitos" ? "/salud" : `/salud?vista=${v}`, { scroll: false });

  const vacio = useVacioAsistente("brote");
  // Brote celebra cada vez que se marca un hábito de hoy
  const celebrar = useCelebracion(db.habit_logs.filter((l) => l.date === today).length);

  return (
    <>
      <PageHeader title="Salud y hábitos" subtitle="Hábitos, rutina de entrenamiento y alimentación." asistente={<AsistenteModulo id="brote" celebrar={celebrar} oculto={db.habits.length === 0} />} />
      {/* Pestañas a la izquierda y «Nuevo hábito» a la derecha, en la misma fila (en celular el botón es el «+» flotante) */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="-mx-4 min-w-0 overflow-x-auto px-4 sm:mx-0 sm:px-0 sin-barra">
          <Segmented size="md" label="Secciones de salud" value={vista} onChange={elegir} options={VISTAS} desplazable />
        </div>
        {vista === "habitos" ? (
          <Button variant="primary" className="shrink-0 max-md:hidden" onClick={() => open({ kind: "habit" })}>
            <Plus size={18} /> Nuevo hábito
          </Button>
        ) : null}
      </div>
      {vista === "entrenamiento" ? (
        <EntrenamientoPanel />
      ) : vista === "alimentacion" ? (
        <AlimentacionPanel />
      ) : db.habits.length === 0 ? (
        <EmptyCard
          ghost="grid"
          title={vacio.frase}
          aside={vacio.aside}
          description="Elige los días en que quieres cumplirlo y márcalo desde aquí o desde el inicio."
          action={
            <Button variant="secondary" className="bg-bg" onClick={() => open({ kind: "habit" })}>
              <Plus size={18} /> Nuevo hábito
            </Button>
          }
        />
      ) : (
        // Dos columnas en pantallas grandes; la tarjeta que queda sola (un hábito, o el último si son impares)
        // ocupa todo el ancho y llega al borde del botón «Nuevo hábito»
        <div className="grid gap-3 xl:grid-cols-2 xl:[&>*:last-child:nth-child(odd)]:col-span-2">
          {db.habits.map((h) => (
            <HabitCard key={h.id} habit={h} today={today} />
          ))}
        </div>
      )}
    </>
  );
}

function HabitCard({ habit, today }: { habit: Habit; today: string }) {
  const { db, insert, remove } = useData();
  const open = useForms();
  const del = useDeleteRecord();
  const { toast } = useFeedback();
  const [busy, setBusy] = useState<string | null>(null);

  const weekStart = startOfWeek(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const key = monthKey(today);
  const monthDays = Array.from({ length: daysInMonth(key) }, (_, i) => `${key}-${String(i + 1).padStart(2, "0")}`);
  const weekStats = completion(habit, db.habit_logs, weekStart, today);
  const monthStats = completion(habit, db.habit_logs, `${key}-01`, today);
  const s = streak(habit, db.habit_logs, today);

  const toggle = async (day: string) => {
    if (day > today) return;
    setBusy(day);
    try {
      const log = logFor(db.habit_logs, habit.id, day);
      if (log) await remove("habit_logs", log.id);
      else await insert("habit_logs", { habit_id: habit.id, date: day });
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar.", "error");
    } finally {
      setBusy(null);
    }
  };

  // En el celular, deslizar la tarjeta a la derecha marca el hábito de hoy
  const pendienteHoy = isScheduled(habit, today, db.habit_logs) && !logFor(db.habit_logs, habit.id, today);
  return (
    <Deslizable
      redondeo={24}
      fondo=""
      derecha={pendienteHoy ? { label: "Hecho hoy", icono: <Check size={18} />, tono: "marca", onAccion: () => void toggle(today) } : null}
    >
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: habit.color }} aria-hidden />
          <div className="min-w-0">
            <h2 className="truncate text-[17px]">{habit.name}</h2>
            <p className="text-[12px] text-muted">
              {habit.days.length === 7 ? "Todos los días" : habit.days.map((d) => WEEKDAYS_MED[d]).join(" · ")}
            </p>
          </div>
        </div>
        <RowActions
          label={habit.name}
          onEdit={() => open({ kind: "habit", record: habit })}
          onDelete={() => del("habits", habit.id, `¿Eliminar el hábito ${habit.name}?`, "Se borrará también su historial.")}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className={cn("num text-[44px] font-bold leading-none tracking-[-0.03em]", s === 0 && "text-dim")}>
            {s} {s === 1 ? "día" : "días"}
          </p>
          <p className="mt-1 text-[13px] text-muted">Racha actual</p>
        </div>
        <dl className="flex gap-6 pb-1 text-right">
          <div>
            <dt className="text-[12.5px] text-muted">Esta semana</dt>
            <dd className={cn("num mt-0.5 text-[18px]", weekStats.pct === 0 && "text-dim")}>{Math.round(weekStats.pct)} %</dd>
          </div>
          <div>
            <dt className="text-[12.5px] capitalize text-muted">{monthLabel(key).split(" ")[0]}</dt>
            <dd className={cn("num mt-0.5 text-[18px]", monthStats.completed === 0 && "text-dim")}>
              {monthStats.completed}/{monthStats.scheduled}
            </dd>
          </div>
        </dl>
      </div>

      <p className="mb-2 mt-6 text-[12.5px] text-muted">Semana actual · toca un día para marcarlo</p>
      <div className="grid grid-cols-7 gap-1.5">
        {week.map((d, i) => {
          const scheduled = isScheduled(habit, d, db.habit_logs);
          const done = !!logFor(db.habit_logs, habit.id, d);
          const future = d > today;
          return (
            <button
              key={d}
              disabled={future || busy === d}
              onClick={() => toggle(d)}
              aria-pressed={done}
              aria-label={`${WEEKDAYS_MED[i]} ${parseISO(d).getUTCDate()}`}
              className={cn(
                "focus-ring flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[16px] text-[11px] transition-all disabled:cursor-not-allowed",
                done ? "bg-brand text-[#0a0a0a]" : scheduled ? "bg-bg-2 text-muted hover:bg-elev" : "border border-dashed border-line-strong text-dim",
                d === today && !done && "ring-[1.5px] ring-fg",
                future && "opacity-40",
              )}
            >
              <span>{WEEKDAYS_SHORT[i]}</span>
              <span className="num text-[14px] font-medium">{parseISO(d).getUTCDate()}</span>
            </button>
          );
        })}
      </div>

      <p className="mb-2 mt-6 text-[12.5px] text-muted">Cumplimiento de {monthLabel(key).toLowerCase()}</p>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS_SHORT.map((w, i) => (
          <span key={`h${i}`} className="text-center text-[11px] text-dim" aria-hidden>
            {w}
          </span>
        ))}
        {Array.from({ length: weekdayMon(monthDays[0]) }, (_, i) => (
          <span key={`pad${i}`} aria-hidden />
        ))}
        {monthDays.map((d) => {
          const done = !!logFor(db.habit_logs, habit.id, d);
          const scheduled = isScheduled(habit, d, db.habit_logs);
          const n = parseISO(d).getUTCDate();
          const state = done ? "cumplido" : d > today ? "pendiente" : scheduled ? "no cumplido" : "no programado";
          return (
            <span
              key={d}
              role="img"
              title={`Día ${n}: ${state}`}
              aria-label={`Día ${n}: ${state}`}
              className={cn(
                "h-6 rounded-[8px]",
                done ? "bg-brand" : !scheduled ? "border border-dashed border-line-strong" : d > today ? "bg-bg-2" : "bg-elev",
                d === today && "ring-[1.5px] ring-fg",
              )}
            />
          );
        })}
      </div>
    </Card>
    </Deslizable>
  );
}
