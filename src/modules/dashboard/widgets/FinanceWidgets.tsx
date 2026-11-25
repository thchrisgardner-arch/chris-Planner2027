"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownLeft, ArrowUpRight, ChartColumn, PiggyBank, Plus, Wallet, Pencil } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Delta, EmptyState, Segmented } from "@/components/ui/misc";
import { MoneyTooltip, SegmentedGauge } from "@/components/charts/charts";
import { useForms } from "@/components/providers/FormsProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { addMonths, endOfMonth, monthKey, monthLabel } from "@/utils/dates";
import { formatCOP, formatCompactCOP, pct, variation } from "@/utils/money";
import { cn } from "@/utils/cn";
import { accountTypeLabel } from "@/modules/finance/constants";
import { detectStoreInText } from "@/modules/other/stores";
import { StoreLogo } from "@/components/ui/StoreLogo";
import {
  accountBalance,
  activitySeries,
  monthTotals,
  savingsSummary,
  totalBalance,
  type ActivityPeriod,
} from "@/modules/finance/selectors";

/* ───────── 01 · Balance disponible ───────── */
export function BalanceWidget({ refMonth, className }: { refMonth: string; className?: string }) {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const isCurrent = refMonth === monthKey(today);

  const data = useMemo(() => {
    const until = isCurrent ? undefined : endOfMonth(refMonth);
    const now = totalBalance(db.accounts, db.transactions, until);
    const prevMonth = addMonths(refMonth, -1);
    const prev = totalBalance(db.accounts, db.transactions, endOfMonth(prevMonth));
    const hasPrevData = db.transactions.some((t) => t.date <= endOfMonth(prevMonth));
    const accounts = db.accounts
      .map((a) => ({ a, balance: accountBalance(a, db.transactions, until) }))
      .sort((x, y) => y.balance - x.balance);
    return { now, prev, hasPrevData, accounts, prevMonth };
  }, [db.accounts, db.transactions, refMonth, isCurrent]);

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title="Balance disponible"
        subtitle={isCurrent ? "Suma de tus cuentas hoy" : `Al cierre de ${monthLabel(refMonth).toLowerCase()}`}
        icon={<Wallet size={19} />}
        action={
          <Link href="/finanzas" aria-label="Ir a Finanzas">
            <Button size="icon-sm" variant="ghost" tabIndex={-1}>
              <ArrowUpRight size={19} />
            </Button>
          </Link>
        }
      />
      {db.accounts.length === 0 ? (
        <EmptyState
          compact
          icon={<Wallet size={21} />}
          title="Aún no tienes cuentas"
          description="Agrega tu cuenta bancaria, efectivo o billetera digital para ver tu saldo."
          action={
            <Button size="sm" variant="primary" onClick={() => open({ kind: "account" })}>
              <Plus size={17} /> Crear cuenta
            </Button>
          }
        />
      ) : (
        <>
          <p className={cn("num text-[34px] font-medium leading-none md:text-[38px]", data.now < 0 && "text-warn")}>
            {formatCOP(data.now)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {data.hasPrevData ? (
              <>
                <Delta value={variation(data.now, data.prev)} />
                <span className="text-[12px] text-dim">vs. cierre de {monthLabel(data.prevMonth).toLowerCase()}</span>
              </>
            ) : (
              <span className="text-[12px] text-dim">Sin movimientos del mes anterior para comparar</span>
            )}
          </div>
          <ul className="mt-auto space-y-2 pt-6">
            {data.accounts.slice(0, 3).map(({ a, balance }) => (
              <li key={a.id} className="flex items-center gap-3 rounded-[20px] bg-bg-2 px-3 py-2.5">
                {detectStoreInText(a.name) ? (
                  <StoreLogo store={detectStoreInText(a.name)!} size={28} />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-brand/70" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px]">{a.name}</span>
                  <span className="block text-[11.5px] text-dim">{accountTypeLabel(a.type)}</span>
                </span>
                <span className={cn("num text-[13.5px] font-medium", balance < 0 && "text-warn")}>{formatCOP(balance)}</span>
              </li>
            ))}
            {data.accounts.length > 3 ? (
              <li>
                <Link href="/finanzas?tab=cuentas" className="text-[12.5px] text-muted hover:text-fg">
                  +{data.accounts.length - 3} cuentas más
                </Link>
              </li>
            ) : null}
          </ul>
        </>
      )}
    </Card>
  );
}

/* ───────── 02 · Ingresos y gastos ───────── */
export function IncomeExpenseWidget({ refMonth, className }: { refMonth: string; className?: string }) {
  const { db } = useData();
  const open = useForms();
  const current = useMemo(() => monthTotals(db.transactions, refMonth), [db.transactions, refMonth]);
  const prev = useMemo(() => monthTotals(db.transactions, addMonths(refMonth, -1)), [db.transactions, refMonth]);
  const hasPrev = prev.income > 0 || prev.expense > 0;
  const max = Math.max(current.income, current.expense, 1);

  return (
    <Card className={cn("@container flex flex-col", className)}>
      <CardHeader
        title="Ingresos y gastos"
        subtitle={monthLabel(refMonth)}
        icon={<ArrowDownLeft size={19} />}
        action={
          <Button size="sm" onClick={() => open({ kind: "transaction" })} disabled={db.accounts.length === 0} title={db.accounts.length === 0 ? "Crea una cuenta primero" : undefined}>
            <Plus size={17} /> Registrar
          </Button>
        }
      />
      {db.transactions.length === 0 ? (
        <EmptyState
          compact
          icon={<ArrowDownLeft size={21} />}
          title="Sin movimientos todavía"
          description={db.accounts.length ? "Registra tu primer ingreso o gasto." : "Crea una cuenta y luego registra tus movimientos."}
          action={
            <Button
              size="sm"
              variant="primary"
              onClick={() => open(db.accounts.length ? { kind: "transaction" } : { kind: "account" })}
            >
              <Plus size={17} /> {db.accounts.length ? "Registrar movimiento" : "Crear cuenta"}
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
            {(
              [
                { label: "Ingresos", value: current.income, prev: prev.income, color: "var(--color-brand)", invert: false },
                { label: "Gastos", value: current.expense, prev: prev.expense, color: "var(--color-warn)", invert: true },
              ] as const
            ).map((s) => (
              <div key={s.label} className="rounded-[20px] bg-bg-2 p-4">
                <p className="label flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </p>
                <p className="num mt-2 truncate text-[22px] font-medium leading-none sm:text-[24px]">{formatCOP(s.value)}</p>
                <div className="mt-3">
                  {hasPrev ? <Delta value={variation(s.value, s.prev)} invert={s.invert} /> : <span className="text-[11.5px] text-dim">Sin mes anterior</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2.5">
            <div className="h-2.5 overflow-hidden rounded-full bg-elev">
              <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${(current.income / max) * 100}%` }} />
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-elev">
              <div className="h-full rounded-full bg-warn transition-[width] duration-500" style={{ width: `${(current.expense / max) * 100}%` }} />
            </div>
          </div>
          <div className="h-5 shrink-0" />
          <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
            <div>
              <p className="label">Diferencia del mes</p>
              <p className={cn("num mt-1 text-[20px] font-medium", current.net >= 0 ? "text-brand-soft" : "text-warn")}>
                {current.net >= 0 ? "+" : ""}
                {formatCOP(current.net)}
              </p>
            </div>
            {current.income > 0 ? (
              <p className="text-right text-[12px] text-muted">
                Gastaste el <span className="num font-medium text-fg">{Math.round((current.expense / current.income) * 100)} %</span>
                <br />
                de tus ingresos
              </p>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}

/* ───────── 03 · Objetivos financieros ───────── */
export function SavingsWidget({ className }: { className?: string }) {
  const { db } = useData();
  const open = useForms();
  const s = useMemo(() => savingsSummary(db.savings_goals), [db.savings_goals]);
  const progress = pct(s.saved, s.target);

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader title="Objetivos de ahorro" subtitle={`${db.savings_goals.length} ${db.savings_goals.length === 1 ? "meta" : "metas"}`} icon={<PiggyBank size={19} />}
        action={
          db.savings_goals.length ? (
            <>
              {db.savings_goals.length === 1 ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Editar ${db.savings_goals[0].name}`}
                  title="Editar meta"
                  onClick={() => open({ kind: "savings", record: db.savings_goals[0] })}
                >
                  <Pencil size={18} />
                </Button>
              ) : (
                <Link href="/finanzas?tab=ahorros" aria-label="Editar metas" title="Editar metas">
                  <Button size="icon-sm" variant="ghost" tabIndex={-1}>
                    <Pencil size={18} />
                  </Button>
                </Link>
              )}
              <Button size="icon-sm" variant="ghost" aria-label="Nueva meta de ahorro" onClick={() => open({ kind: "savings" })}>
                <Plus size={19} />
              </Button>
              <Link href="/finanzas?tab=ahorros" aria-label="Ver todas las metas">
                <Button size="icon-sm" variant="ghost" tabIndex={-1}>
                  <ArrowUpRight size={19} />
                </Button>
              </Link>
            </>
          ) : null
        }
      />
      {db.savings_goals.length === 0 ? (
        <EmptyState
          compact
          icon={<PiggyBank size={21} />}
          title="Define tu primera meta"
          description="Fondo de emergencia, viaje, equipo nuevo…"
          action={
            <Button size="sm" variant="primary" onClick={() => open({ kind: "savings" })}>
              <Plus size={17} /> Crear meta
            </Button>
          }
        />
      ) : (
        <>
          <SegmentedGauge value={progress}>
            <p className="num text-[36px] font-medium leading-none">
              {Math.round(progress)}
              <span className="text-[20px] text-muted">%</span>
            </p>
            <p className="mt-1 text-[12px] text-muted">cumplido</p>
          </SegmentedGauge>
          <dl className="mt-5 divide-y divide-line rounded-[22px] bg-bg-2 px-3.5 text-[12.5px]">
            {[
              { k: "Ahorrado", v: s.saved, cls: "text-brand-soft" },
              { k: "Pendiente", v: s.pending, cls: "text-fg" },
              { k: "Objetivo total", v: s.target, cls: "text-muted" },
            ].map((r) => (
              <div key={r.k} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-dim">{r.k}</dt>
                <dd className={cn("num font-medium", r.cls)}>{formatCOP(r.v)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Card>
  );
}

/* ───────── 06 · Actividad financiera ───────── */
const PERIODS: { value: ActivityPeriod; label: string }[] = [
  { value: "7d", label: "7 días" },
  { value: "mes", label: "Este mes" },
  { value: "6m", label: "6 meses" },
  { value: "anio", label: "Este año" },
];

export function ActivityWidget({ className }: { className?: string }) {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const [period, setPeriod] = useState<ActivityPeriod>("6m");
  const series = useMemo(() => activitySeries(db.transactions, period, today), [db.transactions, period, today]);
  const totals = series.reduce((acc, p) => ({ i: acc.i + p.ingresos, g: acc.g + p.gastos }), { i: 0, g: 0 });
  const empty = totals.i === 0 && totals.g === 0;

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title="Actividad financiera"
        subtitle="Ingresos y gastos completados"
        icon={<ChartColumn size={19} />}
        action={<Segmented value={period} onChange={setPeriod} options={PERIODS} className="hidden sm:inline-flex" />}
      />
      <Segmented value={period} onChange={setPeriod} options={PERIODS} className="-mt-1 mb-4 self-start sm:hidden" />
      <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <p className="label flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand" /> Ingresos
          </p>
          <p className="num mt-1 text-[20px] font-medium">{formatCOP(totals.i)}</p>
        </div>
        <div>
          <p className="label flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-warn" /> Gastos
          </p>
          <p className="num mt-1 text-[20px] font-medium">{formatCOP(totals.g)}</p>
        </div>
      </div>
      <div className="relative h-[230px] w-full">
        {empty ? (
          <div className="absolute inset-0 z-10 grid place-items-center">
            <div className="rounded-[14px] border border-line bg-card/90 px-5 py-4 text-center">
              <p className="text-[13.5px] font-medium">Sin movimientos en este periodo</p>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => open(db.accounts.length ? { kind: "transaction" } : { kind: "account" })}>
                <Plus size={17} /> {db.accounts.length ? "Registrar movimiento" : "Crear cuenta"}
              </Button>
            </div>
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} barGap={4} barCategoryGap="22%" margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="3 5" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-dim)", fontSize: 11.5 }} dy={6} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={58}
              tick={{ fill: "var(--color-dim)", fontSize: 11 }}
              tickFormatter={(v: number) => (v === 0 ? "0" : formatCompactCOP(v))}
            />
            <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)", radius: 8 }} />
            <Bar dataKey="ingresos" name="ingresos" fill="#2ee56b" radius={[6, 6, 2, 2]} maxBarSize={22} />
            <Bar dataKey="gastos" name="gastos" fill="#f4a340" radius={[6, 6, 2, 2]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
