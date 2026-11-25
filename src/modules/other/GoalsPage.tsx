"use client";

import { Minus, Plus, Target } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, Progress } from "@/components/ui/misc";
import { Ring } from "@/components/charts/charts";
import { RowActions, useDeleteRecord } from "@/components/ui/RowActions";
import { useForms } from "@/components/providers/FormsProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import type { AnnualGoal } from "@/types/db";
import { relativeDay } from "@/utils/dates";
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
        <Button variant="primary" className="lg:hidden" onClick={() => open({ kind: "goal" })}>
          <Plus size={18} /> Objetivo
        </Button>
        <Button className="hidden lg:inline-flex" onClick={() => open({ kind: "goal" })}>
          <Target size={18} /> Nuevo objetivo
        </Button>
      </PageHeader>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target size={22} />}
          title="Define tus objetivos para 2027"
          description="Finanzas, profesional, salud, personal, aprendizaje y experiencias."
          action={
            <Button variant="primary" onClick={() => open({ kind: "goal" })}>
              <Plus size={18} /> Crear objetivo
            </Button>
          }
        />
      ) : (
        <>
          <Card className="mb-5 flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex items-center gap-5">
              <Ring value={avg} size={96} stroke={9} color="var(--color-violet)">
                <span className="num text-[22px] font-semibold">{Math.round(avg)}%</span>
              </Ring>
              <div>
                <p className="text-[17px] font-semibold">Cumplimiento anual</p>
                <p className="mt-1 text-[13px] text-muted">
                  {achieved} de {goals.length} objetivos logrados
                </p>
              </div>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
              {GOAL_AREAS.map((a) => {
                const list = goals.filter((g) => g.area === a.value);
                const p = list.length ? list.reduce((s, g) => s + g.progress, 0) / list.length : 0;
                return (
                  <div key={a.value} className="rounded-[22px] bg-bg-2 px-3 py-2.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-muted">{a.label}</span>
                      <span className="num text-dim">{list.length}</span>
                    </div>
                    <Progress value={p} color={a.color} className="mt-2" label={`Progreso ${a.label}`} />
                  </div>
                );
              })}
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((g) => {
              const area = goalArea(g.area);
              return (
                <Card key={g.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <Badge className="border-transparent" >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: area.color }} /> {area.label}
                    </Badge>
                    <RowActions label={g.title} onEdit={() => open({ kind: "goal", record: g })} onDelete={() => del("annual_goals", g.id, `¿Eliminar «${g.title}»?`)} />
                  </div>
                  <p className="mt-3 text-[16px] font-semibold leading-snug">{g.title}</p>
                  {g.description ? <p className="mt-1 line-clamp-2 text-[13px] text-muted">{g.description}</p> : null}
                  <p className="mt-2 text-[12px] text-dim">
                    {GOAL_STATUSES.find((s) => s.value === g.status)?.label} · Prioridad {priorityLabel(g.priority).toLowerCase()}
                    {g.target_date ? ` · ${relativeDay(g.target_date, today)}` : ""}
                  </p>
                  <div className="mt-auto pt-5">
                    <div className="flex items-center gap-3">
                      <Progress value={g.progress} color={area.color} className="h-2" label={`Progreso de ${g.title}`} />
                      <span className="num w-10 text-right text-[13px] font-semibold">{g.progress}%</span>
                    </div>
                    <div className="mt-3 flex gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => bump(g, -10)} aria-label="Restar 10 %">
                        <Minus size={14} /> 10 %
                      </Button>
                      <Button size="sm" onClick={() => bump(g, 10)} aria-label="Sumar 10 %">
                        <Plus size={14} /> 10 %
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="mt-5 text-[12px] text-dim">Los hitos por objetivo llegan en la siguiente fase.</p>
        </>
      )}
    </>
  );
}
