import type { Account, SavingsGoal, Transaction } from "@/types/db";
import {
  WEEKDAYS_MED,
  addDays,
  addMonths,
  daysInMonth,
  endOfMonth,
  monthKey,
  monthShort,
  parseISO,
} from "@/utils/dates";
import { sum } from "@/utils/money";

const counts = (t: Transaction) => t.status === "completado";

/**
 * Saldo de una cuenta = saldo inicial + ingresos − gastos − transferencias salientes + transferencias entrantes.
 * Se calcula siempre a partir de los movimientos, así nunca se desincroniza.
 * `until` (incluido) permite calcular el saldo a una fecha.
 */
export function accountBalance(account: Account, txs: Transaction[], until?: string): number {
  let balance = Math.round(account.initial_balance);
  for (const t of txs) {
    if (!counts(t) || (until && t.date > until)) continue;
    if (t.type === "ingreso" && t.account_id === account.id) balance += t.amount;
    else if (t.type === "gasto" && t.account_id === account.id) balance -= t.amount;
    else if (t.type === "transferencia") {
      if (t.account_id === account.id) balance -= t.amount;
      if (t.to_account_id === account.id) balance += t.amount;
    }
  }
  return balance;
}

export function totalBalance(accounts: Account[], txs: Transaction[], until?: string): number {
  return sum(accounts.map((a) => accountBalance(a, txs, until)));
}

export interface PeriodTotals {
  income: number;
  expense: number;
  net: number;
}

/** Ingresos y gastos completados entre dos fechas (incluidas). Las transferencias no cuentan. */
export function totalsBetween(txs: Transaction[], from: string, to: string): PeriodTotals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (!counts(t) || t.date < from || t.date > to) continue;
    if (t.type === "ingreso") income += t.amount;
    else if (t.type === "gasto") expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

export function monthTotals(txs: Transaction[], key: string): PeriodTotals {
  return totalsBetween(txs, `${key}-01`, endOfMonth(key));
}

export type ActivityPeriod = "7d" | "mes" | "6m" | "anio";

export interface ActivityPoint {
  label: string;
  hint: string;
  ingresos: number;
  gastos: number;
}

/** Serie de ingresos/gastos para el gráfico de barras según el periodo elegido. */
export function activitySeries(txs: Transaction[], period: ActivityPeriod, today: string): ActivityPoint[] {
  if (period === "7d") {
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i - 6);
      const t = totalsBetween(txs, day, day);
      const wd = (parseISO(day).getUTCDay() + 6) % 7;
      return { label: WEEKDAYS_MED[wd], hint: day, ingresos: t.income, gastos: t.expense };
    });
  }
  if (period === "mes") {
    const key = monthKey(today);
    const days = daysInMonth(key);
    const weeks: ActivityPoint[] = [];
    for (let start = 1, w = 1; start <= days; start += 7, w++) {
      const end = Math.min(start + 6, days);
      const from = `${key}-${String(start).padStart(2, "0")}`;
      const to = `${key}-${String(end).padStart(2, "0")}`;
      const t = totalsBetween(txs, from, to);
      weeks.push({ label: `Sem ${w}`, hint: `${start}–${end} ${monthShort(key)}`, ingresos: t.income, gastos: t.expense });
    }
    return weeks;
  }
  const current = monthKey(today);
  const months =
    period === "6m"
      ? Array.from({ length: 6 }, (_, i) => addMonths(current, i - 5))
      : Array.from({ length: 12 }, (_, i) => `${current.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`);
  return months.map((k) => {
    const t = monthTotals(txs, k);
    const label = monthShort(k);
    return { label: label.charAt(0).toUpperCase() + label.slice(1), hint: k, ingresos: t.income, gastos: t.expense };
  });
}

export function savingsSummary(goals: SavingsGoal[]) {
  const target = sum(goals.map((g) => g.target_amount));
  const saved = sum(goals.map((g) => Math.min(g.current_amount, g.target_amount)));
  return { target, saved, pending: Math.max(0, target - saved) };
}

/** Gastos agrupados por categoría en un rango. */
export function expensesByCategory(txs: Transaction[], from: string, to: string) {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "gasto" || !counts(t) || t.date < from || t.date > to) continue;
    const k = t.category ?? "Sin categoría";
    map.set(k, (map.get(k) ?? 0) + t.amount);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

/** Distribución neutral: para mí / para otras personas / compartido. */
export function expensesByBeneficiary(txs: Transaction[], from: string, to: string) {
  const out = { para_mi: 0, otras_personas: 0, compartido: 0, sin_clasificar: 0 };
  for (const t of txs) {
    if (t.type !== "gasto" || !counts(t) || t.date < from || t.date > to) continue;
    out[t.beneficiary ?? "sin_clasificar"] += t.amount;
  }
  return out;
}
