"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AsistenteModulo } from "@/modules/asistentes/Presencia";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/misc";
import { useForms, type FormRequest } from "@/components/providers/FormsProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import type { CalendarEvent, Database, EventType } from "@/types/db";
import {
  TIMEZONE,
  WEEKDAYS_MED,
  addDays,
  addMonths,
  daysInMonth,
  formatTime,
  monthKey,
  monthLabel,
  parseISO,
  startOfWeek,
  weekdayMon,
} from "@/utils/dates";
import { cn } from "@/utils/cn";
import { isScheduled } from "@/modules/habits/selectors";
import { CALENDAR_EXTRA, EVENT_TYPES, eventType } from "./constants";

type View = "dia" | "semana" | "mes";
type Filter = "todos" | EventType | "tareas";

const START_HOUR = 5;
const END_HOUR = 24;
const HOUR_H = 60; // px por hora
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

interface Item {
  id: string;
  title: string;
  start: number | null; // minutos desde 00:00
  end: number | null;
  bg: string;
  fg: string;
  dot: string;
  kind: string;
  form?: FormRequest;
}

const toMin = (t: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const pad = (n: number) => String(n).padStart(2, "0");
const minToTime = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

function bogotaNowMinutes() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** Todo lo que ocurre un día, según el filtro. */
function itemsFor(db: Database, iso: string, filter: Filter): Item[] {
  const out: Item[] = [];
  if (filter !== "tareas") {
    for (const e of db.calendar_events) {
      if (e.date !== iso || (filter !== "todos" && e.type !== filter)) continue;
      const t = eventType(e.type);
      out.push({ id: e.id, title: e.title, start: toMin(e.start_time), end: toMin(e.end_time), bg: t.bg, fg: t.fg, dot: t.color, kind: t.label, form: { kind: "event", record: e } });
    }
  }
  if (filter === "todos" || filter === "tareas") {
    const x = CALENDAR_EXTRA.tarea;
    for (const t of db.tasks)
      if (t.due_date === iso && t.status !== "completada")
        out.push({ id: t.id, title: t.name, start: null, end: null, bg: x.bg, fg: x.fg, dot: x.color, kind: x.label, form: { kind: "task", record: t } });
  }
  if (filter === "todos") {
    const x = CALENDAR_EXTRA.meta;
    for (const g of db.savings_goals)
      if (g.target_date === iso) out.push({ id: g.id, title: g.name, start: null, end: null, bg: x.bg, fg: x.fg, dot: x.color, kind: "Meta de ahorro", form: { kind: "savings", record: g } });
    for (const g of db.annual_goals)
      if (g.target_date === iso) out.push({ id: g.id, title: g.title, start: null, end: null, bg: x.bg, fg: x.fg, dot: x.color, kind: "Objetivo", form: { kind: "goal", record: g } });
  }
  return out.sort((a, b) => (a.start ?? -1) - (b.start ?? -1));
}

/** Reparte eventos que se cruzan en columnas para que no se tapen. */
function layoutLanes(items: Item[]) {
  const timed = items.filter((i) => i.start !== null).map((i) => ({ item: i, s: i.start!, e: Math.max(i.end ?? i.start! + 60, i.start! + 20) }));
  timed.sort((a, b) => a.s - b.s || b.e - a.e);
  const placed: { item: Item; s: number; e: number; lane: number; lanes: number }[] = [];
  let cluster: typeof placed = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => (c.lanes = lanes));
    cluster = [];
  };
  for (const t of timed) {
    if (t.s >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const used = new Set(cluster.filter((c) => c.e > t.s).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    const p = { item: t.item, s: t.s, e: t.e, lane, lanes: 1 };
    cluster.push(p);
    placed.push(p);
    clusterEnd = Math.max(clusterEnd, t.e);
  }
  flush();
  return placed;
}

const FILTERS: { value: Filter; label: string; dot?: string }[] = [
  { value: "todos", label: "Todos" },
  ...EVENT_TYPES.map((t) => ({ value: t.value as Filter, label: t.label, dot: t.color })),
  { value: "tareas", label: "Tareas", dot: CALENDAR_EXTRA.tarea.color },
];

/** Estado de una vista de calendario (vista, día de referencia y filtro) */
export function useVistaCalendario(inicial?: View) {
  const today = useToday();
  const [view, setView] = useState<View>(() => inicial ?? (typeof window !== "undefined" && window.innerWidth < 768 ? "dia" : "semana"));
  const [cursor, setCursor] = useState(today);
  const [filter, setFilter] = useState<Filter>("todos");
  return { view, setView, cursor, setCursor, filter, setFilter };
}
export type EstadoCalendario = ReturnType<typeof useVistaCalendario>;

export function CalendarPage() {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const estado = useVistaCalendario();
  const { view, cursor } = estado;

  return (
    <>
      <PageHeader title="Calendario" subtitle="Eventos, entrenamientos, pagos, vencimientos, tareas y metas." asistente={<AsistenteModulo id="tic" />}>
        <Button variant="primary" className="max-md:hidden" onClick={() => open({ kind: "event", defaults: { date: view === "mes" ? today : cursor } })}>
          <Plus size={18} /> Nuevo evento
        </Button>
      </PageHeader>
      <VistaCalendario db={db} estado={estado} />
    </>
  );
}

/**
 * Tarjeta del calendario: barra (periodo, Hoy, Día/Semana/Mes, filtros) y la vista por horas o del mes.
 * La usa el calendario general y el de cada proyecto (con sus datos ya filtrados y `extra` para lo
 * que se cree desde ahí, p. ej. project_id).
 */
export function VistaCalendario({ db, estado, extra }: { db: Database; estado: EstadoCalendario; extra?: Partial<CalendarEvent> }) {
  const today = useToday();
  const { view, setView, cursor, setCursor, filter, setFilter } = estado;

  const move = (dir: number) => {
    if (view === "mes") setCursor(`${addMonths(monthKey(cursor), dir)}-01`);
    else setCursor(addDays(cursor, view === "semana" ? 7 * dir : dir));
  };

  const weekStart = startOfWeek(cursor);
  const title = useMemo(() => {
    if (view === "mes") return monthLabel(monthKey(cursor));
    if (view === "dia") {
      const d = parseISO(cursor);
      return `${WEEKDAYS_MED[weekdayMon(cursor)]}, ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    }
    const a = parseISO(weekStart);
    const b = parseISO(addDays(weekStart, 6));
    const sameMonth = a.getUTCMonth() === b.getUTCMonth();
    return `${a.getUTCDate()}${sameMonth ? "" : ` ${MONTHS_SHORT[a.getUTCMonth()]}`} – ${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  }, [view, cursor, weekStart]);

  const days = view === "semana" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [cursor];

  return (
    <>
      <div className="card overflow-hidden">
        {/* Barra de herramientas */}
        <div className="flex flex-col gap-4 border-b border-line p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="num mr-1 text-[22px] tracking-[-0.02em] first-letter:uppercase sm:text-[26px]" aria-live="polite">{title}</h2>
            {/* En celular: flechas, Hoy y la vista en una sola línea (con la vista en tamaño compacto) */}
            <div className="flex items-center gap-1 max-sm:w-full max-sm:flex-nowrap">
              <Button size="icon" variant="ghost" onClick={() => move(-1)} aria-label="Periodo anterior">
                <ChevronLeft size={20} />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => move(1)} aria-label="Periodo siguiente">
                <ChevronRight size={20} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCursor(today)}>
                Hoy
              </Button>
              <div className="ml-auto shrink-0 sm:hidden">
                <Segmented
                  size="sm"
                  label="Vista del calendario"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "dia", label: "Día" },
                    { value: "semana", label: "Semana" },
                    { value: "mes", label: "Mes" },
                  ]}
                />
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 max-sm:hidden">
              <Segmented
                size="md"
                label="Vista del calendario"
                value={view}
                onChange={setView}
                options={[
                  { value: "dia", label: "Día" },
                  { value: "semana", label: "Semana" },
                  { value: "mes", label: "Mes" },
                ]}
              />
            </div>
          </div>
          {/* Los filtros pasan a otra fila en celular: ninguno queda cortado */}
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  aria-pressed={active}
                  className={cn(
                    "focus-ring flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-200",
                    active ? "bg-fg text-on-fg" : "bg-bg-2 text-fg hover:bg-elev",
                  )}
                >
                  {active ? (
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-on-fg text-fg">
                      <Check size={11} strokeWidth={2.5} />
                    </span>
                  ) : f.dot ? (
                    <span className="h-2 w-2 rounded-full" style={{ background: f.dot }} />
                  ) : null}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {view === "mes" ? (
          <MonthGrid
            db={db}
            cursor={cursor}
            today={today}
            filter={filter}
            onPick={(d) => {
              setCursor(d);
              setView("dia");
            }}
          />
        ) : (
          <TimeGrid db={db} days={days} today={today} filter={filter} extra={extra} />
        )}
      </div>
    </>
  );
}

/* ───────── Vista por horas (semana o día) ───────── */
function TimeGrid({ db, days, today, filter, extra }: { db: Database; days: string[]; today: string; filter: Filter; extra?: Partial<CalendarEvent> }) {
  const open = useForms();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => bogotaNowMinutes());
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const multi = days.length > 1;

  useEffect(() => {
    // Abrir cerca de la hora actual (como mínimo desde las 7 a. m.)
    const target = Math.max(7 * 60, bogotaNowMinutes() - 90);
    scrollRef.current?.scrollTo({ top: ((target - START_HOUR * 60) / 60) * HOUR_H });
    const id = setInterval(() => setNow(bogotaNowMinutes()), 60_000);
    return () => clearInterval(id);
  }, []);

  const cols = `56px repeat(${days.length}, minmax(${multi ? 96 : 0}px, 1fr))`;
  const allDay = days.map((d) => itemsFor(db, d, filter).filter((i) => i.start === null));
  const habitsByDay = days.map((d) => db.habits.filter((h) => isScheduled(h, d)).length);
  const hasAllDay = allDay.some((a) => a.length) || habitsByDay.some(Boolean);

  const createAt = (day: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = START_HOUR * 60 + Math.floor((y / HOUR_H) * 2) * 30; // a la media hora
    open({ kind: "event", defaults: { ...extra, date: day, start_time: minToTime(minutes), end_time: minToTime(Math.min(minutes + 60, 23 * 60 + 45)) } });
  };

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: multi ? 760 : undefined }}>
        {/* Encabezado de días */}
        <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => (
            <div key={d} className="flex justify-center px-1 py-3">
              <span aria-current={d === today ? "date" : undefined} className={cn("num rounded-full px-3 py-1 text-[13px]", d === today ? "bg-fg text-on-fg" : "text-fg")}>
                {parseISO(d).getUTCDate()} · {WEEKDAYS_MED[weekdayMon(d)]}
              </span>
            </div>
          ))}
        </div>

        {/* Todo el día */}
        {hasAllDay ? (
          <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
            <div className="px-2 py-2.5 text-right text-[10.5px] leading-tight text-dim">Todo el día</div>
            {days.map((d, i) => (
              <div key={d} className="flex min-w-0 flex-col gap-1 border-l border-line p-1.5">
                {allDay[i].map((it) => (
                  <button
                    key={it.id}
                    onClick={() => it.form && open(it.form)}
                    className="cursor-pointer truncate rounded-[10px] border-l-[3px] bg-elev px-2 py-1 text-left text-[11.5px] text-fg transition-colors hover:bg-line-strong/50"
                    style={{ borderLeftColor: it.dot }}
                    title={`${it.kind}: ${it.title}`}
                  >
                    {it.title}
                  </button>
                ))}
                {habitsByDay[i] ? (
                  <span className="truncate px-1 text-[10.5px] text-dim">
                    {habitsByDay[i]} {habitsByDay[i] === 1 ? "hábito" : "hábitos"}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {/* Rejilla de horas */}
        <div ref={scrollRef} className="relative max-h-[640px] overflow-y-auto">
          <div className="grid" style={{ gridTemplateColumns: cols }}>
            <div>
              {hours.map((h) => (
                <div key={h} className="relative" style={{ height: HOUR_H }}>
                  <span className="num absolute -top-2 right-2.5 text-[11px] text-dim">{h === START_HOUR ? "" : `${pad(h)}:00`}</span>
                </div>
              ))}
            </div>

            {days.map((d) => {
              const weekend = weekdayMon(d) >= 5;
              const placed = layoutLanes(itemsFor(db, d, filter));
              const nowTop = ((now - START_HOUR * 60) / 60) * HOUR_H;
              return (
                <div
                  key={d}
                  className={cn("relative cursor-copy border-l border-line", weekend && "bg-bg-2/70")}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) createAt(d, e);
                  }}
                  title="Clic en un espacio vacío para crear un evento"
                >
                  {hours.map((h) => (
                    <div key={h} className="pointer-events-none border-t border-line/70" style={{ height: HOUR_H }} />
                  ))}

                  {placed.map(({ item, s, e, lane, lanes }) => {
                    const from = Math.max(s, START_HOUR * 60);
                    const top = ((from - START_HOUR * 60) / 60) * HOUR_H + 2;
                    const height = Math.max(26, ((e - from) / 60) * HOUR_H - 4);
                    const short = height < 44;
                    return (
                      <button
                        key={item.id}
                        onClick={() => item.form && open(item.form)}
                        className="absolute flex cursor-pointer flex-col overflow-hidden rounded-[12px] border-l-[3px] bg-elev px-2.5 py-1.5 text-left text-fg transition-colors duration-200 hover:bg-line-strong/50"
                        style={{
                          top,
                          height,
                          left: `calc(${(lane / lanes) * 100}% + 4px)`,
                          width: `calc(${100 / lanes}% - 8px)`,
                          borderLeftColor: item.dot,
                        }}
                        title={`${item.title} · ${formatTime(minToTime(s))}`}
                      >
                        <span className={cn("truncate", short ? "text-[11.5px]" : "text-[12.5px]")}>{item.title}</span>
                        {!short ? (
                          <span className="num truncate text-[11px] text-muted">
                            {formatTime(minToTime(s))} – {formatTime(minToTime(e))}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}

                  {d === today && now >= START_HOUR * 60 ? (
                    <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }}>
                      <div className="h-[1.5px] bg-fg" />
                      <span className="num absolute -left-1 -top-[10px] rounded-full bg-fg px-2 py-0.5 text-[10.5px] font-medium text-on-fg">
                        {formatTime(minToTime(now))}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Vista mensual ───────── */
function MonthGrid({
  db,
  cursor,
  today,
  filter,
  onPick,
}: {
  db: Database;
  cursor: string;
  today: string;
  filter: Filter;
  onPick: (d: string) => void;
}) {
  const key = monthKey(cursor);
  const first = `${key}-01`;
  const lead = weekdayMon(first);
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth(key)) / 7) * 7 }, (_, i) => addDays(first, i - lead));
  return (
    <div className="p-3 sm:p-4">
      <div className="mb-2 grid grid-cols-7 text-center text-[12px] font-medium text-dim">
        {WEEKDAYS_MED.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d) => {
          const items = itemsFor(db, d, filter);
          const inMonth = d.startsWith(key);
          return (
            <button
              key={d}
              onClick={() => onPick(d)}
              aria-current={d === today ? "date" : undefined}
              aria-label={`${parseISO(d).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}${items.length ? `, ${items.length} ${items.length === 1 ? "elemento" : "elementos"}` : ""}`}
              className={cn(
                "focus-ring flex min-h-[64px] cursor-pointer flex-col rounded-[16px] p-1.5 text-left transition-colors sm:min-h-[104px] sm:p-2",
                inMonth ? "bg-bg-2 hover:bg-elev" : "opacity-35",
              )}
            >
              <span className={cn("num grid h-7 w-7 place-items-center rounded-full text-[12.5px]", d === today && "bg-fg text-on-fg")}>
                {parseISO(d).getUTCDate()}
              </span>
              <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                {items.slice(0, 4).map((it) => (
                  <span key={it.id} className="h-1.5 w-1.5 rounded-full" style={{ background: it.dot }} />
                ))}
              </span>
              <span className="mt-1 hidden flex-col gap-1 sm:flex">
                {items.slice(0, 3).map((it) => (
                  <span key={it.id} className="truncate rounded-[8px] border-l-[3px] bg-bg px-1.5 py-0.5 text-[11px] text-fg dark:bg-elev" style={{ borderLeftColor: it.dot }}>
                    {it.title}
                  </span>
                ))}
                {items.length > 3 ? <span className="px-1.5 text-[10.5px] text-dim">+{items.length - 3} más</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
