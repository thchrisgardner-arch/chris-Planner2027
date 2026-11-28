"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, CalendarClock, CarFront, CreditCard, Dices, Dumbbell, Ellipsis, FolderInput, HandHeart, HeartPulse, House, Popcorn, Smartphone, Utensils, Pencil, PiggyBank, Plus, Repeat, Search, Shapes, ShoppingBag, Tag, Trash2, Unlink, Upload, Users, Zap, type LucideIcon } from "lucide-react";
import { Deslizable } from "@/components/ui/Deslizable";
import { completarPendiente } from "@/lib/finanzas/pagosFijos";
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
import type { SavingsGoal, Transaction } from "@/types/db";
import { CAJA_META, ImagenMeta, PlanAporteForm, PlanEnTarjeta, sembrarAportesDemo } from "./MetasAhorro";
import { endOfMonth, formatShortDate, monthKey, monthLabel, addMonths, relativeDay } from "@/utils/dates";
import { formatCOP, formatKpiCOP, pct, sum } from "@/utils/money";
import { cn } from "@/utils/cn";
import { StoreLogo } from "@/components/ui/StoreLogo";
import { detectStoreInText } from "@/modules/other/stores";
import { ActivityCard as ActivityWidget } from "@/modules/dashboard/DashboardWidgets";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, accountTypeLabel } from "./constants";
import { Deudas } from "./DeudasTab";
import { PagosFijos } from "./PagosFijosTab";
import { ImportarExtracto } from "./ImportarExtracto";
import { MenuExportar } from "@/components/ui/MenuExportar";
import { documentoMovimientos } from "@/lib/exportar/datos";
import { mesTexto, proyeccionMeta } from "@/lib/finanzas/proyeccionMeta";
import { EnQueSeVa } from "./EnQueSeVa";
import { PreguntaCentavo } from "./PreguntaCentavo";
import { Presupuestos } from "./Presupuestos";
import { AsignarProyecto } from "./AsignarProyecto";
import { accountBalance, avisoBorrarCuenta, expensesByBeneficiary, expensesByCategory, monthTotals, totalBalance } from "./selectors";

type Tab = "resumen" | "movimientos" | "cuentas" | "ahorros" | "deudas" | "fijos" | "ingresos-fijos";

const TABS: { value: Tab; label: string }[] = [
  { value: "resumen", label: "Resumen" },
  { value: "movimientos", label: "Movimientos" },
  { value: "cuentas", label: "Cuentas" },
  { value: "ahorros", label: "Ahorros" },
  { value: "deudas", label: "Deudas" },
  { value: "fijos", label: "Gastos fijos" },
  { value: "ingresos-fijos", label: "Ingresos fijos" },
];

export function FinancePage() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("tab") as Tab | null;
  const tab: Tab = raw && TABS.some((t) => t.value === raw) ? raw : "resumen";
  const open = useForms();


  return (
    <>
      <PageHeader title="Finanzas" subtitle="Ingresos, gastos, cuentas, ahorros y deudas." asistente={<AsistenteModulo id="centavo" />} />
      {/* Pestañas y «Nuevo movimiento» en la misma fila; si no caben, el botón baja y sigue a la derecha (en celular es el «+» flotante) */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="-mx-4 min-w-0 max-w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:max-w-full sm:px-0 sin-barra">
          <Segmented size="md" label="Secciones de finanzas" value={tab} onChange={(v) => router.replace(`/finanzas?tab=${v}`, { scroll: false })} options={TABS} desplazable />
        </div>
        <Button variant="primary" className="ml-auto shrink-0 max-md:hidden" onClick={() => open({ kind: "transaction" })}>
          <Plus size={18} /> Nuevo movimiento
        </Button>
      </div>
      {tab === "resumen" && <Summary />}
      {tab === "movimientos" && <Movements />}
      {tab === "cuentas" && <Accounts />}
      {tab === "ahorros" && <Savings />}
      {tab === "deudas" && <Deudas />}
      {tab === "fijos" && <PagosFijos />}
      {tab === "ingresos-fijos" && <PagosFijos mov="ingreso" />}
    </>
  );
}

/* ───────── Resumen ───────── */
export function Kpi({ label, value, hint, inverse }: { label: string; value: number; hint?: string; inverse?: boolean }) {
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
  // Categoría elegida en el gráfico: filtra «¿En qué se va tu plata?»
  const [categoria, setCategoria] = useState<string | null>(null);
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
        <Presupuestos className="md:col-span-2 xl:col-span-12" />
        <PreguntaCentavo className="md:col-span-2 xl:col-span-12" />
        <ActivityWidget className="md:col-span-2 xl:col-span-7" />
        <TarjetaGastosCategoria className="xl:col-span-5" items={byCat} total={m.expense} subtitle={monthLabel(key)} onElegir={setCategoria} elegida={categoria} />
        <EnQueSeVa className="md:col-span-2 xl:col-span-12" categoria={categoria} onQuitarCategoria={() => setCategoria(null)} />
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

/** Ícono de cada categoría de gasto (las nuevas usan la etiqueta) */
const ICONO_CATEGORIA: Record<string, LucideIcon> = {
  Vivienda: House,
  Servicios: Zap,
  Alimentación: Utensils,
  Transporte: CarFront,
  Salud: HeartPulse,
  Gimnasio: Dumbbell,
  Entretenimiento: Popcorn,
  Apuestas: Dices,
  "Compras personales": ShoppingBag,
  Tecnología: Smartphone,
  Suscripciones: Repeat,
  Familia: Users,
  "Ayuda a otras personas": HandHeart,
  Deudas: CreditCard,
  Otros: Shapes,
};

/** Paleta de la app (verde marca, negro y grises) en orden fijo; el resto se agrupa en «Otras categorías» */
const SERIES = [1, 2, 3, 4, 5].map((n) => ({ color: `var(--serie-${n})`, tinta: `var(--tinta-${n})` }));
const OTRAS = { color: "var(--serie-otras)", tinta: "var(--tinta-otras)" };

interface Parte {
  name: string;
  value: number;
  color: string;
  /** Color del ícono encima del color de la serie */
  tinta: string;
  icono: LucideIcon;
  /** Categorías que agrupa (una sola si no es «Otras categorías») */
  categorias: string[];
}

function partesDona(items: { name: string; value: number }[]): Parte[] {
  const conValor = items.filter((c) => c.value > 0);
  const visibles = conValor.slice(0, 5);
  const partes: Parte[] = visibles.map((c, i) => ({
    name: c.name,
    value: c.value,
    ...SERIES[i],
    icono: ICONO_CATEGORIA[c.name] ?? Tag,
    categorias: [c.name],
  }));
  const resto = conValor.slice(visibles.length);
  if (resto.length === 1) partes.push({ name: resto[0].name, value: resto[0].value, ...OTRAS, icono: ICONO_CATEGORIA[resto[0].name] ?? Tag, categorias: [resto[0].name] });
  else if (resto.length > 1)
    partes.push({ name: "Otras categorías", value: sum(resto.map((c) => c.value)), ...OTRAS, icono: Ellipsis, categorias: resto.map((c) => c.name) });
  return partes;
}

/** Gastos por categoría en dona: el resumen de Finanzas y el panel Dinero de cada proyecto */
export function TarjetaGastosCategoria({
  items,
  total,
  subtitle,
  className,
  vacio = "Aquí verás en qué se va tu plata cuando registres gastos.",
  onElegir,
  elegida,
}: {
  items: { name: string; value: number }[];
  total: number;
  subtitle: string;
  className?: string;
  vacio?: string;
  /** Tocar una categoría (filtra «¿En qué se va tu plata?») */
  onElegir?: (categoria: string | null) => void;
  elegida?: string | null;
}) {
  const partes = useMemo(() => partesDona(items), [items]);
  const [activa, setActiva] = useState<number | null>(null);
  const base = total > 0 ? total : sum(partes.map((p) => p.value));
  const indiceElegida = elegida ? partes.findIndex((p) => p.categorias.includes(elegida)) : -1;
  // Al pasar el mouse manda la parte señalada; si no, la elegida (filtro); si no, el total
  const foco = activa ?? (indiceElegida >= 0 ? indiceElegida : null);
  const elegir = (p: Parte) => {
    if (!onElegir || p.categorias.length !== 1) return;
    onElegir(elegida === p.name ? null : p.name);
  };

  return (
    <Card className={className}>
      <CardHeader title="Gastos por categoría" subtitle={subtitle} />
      {partes.length === 0 ? (
        <div>
          <GhostBars />
          <p className="mt-4 text-[13px] text-muted">{vacio}</p>
        </div>
      ) : (
        <div className="@container"><div className="grid items-center justify-items-center gap-5 @[340px]:grid-cols-[auto_minmax(0,1fr)] @[340px]:justify-items-stretch">
          <Dona partes={partes} base={base} foco={foco} elegida={indiceElegida} clicable={!!onElegir} onActiva={setActiva} onElegir={elegir} />
          <ul className="flex w-full flex-col gap-0.5" aria-label="Categorías">
            {partes.map((p, i) => {
              const Icono = p.icono;
              const clicable = !!onElegir && p.categorias.length === 1;
              const porcentaje = Math.round(pct(p.value, base));
              const contenido = (
                <>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: p.color, color: p.tinta }} aria-hidden>
                    <Icono size={15} strokeWidth={2.25} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] leading-snug text-fg [overflow-wrap:anywhere]">{p.name}</span>
                    <span className="num block text-[12px] text-muted">{formatCOP(p.value)}</span>
                  </span>
                  <span className="num shrink-0 text-[14px] text-fg">{porcentaje} %</span>
                </>
              );
              const fila = cn(
                "flex w-full items-center gap-2.5 rounded-[12px] px-2 py-1 text-left transition-[opacity,background-color] duration-200",
                foco === i && "bg-bg-2",
                indiceElegida >= 0 && indiceElegida !== i && "opacity-50",
              );
              return (
                <li key={p.name} onMouseEnter={() => setActiva(i)} onMouseLeave={() => setActiva(null)}>
                  {clicable ? (
                    <button
                      type="button"
                      aria-pressed={elegida === p.name}
                      aria-label={`${p.name}: ${formatCOP(p.value)}, ${porcentaje} %. Ver en qué se va`}
                      onClick={() => elegir(p)}
                      onFocus={() => setActiva(i)}
                      onBlur={() => setActiva(null)}
                      className={cn(fila, "focus-ring cursor-pointer")}
                    >
                      {contenido}
                    </button>
                  ) : (
                    <div className={fila} title={p.categorias.length > 1 ? p.categorias.join(", ") : undefined}>
                      {contenido}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div></div>
      )}
    </Card>
  );
}

/** Dona en SVG: segmentos separados ≈2px; en el centro, el total o la parte señalada */
function Dona({
  partes,
  base,
  foco,
  elegida,
  clicable,
  onActiva,
  onElegir,
}: {
  partes: Parte[];
  base: number;
  foco: number | null;
  elegida: number;
  clicable: boolean;
  onActiva: (i: number | null) => void;
  onElegir: (p: Parte) => void;
}) {
  const R = 78;
  const GROSOR = 24;
  const C = 2 * Math.PI * R;
  const HUECO = partes.length > 1 ? 1.8 : 0; // ≈2px con la dona a 232–260px
  const totalPartes = sum(partes.map((p) => p.value)) || 1;
  const largos = partes.map((p) => (p.value / totalPartes) * C);
  const segmentos = partes.map((p, i) => ({
    p,
    desde: sum(largos.slice(0, i)),
    largo: Math.max(0.5, largos[i] - HUECO),
  }));
  const enFoco = foco !== null ? partes[foco] : null;
  // Etiqueta que sigue al cursor sobre cada color
  const [cursor, setCursor] = useState<{ i: number; x: number; y: number } | null>(null);
  const mover = (i: number, e: React.MouseEvent<SVGCircleElement>) => {
    const caja = e.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (caja) setCursor({ i, x: e.clientX - caja.left, y: e.clientY - caja.top });
  };
  const señalada = cursor ? partes[cursor.i] : null;

  return (
    <div className="relative h-[204px] w-[204px] shrink-0 @[340px]:h-[172px] @[340px]:w-[172px] @[460px]:h-[208px] @[460px]:w-[208px] @[600px]:h-[240px] @[600px]:w-[240px]">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90 overflow-visible" role="img" aria-label={`Gastos por categoría, total ${formatCOP(base)}`}>
        {segmentos.map(({ p, desde, largo }, i) => (
          <circle
            key={p.name}
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={p.color}
            strokeWidth={foco === i ? GROSOR + 6 : GROSOR}
            strokeDasharray={`${largo} ${C - largo}`}
            strokeDashoffset={-desde}
            className={cn(
              "transition-[stroke-width,opacity] duration-200",
              clicable && p.categorias.length === 1 && "cursor-pointer",
              elegida >= 0 && elegida !== i && foco !== i && "opacity-35",
            )}
            onMouseEnter={(e) => {
              onActiva(i);
              mover(i, e);
            }}
            onMouseMove={(e) => mover(i, e)}
            onMouseLeave={() => {
              onActiva(null);
              setCursor(null);
            }}
            onClick={() => onElegir(p)}
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div className="max-w-[60%]">
          <p className="line-clamp-2 text-[13px] leading-snug text-muted">{enFoco ? enFoco.name : "Total"}</p>
          <p className="figure text-[24px] leading-tight text-fg @[340px]:text-[20px] @[460px]:text-[24px] @[600px]:text-[28px]">{formatKpiCOP(enFoco ? enFoco.value : base)}</p>
          <p className="num text-[12px] text-muted">{enFoco ? `${Math.round(pct(enFoco.value, base))} %` : formatCOP(base)}</p>
        </div>
      </div>
      {señalada && cursor ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 w-max max-w-[220px] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-[14px] bg-fg px-3 py-2 text-on-fg shadow-lg"
          style={{ left: cursor.x, top: cursor.y }}
        >
          <p className="flex items-center gap-2 text-[13px] font-medium">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-on-fg/30" style={{ background: señalada.color }} aria-hidden />
            {señalada.name}
          </p>
          <p className="num mt-0.5 text-[12px] opacity-70">
            {formatCOP(señalada.value)} · {Math.round(pct(señalada.value, base))} %
          </p>
          {señalada.categorias.length > 1 ? <p className="mt-1 text-[11.5px] opacity-70">{señalada.categorias.join(", ")}</p> : null}
        </div>
      ) : null}
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
function Movements() {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [month, setMonth] = useState("");
  const [sort, setSort] = useState<SortKey>("recientes");
  const [importar, setImportar] = useState(false);
  // Movimientos elegidos para «Asignar a proyecto» (null = cerrado)
  const [asignar, setAsignar] = useState<string[] | null>(null);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => addMonths(monthKey(today), -i)), [today]);
  const importador = importar ? <ImportarExtracto onClose={() => setImportar(false)} /> : null;

  const rows = useMemo(
    () =>
      db.transactions
        .filter((t) => (!q || t.description.toLowerCase().includes(q.toLowerCase())) && (!type || t.type === type) && (!category || t.category === category) && (!month || t.date.startsWith(month)))
        .sort(SORTERS[sort]),
    [db.transactions, q, type, category, month, sort],
  );

  // Lo que se exporta es lo que se ve: con los filtros y el orden puestos
  const filtrosTexto = [q && `búsqueda «${q}»`, type && { ingreso: "ingresos", gasto: "gastos", transferencia: "transferencias" }[type], category, month && monthLabel(month)].filter(Boolean).join(", ");

  const customCats = db.transaction_categories.map((c) => c.name);
  const allCats = [...new Set([...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES, ...customCats])];

  if (db.transactions.length === 0) {
    return (
      <>
        <EmptyState
          title="Aún no registras movimientos"
          description={db.accounts.length ? "Registra ingresos, gastos o transferencias entre tus cuentas, o importa el extracto de tu banco." : "Primero agrega una cuenta."}
          action={
            db.accounts.length ? (
              <Button onClick={() => setImportar(true)}>
                <Upload size={18} /> Importar extracto
              </Button>
            ) : (
              <Button onClick={() => open({ kind: "account" })}>
                <Plus size={18} /> Agregar cuenta
              </Button>
            )
          }
        />
        {importador}
      </>
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
        <div className="flex gap-2">
          <Button onClick={() => setImportar(true)} className="flex-1 lg:flex-none">
            <Upload size={18} /> Importar
          </Button>
          <div className="flex-1 lg:flex-none [&>div]:w-full">
            <MenuExportar
              className="w-full"
              alinear="end"
              archivo="movimientos"
              vacio="No hay movimientos para exportar con estos filtros."
              crear={() => documentoMovimientos(rows, db, today, filtrosTexto)}
            />
          </div>
        </div>
      </div>
      {importador}
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[12px] text-dim">{rows.length} movimientos</p>
        {db.projects.length ? (
          <button type="button" onClick={() => setAsignar([])} className="focus-ring cursor-pointer rounded-full px-1 text-[12.5px] font-medium text-muted hover:text-fg">
            Asignar a proyecto
          </button>
        ) : null}
      </div>
      {asignar ? <AsignarProyecto filas={rows} preseleccion={asignar} onClose={() => setAsignar(null)} /> : null}
      {rows.length === 0 ? (
        <EmptyState compact icon={<Search size={20} />} title="Sin resultados" description="Prueba con otros filtros." />
      ) : (
        <ListaMovimientos rows={rows} onAsignar={db.projects.length ? (t) => setAsignar([t.id]) : undefined} />
      )}
    </Card>
  );
}

/**
 * Lista de movimientos (la de Finanzas). El panel Dinero de un proyecto la usa filtrada y con
 * «Quitar del proyecto»; en Finanzas, deslizar ofrece «Proyecto» para asignarlo.
 */
export function ListaMovimientos({ rows, onQuitar, onAsignar }: { rows: Transaction[]; onQuitar?: (t: Transaction) => void; onAsignar?: (t: Transaction) => void }) {
  const { db, insert, remove } = useData();
  const open = useForms();
  const del = useDeleteRecord();
  const { toast } = useFeedback();
  const today = useToday();
  const accountName = (id: string | null) => (id ? db.accounts.find((a) => a.id === id)?.name ?? "—" : "");
  return (
    <ul className="divide-y divide-line">
      {rows.map((t) => {
        const sign = t.type === "ingreso" ? "+" : t.type === "gasto" ? "−" : "";
        const shop = t.type === "transferencia" ? undefined : detectStoreInText(t.description);
        return (
          <li key={t.id}>
            <Deslizable
              acciones={[
                { label: "Editar", icono: <Pencil size={18} />, onAccion: () => open({ kind: "transaction", record: t }) },
                ...(onQuitar ? [{ label: "Quitar", icono: <Unlink size={18} />, onAccion: () => onQuitar(t) }] : onAsignar ? [{ label: "Proyecto", icono: <FolderInput size={18} />, onAccion: () => onAsignar(t) }] : []),
                {
                  label: "Borrar",
                  icono: <Trash2 size={18} />,
                  tono: "peligro",
                  onAccion: () => del("transactions", t.id, "¿Eliminar este movimiento?", `${t.description} · ${formatCOP(t.amount)}`),
                },
              ]}
            >
            <div className="flex items-center gap-3 py-3">
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
                  await completarPendiente(t, { insert, remove });
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
            {onQuitar ? (
              <Button size="icon-sm" variant="ghost" onClick={() => onQuitar(t)} aria-label={`Quitar ${t.description} del proyecto`} title="Quitar del proyecto">
                <Unlink size={16} />
              </Button>
            ) : null}
            <RowActions
              label={t.description}
              onEdit={() => open({ kind: "transaction", record: t })}
              onDelete={() => del("transactions", t.id, "¿Eliminar este movimiento?", `${t.description} · ${formatCOP(t.amount)}`)}
            />
            </div>
            </Deslizable>
          </li>
        );
      })}
    </ul>
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
/** Meta sin plan: cuándo llega al ritmo real, cuánto la adelanta un extra y cuánto hace falta para su fecha */
function ProyeccionEnTarjeta({ meta, hoy }: { meta: SavingsGoal; hoy: string }) {
  const p = proyeccionMeta(meta, hoy);
  if (!p) return null;
  return (
    <div className={CAJA_META}>
      {p.llega ? (
        <p>
          A tu ritmo (~{formatCOP(Math.round(p.ritmo / 1000) * 1000)} al mes) llega en <span className="font-medium">{mesTexto(p.llega)}</span>
          {p.aTiempo === false ? <span className="text-danger">, después de su fecha</span> : p.aTiempo ? ", a tiempo" : ""}.
        </p>
      ) : (
        <p>
          {p.reciente
            ? "Meta nueva: en unas semanas te digo a qué ritmo vas y cuándo llega."
            : p.ritmo > 0
              ? "A tu ritmo actual tardaría más de 10 años."
              : "Aún no tiene ahorro: con el primer aporte te digo cuándo llega."}
        </p>
      )}
      {p.llegaConExtra ? (
        <p className="text-muted">
          Con {formatCOP(p.extra)} más al mes, en {mesTexto(p.llegaConExtra)}.
        </p>
      ) : null}
      {p.necesarioAlMes !== null && p.aTiempo !== true ? (
        <p className="text-muted">
          Para llegar en {mesTexto(monthKey(meta.target_date!))} necesitas {formatCOP(p.necesarioAlMes)} al mes.
        </p>
      ) : null}
    </div>
  );
}

function Savings() {
  const { db } = useData();
  const open = useForms();
  const del = useDeleteRecord();
  const today = useToday();
  // Meta cuyo plan de aporte se está editando
  const [planDe, setPlanDe] = useState<SavingsGoal | null>(null);
  const { mode } = useData();
  useEffect(() => {
    if (mode === "demo" && today) sembrarAportesDemo(db.savings_goals, today);
  }, [mode, today, db.savings_goals]);

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
                <ImagenMeta meta={g} />
                <div className="mr-auto min-w-0">
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
              {/* Un solo recuadro de información (proyección o plan) y, abajo, los botones alineados entre tarjetas */}
              {!g.plan && today ? <ProyeccionEnTarjeta meta={g} hoy={today} /> : null}
              <PlanEnTarjeta meta={g} />
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Button size="sm" variant="secondary" className="bg-bg-2" onClick={() => open({ kind: "deposit", record: g })}>
                  <PiggyBank size={14} /> Abonar / retirar
                </Button>
                {g.current_amount < g.target_amount ? (
                  <Button size="sm" variant="ghost" onClick={() => setPlanDe(g)}>
                    <CalendarClock size={14} /> {g.plan ? "Editar plan" : "Plan de aporte"}
                  </Button>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>
      {planDe ? <PlanAporteForm meta={db.savings_goals.find((x) => x.id === planDe.id) ?? planDe} onClose={() => setPlanDe(null)} /> : null}
    </>
  );
}
