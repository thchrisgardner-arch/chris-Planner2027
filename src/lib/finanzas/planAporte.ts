/**
 * Plan de aporte de una meta de ahorro (Fase 4, inspirado en las Metas de Nequi): abonar día a día,
 * semana a semana, cada quincena o mes a mes hasta llegar al monto. La app no mueve dinero: cada
 * aporte queda pendiente por confirmar ("Ahorrado") o se salta ("Esta vez no").
 *  - Con fecha: la app calcula cuánto ahorrar en cada aporte.
 *  - Sin fecha: la persona fija el aporte y la app calcula la fecha estimada.
 * Funciones puras.
 */
import type { SavingsGoal } from "../../types/db";
import { addDays, daysInMonth, endOfMonth, monthKey, parseISO } from "../../utils/dates";
import { formatCOP } from "../../utils/money";

export type FrecuenciaAporte = "diaria" | "semanal" | "quincenal" | "mensual";

export const FRECUENCIAS: { value: FrecuenciaAporte; label: string; cada: string }[] = [
  { value: "diaria", label: "Diaria", cada: "cada día" },
  { value: "semanal", label: "Semanal", cada: "cada semana" },
  { value: "quincenal", label: "Quincenal", cada: "cada quincena" },
  { value: "mensual", label: "Mensual", cada: "cada mes" },
];

/** `savings_goals.plan` (jsonb) */
export interface PlanAporte {
  frecuencia: FrecuenciaAporte;
  /** Valor de cada aporte */
  monto: number;
  /** Fecha del primer aporte (YYYY-MM-DD) */
  inicio: string;
  /** Lo ahorrado cuando empezó el plan (para medir el ritmo) */
  base: number;
}

/** Aportes confirmados o saltados: meta → fecha → estado */
export type EstadosAporte = Record<string, { estado: "ahorrado" | "saltado"; monto: number }>;

const dia = (iso: string) => parseISO(iso).getUTCDate();
const fechaEnMes = (mes: string, d: number) => `${mes}-${String(Math.min(d, daysInMonth(mes))).padStart(2, "0")}`;

/** Fechas de aporte entre `desde` y `hasta` (incluidas), según la frecuencia y el inicio del plan */
export function fechasAporte(plan: Pick<PlanAporte, "frecuencia" | "inicio">, desde: string, hasta: string, max = 2000): string[] {
  const out: string[] = [];
  const inicio = plan.inicio;
  const ini = desde > inicio ? desde : inicio;
  if (ini > hasta) return out;
  if (plan.frecuencia === "diaria" || plan.frecuencia === "semanal") {
    const paso = plan.frecuencia === "diaria" ? 1 : 7;
    for (let d = inicio; d <= hasta && out.length < max; d = addDays(d, paso)) if (d >= ini) out.push(d);
    return out;
  }
  // Quincenal: el 15 y el último día del mes. Mensual: el mismo día del mes del inicio.
  for (let mes = monthKey(inicio); `${mes}-01` <= hasta && out.length < max; mes = monthKey(addDays(endOfMonth(mes), 1))) {
    const fechas = plan.frecuencia === "quincenal" ? [fechaEnMes(mes, 15), endOfMonth(mes)] : [fechaEnMes(mes, dia(inicio))];
    for (const f of fechas) if (f >= ini && f >= inicio && f <= hasta) out.push(f);
  }
  return out;
}

/** Siguiente fecha de aporte desde `hoy` (incluido) */
export function proximaFecha(plan: Pick<PlanAporte, "frecuencia" | "inicio">, hoy: string): string {
  return fechasAporte(plan, hoy, addDays(hoy, 62), 1)[0];
}

const redondearMil = (n: number) => Math.ceil(n / 1000) * 1000;

/** Con fecha: cuánto ahorrar en cada aporte (desde hoy hasta la fecha) para llegar */
export function aporteNecesario(meta: Pick<SavingsGoal, "target_amount" | "current_amount" | "target_date">, plan: Pick<PlanAporte, "frecuencia" | "inicio">, hoy: string): number | null {
  if (!meta.target_date) return null;
  const falta = meta.target_amount - meta.current_amount;
  if (falta <= 0) return 0;
  const n = fechasAporte({ ...plan, inicio: plan.inicio > hoy ? plan.inicio : hoy }, hoy, meta.target_date).length;
  return n ? redondearMil(falta / n) : falta;
}

/** Sin fecha: cuándo se llega con el aporte fijado */
export function fechaEstimada(meta: Pick<SavingsGoal, "target_amount" | "current_amount"> & { target_date?: string | null }, plan: PlanAporte, hoy: string): string | null {
  const falta = meta.target_amount - meta.current_amount;
  if (falta <= 0) return hoy;
  if (plan.monto <= 0) return null;
  const k = Math.ceil(falta / plan.monto);
  const fechas = fechasAporte({ ...plan, inicio: plan.inicio > hoy ? plan.inicio : hoy }, hoy, addDays(hoy, 365 * 30), k);
  return fechas.length >= k ? fechas[k - 1] : null;
}

/** Aportes pendientes por confirmar: los que ya llegaron (hasta hoy) y no se ahorraron ni saltaron */
export function aportesPendientes(plan: PlanAporte, estados: EstadosAporte, hoy: string, max = 6): string[] {
  return fechasAporte(plan, plan.inicio, hoy)
    .filter((f) => !estados[f])
    .slice(-max);
}

export interface Ritmo {
  /** Positivo: adelantado; negativo: atrasado (en pesos) */
  diferencia: number;
  texto: string;
}

/** Ritmo contra el plan, sin culpa: "Vas $40.000 adelantado" o "Te faltan 2 aportes para ir al día" */
export function ritmo(meta: Pick<SavingsGoal, "current_amount" | "target_amount">, plan: PlanAporte, hoy: string): Ritmo {
  if (meta.current_amount >= meta.target_amount) return { diferencia: 0, texto: "Meta cumplida." };
  const vencidos = fechasAporte(plan, plan.inicio, hoy).length;
  const esperado = Math.min(meta.target_amount, plan.base + plan.monto * vencidos);
  const diferencia = Math.round(meta.current_amount - esperado);
  if (Math.abs(diferencia) < Math.max(1000, plan.monto * 0.05)) return { diferencia: 0, texto: "Vas al día." };
  if (diferencia > 0) return { diferencia, texto: `Vas ${formatCOP(diferencia)} adelantado.` };
  const aportes = Math.ceil(-diferencia / plan.monto);
  return { diferencia, texto: aportes === 1 ? "Te falta 1 aporte para ir al día." : `Te faltan ${aportes} aportes para ir al día.` };
}

const fechaLarga = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "UTC" }).format(parseISO(iso));

/** "Ahorra $85.000 cada quincena para llegar el 15 de junio" */
export function textoPlan(meta: Pick<SavingsGoal, "target_amount" | "current_amount" | "target_date">, plan: PlanAporte, hoy: string): string {
  const cada = FRECUENCIAS.find((f) => f.value === plan.frecuencia)!.cada;
  if (meta.current_amount >= meta.target_amount) return "Llegaste a la meta.";
  // Con fecha: el aporte del plan (se recalcula al aportar de más o de menos, no en cada visita)
  if (meta.target_date) return `Ahorra ${formatCOP(plan.monto)} ${cada} para llegar el ${fechaLarga(meta.target_date)}.`;
  const f = fechaEstimada(meta, plan, hoy);
  return f ? `Con ${formatCOP(plan.monto)} ${cada} llegas el ${fechaLarga(f)}.` : `Ahorra ${formatCOP(plan.monto)} ${cada}.`;
}

/**
 * Al confirmar un aporte de más o de menos, una meta con fecha recalcula el valor de los siguientes
 * aportes; sin fecha, el aporte fijado no cambia (cambia la fecha estimada).
 */
export function recalcularPlan(meta: Pick<SavingsGoal, "target_amount" | "current_amount" | "target_date">, plan: PlanAporte, montoConfirmado: number, hoy: string): PlanAporte {
  if (!meta.target_date || montoConfirmado === plan.monto) return plan;
  const nuevo = aporteNecesario({ ...meta, current_amount: meta.current_amount }, { ...plan, inicio: addDays(hoy, 1) }, addDays(hoy, 1));
  if (nuevo === null || nuevo <= 0) return plan;
  // El ritmo se mide desde aquí con el nuevo valor
  return { ...plan, monto: nuevo, inicio: proximaFecha(plan, addDays(hoy, 1)) ?? plan.inicio, base: meta.current_amount };
}
