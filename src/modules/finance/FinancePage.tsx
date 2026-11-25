"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ArrowLeftRight, Download, PiggyBank, Plus, Search, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Badge, EmptyState, Progress } from "@/components/ui/misc";
import { ModuleTabs, RowActions, useDeleteRecord } from "@/components/ui/RowActions";
import { useForms } from "@/components/providers/FormsProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import type { Transaction } from "@/types/db";
import { endOfMonth, formatShortDate, monthKey, monthLabel, addMonths, relativeDay } from "@/utils/dates";
import { formatCOP, pct, sum } from "@/utils/money";
import { cn } from "@/utils/cn";
import { StoreLogo } from "@/components/ui/StoreLogo";
import { detectStoreInText } from "@/modules/other/stores";
import { ActivityWidget } from "@/modules/dashboard/widgets/FinanceWidgets";
import { CATEGORY_COLORS, EXPENSE_CATEGORIES, INCOME_CATEGORIES, accountTypeLabel } from "./constants";
import { accountBalance, expensesByBeneficiary, expensesByCategory, monthTotals, totalBalance } from "./selectors";

type Tab = "resumen" | "movimientos" | "cuentas" | "ahorros" | "presupuestos" | "deudas" | "analisis";

const TABS: { value: Tab; label: string; soon?: boolean }[] = [
  { value: "resumen", label: "Resumen" },
  { value: "movimientos", label: "Movimientos" },
  { value: "cuentas", label: "Cuentas" },
  { value: "ahorros", label: "Ahorros" },
  { value: "presupuestos", label: "Presupuestos", soon: true },
  { value: "deudas", label: "Deudas", soon: true },
  { value: "analisis", label: "Análisis", soon: true },
];

export function FinancePage() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("tab") as Tab | null;
  const tab: Tab = raw && TABS.some((t) => t.value === raw && !t.soon) ? raw : "resumen";
  const open = useForms();
  const { db } = useData();

  return (
    <>
      <PageHeader title="Finanzas" subtitle="Ingresos, gastos, cuentas y ahorros en COP.">
        <Button onClick={() => open({ kind: "account" })}>
          <Wallet size={18} /> Cuenta
        </Button>
        <Button
          variant="primary"
          className="lg:hidden"
          onClick={() => open(db.accounts.length ? { kind: "transaction" } : { kind: "account" })}
        >
          <Plus size={18} /> Movimiento
        </Button>
      </PageHeader>
      <ModuleTabs value={tab} onChange={(v) => router.replace(`/finanzas?tab=${v}`, { scroll: false })} tabs={TABS} />
      {tab === "resumen" && <Summary />}
      {tab === "movimientos" && <Movements />}
      {tab === "cuentas" && <Accounts />}
      {tab === "ahorros" && <Savings />}
    </>
  );
}

/* ───────── Resumen ───────── */
function Kpi({ label, value, tone, hint }: { label: string; value: number; tone?: string; hint?: string }) {
  return (
    <Card className="p-5 sm:p-5">
      <p className="label">{label}</p>
      <p className={cn("num mt-2 truncate text-[24px] font-semibold leading-none md:text-[26px]", tone)}>{formatCOP(value)}</p>
      {hint ? <p className="mt-2 text-[11.5px] text-dim">{hint}</p> : null}
    </Card>
  );
}

function Summary() {
  const { db } = useData();
  const today = useToday();
  const key = monthKey(today);
  const m = monthTotals(db.transactions, key);
  const available = totalBalance(db.accounts, db.transactions);
  const saved = sum(db.savings_goals.map((g) => g.current_amount));
  const cardDebt = sum(
    db.accounts.filter((a) => a.type === "tarjeta_credito").map((a) => Math.min(0, accountBalance(a, db.transactions))),
  );
  const from = `${key}-01`;
  const to = endOfMonth(key);
  const byCat = expensesByCategory(db.transactions, from, to);
  const byBen = expensesByBeneficiary(db.transactions, from, to);
  const benTotal = byBen.para_mi + byBen.otras_personas + byBen.compartido + byBen.sin_clasificar;

  return (
    <div className="grid gap-4 xl:gap-5">
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 min-[1700px]:grid-cols-6">
        <Kpi label="Ingresos del mes" value={m.income} tone="text-brand-soft" hint={monthLabel(key)} />
        <Kpi label="Gastos del mes" value={m.expense} tone="text-warn" hint={monthLabel(key)} />
        <Kpi label="Balance neto" value={m.net} tone={m.net >= 0 ? "text-fg" : "text-warn"} hint="Ingresos − gastos" />
        <Kpi label="Dinero disponible" value={available} hint="Todas las cuentas" />
        <Kpi label="Ahorro acumulado" value={saved} hint="En tus metas" />
        <Kpi label="Deuda en tarjetas" value={Math.abs(cardDebt)} hint="Saldo negativo de tarjetas" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-12 xl:gap-5">
        <ActivityWidget className="md:col-span-2 xl:col-span-7" />
        <Card className="xl:col-span-5">
          <CardHeader title="Gastos por categoría" subtitle={monthLabel(key)} />
          {byCat.length === 0 ? (
            <EmptyState compact icon={<Wallet size={21} />} title="Sin gastos este mes" />
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <div className="h-[180px] w-[180px] shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
                      {byCat.map((c, i) => (
                        <Cell key={c.name} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.[0] ? (
                          <div className="rounded-[12px] border border-line bg-elev px-3 py-2 text-[12.5px]">
                            {payload[0].name}: <span className="num font-medium">{formatCOP(Number(payload[0].value))}</span>
                          </div>
                        ) : null
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-2">
                {byCat.slice(0, 6).map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2.5 text-[13px]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                    <span className="flex-1 truncate text-muted">{c.name}</span>
                    <span className="num font-medium">{formatCOP(c.value)}</span>
                    <span className="num w-10 text-right text-[11.5px] text-dim">{Math.round(pct(c.value, m.expense))} %</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
        <Card className="md:col-span-2 xl:col-span-12">
          <CardHeader title="¿Para quién fue el gasto?" subtitle="Distribución del mes, solo informativa" />
          {benTotal === 0 ? (
            <EmptyState compact icon={<Wallet size={21} />} title="Sin gastos clasificados este mes" />
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-elev">
                {[
                  { v: byBen.para_mi, c: "#2ee56b" },
                  { v: byBen.otras_personas, c: "#9b82f6" },
                  { v: byBen.compartido, c: "#66a9f7" },
                  { v: byBen.sin_clasificar, c: "var(--color-line-strong)" },
                ].map((s, i) => (
                  <div key={i} style={{ width: `${pct(s.v, benTotal)}%`, background: s.c }} className="h-full transition-[width] duration-500" />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { k: "Para mí", v: byBen.para_mi, c: "#2ee56b" },
                  { k: "Para otras personas", v: byBen.otras_personas, c: "#9b82f6" },
                  { k: "Compartido", v: byBen.compartido, c: "#66a9f7" },
                  { k: "Sin clasificar", v: byBen.sin_clasificar, c: "var(--color-line-strong)" },
                ].map((s) => (
                  <div key={s.k} className="rounded-[22px] bg-bg-2 px-4 py-3">
                    <p className="label flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.c }} /> {s.k}
                    </p>
                    <p className="num mt-1.5 text-[17px] font-semibold">{formatCOP(s.v)}</p>
                    <p className="num text-[11.5px] text-dim">{Math.round(pct(s.v, benTotal))} %</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ───────── Movimientos ───────── */
type SortKey = "recientes" | "antiguos" | "menor" | "mayor";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recientes", label: "Más recientes" },
  { value: "antiguos", label: "Más antiguos" },
  { value: "menor", label: "Menor a mayor valor" },
  { value: "mayor", label: "Mayor a menor valor" },
];

const byDateDesc = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);

/** En empate de valor, el más reciente va primero. */
const SORTERS: Record<SortKey, (a: Transaction, b: Transaction) => number> = {
  recientes: byDateDesc,
  antiguos: (a, b) => -byDateDesc(a, b),
  menor: (a, b) => a.amount - b.amount || byDateDesc(a, b),
  mayor: (a, b) => b.amount - a.amount || byDateDesc(a, b),
};
function toCSV(rows: Transaction[], accountName: (id: string | null) => string) {
  const head = ["Fecha", "Tipo", "Descripción", "Categoría", "Cuenta", "Cuenta destino", "Valor", "Estado", "Para quién", "Método", "Notas"];
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((t) =>
    [t.date, t.type, t.description, t.category, accountName(t.account_id), accountName(t.to_account_id), t.amount, t.status, t.beneficiary, t.payment_method, t.notes]
      .map(esc)
      .join(";"),
  );
  return "﻿" + [head.map(esc).join(";"), ...lines].join("\n");
}

function Movements() {
  const { db } = useData();
  const open = useForms();
  const del = useDeleteRecord();
  const { toast } = useFeedback();
  const today = useToday();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [month, setMonth] = useState("");
  const [sort, setSort] = useState<SortKey>("recientes");
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => addMonths(monthKey(today), -i)), [today]);
  const accountName = (id: string | null) => (id ? db.accounts.find((a) => a.id === id)?.name ?? "—" : "");

  const rows = useMemo(
    () =>
      db.transactions
        .filter((t) => (!q || t.description.toLowerCase().includes(q.toLowerCase())) && (!type || t.type === type) && (!category || t.category === category) && (!month || t.date.startsWith(month)))
        .sort(SORTERS[sort]),
    [db.transactions, q, type, category, month, sort],
  );

  const exportCSV = () => {
    if (!rows.length) return toast("No hay movimientos para exportar con estos filtros.", "error");
    const blob = new Blob([toCSV(rows, accountName)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeos-movimientos-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exportados ${rows.length} movimientos.`);
  };

  const customCats = db.transaction_categories.map((c) => c.name);
  const allCats = [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, ...customCats])];

  if (db.transactions.length === 0) {
    return (
      <EmptyState
        icon={<ArrowLeftRight size={22} />}
        title="Aún no registras movimientos"
        description={db.accounts.length ? "Registra ingresos, gastos o transferencias entre tus cuentas." : "Primero crea una cuenta."}
        action={
          <Button variant="primary" onClick={() => open(db.accounts.length ? { kind: "transaction" } : { kind: "account" })}>
            <Plus size={18} /> {db.accounts.length ? "Registrar movimiento" : "Crear cuenta"}
          </Button>
        }
      />
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_150px_180px_170px_190px_auto]">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
          <Input placeholder="Buscar por descripción" className="pl-10" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo">
          <option value="">Todos los tipos</option>
          <option value="ingreso">Ingresos</option>
          <option value="gasto">Gastos</option>
          <option value="transferencia">Transferencias</option>
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {allCats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Mes">
          <option value="">Todas las fechas</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar">
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Button onClick={exportCSV}>
          <Download size={18} /> Exportar
        </Button>
      </div>
      <p className="mb-2 text-[12px] text-dim">{rows.length} movimientos</p>
      {rows.length === 0 ? (
        <EmptyState compact icon={<Search size={20} />} title="Sin resultados" description="Prueba con otros filtros." />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((t) => {
            const sign = t.type === "ingreso" ? "+" : t.type === "gasto" ? "−" : "";
            const shop = t.type === "transferencia" ? undefined : detectStoreInText(t.description);
            return (
              <li key={t.id} className="flex items-center gap-3 py-3">
                {shop ? (
                  <StoreLogo store={shop} size={40} />
                ) : (
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-line",
                    t.type === "ingreso" ? "text-brand-soft" : t.type === "gasto" ? "text-warn" : "text-info",
                  )}
                >
                  <ArrowLeftRight size={18} />
                </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px]">{t.description}</p>
                  <p className="truncate text-[12px] text-muted">
                    {t.type === "transferencia" ? `${accountName(t.account_id)} → ${accountName(t.to_account_id)}` : `${t.category ?? "—"} · ${accountName(t.account_id)}`}
                    <span className="text-dim"> · {relativeDay(t.date, today) === formatShortDate(t.date) ? formatShortDate(t.date) : relativeDay(t.date, today)}</span>
                  </p>
                </div>
                {t.status === "pendiente" ? <Badge tone="warn">Pendiente</Badge> : null}
                <p
                  className={cn(
                    "num shrink-0 text-right text-[14.5px] font-semibold",
                    t.type === "ingreso" ? "text-brand-soft" : t.type === "gasto" ? "text-fg" : "text-info",
                  )}
                >
                  {sign}
                  {formatCOP(t.amount)}
                </p>
                <RowActions
                  label={t.description}
                  onEdit={() => open({ kind: "transaction", record: t })}
                  onDelete={() => del("transactions", t.id, "¿Eliminar este movimiento?", `${t.description} · ${formatCOP(t.amount)}`)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ───────── Cuentas ───────── */
function Accounts() {
  const { db } = useData();
  const open = useForms();
  const del = useDeleteRecord();

  if (db.accounts.length === 0) {
    return (
      <EmptyState
        icon={<Wallet size={22} />}
        title="Crea tu primera cuenta"
        description="Banco, efectivo, billetera digital, ahorros o tarjeta de crédito."
        action={
          <Button variant="primary" onClick={() => open({ kind: "account" })}>
            <Plus size={18} /> Crear cuenta
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {db.accounts.map((a) => {
        const balance = accountBalance(a, db.transactions);
        const count = db.transactions.filter((t) => t.account_id === a.id || t.to_account_id === a.id).length;
        const bank = detectStoreInText(a.name);
        return (
          <Card key={a.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              {bank ? <StoreLogo store={bank} size={40} /> : null}
              <div className="mr-auto min-w-0">
                <p className="truncate text-[16px] font-semibold">{a.name}</p>
                <p className="text-[12.5px] text-muted">{accountTypeLabel(a.type)}</p>
              </div>
              <RowActions
                label={a.name}
                onEdit={() => open({ kind: "account", record: a })}
                onDelete={() =>
                  del(
                    "accounts",
                    a.id,
                    `¿Eliminar la cuenta ${a.name}?`,
                    count ? `También se eliminarán sus ${count} movimientos.` : undefined,
                  )
                }
              />
            </div>
            <p className={cn("num mt-6 text-[30px] font-semibold leading-none", balance < 0 && "text-warn")}>{formatCOP(balance)}</p>
            <p className="mt-2 text-[12px] text-dim">
              Saldo inicial {formatCOP(a.initial_balance)} · {count} movimientos
            </p>
            <div className="mt-5 flex gap-2">
              <Button size="sm" onClick={() => open({ kind: "transaction", defaults: { account_id: a.id } })}>
                <Plus size={14} /> Movimiento
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={db.accounts.length < 2}
                title={db.accounts.length < 2 ? "Necesitas al menos dos cuentas" : undefined}
                onClick={() => open({ kind: "transaction", defaults: { type: "transferencia", account_id: a.id } })}
              >
                <ArrowLeftRight size={14} /> Transferir
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ───────── Ahorros ───────── */
function Savings() {
  const { db } = useData();
  const open = useForms();
  const del = useDeleteRecord();
  const today = useToday();

  if (db.savings_goals.length === 0) {
    return (
      <EmptyState
        icon={<PiggyBank size={22} />}
        title="Sin objetivos de ahorro"
        description="Define cuánto quieres ahorrar y para cuándo."
        action={
          <Button variant="primary" onClick={() => open({ kind: "savings" })}>
            <Plus size={18} /> Crear objetivo
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => open({ kind: "savings" })}>
          <Plus size={18} /> Nuevo objetivo
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {db.savings_goals.map((g) => {
          const p = pct(g.current_amount, g.target_amount);
          return (
            <Card key={g.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold">{g.name}</p>
                  <p className="text-[12.5px] text-muted">
                    {g.target_date ? `Meta: ${relativeDay(g.target_date, today)}` : "Sin fecha"} · Prioridad {g.priority}
                  </p>
                </div>
                <RowActions
                  label={g.name}
                  onEdit={() => open({ kind: "savings", record: g })}
                  onDelete={() => del("savings_goals", g.id, `¿Eliminar ${g.name}?`)}
                />
              </div>
              <div className="mt-6 flex items-end justify-between gap-2">
                <p className="num text-[26px] font-semibold leading-none">{formatCOP(g.current_amount)}</p>
                <p className="num text-[13px] font-medium text-brand-soft">{Math.round(p)} %</p>
              </div>
              <Progress value={p} className="mt-3 h-2" label={`Progreso de ${g.name}`} />
              <p className="mt-2 text-[12px] text-dim">
                Faltan {formatCOP(Math.max(0, g.target_amount - g.current_amount))} de {formatCOP(g.target_amount)}
              </p>
              <Button size="sm" variant="primary" className="mt-5 self-start" onClick={() => open({ kind: "deposit", record: g })}>
                <PiggyBank size={14} /> Abonar / retirar
              </Button>
            </Card>
          );
        })}
      </div>
    </>
  );
}
