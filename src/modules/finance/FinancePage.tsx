"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, Download, PiggyBank, Plus, Search } from "lucide-react";
import { AsistenteModulo } from "@/modules/asistentes/Presencia";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Badge, EmptyState, GhostBars } from "@/components/ui/misc";
import { RowActions, useDeleteRecord } from "@/components/ui/RowActions";
import { Segmented } from "@/components/ui/misc";
import { useForms } from "@/components/providers/FormsProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import type { Transaction } from "@/types/db";
import { endOfMonth, formatShortDate, monthKey, monthLabel, addMonths, relativeDay } from "@/utils/dates";
import { formatCOP, formatKpiCOP, pct, sum } from "@/utils/money";
import { cn } from "@/utils/cn";
import { StoreLogo } from "@/components/ui/StoreLogo";
import { detectStoreInText } from "@/modules/other/stores";
import { ActivityCard as ActivityWidget } from "@/modules/dashboard/DashboardWidgets";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, accountTypeLabel } from "./constants";
import { Deudas } from "./DeudasTab";
import { accountBalance, avisoBorrarCuenta, expensesByBeneficiary, expensesByCategory, monthTotals, totalBalance } from "./selectors";

type Tab = "resumen" | "movimientos" | "cuentas" | "ahorros" | "deudas";

const TABS: { value: Tab; label: string }[] = [
  { value: "resumen", label: "Resumen" },
  { value: "movimientos", label: "Movimientos" },
  { value: "cuentas", label: "Cuentas" },
  { value: "ahorros", label: "Ahorros" },
  { value: "deudas", label: "Deudas" },
];

export function FinancePage() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("tab") as Tab | null;
  const tab: Tab = raw && TABS.some((t) => t.value === raw) ? raw : "resumen";
  const open = useForms();


  return (
    <>
      <PageHeader title="Finanzas" subtitle="Ingresos, gastos, cuentas, ahorros y deudas." asistente={<AsistenteModulo id="centavo" />}>
        <Button variant="primary" className="max-md:hidden" onClick={() => open({ kind: "transaction" })}>
          <Plus size={18} /> Nuevo movimiento
        </Button>
      </PageHeader>
      <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented size="md" label="Secciones de finanzas" value={tab} onChange={(v) => router.replace(`/finanzas?tab=${v}`, { scroll: false })} options={TABS} />
      </div>
      {tab === "resumen" && <Summary />}
      {tab === "movimientos" && <Movements />}
      {tab === "cuentas" && <Accounts />}
      {tab === "ahorros" && <Savings />}
      {tab === "deudas" && <Deudas />}
      <p className="mt-8 text-center text-[13px] text-dim">Próximamente: presupuestos y análisis.</p>
    </>
  );
}

/* ───────── Resumen ───────── */
function Kpi({ label, value, hint, inverse }: { label: string; value: number; hint?: string; inverse?: boolean }) {
  return (
    <Card variant={inverse ? "inverse" : "default"} className="flex min-h-[140px] flex-col">
      <h2 className={cn("text-[14px]", inverse ? "text-on-fg" : "text-fg")}>{label}</h2>
      <p className={cn("figure mt-auto whitespace-nowrap pt-5 text-[28px] min-[400px]:text-[32px] sm:text-[48px]", inverse ? "text-on-fg" : value === 0 ? "text-dim" : "text-fg")} title={formatCOP(value)}>
        {formatKpiCOP(value)}
      </p>
      {hint ? <p className={cn("mt-1.5 text-[12.5px]", inverse ? "text-on-fg/60" : "text-muted")}>{hint}</p> : null}
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
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi inverse label="Dinero disponible" value={available} hint={cardDebt ? "Todas las cuentas, ya restada la deuda de tarjetas" : "Todas las cuentas"} />
        <Kpi label="Ingresos del mes" value={m.income} hint={monthLabel(key)} />
        <Kpi label="Gastos del mes" value={m.expense} hint={monthLabel(key)} />
        <Kpi label="Balance neto" value={m.net} hint="Ingresos − gastos" />
        <Kpi label="Ahorro acumulado" value={saved} hint="En tus metas (parte de tu dinero)" />
        <Kpi label="Deuda en tarjetas" value={Math.abs(cardDebt)} hint="Saldo negativo de tarjetas" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
        <ActivityWidget className="md:col-span-2 xl:col-span-7" />
        <Card className="xl:col-span-5">
          <CardHeader title="Gastos por categoría" subtitle={monthLabel(key)} />
          {byCat.length === 0 ? (
            <div>
              <GhostBars />
              <p className="mt-4 text-[13px] text-muted">Aquí verás en qué se va tu plata cuando registres gastos.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {byCat.slice(0, 7).map((c, i) => (
                <li key={c.name}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span className="truncate text-fg">{c.name}</span>
                    <span className="num shrink-0 text-muted">
                      {formatCOP(c.value)} <span className="text-dim">· {Math.round(pct(c.value, m.expense))} %</span>
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-elev">
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-500", i === 0 ? "bg-brand" : "bg-line-strong")}
                      style={{ width: `${Math.max(4, pct(c.value, byCat[0].value))}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="md:col-span-2 xl:col-span-12">
          <CardHeader title="¿Para quién fue el gasto?" subtitle="Distribución del mes, solo informativa" />
          {benTotal === 0 ? (
            <EmptyState title="Sin gastos clasificados este mes" />
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-elev">
                {[
                  { v: byBen.para_mi, c: "var(--color-fg)" },
                  { v: byBen.otras_personas, c: "var(--color-muted)" },
                  { v: byBen.compartido, c: "var(--color-line-strong)" },
                  { v: byBen.sin_clasificar, c: "var(--color-elev)" },
                ].map((s, i) => (
                  <div key={i} style={{ width: `${pct(s.v, benTotal)}%`, background: s.c }} className="h-full transition-[width] duration-500" />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { k: "Para mí", v: byBen.para_mi, c: "var(--color-fg)" },
                  { k: "Para otras personas", v: byBen.otras_personas, c: "var(--color-muted)" },
                  { k: "Compartido", v: byBen.compartido, c: "var(--color-line-strong)" },
                  { k: "Sin clasificar", v: byBen.sin_clasificar, c: "var(--color-elev)" },
                ].map((s) => (
                  <div key={s.k} className="rounded-[22px] bg-bg-2 px-4 py-3">
                    <p className="label flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.c }} /> {s.k}
                    </p>
                    <p className={cn("figure mt-2 text-[32px]", s.v === 0 && "text-dim")}>{formatKpiCOP(s.v)}</p>
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
  const { db, update } = useData();
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
        title="Aún no registras movimientos"
        description={db.accounts.length ? "Registra ingresos, gastos o transferencias entre tus cuentas." : "Primero agrega una cuenta."}
        action={
          db.accounts.length ? undefined : (
            <Button onClick={() => open({ kind: "account" })}>
              <Plus size={18} /> Agregar cuenta
            </Button>
          )
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
                {t.status === "pendiente" ? (
                  // Los pendientes no suman al saldo: se dice y se pueden completar con un toque
                  <button
                    type="button"
                    title="Aún no suma a tus saldos. Toca para marcarlo como completado."
                    aria-label={`${t.description}: pendiente, aún no suma a tus saldos. Marcar como completado`}
                    onClick={async () => {
                      await update("transactions", t.id, { status: "completado" });
                      toast("Movimiento completado: ya suma a tus saldos.");
                    }}
                    className="focus-ring shrink-0 cursor-pointer rounded-full"
                  >
                    <Badge tone="warn">Pendiente · completar</Badge>
                  </button>
                ) : null}
                <p
                  className={cn(
                    "num shrink-0 text-right text-[14.5px] font-medium",
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
        title="Agrega tu primera cuenta"
        description="Banco, efectivo, billetera digital, ahorros o tarjeta de crédito."
        action={
          <Button onClick={() => open({ kind: "account" })}>
            <Plus size={18} /> Agregar cuenta
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {db.accounts.map((a) => {
        const balance = accountBalance(a, db.transactions);
        const count = db.transactions.filter((t) => t.account_id === a.id || t.to_account_id === a.id).length;
        const bank = detectStoreInText(a.name);
        return (
          <Card key={a.id} className="flex flex-col">
            <div className="flex items-start justify-between gap-2">
              {bank ? <StoreLogo store={bank} size={40} /> : null}
              <div className="mr-auto min-w-0">
                <p className="truncate text-[16px] font-medium">{a.name}</p>
                <p className="text-[12.5px] text-muted">{accountTypeLabel(a.type)}</p>
              </div>
              <RowActions
                label={a.name}
                onEdit={() => open({ kind: "account", record: a })}
                onDelete={() => del("accounts", a.id, `¿Eliminar la cuenta ${a.name}?`, avisoBorrarCuenta(a, db.accounts, db.transactions))}
              />
            </div>
            <p className={cn("figure mt-8 text-[38px]", balance < 0 ? "text-danger" : balance === 0 ? "text-dim" : "text-fg")}>{formatCOP(balance)}</p>
            <p className="mt-2 text-[12px] text-dim">
              Saldo inicial {formatCOP(a.initial_balance)} · {count} {count === 1 ? "movimiento" : "movimientos"}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" className="bg-bg-2" onClick={() => open({ kind: "transaction", defaults: { account_id: a.id } })}>
                <Plus size={14} /> Movimiento
              </Button>
              {db.accounts.length < 2 ? (
                // Un botón deshabilitado no explica nada en el celular: se dice en texto
                <span className="text-[12.5px] text-muted">Agrega otra cuenta para transferir</span>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => open({ kind: "transaction", defaults: { type: "transferencia", account_id: a.id } })}
                >
                  <ArrowLeftRight size={14} /> Transferir
                </Button>
              )}
            </div>
          </Card>
        );
      })}
      <button
        type="button"
        onClick={() => open({ kind: "account" })}
        className="focus-ring flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-line-strong text-[14px] font-medium text-muted transition-colors hover:bg-card hover:text-fg"
      >
        <Plus size={22} /> Agregar cuenta
      </button>
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
        title="Sin objetivos de ahorro"
        description="Define cuánto quieres ahorrar y para cuándo."
        action={
          <Button onClick={() => open({ kind: "savings" })}>
            <Plus size={18} /> Crear objetivo
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button variant="ghost" onClick={() => open({ kind: "savings" })}>
          <Plus size={18} /> Nuevo objetivo
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {db.savings_goals.map((g) => {
          const p = pct(g.current_amount, g.target_amount);
          return (
            <Card key={g.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-medium">{g.name}</p>
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
              <div className="mt-8 flex items-end justify-between gap-2">
                <p className={cn("figure text-[52px]", p === 0 && "text-dim")}>
                  {Math.round(p)}
                  <span className="text-[24px] text-muted"> %</span>
                </p>
                <p className="num pb-2 text-[14px] text-fg">{formatCOP(g.current_amount)}</p>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-bg-2" role="progressbar" aria-label={`Progreso de ${g.name}`} aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
                <div className={cn("h-full rounded-full", p >= 100 ? "bg-brand" : "bg-fg")} style={{ width: `${Math.min(100, p)}%` }} />
              </div>
              <p className="mt-2 text-[12px] text-dim">
                Faltan {formatCOP(Math.max(0, g.target_amount - g.current_amount))} de {formatCOP(g.target_amount)}
              </p>
              <Button size="sm" variant="secondary" className="mt-5 self-start bg-bg-2" onClick={() => open({ kind: "deposit", record: g })}>
                <PiggyBank size={14} /> Abonar / retirar
              </Button>
            </Card>
          );
        })}
      </div>
    </>
  );
}
