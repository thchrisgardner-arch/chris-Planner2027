"use client";

import { Minus, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/misc";
import { ProgressCard } from "@/components/ui/viz";
import { RowActions, useDeleteRecord } from "@/components/ui/RowActions";
import { useForms } from "@/components/providers/FormsProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import type { AnnualGoal } from "@/types/db";
import { relativeDay } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { priorityLabel } from "@/modules/projects/constants";
import { GOAL_AREAS, GOAL_STATUSES, goalArea } from "./constants";

export function GoalsPage() {
  const { db, update } = useData();
  const open = useForms();
  const del = useDeleteRecord();
  const today = useToday();
  const goals = db.annual_goals;
  const avg = goals.length ? goals.reduce((s, g) => s + g.progress, 0) / goals.length : 0;
  const achieved = goals.filter((g) => g.status === "logrado").length;

  const bump = (g: AnnualGoal, delta: number) => {
    const progress = Math.max(0, Math.min(100, g.progress + delta));
    return update("annual_goals", g.id, {
      progress,
      status: progress >= 100 ? "logrado" : progress > 0 && g.status === "no_iniciado" ? "en_progreso" : g.status === "logrado" ? "en_progreso" : g.status,
    });
  };

  return (
    <>
      <PageHeader title="Objetivos 2027" subtitle="Tu planificación anual por áreas de vida.">
        <Button variant="primary" className="max-md:hidden" onClick={() => open({ kind: "goal" })}>
          <Plus size={18} /> Nuevo objetivo
        </Button>
      </PageHeader>

      {goals.length === 0 ? (
        <EmptyState
          title="Define tus objetivos para 2027"
          description="Finanzas, profesional, salud, personal, aprendizaje y experiencias."
        />
      ) : (
        <>
          <div className="mb-3 grid gap-3 xl:grid-cols-12">
            <Card variant="inverse" className="flex min-h-[220px] flex-col xl:col-span-4">
              <h2 className="text-[15px] text-on-fg">Cumplimiento anual</h2>
              <p className="figure mt-auto pt-6 text-[72px] text-on-fg">
                {Math.round(avg)}
                <span className="text-[28px] text-on-fg/60"> %</span>
              </p>
              <p className="mt-1 text-[13px] text-on-fg/65">
                {achieved} de {goals.length} {goals.length === 1 ? "objetivo logrado" : "objetivos logrados"}
              </p>
            </Card>
            <Card className="xl:col-span-8">
              <h2 className="text-[15px]">Por área de vida</h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {GOAL_AREAS.map((a) => {
                  const list = goals.filter((g) => g.area === a.value);
                  const p = list.length ? list.reduce((s, g) => s + g.progress, 0) / list.length : 0;
                  return (
                    <ProgressCard
                      key={a.value}
                      label={a.label}
                      pct={p}
                      meta={list.length ? `${list.length} ${list.length === 1 ? "objetivo" : "objetivos"}` : "Sin objetivos"}
                    />
                  );
                })}
              </div>
            </Card>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((g) => {
              const area = goalArea(g.area);
              return (
                <Card key={g.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: area.color }} aria-hidden /> {area.label}
                      </Badge>
                      <Badge tone={g.status === "logrado" ? "brand" : "neutral"}>{GOAL_STATUSES.find((s) => s.value === g.status)?.label}</Badge>
                    </div>
                    <RowActions label={g.title} onEdit={() => open({ kind: "goal", record: g })} onDelete={() => del("annual_goals", g.id, `¿Eliminar «${g.title}»?`)} />
                  </div>
                  <h2 className="mt-4 text-[17px] leading-snug">{g.title}</h2>
                  {g.description ? <p className="mt-1 line-clamp-2 text-[13px] text-muted">{g.description}</p> : null}
                  <p className="mt-2 text-[12px] text-dim">
                    Prioridad {priorityLabel(g.priority).toLowerCase()}
                    {g.target_date ? ` · ${relativeDay(g.target_date, today)}` : ""}
                  </p>
                  <div className="mt-auto pt-5">
                    <div className="flex items-end justify-between gap-3">
                      <p className={cn("figure text-[52px]", g.progress === 0 && "text-dim")}>
                        {g.progress}
                        <span className="text-[22px] text-muted"> %</span>
                      </p>
                      <div className="flex gap-1.5 pb-1.5">
                        <Button size="icon-sm" variant="secondary" className="bg-bg-2" onClick={() => bump(g, -10)} aria-label={`Restar 10 % a ${g.title}`} disabled={g.progress === 0}>
                          <Minus size={16} />
                        </Button>
                        <Button size="icon-sm" variant="secondary" className="bg-bg-2" onClick={() => bump(g, 10)} aria-label={`Sumar 10 % a ${g.title}`} disabled={g.progress >= 100}>
                          <Plus size={16} />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-bg-2" role="progressbar" aria-label={`Progreso de ${g.title}`} aria-valuenow={g.progress} aria-valuemin={0} aria-valuemax={100}>
                      <div className={cn("h-full rounded-full", g.progress >= 100 ? "bg-brand" : "bg-fg")} style={{ width: `${g.progress}%` }} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="mt-8 text-center text-[13px] text-dim">Próximamente: hitos por objetivo.</p>
        </>
      )}
    </>
  );
}
