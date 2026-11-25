"use client";

import { useState } from "react";
import { Flame, Plus, Repeat } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/misc";
import { ModuleTabs, RowActions, useDeleteRecord } from "@/components/ui/RowActions";
import { useForms } from "@/components/providers/FormsProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import type { Habit } from "@/types/db";
import { WEEKDAYS_MED, WEEKDAYS_SHORT, addDays, monthKey, monthLabel, parseISO, startOfWeek, daysInMonth } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { completion, isScheduled, logFor, streak } from "./selectors";

type Tab = "habitos" | "entrenamiento" | "alimentacion";

export function HabitsPage() {
  const { db } = useData();
  const open = useForms();
  const [tab, setTab] = useState<Tab>("habitos");
  const today = useToday();

  return (
    <>
      <PageHeader title="Salud y hábitos" subtitle="Seguimiento diario, rachas y cumplimiento.">
        <Button variant="primary" className="lg:hidden" onClick={() => open({ kind: "habit" })}>
          <Plus size={18} /> Hábito
        </Button>
        <Button className="hidden lg:inline-flex" onClick={() => open({ kind: "habit" })}>
          <Repeat size={18} /> Nuevo hábito
        </Button>
      </PageHeader>
      <ModuleTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "habitos", label: "Hábitos" },
          { value: "entrenamiento", label: "Entrenamiento", soon: true },
          { value: "alimentacion", label: "Alimentación", soon: true },
        ]}
      />
      {db.habits.length === 0 ? (
        <EmptyState
          icon={<Repeat size={22} />}
          title="Crea tu primer hábito"
          description="Elige los días en que quieres cumplirlo y márcalo desde aquí o desde el dashboard."
          action={
            <Button variant="primary" onClick={() => open({ kind: "habit" })}>
              <Plus size={18} /> Nuevo hábito
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
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

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: habit.color }} />
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-medium">{habit.name}</h3>
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

      <div className="mt-5 grid grid-cols-3 gap-2">
        <div className="rounded-[22px] bg-bg-2 px-3 py-2.5">
          <p className="label">Racha</p>
          <p className="num mt-1 flex items-center gap-1 text-[20px] font-medium">
            {s} <Flame size={18} className={s ? "text-warn" : "text-dim"} />
          </p>
        </div>
        <div className="rounded-[22px] bg-bg-2 px-3 py-2.5">
          <p className="label">Esta semana</p>
          <p className="num mt-1 text-[20px] font-medium">{Math.round(weekStats.pct)} %</p>
        </div>
        <div className="rounded-[22px] bg-bg-2 px-3 py-2.5">
          <p className="label">{monthLabel(key).split(" ")[0]}</p>
          <p className="num mt-1 text-[20px] font-medium">
            {monthStats.completed}/{monthStats.scheduled}
          </p>
        </div>
      </div>

      <p className="label mb-2 mt-5">Semana actual · toca un día para marcarlo</p>
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
                "focus-ring flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[12px] border text-[11px] transition-all disabled:cursor-not-allowed",
                done ? "border-transparent text-[#06240f]" : scheduled ? "border-line bg-bg-2 text-muted hover:border-line-strong" : "border-dashed border-line text-dim",
                d === today && !done && "ring-1 ring-fg/30",
                future && "opacity-40",
              )}
              style={done ? { background: habit.color } : undefined}
            >
              <span>{WEEKDAYS_SHORT[i]}</span>
              <span className="num text-[14px] font-medium">{parseISO(d).getUTCDate()}</span>
            </button>
          );
        })}
      </div>

      <p className="label mb-2 mt-5">Calendario de cumplimiento · {monthLabel(key)}</p>
      <div className="flex flex-wrap gap-1">
        {monthDays.map((d) => {
          const done = !!logFor(db.habit_logs, habit.id, d);
          const scheduled = isScheduled(habit, d);
          return (
            <span
              key={d}
              title={`${d}${done ? " · cumplido" : scheduled ? "" : " · no programado"}`}
              className={cn("h-4 w-4 rounded-[4px]", !done && (scheduled ? "bg-elev" : "bg-bg-2"), d > today && "opacity-40")}
              style={done ? { background: habit.color } : undefined}
            />
          );
        })}
      </div>
    </Card>
  );
}
