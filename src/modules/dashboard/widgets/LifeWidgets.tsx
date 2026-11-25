"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlarmClock,
  ArrowUpRight,
  CreditCard,
  Dumbbell,
  EllipsisVertical,
  Sparkles,
  UserRound,
  CalendarDays,
  Check,
  Flame,
  FolderKanban,
  Gift,
  ImageOff,
  ListTodo,
  Plus,
  Repeat,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, Progress } from "@/components/ui/misc";
import { Ring } from "@/components/charts/charts";
import { useForms } from "@/components/providers/FormsProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import type { Task } from "@/types/db";
import { WEEKDAYS_SHORT, addDays, formatTime, parseISO, relativeDay, startOfWeek } from "@/utils/dates";
import { formatCOP, pct } from "@/utils/money";
import { cn } from "@/utils/cn";
import {
  priorityLabel,
  priorityTone,
  projectProgress,
  projectStatusLabel,
  projectStatusTone,
  taskStatusLabel,
} from "@/modules/projects/constants";
import { isScheduled, logFor, streak } from "@/modules/habits/selectors";
import { CALENDAR_EXTRA, eventType, wishStatusLabel, wishStatusTone } from "@/modules/other/constants";
import { findStore } from "@/modules/other/stores";
import { StoreLogo } from "@/components/ui/StoreLogo";

/* ───────── Checkbox redondo reutilizable ───────── */
export function CheckCircle({
  checked,
  onToggle,
  label,
  color = "var(--color-brand)",
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "focus-ring grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full border-[1.5px] transition-all duration-200 disabled:cursor-wait",
        checked ? "border-transparent" : "border-line-strong hover:border-muted",
      )}
      style={checked ? { background: color } : undefined}
    >
      {checked ? <Check size={14} strokeWidth={2.5} className="text-[#06240f]" /> : null}
    </button>
  );
}

/* ───────── 04 · Próximas tareas ───────── */
export function useToggleTask() {
  const { update } = useData();
  const { toast } = useFeedback();
  return async (t: Task) => {
    const done = t.status !== "completada";
    try {
      await update("tasks", t.id, { status: done ? "completada" : "pendiente" });
      toast(done ? `Completada: ${t.name}` : `Reabierta: ${t.name}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo actualizar.", "error");
    }
  };
}

export function TasksWidget({ className }: { className?: string }) {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const toggle = useToggleTask();

  const tasks = useMemo(
    () =>
      db.tasks
        .filter((t) => t.status !== "completada" && !t.parent_task_id)
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
        .slice(0, 5),
    [db.tasks],
  );
  const pending = db.tasks.filter((t) => t.status !== "completada").length;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title="Próximas tareas"
        subtitle={pending ? `${pending} pendientes` : "Sin pendientes"}
        icon={<ListTodo size={19} />}
        action={
          <Button size="icon-sm" variant="ghost" aria-label="Nueva tarea" onClick={() => open({ kind: "task" })}>
            <Plus size={19} />
          </Button>
        }
      />
      {tasks.length === 0 ? (
        <EmptyState
          compact
          icon={<ListTodo size={21} />}
          title={db.tasks.length ? "Todo completado" : "No hay tareas aún"}
          description={db.tasks.length ? "No tienes tareas pendientes. Buen trabajo." : "Agrega lo que tienes que hacer y conéctalo a un proyecto."}
          action={
            <Button size="sm" variant="primary" onClick={() => open({ kind: "task" })}>
              <Plus size={17} /> Nueva tarea
            </Button>
          }
        />
      ) : (
        <ul className="-mx-2 flex flex-col">
          {tasks.map((t) => {
            const project = db.projects.find((p) => p.id === t.project_id);
            const overdue = t.due_date && t.due_date < today;
            return (
              <li key={t.id} className="group flex items-start gap-3 rounded-[14px] px-2 py-2.5 transition-colors hover:bg-bg-2">
                <div className="pt-0.5">
                  <CheckCircle checked={false} onToggle={() => toggle(t)} label={`Completar ${t.name}`} />
                </div>
                <button className="min-w-0 flex-1 cursor-pointer text-left" onClick={() => open({ kind: "task", record: t })}>
                  <p className="truncate text-[14px] text-fg">{t.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-muted">
                    {project ? (
                      <>
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: project.color }} />
                        <span className="truncate">{project.name}</span>
                      </>
                    ) : (
                      <span className="text-dim">Sin proyecto</span>
                    )}
                    {t.due_date ? (
                      <>
                        <span className="text-dim">·</span>
                        <span className={cn("shrink-0", overdue && "text-warn")}>{relativeDay(t.due_date, today)}</span>
                      </>
                    ) : null}
                  </p>
                </button>
                <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                  <Badge tone={priorityTone(t.priority)}>{priorityLabel(t.priority)}</Badge>
                  <span className="text-[11px] text-dim">{taskStatusLabel(t.status)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {tasks.length ? (
        <Link href="/proyectos" className="mt-auto pt-3 text-[12.5px] text-muted transition-colors hover:text-fg">
          Ver todas las tareas →
        </Link>
      ) : null}
    </Card>
  );
}

/* ───────── 05 · Proyectos activos ───────── */
export function ProjectsWidget({ className }: { className?: string }) {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const active = db.projects.filter((p) => p.status === "en_proceso");

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title="Proyectos activos"
        subtitle={`${active.length} en proceso · ${db.projects.length} en total`}
        icon={<FolderKanban size={19} />}
        action={
          <>
            <Button size="icon-sm" variant="ghost" aria-label="Nuevo proyecto" onClick={() => open({ kind: "project" })}>
              <Plus size={19} />
            </Button>
            <Link href="/proyectos" aria-label="Ir a Proyectos">
              <Button size="icon-sm" variant="ghost" tabIndex={-1}>
                <ArrowUpRight size={19} />
              </Button>
            </Link>
          </>
        }
      />
      {active.length === 0 ? (
        <EmptyState
          compact
          icon={<FolderKanban size={21} />}
          title={db.projects.length ? "Ningún proyecto en proceso" : "Crea tu primer proyecto"}
          description={db.projects.length ? "Cambia el estado de un proyecto a «En proceso» para verlo aquí." : "Organiza metas grandes en tareas con progreso automático."}
          action={
            <Button size="sm" variant="primary" onClick={() => open({ kind: "project" })}>
              <Plus size={17} /> Nuevo proyecto
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {active.slice(0, 4).map((p) => {
            const prog = projectProgress(p, db.tasks);
            const late = p.due_date && p.due_date < today;
            return (
              <button
                key={p.id}
                onClick={() => open({ kind: "project", record: p })}
                className="focus-ring group cursor-pointer rounded-[22px] bg-bg-2 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone={projectStatusTone(p.status)} dot>
                    {projectStatusLabel(p.status)}
                  </Badge>
                  {p.category ? <span className="truncate text-[11.5px] text-dim">{p.category}</span> : null}
                </div>
                <p className="mt-3 line-clamp-2 min-h-[42px] text-[15px] font-medium leading-snug">{p.name}</p>
                <div className="mt-4 flex items-end justify-between">
                  <p className="num text-[26px] font-semibold leading-none text-fg">
                    {Math.round(prog.pct)}
                    <span className="text-[14px] text-muted">%</span>
                  </p>
                  <p className={cn("text-[11.5px]", late ? "text-warn" : "text-muted")}>
                    {p.due_date ? `Entrega ${relativeDay(p.due_date, today).toLowerCase()}` : "Sin fecha"}
                  </p>
                </div>
                <Progress value={prog.pct} color={p.color} className="mt-3" label={`Progreso de ${p.name}`} />
                <p className="mt-2 text-[11px] text-dim">
                  {prog.total ? `${prog.done} de ${prog.total} tareas` : "Sin tareas aún"}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ───────── 07 · Hábitos diarios ───────── */
export function HabitsWidget({ className }: { className?: string }) {
  const { db, insert, remove } = useData();
  const open = useForms();
  const { toast } = useFeedback();
  const today = useToday();
  const [busy, setBusy] = useState<string | null>(null);

  const todays = db.habits.filter((h) => isScheduled(h, today));
  const done = todays.filter((h) => logFor(db.habit_logs, h.id, today)).length;

  const toggle = async (habitId: string, name: string) => {
    setBusy(habitId);
    try {
      const log = logFor(db.habit_logs, habitId, today);
      if (log) await remove("habit_logs", log.id);
      else {
        await insert("habit_logs", { habit_id: habitId, date: today });
        toast(`Hábito cumplido: ${name}`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title="Hábitos de hoy"
        subtitle={todays.length ? `${done} de ${todays.length} completados` : "Nada programado hoy"}
        icon={<Repeat size={19} />}
        action={
          todays.length ? (
            <Ring value={pct(done, todays.length)} size={40} stroke={4.5}>
              <span className="num text-[10.5px] font-semibold">{Math.round(pct(done, todays.length))}</span>
            </Ring>
          ) : null
        }
      />
      {db.habits.length === 0 ? (
        <EmptyState
          compact
          icon={<Repeat size={21} />}
          title="Crea tus hábitos"
          description="Entrenar, leer, tomar agua… márcalos aquí cada día."
          action={
            <Button size="sm" variant="primary" onClick={() => open({ kind: "habit" })}>
              <Plus size={17} /> Nuevo hábito
            </Button>
          }
        />
      ) : todays.length === 0 ? (
        <EmptyState compact icon={<Repeat size={21} />} title="Día libre" description="Ningún hábito programado para hoy." />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {todays.map((h) => {
            const checked = !!logFor(db.habit_logs, h.id, today);
            const s = streak(h, db.habit_logs, today);
            return (
              <li
                key={h.id}
                className={cn(
                  "flex items-center gap-3 rounded-[14px] border px-3 py-2.5 transition-colors duration-200",
                  checked ? "border-brand/20 bg-brand/[0.06]" : "border-transparent bg-bg-2",
                )}
              >
                <CheckCircle
                  checked={checked}
                  color={h.color}
                  disabled={busy === h.id}
                  onToggle={() => toggle(h.id, h.name)}
                  label={`${checked ? "Desmarcar" : "Marcar"} ${h.name}`}
                />
                <span className={cn("flex-1 truncate text-[14px]", checked && "text-muted line-through decoration-dim")}>{h.name}</span>
                {s > 0 ? (
                  <span className="num flex items-center gap-1 text-[12px] font-medium text-warn" title={`Racha de ${s} días`}>
                    <Flame size={14} /> {s}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {db.habits.length ? (
        <Link href="/salud" className="mt-auto pt-3 text-[12.5px] text-muted hover:text-fg">
          Ver seguimiento →
        </Link>
      ) : null}
    </Card>
  );
}

/* ───────── 08 · Wishlist ───────── */
const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 } as const;

export function WishlistWidget({ className }: { className?: string }) {
  const { db } = useData();
  const open = useForms();
  const items = useMemo(
    () =>
      db.wishlist_items
        .filter((w) => w.status !== "comprado" && w.status !== "descartado")
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.created_at.localeCompare(b.created_at))
        .slice(0, 3),
    [db.wishlist_items],
  );

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title="Wishlist"
        subtitle="Tus próximas compras"
        icon={<Gift size={19} />}
        action={
          <>
            <Button size="icon-sm" variant="ghost" aria-label="Agregar deseo" onClick={() => open({ kind: "wish" })}>
              <Plus size={19} />
            </Button>
            <Link href="/wishlist" aria-label="Ir a Wishlist">
              <Button size="icon-sm" variant="ghost" tabIndex={-1}>
                <ArrowUpRight size={19} />
              </Button>
            </Link>
          </>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          compact
          icon={<Gift size={21} />}
          title="Tu wishlist está vacía"
          description="Guarda lo que quieres comprar y asócialo a una meta de ahorro."
          action={
            <Button size="sm" variant="primary" onClick={() => open({ kind: "wish" })}>
              <Plus size={17} /> Agregar deseo
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {items.map((w) => {
            const goal = db.savings_goals.find((g) => g.id === w.savings_goal_id);
            const saved = goal ? Math.min(goal.current_amount, w.price) : 0;
            const shop = findStore(w.store);
            return (
              <button
                key={w.id}
                onClick={() => open({ kind: "wish", record: w })}
                className="focus-ring group flex cursor-pointer gap-3 rounded-[22px] bg-bg-2 p-2.5 text-left transition-all duration-200 hover:border-line-strong sm:flex-col"
              >
                <div className="relative aspect-square w-20 shrink-0 overflow-hidden rounded-[13px] bg-elev sm:w-full sm:aspect-[4/3]">
                  {w.image_url ? (
                    // Imagen externa definida por la persona (URL libre)
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.image_url} alt={w.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-dim">
                      <ImageOff size={22} />
                    </div>
                  )}
                  {shop ? <StoreLogo store={shop} size={28} className="absolute right-1.5 top-1.5" /> : null}
                </div>
                <div className="min-w-0 flex-1 sm:px-1 sm:pb-1">
                  <Badge tone={wishStatusTone(w.status)} className="mb-1.5">
                    {wishStatusLabel(w.status)}
                  </Badge>
                  <p className="truncate text-[14px] font-medium">{w.name}</p>
                  <p className="num text-[13px] text-muted">{formatCOP(w.price)}</p>
                  {goal ? (
                    <>
                      <Progress value={pct(saved, w.price)} className="mt-2" label={`Ahorro para ${w.name}`} />
                      <p className="mt-1 text-[11px] text-dim">{Math.round(pct(saved, w.price))} % ahorrado</p>
                    </>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ───────── 09 · Calendario ───────── */
const EVENT_ICONS = {
  personal: UserRound,
  entrenamiento: Dumbbell,
  pago: CreditCard,
  vencimiento: AlarmClock,
  otro: Sparkles,
} as const;

interface DayItem {
  id: string;
  title: string;
  time: string | null;
  kind: string;
  bg: string;
  fg: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  onClick: () => void;
}

export function CalendarWidget({ className }: { className?: string }) {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? today;
  const weekStart = startOfWeek(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const itemsFor = (iso: string): DayItem[] => {
    const events: DayItem[] = db.calendar_events
      .filter((e) => e.date === iso)
      .map((e) => {
        const t = eventType(e.type);
        return { id: e.id, title: e.title, time: e.start_time, kind: t.label, bg: t.bg, fg: t.fg, Icon: EVENT_ICONS[e.type], onClick: () => open({ kind: "event", record: e }) };
      });
    const tasks: DayItem[] = db.tasks
      .filter((t) => t.due_date === iso && t.status !== "completada")
      .map((t) => ({
        id: t.id,
        title: t.name,
        time: null,
        kind: "Tarea",
        bg: CALENDAR_EXTRA.tarea.bg,
        fg: CALENDAR_EXTRA.tarea.fg,
        Icon: ListTodo,
        onClick: () => open({ kind: "task", record: t }),
      }));
    return [...events, ...tasks].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  };

  const selectedItems = itemsFor(selected);
  const habitsCount = db.habits.filter((h) => isScheduled(h, selected)).length;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title="Calendario"
        subtitle={selected ? relativeDay(selected, today) : ""}
        icon={<CalendarDays size={19} />}
        action={
          <>
            <Button size="icon-sm" variant="ghost" aria-label="Nuevo evento" onClick={() => open({ kind: "event", defaults: { date: selected } })}>
              <Plus size={19} />
            </Button>
            <Link href="/calendario" aria-label="Ir al calendario">
              <Button size="icon-sm" variant="ghost" tabIndex={-1}>
                <ArrowUpRight size={19} />
              </Button>
            </Link>
          </>
        }
      />
      <div className="grid grid-cols-7 gap-1 rounded-[24px] bg-bg-2 px-2 py-3">
        {days.map((d, i) => {
          const isSel = d === selected;
          const isToday = d === today;
          const has = itemsFor(d).length > 0;
          return (
            <button
              key={d}
              onClick={() => setPicked(d)}
              aria-pressed={isSel}
              aria-label={d}
              className="focus-ring flex cursor-pointer flex-col items-center gap-2 rounded-[14px] py-1"
            >
              <span className="text-[12px] font-medium text-fg">{WEEKDAYS_SHORT[i]}</span>
              <span
                className={cn(
                  "num grid h-9 w-9 place-items-center rounded-full text-[14px] transition-all duration-200",
                  isSel ? "bg-fg font-semibold text-on-fg" : isToday ? "font-semibold text-fg ring-1 ring-fg/25" : "text-muted hover:bg-elev",
                )}
              >
                {parseISO(d).getUTCDate()}
              </span>
              <span className={cn("h-1 w-1 rounded-full", has ? "bg-warn" : "bg-transparent")} />
            </button>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-col gap-2.5">
        {selectedItems.length === 0 ? (
          <li className="rounded-[22px] bg-bg-2 px-4 py-6 text-center">
            <p className="text-[13.5px] text-muted">Sin compromisos este día</p>
            <button
              onClick={() => open({ kind: "event", defaults: { date: selected } })}
              className="mt-1.5 cursor-pointer text-[13px] font-medium text-fg underline-offset-4 hover:underline"
            >
              Agregar evento
            </button>
          </li>
        ) : (
          selectedItems.slice(0, 4).map((it) => (
            <li key={it.id} className="flex items-center gap-3.5 rounded-[22px] bg-bg-2 p-3 pr-2">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card" style={{ color: it.fg }}>
                <it.Icon size={18} />
              </span>
              <button onClick={it.onClick} className="min-w-0 flex-1 cursor-pointer text-left">
                <span className="block truncate text-[15px] font-medium">{it.title}</span>
                <span className="block truncate text-[12.5px] text-muted">
                  {it.time ? `${formatTime(it.time)} • ` : ""}
                  {it.kind}
                </span>
              </button>
              <button
                onClick={it.onClick}
                aria-label={`Opciones de ${it.title}`}
                className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-full text-fg transition-colors hover:bg-elev"
              >
                <EllipsisVertical size={20} />
              </button>
            </li>
          ))
        )}
      </ul>
      {habitsCount ? (
        <p className="mt-3 text-[12px] text-dim">
          + {habitsCount} {habitsCount === 1 ? "hábito programado" : "hábitos programados"}
        </p>
      ) : null}
    </Card>
  );
}
