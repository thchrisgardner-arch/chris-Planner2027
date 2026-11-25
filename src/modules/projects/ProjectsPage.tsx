"use client";

import { useMemo, useState } from "react";
import { CornerDownRight, FolderKanban, ListTodo, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Badge, EmptyState, Progress, Segmented } from "@/components/ui/misc";
import { RowActions, useDeleteRecord } from "@/components/ui/RowActions";
import { useForms } from "@/components/providers/FormsProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import type { Project, ProjectStatus, Task } from "@/types/db";
import { relativeDay } from "@/utils/dates";
import { formatCOP } from "@/utils/money";
import { cn } from "@/utils/cn";
import { CheckCircle, useToggleTask } from "@/modules/dashboard/DashboardWidgets";
import {
  PROJECT_STATUSES,
  priorityLabel,
  priorityTone,
  projectProgress,
  projectStatusLabel,
  projectStatusTone,
} from "./constants";

type View = "lista" | "kanban";

export function ProjectsPage() {
  const { db } = useData();
  const open = useForms();
  const [view, setView] = useState<View>("lista");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | ProjectStatus>("");

  const projects = useMemo(
    () =>
      db.projects.filter(
        (p) =>
          (!status || p.status === status) &&
          (!q ||
            p.name.toLowerCase().includes(q.toLowerCase()) ||
            db.tasks.some((t) => t.project_id === p.id && t.name.toLowerCase().includes(q.toLowerCase()))),
      ),
    [db.projects, db.tasks, q, status],
  );
  const loose = db.tasks.filter((t) => !t.project_id && !t.parent_task_id && (!q || t.name.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <PageHeader title="Proyectos" subtitle="Proyectos personales, tareas y subtareas con progreso automático.">
        <Button onClick={() => open({ kind: "task" })}>
          <ListTodo size={18} /> Tarea
        </Button>
        <Button variant="primary" className="lg:hidden" onClick={() => open({ kind: "project" })}>
          <Plus size={18} /> Proyecto
        </Button>
      </PageHeader>

      {db.projects.length === 0 && db.tasks.length === 0 ? (
        <EmptyState
          icon={<FolderKanban size={22} />}
          title="Aún no tienes proyectos"
          description="Crea un proyecto y divídelo en tareas. El progreso se calcula solo."
          action={
            <Button variant="primary" onClick={() => open({ kind: "project" })}>
              <Plus size={18} /> Crear proyecto
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
              <Input placeholder="Buscar proyectos o tareas" className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
            </div>
            <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus | "")} className="sm:w-[190px]" aria-label="Estado">
              <option value="">Todos los estados</option>
              {PROJECT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Segmented
              size="md"
              value={view}
              onChange={setView}
              options={[
                { value: "lista", label: "Lista" },
                { value: "kanban", label: "Kanban" },
              ]}
            />
          </div>
          {view === "lista" ? <ListView projects={projects} loose={loose} /> : <KanbanView projects={projects} />}
        </>
      )}
    </>
  );
}

/* ───────── Fila de tarea (con subtareas) ───────── */
function TaskRow({ task, depth = 0 }: { task: Task; depth?: number }) {
  const { db } = useData();
  const open = useForms();
  const toggle = useToggleTask();
  const del = useDeleteRecord();
  const today = useToday();
  const subs = db.tasks.filter((t) => t.parent_task_id === task.id);
  const done = task.status === "completada";
  const overdue = !done && task.due_date && task.due_date < today;

  return (
    <>
      <li className={cn("group flex items-center gap-3 rounded-[12px] px-2 py-2 hover:bg-bg-2", depth && "ml-8")}>
        {depth ? <CornerDownRight size={14} className="-ml-5 shrink-0 text-dim" /> : null}
        <CheckCircle checked={done} onToggle={() => toggle(task)} label={`${done ? "Reabrir" : "Completar"} ${task.name}`} />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-[14px]", done && "text-dim line-through")}>{task.name}</p>
          <p className="text-[12px] text-muted">
            {task.due_date ? <span className={cn(overdue && "text-warn")}>{relativeDay(task.due_date, today)}</span> : "Sin fecha"}
            {subs.length ? <span className="text-dim"> · {subs.filter((s) => s.status === "completada").length}/{subs.length} subtareas</span> : null}
          </p>
        </div>
        <Badge tone={priorityTone(task.priority)} className="hidden sm:inline-flex">
          {priorityLabel(task.priority)}
        </Badge>
        {!depth ? (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Agregar subtarea a ${task.name}`}
            title="Agregar subtarea"
            onClick={() => open({ kind: "task", defaults: { parent_task_id: task.id, project_id: task.project_id } })}
          >
            <Plus size={17} />
          </Button>
        ) : null}
        <RowActions
          label={task.name}
          onEdit={() => open({ kind: "task", record: task })}
          onDelete={() => del("tasks", task.id, `¿Eliminar «${task.name}»?`, subs.length ? `También se eliminarán ${subs.length} subtareas.` : undefined)}
        />
      </li>
      {subs.map((s) => (
        <TaskRow key={s.id} task={s} depth={1} />
      ))}
    </>
  );
}

function ProjectMeta({ p }: { p: Project }) {
  const today = useToday();
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
      {p.category ? <span>{p.category}</span> : null}
      <span>Prioridad {priorityLabel(p.priority).toLowerCase()}</span>
      {p.due_date ? <span className={cn(p.status !== "completado" && p.due_date < today && "text-warn")}>Entrega {relativeDay(p.due_date, today).toLowerCase()}</span> : null}
      {p.budget ? <span>Presupuesto {formatCOP(p.budget)}</span> : null}
    </p>
  );
}

function ListView({ projects, loose }: { projects: Project[]; loose: Task[] }) {
  const { db, update } = useData();
  const open = useForms();
  const del = useDeleteRecord();
  const { toast } = useFeedback();

  return (
    <div className="flex flex-col gap-4">
      {projects.length === 0 ? <EmptyState compact icon={<Search size={20} />} title="Ningún proyecto coincide con los filtros" /> : null}
      {projects.map((p) => {
        const prog = projectProgress(p, db.tasks);
        const tasks = db.tasks.filter((t) => t.project_id === p.id && !t.parent_task_id);
        return (
          <Card key={p.id} className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} />
                <div className="min-w-0">
                  <h3 className="truncate text-[18px] font-medium">{p.name}</h3>
                  <ProjectMeta p={p} />
                  {p.description ? <p className="mt-2 text-[13px] text-muted">{p.description}</p> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={p.status}
                  aria-label={`Estado de ${p.name}`}
                  className="h-9 w-[150px] text-[13px]"
                  onChange={async (e) => {
                    await update("projects", p.id, { status: e.target.value as ProjectStatus });
                    toast(`${p.name}: ${projectStatusLabel(e.target.value as ProjectStatus)}`);
                  }}
                >
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <RowActions
                  label={p.name}
                  onEdit={() => open({ kind: "project", record: p })}
                  onDelete={() => del("projects", p.id, `¿Eliminar el proyecto ${p.name}?`, tasks.length ? "También se eliminarán sus tareas." : undefined)}
                />
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Progress value={prog.pct} color={p.color} className="h-2" label={`Progreso de ${p.name}`} />
              <span className="num w-12 shrink-0 text-right text-[13px] font-medium text-fg">
                {Math.round(prog.pct)} %
              </span>
            </div>
            <ul className="-mx-2 mt-4 flex flex-col">
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </ul>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => open({ kind: "task", defaults: { project_id: p.id } })}>
              <Plus size={17} /> Agregar tarea
            </Button>
          </Card>
        );
      })}
      {loose.length ? (
        <Card className="p-5 sm:p-6">
          <h3 className="text-[17px] font-medium">Tareas sin proyecto</h3>
          <ul className="-mx-2 mt-3 flex flex-col">
            {loose.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function KanbanView({ projects }: { projects: Project[] }) {
  const { db, update } = useData();
  const open = useForms();
  const today = useToday();

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[1100px] grid-cols-5 gap-3">
        {PROJECT_STATUSES.map((col) => {
          const items = projects.filter((p) => p.status === col.value);
          return (
            <div key={col.value} className="rounded-[22px] bg-bg-2 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <Badge tone={projectStatusTone(col.value)} dot>
                  {col.label}
                </Badge>
                <span className="num text-[12px] text-dim">{items.length}</span>
              </div>
              <div className="flex min-h-[120px] flex-col gap-2.5">
                {items.map((p) => {
                  const prog = projectProgress(p, db.tasks);
                  return (
                    <div key={p.id} className="rounded-[16px] border border-line bg-card p-3.5">
                      <button className="block w-full cursor-pointer text-left" onClick={() => open({ kind: "project", record: p })}>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
                          <p className="truncate text-[14px] font-medium">{p.name}</p>
                        </div>
                        <p className="mt-1 text-[11.5px] text-muted">
                          {p.due_date ? relativeDay(p.due_date, today) : "Sin fecha"} · {prog.done}/{prog.total} tareas
                        </p>
                        <Progress value={prog.pct} color={p.color} className="mt-3" label={`Progreso de ${p.name}`} />
                      </button>
                      <Select
                        value={p.status}
                        aria-label={`Mover ${p.name}`}
                        className="mt-3 h-8 rounded-[9px] text-[12px]"
                        onChange={(e) => update("projects", p.id, { status: e.target.value as ProjectStatus })}
                      >
                        {PROJECT_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            Mover a: {s.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  );
                })}
                {items.length === 0 ? <p className="px-1 py-6 text-center text-[12px] text-dim">Vacío</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
