import type { SavingsGoal, WishlistItem } from "@/types/db";
import { enPesos } from "@/lib/monedas";

const PESO = { alta: 0, media: 1, baja: 2 } as const;

/**
 * Cuánto del ahorro de su meta le toca a cada deseo.
 * Si varios deseos comparten una meta, el ahorro se reparte por prioridad (y luego por antigüedad)
 * en vez de mostrarse completo en cada uno. Los comprados o descartados no consumen ahorro.
 */
export function ahorroPorDeseo(items: WishlistItem[], goals: SavingsGoal[]): Map<string, number> {
  const out = new Map<string, number>();
  const restante = new Map(goals.map((g) => [g.id, Math.max(0, g.current_amount)]));
  const activos = items
    .filter((w) => w.savings_goal_id && w.status !== "comprado" && w.status !== "descartado")
    .sort((a, b) => PESO[a.priority] - PESO[b.priority] || a.created_at.localeCompare(b.created_at));
  for (const w of activos) {
    const queda = restante.get(w.savings_goal_id!) ?? 0;
    const toca = Math.min(queda, enPesos(w) ?? 0);
    out.set(w.id, toca);
    restante.set(w.savings_goal_id!, queda - toca);
  }
  return out;
}
