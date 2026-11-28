/**
 * Objetivo que es una compra de contado (ej. «Mazda 3 Touring»): se ahorra en cuotas y se compra al llegar
 * al precio. Los números viven en su meta de ahorro: precio = monto objetivo, ahorrado = lo ahorrado y la
 * cuota = el plan de aporte (valor y frecuencia). El progreso del objetivo es el % de la meta. Funciones puras.
 */
import type { AnnualGoal, SavingsGoal } from "../../types/db";
import { FRECUENCIAS, fechaEstimada, ritmo, type FrecuenciaAporte, type PlanAporte } from "../finanzas/planAporte";
import { addDays } from "../../utils/dates";

/**
 * Progreso y estado que le tocan a un objetivo de compra según su meta, o null si ya están al día.
 * Al llegar al 100 % queda «logrado»; si baja (retiro), vuelve a «en progreso»; un objetivo pausado sigue pausado.
 */
export function avanceDeCompra(
  g: Pick<AnnualGoal, "progress" | "status">,
  meta: Pick<SavingsGoal, "target_amount" | "current_amount">,
): Pick<AnnualGoal, "progress" | "status"> | null {
  const progress = meta.target_amount > 0 ? Math.min(100, Math.floor((Math.max(0, meta.current_amount) / meta.target_amount) * 100)) : 0;
  const status: AnnualGoal["status"] =
    progress >= 100 ? "logrado" : g.status === "logrado" || (g.status === "no_iniciado" && progress > 0) ? "en_progreso" : g.status;
  return progress === g.progress && status === g.status ? null : { progress, status };
}

export interface ResumenCompra {
  precio: number;
  ahorrado: number;
  falta: number;
  /** 0 a 100 */
  pct: number;
  cuota: { monto: number; frecuencia: FrecuenciaAporte; cada: string } | null;
  /** Cuotas ya ahorradas desde que empezó el plan (estimadas: lo ahorrado desde el inicio ÷ la cuota) */
  cuotasPagadas: number;
  /** Cuotas que faltan para llegar al precio */
  cuotasRestantes: number;
  /** Fecha estimada en que se llega al precio con la cuota (null sin cuota) */
  llega: string | null;
  /** "Vas al día" / "Vas $X adelantado" / "Te faltan 2 aportes para ir al día" (null sin cuota) */
  ritmo: string | null;
}

export function resumenCompra(meta: Pick<SavingsGoal, "target_amount" | "current_amount" | "target_date" | "plan">, hoy: string): ResumenCompra {
  const precio = meta.target_amount;
  const ahorrado = Math.max(0, meta.current_amount);
  const falta = Math.max(0, precio - ahorrado);
  const pct = precio > 0 ? Math.min(100, Math.floor((ahorrado / precio) * 100)) : 0;
  const plan = meta.plan as PlanAporte | null | undefined;
  if (!plan || plan.monto <= 0) return { precio, ahorrado, falta, pct, cuota: null, cuotasPagadas: 0, cuotasRestantes: 0, llega: null, ritmo: null };
  const cada = FRECUENCIAS.find((f) => f.value === plan.frecuencia)?.cada ?? "";
  // Ritmo: contando la cuota de hoy si ya se pagó (al día o adelantado); si no, hasta ayer (la de hoy aún no está atrasada)
  const actual = { current_amount: ahorrado, target_amount: precio };
  const conHoy = ritmo(actual, plan, hoy);
  const textoRitmo = conHoy.diferencia >= 0 ? conHoy.texto : ritmo(actual, plan, addDays(hoy, -1)).texto;
  return {
    precio,
    ahorrado,
    falta,
    pct,
    cuota: { monto: plan.monto, frecuencia: plan.frecuencia, cada },
    cuotasPagadas: Math.max(0, Math.floor((ahorrado - plan.base) / plan.monto)),
    cuotasRestantes: Math.ceil(falta / plan.monto),
    llega: falta > 0 ? fechaEstimada({ ...meta, target_amount: precio, current_amount: ahorrado }, plan, hoy) : hoy,
    ritmo: falta > 0 ? textoRitmo : null,
  };
}
