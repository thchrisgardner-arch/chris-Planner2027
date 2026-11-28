/**
 * Metas de ahorro SIN plan de aporte: cuándo llegan al ritmo real y cuánto se adelantan con un extra.
 * El ritmo es lo ahorrado desde que se creó la meta, por mes (mínimo un mes). Las metas con plan ya
 * muestran su propia proyección (lib/finanzas/planAporte). Función pura.
 */
import type { SavingsGoal } from "../../types/db";
import { addMonths, diffDays, monthKey, monthLabel } from "../../utils/dates";

export interface ProyeccionMeta {
  /** Ahorro promedio al mes desde que se creó la meta (0 si aún no hay nada) */
  ritmo: number;
  /** Mes (YYYY-MM) en que llega al ritmo actual; null si no hay ritmo o tardaría más de 10 años */
  llega: string | null;
  /** Con `extra` más al mes, mes en que llegaría (solo si adelanta) */
  extra: number;
  llegaConExtra: string | null;
  /** Si tiene fecha límite futura: cuánto hay que ahorrar al mes desde ya para llegar a tiempo */
  necesarioAlMes: number | null;
  /** ¿Al ritmo actual llega antes de su fecha límite? (null si no tiene fecha) */
  aTiempo: boolean | null;
  /** Creada hace menos de 30 días: todavía no hay un ritmo confiable (lo ya ahorrado pudo ser de antes) */
  reciente: boolean;
}

const MAX_MESES = 120;
/** Extra sugerido: la mitad del ritmo actual redondeada a $10.000, entre $20.000 y $200.000 */
const extraDe = (ritmo: number) => Math.min(200_000, Math.max(20_000, Math.round(ritmo / 2 / 10_000) * 10_000));

export function proyeccionMeta(g: Pick<SavingsGoal, "target_amount" | "current_amount" | "target_date" | "created_at">, hoy: string): ProyeccionMeta | null {
  const falta = g.target_amount - g.current_amount;
  if (falta <= 0) return null;
  const dias = diffDays(hoy, g.created_at.slice(0, 10));
  const reciente = dias < 30;
  // Recién creada: lo ya ahorrado pudo juntarse antes, así que no se adivina un ritmo
  const ritmo = reciente ? 0 : Math.max(0, g.current_amount) / (dias / 30);
  const actual = monthKey(hoy);
  const mesesPara = (porMes: number) => (porMes > 0 ? Math.ceil(falta / porMes) : Infinity);

  const m1 = mesesPara(ritmo);
  const llega = m1 <= MAX_MESES ? addMonths(actual, m1) : null;
  const extra = extraDe(ritmo);
  const m2 = mesesPara(ritmo + extra);
  const llegaConExtra = m2 <= MAX_MESES && m2 < m1 ? addMonths(actual, m2) : null;

  let necesarioAlMes: number | null = null;
  let aTiempo: boolean | null = null;
  if (g.target_date && g.target_date > hoy) {
    // Meses que quedan hasta el mes de la fecha límite (al menos 1)
    const [y1, mo1] = actual.split("-").map(Number);
    const [y2, mo2] = monthKey(g.target_date).split("-").map(Number);
    const quedan = Math.max(1, (y2 - y1) * 12 + (mo2 - mo1));
    necesarioAlMes = Math.ceil(falta / quedan / 1000) * 1000;
    aTiempo = llega !== null && llega <= monthKey(g.target_date);
  }
  return { ritmo, llega, extra, llegaConExtra: reciente ? null : llegaConExtra, necesarioAlMes, aTiempo: reciente ? null : aTiempo, reciente };
}

/** "2027-03" → "marzo de 2027" */
export const mesTexto = (key: string) => {
  const [mes, anio] = monthLabel(key).split(" ");
  return `${mes.toLowerCase()} de ${anio}`;
};
