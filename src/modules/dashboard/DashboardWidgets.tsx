"use client";

import { useMemo, useState } from "react";
import { Check, ImageOff } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, Delta, Progress, Segmented } from "@/components/ui/misc";
import { BarChart, HeatGrid, ProgressCard, StatCard, type HeatRow } from "@/components/ui/viz";
import { StoreLogo } from "@/components/ui/StoreLogo";
import { useForms } from "@/components/providers/FormsProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import type { Task } from "@/types/db";
import {
  WEEKDAYS_SHORT,
  addDays,
  addMonths,
  endOfMonth,
  formatTime,
  monthKey,
  monthLabel,
  parseISO,
  relativeDay,
  startOfWeek,
} from "@/utils/dates";
import { formatCOP, formatKpiCOP, pct, variation } from "@/utils/money";
import { cn } from "@/utils/cn";
import { activitySeries, monthTotals, totalBalance, type ActivityPeriod } from "@/modules/finance/selectors";
import { projectProgress, projectStatusLabel } from "@/modules/projects/constants";
import { isScheduled, logFor } from "@/modules/habits/selectors";
import { CALENDAR_EXTRA, eventType, wishStatusLabel } from "@/modules/other/constants";
import { findStore } from "@/modules/other/stores";
import { ahorroPorDeseo } from "@/modules/other/wishlistAhorro";

/* ───────── Piezas compartidas ───────── */

/** Casilla circular (tareas y hábitos). */
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
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "focus-ring relative grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full after:absolute after:-inset-2 after:content-[''] border-[1.5px] transition-all duration-200 disabled:cursor-wait",
        checked ? "border-transparent" : "border-line-strong hover:border-fg",
      )}
      style={checked ? { background: color } : undefined}
    >
      {checked ? <Check size={15} strokeWidth={2.5} className="text-[#0a0a0a]" /> : null}
    </button>
  );
}

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

/** Línea única de estado vacío con un solo enlace de acción. */
function EmptyLine({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 text-[13.5px] text-muted">
      {text}
      {action && onAction ? (
        <button type="button" onClick={onAction} className="cursor-pointer font-medium text-fg underline-offset-4 hover:underline">
          {action}
        </button>
      ) : null}
    </p>
  );
}

/* ═════════ Fila KPI ═════════ */
export function KpiRow({ refMonth }: { refMonth: string }) {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const isCurrent = refMonth === monthKey(today);
  const prevMonth = addMonths(refMonth, -1);
  const prevLabel = monthLabel(prevMonth).split(" ")[0].toLowerCase();

  const k = useMemo(() => {
    const until = isCurrent ? undefined : endOfMonth(refMonth);
    const balance = totalBalance(db.accounts, db.transactions, until);
    const prevBalance = totalBalance(db.accounts, db.transactions, endOfMonth(prevMonth));
    const hasPrev = db.transactions.some((t) => t.date <= endOfMonth(prevMonth));
    const cur = monthTotals(db.transactions, refMonth);
    const prev = monthTotals(db.transactions, prevMonth);
    return { balance, prevBalance, hasPrev, cur, prev, prevHasMoves: prev.income > 0 || prev.expense > 0 };
  }, [db.accounts, db.transactions, refMonth, prevMonth, isCurrent]);

  const noAccounts = db.accounts.length === 0;

  return (
    <div data-tour="kpis" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        variant="inverse"
        label="Dinero disponible"
        value={formatKpiCOP(k.balance)}
        href="/finanzas?tab=cuentas"
        className="sm:col-span-2 xl:col-span-1"
        meta={
          noAccounts ? (
            <button type="button" onClick={() => open({ kind: "account" })} className="cursor-pointer font-medium text-on-fg underline-offset-4 hover:underline">
              Agregar cuenta
            </button>
          ) : k.hasPrev ? (
            <Delta inverse value={variation(k.balance, k.prevBalance)} suffix={`vs. ${prevLabel} · ${db.accounts.length} ${db.accounts.length === 1 ? "cuenta" : "cuentas"}`} />
          ) : (
            `${db.accounts.length} ${db.accounts.length === 1 ? "cuenta" : "cuentas"}`
          )
        }
      />
      <StatCard
        label="Ingresos del mes"
        value={formatKpiCOP(k.cur.income)}
        muted={k.cur.income === 0}
        href="/finanzas?tab=movimientos"
        meta={k.prevHasMoves ? <Delta value={variation(k.cur.income, k.prev.income)} suffix={`vs. ${prevLabel}`} /> : monthLabel(refMonth)}
      />
      <StatCard
        label="Gastos del mes"
        value={formatKpiCOP(k.cur.expense)}
        muted={k.cur.expense === 0}
        href="/finanzas?tab=movimientos"
        meta={k.prevHasMoves ? <Delta invert value={variation(k.cur.expense, k.prev.expense)} suffix={`vs. ${prevLabel}`} /> : monthLabel(refMonth)}
      />
    </div>
  );
}

/* ═════════ Actividad financiera ═════════ */
const PERIODS: { value: ActivityPeriod; label: string }[] = [
  { value: "7d", label: "7 días" },
  { value: "mes", label: "Mes" },
  { value: "6m", label: "6 meses" },
  { value: "anio", label: "Año" },
];

export function ActivityCard({ className }: { className?: string }) {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const [period, setPeriod] = useState<ActivityPeriod>("6m");
  const series = useMemo(() => activitySeries(db.transactions, period, today), [db.transactions, period, today]);
  const totals = series.reduce((a, p) => ({ i: a.i + p.ingresos, g: a.g + p.gastos }), { i: 0, g: 0 });
  const empty = totals.i === 0 && totals.g === 0;

  // Periodo actual: el último en 7 días y 6 meses; la semana o el mes en curso en los demás
  const day = today ? Number(today.slice(8, 10)) : 1;
  const activeIndex = period === "mes" ? Math.floor((day - 1) / 7) : period === "anio" ? Number(today.slice(5, 7)) - 1 : series.length - 1;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title="Actividad financiera"
        subtitle={empty ? "Ingresos y gastos completados" : `Ingresos ${formatKpiCOP(totals.i)} · Gastos ${formatKpiCOP(totals.g)}`}
        action={<Segmented value={period} onChange={setPeriod} options={PERIODS} label="Periodo" className="hidden sm:inline-flex" />}
      />
      <Segmented value={period} onChange={setPeriod} options={PERIODS} label="Periodo" className="-mt-1 mb-4 self-start sm:hidden" />
      <div className="mt-auto pt-4">
        <BarChart
          data={series.map((p) => ({ label: p.label, hint: p.hint, values: [p.ingresos, p.gastos] }))}
          activeIndex={activeIndex}
          seriesLabels={["Ingresos", "Gastos"]}
          formatTooltip={(d) => `↑ ${formatKpiCOP(d.values[0])}  ·  ↓ ${formatKpiCOP(d.values[1])}`}
        />
      </div>
      {empty ? (
        <EmptyLine
          text="Aún no hay movimientos en este periodo."
          action={db.accounts.length ? "Registrar movimiento" : "Agregar cuenta"}
          onAction={() => open(db.accounts.length ? { kind: "transaction" } : { kind: "account" })}
        />
      ) : (
        <div className="mt-4 flex gap-4 text-[12.5px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brand" /> Ingresos
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-fg" /> Gastos
          </span>
          <span className="ml-auto">Pasa el cursor por una barra para ver su detalle</span>
        </div>
      )}
    </Card>
  );
}

/* ═════════ Hábitos de la semana (cuadrícula) ═════════ */
export function HabitsWeekCard({ className }: { className?: string }) {
  const { db, insert, remove } = useData();
  const open = useForms();
  const { toast } = useFeedback();
  const today = useToday();
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today), i));

  const toggle = async (habitId: string, day: string, name: string) => {
    try {
      const log = logFor(db.habit_logs, habitId, day);
      if (log) await remove("habit_logs", log.id);
      else {
        await insert("habit_logs", { habit_id: habitId, date: day });
        if (day === today) toast(`Hábito cumplido: ${name}`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar.", "error");
    }
  };

  const habits = db.habits.slice(0, 5);
  const todays = db.habits.filter((h) => isScheduled(h, today));
  const doneToday = todays.filter((h) => logFor(db.habit_logs, h.id, today)).length;

  const rows: HeatRow[] = habits.length
    ? habits.map((h) => ({
        key: h.id,
        label: h.name,
        cells: week.map((d) => {
          const scheduled = isScheduled(h, d);
          const done = !!logFor(db.habit_logs, h.id, d);
          const state = !scheduled ? "off" : done ? "done" : d > today ? "future" : d === today ? "today" : "missed";
          const date = parseISO(d).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
          return {
            key: d,
            state,
            title: `${h.name}, ${date}: ${!scheduled ? "no programado" : done ? "cumplido" : d > today ? "pendiente" : "sin cumplir"}`,
            onClick: scheduled && d <= today ? () => toggle(h.id, d, h.name) : undefined,
          };
        }),
      }))
    : ["Hábito", "Hábito", "Hábito"].map((label, r) => ({
        key: `ghost-${r}`,
        label,
        cells: week.map((d) => ({ key: d, state: "future" as const, title: "Sin hábitos todavía" })),
      }));

  return (
    <Card data-tour="habitos" className={cn("flex flex-col", className)}>
      <CardHeader
        title="Hábitos de la semana"
        subtitle={todays.length ? `${doneToday} de ${todays.length} hoy` : "Toca una casilla para marcarla"}
        href="/salud"
        hrefLabel="Ver hábitos"
      />
      <div className={cn(!habits.length && "opacity-60")}>
        <HeatGrid rows={rows} columns={WEEKDAYS_SHORT} labelWidth={132} />
      </div>
      {habits.length ? (
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[4px] bg-brand" /> Cumplido
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[4px] bg-fg" /> Hoy pendiente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[4px] bg-elev" /> Sin cumplir
          </span>
        </div>
      ) : (
        <EmptyLine text="Crea tus hábitos y márcalos aquí cada día." action="Nuevo hábito" onAction={() => open({ kind: "habit" })} />
      )}
    </Card>
  );
}

/* ═════════ Objetivos de ahorro ═════════ */
export function SavingsCard({ className }: { className?: string }) {
  const { db } = useData();
  const open = useForms();
  const goals = [...db.savings_goals].sort((a, b) => pct(b.current_amount, b.target_amount) - pct(a.current_amount, a.target_amount)).slice(0, 3);
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader title="Objetivos de ahorro" subtitle={`${db.savings_goals.length} ${db.savings_goals.length === 1 ? "meta" : "metas"}`} href="/finanzas?tab=ahorros" hrefLabel="Ver ahorros" />
      <div className="flex flex-col gap-2">
        {goals.length ? (
          goals.map((g, i) => (
            <ProgressCard
              key={g.id}
              label={g.name}
              pct={pct(g.current_amount, g.target_amount)}
              fill={i === 0 ? "accent" : "warn"}
              meta={`${formatKpiCOP(g.current_amount)} de ${formatKpiCOP(g.target_amount)}`}
              onClick={() => open({ kind: "deposit", record: g })}
            />
          ))
        ) : (
          <ProgressCard label="Tu primera meta" pct={0} meta="Fondo de emergencia, viaje, equipo…" onClick={() => open({ kind: "savings" })} />
        )}
        {Array.from({ length: Math.max(0, 3 - Math.max(goals.length, 1)) }, (_, i) => (
          <div key={`ghost-${i}`} aria-hidden className="flex items-end justify-between rounded-[20px] bg-bg-2/60 px-4 py-3.5 opacity-70">
            <span className="flex flex-col gap-2">
              <span className="h-2.5 w-28 rounded-full bg-elev" />
              <span className="h-2 w-20 rounded-full bg-elev/70" />
            </span>
            <span className="h-6 w-10 rounded-full bg-elev" />
          </div>
        ))}
      </div>
      {goals.length ? <p className="mt-3 text-[12.5px] text-dim">Toca una meta para abonar o retirar.</p> : null}
    </Card>
  );
}

/* ═════════ Próximas tareas ═════════ */
export function TasksCard({ className }: { className?: string }) {
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
      <CardHeader title="Próximas tareas" subtitle={pending ? `${pending} pendientes` : "Sin pendientes"} href="/proyectos" hrefLabel="Ver tareas" />
      {tasks.length ? (
        <ul className="flex flex-col gap-1.5">
          {tasks.map((t) => {
            const project = db.projects.find((p) => p.id === t.project_id);
            const overdue = !!t.due_date && t.due_date < today;
            return (
              <li key={t.id} className="flex items-center gap-3 rounded-[16px] bg-bg-2 px-3 py-2.5">
                <CheckCircle checked={false} onToggle={() => toggle(t)} label={`Completar ${t.name}`} />
                <button type="button" onClick={() => open({ kind: "task", record: t })} className="min-w-0 flex-1 cursor-pointer text-left">
                  <span className="block truncate text-[14px]">{t.name}</span>
                  {project ? <span className="mt-0.5 block truncate text-[12px] text-muted">{project.name}</span> : null}
                </button>
                {t.due_date ? (
                  <span className={cn("shrink-0 text-[12.5px]", overdue ? "font-medium text-danger" : "text-muted")}>{relativeDay(t.due_date, today)}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5 opacity-60" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 rounded-[16px] bg-bg-2 px-3 py-3">
                <span className="h-7 w-7 rounded-full border-[1.5px] border-line-strong" />
                <span className="h-2.5 rounded-full bg-elev" style={{ width: `${60 - i * 12}%` }} />
              </li>
            ))}
          </ul>
          <EmptyLine text={db.tasks.length ? "Todo completado." : "Aún no tienes tareas."} action="Nueva tarea" onAction={() => open({ kind: "task" })} />
        </>
      )}
    </Card>
  );
}

/* ═════════ Calendario: tira de 7 días ═════════ */
export function CalendarCard({ className }: { className?: string }) {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked ?? today;
  const days = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today), i));

  const itemsFor = (iso: string) => {
    const ev = db.calendar_events
      .filter((e) => e.date === iso)
      .map((e) => ({ id: e.id, title: e.title, time: e.start_time, kind: eventType(e.type).label, color: eventType(e.type).color, form: { kind: "event" as const, record: e } }));
    const tk = db.tasks
      .filter((t) => t.due_date === iso && t.status !== "completada")
      .map((t) => ({ id: t.id, title: t.name, time: null as string | null, kind: "Tarea", color: CALENDAR_EXTRA.tarea.color, form: { kind: "task" as const, record: t } }));
    return [...ev, ...tk].sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  };
  const items = itemsFor(selected);

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader title="Calendario" subtitle={selected ? relativeDay(selected, today) : ""} href="/calendario" hrefLabel="Abrir calendario" />
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const isSel = d === selected;
          const isToday = d === today;
          const label = parseISO(d).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
          return (
            <button
              key={d}
              type="button"
              onClick={() => setPicked(d)}
              aria-pressed={isSel}
              aria-current={isToday ? "date" : undefined}
              aria-label={label}
              className={cn(
                "focus-ring flex cursor-pointer flex-col items-center gap-1 rounded-full py-2.5 transition-colors",
                isSel ? "bg-fg text-on-fg" : "hover:bg-bg-2",
              )}
            >
              <span className={cn("text-[11.5px]", isSel ? "text-on-fg/70" : "text-dim")}>{WEEKDAYS_SHORT[i]}</span>
              <span className={cn("num text-[15px]", isToday && !isSel && "font-medium")}>{parseISO(d).getUTCDate()}</span>
              <span className={cn("h-1 w-1 rounded-full", itemsFor(d).length ? (isSel ? "bg-brand" : "bg-fg") : "bg-transparent")} />
            </button>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {items.length ? (
          items.slice(0, 3).map((it) => (
            <li key={it.id}>
              <button type="button" onClick={() => open(it.form)} className="flex w-full cursor-pointer items-center gap-3 rounded-[16px] bg-bg-2 px-3 py-2.5 text-left">
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: it.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">{it.title}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {it.time ? `${formatTime(it.time)} · ` : ""}
                    {it.kind}
                  </span>
                </span>
              </button>
            </li>
          ))
        ) : (
          <EmptyLine text="Sin compromisos este día." action="Agregar evento" onAction={() => open({ kind: "event", defaults: { date: selected } })} />
        )}
      </ul>
    </Card>
  );
}

/* ═════════ Proyectos activos ═════════ */
export function ProjectsCard({ className }: { className?: string }) {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const active = db.projects.filter((p) => p.status === "en_proceso");

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader title="Proyectos activos" subtitle={`${active.length} en proceso · ${db.projects.length} en total`} href="/proyectos" hrefLabel="Ver proyectos" />
      {active.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {active.slice(0, 4).map((p) => {
            const prog = projectProgress(p, db.tasks);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => open({ kind: "project", record: p })}
                className="focus-ring flex cursor-pointer flex-col rounded-[20px] bg-bg-2 p-4 text-left transition-transform duration-200 hover:scale-[1.01]"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge>{p.category ?? projectStatusLabel(p.status)}</Badge>
                  <span className="text-[12px] text-muted">{p.due_date ? relativeDay(p.due_date, today) : "Sin fecha"}</span>
                </div>
                <span className="mt-3 line-clamp-2 min-h-[40px] text-[15px] font-medium leading-snug">{p.name}</span>
                <div className="mt-3 flex items-end justify-between">
                  <span className="figure text-[34px]">
                    {Math.round(prog.pct)}
                    <span className="text-[16px] text-muted">%</span>
                  </span>
                  <span className="text-[12px] text-muted">{prog.total ? `${prog.done}/${prog.total} tareas` : "Sin tareas"}</span>
                </div>
                <Progress value={prog.pct} color={p.color} className="mt-3" label={`Progreso de ${p.name}`} />
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div aria-hidden className="grid gap-2 opacity-70 sm:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className={cn("rounded-[20px] bg-bg-2 p-4", i === 1 && "hidden sm:block")}>
                <span className="block h-5 w-20 rounded-full bg-elev" />
                <span className="mt-4 block h-3 w-3/4 rounded-full bg-elev" />
                <span className="mt-5 block h-7 w-14 rounded-full bg-elev" />
                <span className="mt-3 block h-2 rounded-full bg-elev/70" />
              </div>
            ))}
          </div>
          <EmptyLine text={db.projects.length ? "Ningún proyecto en proceso." : "Aún no tienes proyectos."} action="Nuevo proyecto" onAction={() => open({ kind: "project" })} />
        </>
      )}
    </Card>
  );
}

/* ═════════ Wishlist (tarjeta cálida) ═════════ */
const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 } as const;

export function WishlistCard({ className }: { className?: string }) {
  const { db } = useData();
  const open = useForms();
  const ahorros = ahorroPorDeseo(db.wishlist_items, db.savings_goals);
  const items = db.wishlist_items
    .filter((w) => w.status !== "comprado" && w.status !== "descartado")
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.created_at.localeCompare(b.created_at))
    .slice(0, 3);

  return (
    <Card variant="warm" className={cn("flex flex-col", className)}>
      <CardHeader title="Wishlist" subtitle="Tus próximas compras" href="/wishlist" hrefLabel="Ver wishlist" />
      {items.length ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {items.map((w) => {
            const shop = findStore(w.store);
            const goal = db.savings_goals.find((g) => g.id === w.savings_goal_id);
            const saved = goal ? (ahorros.get(w.id) ?? 0) : 0;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => open({ kind: "wish", record: w })}
                className="focus-ring flex cursor-pointer gap-3 rounded-[20px] bg-bg/70 p-2.5 text-left transition-transform duration-200 hover:scale-[1.01] sm:flex-col"
              >
                <span className="relative grid aspect-square w-20 shrink-0 place-items-center overflow-hidden rounded-[16px] bg-white sm:aspect-[4/3] sm:w-full">
                  {w.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.image_url} alt={w.name} referrerPolicy="no-referrer" className="h-full w-full object-contain p-2" />
                  ) : (
                    <ImageOff size={20} className="text-dim" />
                  )}
                  {shop ? <StoreLogo store={shop} size={26} className="absolute right-1.5 top-1.5" /> : null}
                </span>
                <span className="min-w-0 flex-1 sm:px-1 sm:pb-1">
                  <span className="block truncate text-[14px] font-medium">{w.name}</span>
                  <span className="num block text-[13.5px] text-muted">{formatCOP(w.price)}</span>
                  <span className="mt-1.5 block">
                    {goal ? <Badge>{Math.round(pct(saved, w.price))} % ahorrado</Badge> : <Badge>{wishStatusLabel(w.status)}</Badge>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div aria-hidden className="grid grid-cols-3 gap-2 opacity-70">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-[20px] bg-bg/70 p-2.5">
                <span className="block aspect-[4/3] rounded-[14px] bg-elev/70" />
                <span className="mt-2.5 block h-2.5 w-3/4 rounded-full bg-elev" />
                <span className="mt-2 block h-2 w-1/2 rounded-full bg-elev/70" />
              </div>
            ))}
          </div>
          <EmptyLine text="Guarda lo que quieres comprar pegando su enlace." action="Agregar deseo" onAction={() => open({ kind: "wish" })} />
        </>
      )}
    </Card>
  );
}
