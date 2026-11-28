"use client";

/**
 * Mantiene al día el progreso de los objetivos que son una compra de contado: su % es el de su meta de
 * ahorro (lo ahorrado ÷ el precio). Así, al abonar en Finanzas, el objetivo avanza solo y lo ven también el
 * cumplimiento anual, las áreas de vida, el XP de Cima y los logros. No dibuja nada.
 */
import { useEffect } from "react";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { avanceDeCompra } from "@/lib/objetivos/compra";

export function SincronizarObjetivosCompra() {
  const { db, status, update } = useData();
  const today = useToday();
  useEffect(() => {
    if (status !== "ready" || !today) return;
    for (const g of db.annual_goals) {
      const meta = g.savings_goal_id ? db.savings_goals.find((s) => s.id === g.savings_goal_id) : undefined;
      if (!meta) continue;
      const cambio = avanceDeCompra(g, meta);
      if (cambio) void update("annual_goals", g.id, cambio);
    }
  }, [db.annual_goals, db.savings_goals, status, today, update]);
  return null;
}
