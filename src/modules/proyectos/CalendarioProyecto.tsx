"use client";

/** Calendario interno del proyecto: entregas de tareas, reuniones, notas de voz y la fecha de entrega. */
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useEspacio } from "@/lib/proyectos/espacio";
import type { Project } from "@/types/db";
import { WEEKDAYS_SHORT, addMonths, daysInMonth, formatTime, monthKey, monthLabel, weekdayMon } from "@/utils/dates";
import { cn } from "@/utils/cn";

type Item = { tipo: "tarea" | "reunion" | "voz" | "entrega"; texto: string; detalle?: string };
const COLOR: Record<Item["tipo"], string> = { tarea: "bg-fg", reunion: "bg-brand", voz: "bg-[var(--color-info)]", entrega: "bg-danger" };
const NOMBRE: Record<Item["tipo"], string> = { tarea: "Tarea", reunion: "Reunión", voz: "Nota de voz", entrega: "Entrega" };

export function CalendarioProyecto({ proyecto }: { proyecto: Project }) {
  const { db } = useData();
  const e = useEspacio();
  const today = useToday();
  const [mes, setMes] = useState(() => monthKey(proyecto.due_date && proyecto.due_date > (today || "") ? today || proyecto.due_date : today || proyecto.due_date || "2026-01-01"));
  const [dia, setDia] = useState<string | null>(today || null);

  const porDia = new Map<string, Item[]>();
  const add = (d: string | null | undefined, it: Item) => d && porDia.set(d, [...(porDia.get(d) ?? []), it]);
  for (const t of db.tasks.filter((x) => x.project_id === proyecto.id)) add(t.due_date, { tipo: "tarea", texto: t.name, detalle: t.status === "completada" ? "Completada" : undefined });
  for (const r of e.reuniones.filter((x) => x.proyectoId === proyecto.id)) add(r.fecha, { tipo: "reunion", texto: r.titulo, detalle: formatTime(r.inicio) });
  for (const v of e.voz.filter((x) => x.proyectoId === proyecto.id)) add(v.creada.slice(0, 10), { tipo: "voz", texto: v.titulo });
  add(proyecto.due_date, { tipo: "entrega", texto: `Entrega de ${proyecto.name}` });

  const offset = weekdayMon(`${mes}-01`);
  const total = daysInMonth(mes);
  const celdas = [...Array(offset).fill(null), ...Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`)];
  const delDia = dia ? (porDia.get(dia) ?? []) : [];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[14px] font-bold capitalize">{monthLabel(mes)}</p>
        <div className="flex gap-1">
          <button type="button" onClick={() => setMes(addMonths(mes, -1))} aria-label="Mes anterior" className="focus-ring grid h-8 w-8 cursor-pointer place-items-center rounded-full hover:bg-elev">
            <ChevronLeft size={17} />
          </button>
          <button type="button" onClick={() => setMes(addMonths(mes, 1))} aria-label="Mes siguiente" className="focus-ring grid h-8 w-8 cursor-pointer place-items-center rounded-full hover:bg-elev">
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS_SHORT.map((d) => (
          <span key={d} className="pb-1 text-[11px] font-medium text-dim">
            {d}
          </span>
        ))}
        {celdas.map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              onClick={() => setDia(d)}
              aria-pressed={dia === d}
              aria-label={`${Number(d.slice(8))}${porDia.get(d)?.length ? `, ${porDia.get(d)!.length} elementos` : ""}`}
              className={cn(
                "focus-ring flex aspect-square cursor-pointer flex-col items-center justify-center rounded-[12px] text-[12.5px] transition-colors",
                dia === d ? "bg-fg text-on-fg" : d === today ? "bg-brand text-[#0a0a0a]" : "hover:bg-elev",
              )}
            >
              <span className="num">{Number(d.slice(8))}</span>
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {[...new Set((porDia.get(d) ?? []).map((x) => x.tipo))].slice(0, 3).map((t) => (
                  <span key={t} className={cn("h-1.5 w-1.5 rounded-full", dia === d && t === "tarea" ? "bg-on-fg" : COLOR[t])} />
                ))}
              </span>
            </button>
          ) : (
            <span key={`v${i}`} />
          ),
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted">
        {(Object.keys(NOMBRE) as Item["tipo"][]).map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", COLOR[t])} /> {NOMBRE[t]}
          </span>
        ))}
      </div>
      {dia ? (
        <div className="mt-3 rounded-[16px] bg-bg-2 p-3">
          <p className="text-[12.5px] font-medium text-muted">
            {new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${dia}T12:00:00Z`))}
          </p>
          {delDia.length ? (
            <ul className="mt-2 grid gap-1.5">
              {delDia.map((it, k) => (
                <li key={k} className="flex items-center gap-2 text-[13.5px]">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", COLOR[it.tipo])} />
                  <span className="min-w-0 flex-1 truncate">{it.texto}</span>
                  {it.detalle ? <span className="shrink-0 text-[12px] text-muted">{it.detalle}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[13px] text-dim">Nada en este día.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
