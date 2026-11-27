"use client";

/** Indicadores del mes en el inicio (arriba en la pantalla: se cargan con la primera vista). */
import { useMemo } from "react";
import { Delta } from "@/components/ui/misc";
import { StatCard } from "@/components/ui/viz";
import { useForms } from "@/components/providers/FormsProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { addMonths, endOfMonth, monthKey, monthLabel } from "@/utils/dates";
import { formatKpiCOP, variation } from "@/utils/money";
import { monthTotals, totalBalance } from "@/modules/finance/selectors";

export function KpiRow({ refMonth }: { refMonth: string }) {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const isCurrent = refMonth === monthKey(today);
  const prevMonth = addMonths(refMonth, -1);
  const prevLabel = monthLabel(prevMonth).split(" ")[0].toLowerCase();

  const k = useMemo(() => {
    const until = isCurrent ? undefined : endOfMonth(refMonth);
    const balance = totalBalance(db.accounts, db.transactions, until);
    const prevBalance = totalBalance(db.accounts, db.transactions, endOfMonth(prevMonth));
    const hasPrev = db.transactions.some((t) => t.date <= endOfMonth(prevMonth));
    const cur = monthTotals(db.transactions, refMonth);
    const prev = monthTotals(db.transactions, prevMonth);
    return { balance, prevBalance, hasPrev, cur, prev, prevHasMoves: prev.income > 0 || prev.expense > 0 };
  }, [db.accounts, db.transactions, refMonth, prevMonth, isCurrent]);

  const noAccounts = db.accounts.length === 0;

  return (
    <div data-tour="kpis" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        variant="inverse"
        label="Dinero disponible"
        value={formatKpiCOP(k.balance)}
        href="/finanzas?tab=cuentas"
        className="sm:col-span-2 xl:col-span-1"
        meta={
          noAccounts ? (
            <button type="button" onClick={() => open({ kind: "account" })} className="cursor-pointer font-medium text-on-fg underline-offset-4 hover:underline">
              Agregar cuenta
            </button>
          ) : k.hasPrev ? (
            <Delta inverse value={variation(k.balance, k.prevBalance)} suffix={`vs. ${prevLabel} · ${db.accounts.length} ${db.accounts.length === 1 ? "cuenta" : "cuentas"}`} />
          ) : (
            `${db.accounts.length} ${db.accounts.length === 1 ? "cuenta" : "cuentas"}`
          )
        }
      />
      <StatCard
        label="Ingresos del mes"
        value={formatKpiCOP(k.cur.income)}
        muted={k.cur.income === 0}
        href="/finanzas?tab=movimientos"
        meta={k.prevHasMoves ? <Delta value={variation(k.cur.income, k.prev.income)} suffix={`vs. ${prevLabel}`} /> : monthLabel(refMonth)}
      />
      <StatCard
        label="Gastos del mes"
        value={formatKpiCOP(k.cur.expense)}
        muted={k.cur.expense === 0}
        href="/finanzas?tab=movimientos"
        meta={k.prevHasMoves ? <Delta invert value={variation(k.cur.expense, k.prev.expense)} suffix={`vs. ${prevLabel}`} /> : monthLabel(refMonth)}
      />
    </div>
  );
}
