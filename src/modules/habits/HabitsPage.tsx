"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/misc";
import { RowActions, useDeleteRecord } from "@/components/ui/RowActions";
import { useForms } from "@/components/providers/FormsProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import type { Habit } from "@/types/db";
import { WEEKDAYS_MED, WEEKDAYS_SHORT, addDays, monthKey, monthLabel, parseISO, startOfWeek, daysInMonth, weekdayMon } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { completion, isScheduled, logFor, streak } from "./selectors";

export function HabitsPage() {
  const { db } = useData();
  const open = useForms();
  const today = useToday();

  return (
    <>
      <PageHeader title="Salud y hábitos" subtitle="Seguimiento diario, rachas y cumplimiento.">
        <Button variant="primary" className="max-md:hidden" onClick={() => open({ kind: "habit" })}>
          <Plus size={18} /> Nuevo hábito
        </Button>
      </PageHeader>
      {db.habits.length === 0 ? (
        <EmptyState
          title="Crea tu primer hábito"
          description="Elige los días en que quieres cumplirlo y márcalo desde aquí o desde el inicio."
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {db.habits.map((h) => (
            <HabitCard key={h.id} habit={h} today={today} />
          ))}
        </div>
      )}
      <p className="mt-8 text-center text-[13px] text-dim">Próximamente: entrenamiento y alimentación.</p>
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

  return (
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
          const scheduled = isScheduled(habit, d);
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
          const scheduled = isScheduled(habit, d);
          const n = parseISO(d).getUTCDate();
          const state = done ? "cumplido" : d > today ? "pendiente" : scheduled ? "no cumplido" : "no programado";
          return (
            <span
              key={d}
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
  );
}
