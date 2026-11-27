"use client";

import { useMemo } from "react";
import { semanaDe } from "@/lib/asistentes/progreso";
import { useGamificacion } from "./Gamificacion";

/** Resumen de la semana en curso (XP, hábitos, tareas, días activos y aportes) */
export function useSemana(today: string) {
  const g = useGamificacion();
  return useMemo(() => {
    const inicio = semanaDe(today);
    const evs = g.progreso.eventos.filter((e) => e.fecha >= inicio && e.fecha <= today);
    const xp = evs.reduce((s, e) => s + e.xp, 0);
    const habitos = evs.filter((e) => e.tipo === "habito").length;
    const tareas = evs.filter((e) => e.tipo === "tarea").length;
    const dias = new Set(evs.map((e) => e.fecha)).size;
    const aportes = evs.filter((e) => e.tipo === "aporte-ahorro").length;
    return { xp, habitos, tareas, dias, aportes };
  }, [g.progreso.eventos, today]);
}
