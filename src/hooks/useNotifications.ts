"use client";

import { useMemo } from "react";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "./useToday";
import { addDays, diffDays, formatTime } from "@/utils/dates";
import { isScheduled, logFor } from "@/modules/habits/selectors";

export interface AppNotification {
  id: string;
  tone: "warn" | "info" | "brand";
  title: string;
  detail: string;
  href: string;
}

/** Avisos calculados a partir de tus datos reales (no se inventa nada). */
export function useNotifications(): AppNotification[] {
  const { db } = useData();
  const today = useToday();

  return useMemo(() => {
    const out: AppNotification[] = [];
    if (!today) return out;
    for (const t of db.tasks) {
      if (t.status === "completada" || !t.due_date) continue;
      const d = diffDays(t.due_date, today);
      if (d < 0) out.push({ id: `t-${t.id}`, tone: "warn", title: t.name, detail: `Tarea vencida hace ${-d} ${-d === 1 ? "día" : "días"}`, href: "/proyectos" });
      else if (d === 0) out.push({ id: `t-${t.id}`, tone: "info", title: t.name, detail: "Tarea para hoy", href: "/proyectos" });
    }
    for (const e of db.calendar_events) {
      if (e.date === today) {
        out.push({ id: `e-${e.id}`, tone: "info", title: e.title, detail: e.start_time ? `Hoy · ${formatTime(e.start_time)}` : "Hoy", href: "/calendario" });
      } else if ((e.type === "pago" || e.type === "vencimiento") && e.date > today && e.date <= addDays(today, 3)) {
        out.push({ id: `e-${e.id}`, tone: "warn", title: e.title, detail: `${e.type === "pago" ? "Pago" : "Vencimiento"} en ${diffDays(e.date, today)} días`, href: "/calendario" });
      }
    }
    // Pagos fijos (movimientos pendientes) que vencen en 3 días o ya vencieron: los recuerda Tic
    for (const t of db.transactions) {
      if (t.status !== "pendiente" || t.date > addDays(today, 3)) continue;
      const d = diffDays(t.date, today);
      out.push({
        id: `pf-${t.id}`,
        tone: d < 0 ? "warn" : "info",
        title: t.description,
        detail: d < 0 ? `Tic: era para hace ${-d} ${-d === 1 ? "día" : "días"}. Si ya lo pagaste, confírmalo.` : d === 0 ? "Tic: es hoy. Confírmalo cuando pagues." : `Tic: vence en ${d} ${d === 1 ? "día" : "días"}.`,
        href: "/finanzas?tab=fijos",
      });
    }
    const pendingHabits = db.habits.filter((h) => isScheduled(h, today, db.habit_logs) && !logFor(db.habit_logs, h.id, today));
    if (pendingHabits.length) {
      out.push({
        id: "habits",
        tone: "brand",
        title: `${pendingHabits.length} ${pendingHabits.length === 1 ? "hábito pendiente" : "hábitos pendientes"} hoy`,
        detail: pendingHabits.map((h) => h.name).slice(0, 3).join(" · "),
        href: "/salud",
      });
    }
    return out;
  }, [db, today]);
}
