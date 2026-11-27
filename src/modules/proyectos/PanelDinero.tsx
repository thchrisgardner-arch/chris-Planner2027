"use client";

/**
 * Panel «Dinero» del proyecto: cuánto cuesta, cuánto deja y si va dentro del presupuesto, con los
 * MISMOS movimientos de Finanzas (los que tienen project_id). El presupuesto es informativo: no
 * separa ni bloquea dinero de ninguna cuenta. Reutiliza las tarjetas, el gráfico y la lista de Finanzas.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "@/components/Enlace";
import { ArrowUpRight, Flag, Minus, Plus, Settings2, Wallet } from "lucide-react";
import { Asistente } from "@/components/asistentes/Asistente";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ChoiceGroup, Field, Select } from "@/components/ui/Field";
import { AmountInput, FormModal } from "@/components/ui/FormModal";
import { EmptyCard } from "@/components/ui/misc";
import { Switch } from "@/components/ui/Switch";
import { useForms } from "@/components/providers/FormsProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { registrarNuevo } from "@/lib/atajoNuevo";
import {
  OPCIONES_ALERTA,
  MIN_HORAS_VALOR,
  cambioDinero,
  deProyecto,
  dineroDe,
  gastosPorCategoria,
  porcentaje,
  proyeccion,
  resumenDinero,
  valorPorHora,
  type PeriodoPresupuesto,
} from "@/lib/proyectos/dinero";
import type { Project, Transaction } from "@/types/db";
import { addMonths, monthKey, monthLabel } from "@/utils/dates";
import { formatAmountInput, formatCOP, parseCOP, pct } from "@/utils/money";
import { cn } from "@/utils/cn";
import { Kpi, ListaMovimientos, TarjetaGastosCategoria } from "@/modules/finance/FinancePage";
import { useHorasEnfoque } from "@/modules/enfoque/ModoEnfoque";
import { Seccion } from "./Seccion";
import { CierreProyecto } from "./CierreProyecto";

const byDateDesc = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);

/** Abre el presupuesto desde el aviso de Centavo («Ajustar presupuesto») */
const pideAjustar = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("ajustar") === "1";

export function PanelDinero({ proyecto: p }: { proyecto: Project }) {
  const { db, update } = useData();
  const open = useForms();
  const { toast } = useFeedback();
  const today = useToday();
  const horas = useHorasEnfoque(p.id);
  const { estado } = useAsistentes();
  const centavo = estado.ajustes.centavo;
  const d = dineroDe(p);
  const mensual = d.presupuesto?.periodo === "mensual";
  const [mes, setMes] = useState("");
  const [ajustes, setAjustes] = useState(false);
  const [cierre, setCierre] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- parámetro de la URL, solo en el navegador
    if (pideAjustar()) setAjustes(true);
  }, []);

  const clave = mes || (today ? monthKey(today) : "");
  const meses = useMemo(() => (today ? Array.from({ length: 12 }, (_, i) => addMonths(monthKey(today), -i)) : []), [today]);
  const r = resumenDinero(p, db.transactions, today, mensual ? clave : undefined);
  // Valor por hora y cierre miran todo el proyecto, aunque el presupuesto sea mensual
  const total = resumenDinero({ ...p, money: { ...d, presupuesto: null } }, db.transactions, today);
  const todos = deProyecto(db.transactions, p.id);
  const filas = [...r.movimientos].sort(byDateDesc);
  const proy = today ? proyeccion(p, db.transactions, today) : null;
  const meta = d.metaAhorroId ? db.savings_goals.find((g) => g.id === d.metaAhorroId) : undefined;
  const vph = valorPorHora(total.balance, horas);

  const nuevo = (type: "gasto" | "ingreso") => open({ kind: "transaction", defaults: { type, project_id: p.id } });
  // N registra un gasto en el proyecto
  useEffect(() => registrarNuevo(() => nuevo("gasto")));

  const quitar = async (t: Transaction) => {
    await update("transactions", t.id, { project_id: null });
    toast(`«${t.description}» quedó en Finanzas sin proyecto.`);
  };

  const acciones = (
    <>
      <Button size="sm" variant="ghost" onClick={() => setAjustes(true)} aria-label="Presupuesto y avisos" title="Presupuesto y avisos">
        <Settings2 size={16} />
      </Button>
      {d.generaIngresos ? (
        <Button size="sm" variant="secondary" className="bg-bg-2" onClick={() => nuevo("ingreso")}>
          <Plus size={16} /> Nuevo ingreso
        </Button>
      ) : null}
      <Button size="sm" variant="primary" onClick={() => nuevo("gasto")} title="Nuevo gasto (N)">
        <Minus size={16} /> Nuevo gasto
      </Button>
    </>
  );
  const ajustesModal = ajustes ? <AjustesDinero proyecto={p} onClose={() => setAjustes(false)} /> : null;
  const cierreModal = cierre ? <CierreProyecto proyecto={p} onClose={() => setCierre(false)} /> : null;

  // Sin presupuesto ni movimientos: Centavo asomado y dos acciones
  if (!d.presupuesto && todos.length === 0) {
    return (
      <>
        <EmptyCard
          ghost="bars"
          title="Este proyecto aún no tiene dinero"
          description="Define un presupuesto o registra el primer gasto. Son los mismos movimientos de Finanzas: nada se duplica y tus saldos no cambian."
          aside={centavo.activo ? <Asistente id="centavo" size={88} momento="asomado" colores={centavo.colores} accesorio={centavo.accesorio} decorativo animado={false} /> : undefined}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setAjustes(true)}>
                Definir presupuesto
              </Button>
              <Button variant="secondary" className="bg-bg-2" onClick={() => nuevo("gasto")}>
                Registrar gasto
              </Button>
            </div>
          }
        />
        {ajustesModal}
      </>
    );
  }

  const usado = r.pct ?? 0;
  const etiquetaPeriodo = mensual ? monthLabel(clave) : "Todo el proyecto";

  return (
    <div className="flex flex-col gap-3">
      <Seccion id="dinero" titulo="Dinero" icon={Wallet} accion={acciones}>
        {mensual ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select value={clave} onChange={(e) => setMes(e.target.value)} aria-label="Mes" className="h-10 w-[200px] bg-bg-2">
              {meses.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
            <span className="text-[12.5px] text-muted">Presupuesto mensual</span>
          </div>
        ) : null}
        {r.presupuesto !== null ? (
          <div className="rounded-[20px] bg-bg-2 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[13px] text-muted">{etiquetaPeriodo}</p>
              <p className="num text-[13.5px] font-medium">
                {formatCOP(r.gastado)} de {formatCOP(r.presupuesto)} · {porcentaje(usado)}
              </p>
            </div>
            <div
              className="mt-2.5 h-3 overflow-hidden rounded-full bg-bg"
              role="progressbar"
              aria-label="Presupuesto usado"
              aria-valuenow={Math.round(usado)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuetext={`${Math.round(usado)} % del presupuesto usado`}
            >
              <div className={cn("h-full rounded-full transition-[width] duration-500", usado >= 100 ? "bg-danger" : "bg-fg")} style={{ width: `${Math.min(100, usado)}%` }} />
            </div>
            <p className="mt-2 text-[12.5px] text-muted">
              {Math.round(usado)} % del presupuesto usado
              {proy ? <span className="text-fg"> · {proy.texto}</span> : null}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-bg-2 p-4">
            <p className="text-[13.5px] text-muted">Sin presupuesto. Defínelo para ver cuánto queda y recibir avisos de Centavo.</p>
            <Button size="sm" variant="secondary" className="bg-bg" onClick={() => setAjustes(true)}>
              Definir presupuesto
            </Button>
          </div>
        )}
        {p.status === "completado" ? (
          <Button size="sm" variant="ghost" className="mt-3" onClick={() => setCierre(true)}>
            <Flag size={15} /> Resumen de cierre
          </Button>
        ) : null}
      </Seccion>

      {/* Tarjetas de resumen (las de Finanzas) */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {r.presupuesto !== null ? <Kpi label="Presupuesto" value={r.presupuesto} hint={etiquetaPeriodo} /> : null}
        <Kpi label="Gastado" value={r.gastado} hint={r.presupuesto !== null ? `${porcentaje(usado)} del presupuesto` : etiquetaPeriodo} />
        {r.disponible !== null ? <Kpi inverse label="Disponible" value={r.disponible} hint={r.disponible < 0 ? "Por encima del presupuesto" : "Lo que queda del presupuesto"} /> : null}
        {d.generaIngresos ? (
          <>
            <Kpi label="Ingresos" value={r.ingresos} hint={etiquetaPeriodo} />
            <Kpi label="Balance" value={r.balance} hint="Ingresos − gastos" />
          </>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-12">
        <TarjetaGastosCategoria
          className="xl:col-span-5"
          items={gastosPorCategoria(r.movimientos)}
          total={r.gastado}
          subtitle={etiquetaPeriodo}
          vacio="Aquí verás en qué se va la plata del proyecto cuando registres gastos."
        />
        <Card className="p-4 sm:p-6 md:col-span-2 xl:col-span-7 xl:row-span-2">
          <CardHeader title="Movimientos del proyecto" subtitle={`${filas.length} ${filas.length === 1 ? "movimiento" : "movimientos"} · los mismos de Finanzas`} />
          {filas.length ? (
            <ListaMovimientos rows={filas} onQuitar={quitar} />
          ) : (
            <p className="text-[13.5px] text-muted">{mensual ? "Sin movimientos en este mes." : "Aún no hay movimientos en este proyecto."}</p>
          )}
        </Card>
        {d.generaIngresos ? (
          <Card className="xl:col-span-5">
            <CardHeader title="Valor por hora" subtitle="Balance del proyecto ÷ horas de enfoque" />
            {vph !== null ? (
              <>
                <p className={cn("figure text-[40px] sm:text-[48px]", vph < 0 && "text-danger")}>{formatCOP(vph)}</p>
                <p className="mt-1 text-[13px] text-muted">
                  por hora · {formatCOP(total.balance)} en {Math.round(horas * 10) / 10} h de enfoque
                </p>
              </>
            ) : (
              <p className="text-[13.5px] text-muted">
                Registra más horas de enfoque para ver cuánto vale tu hora ({Math.round(horas * 10) / 10} de {MIN_HORAS_VALOR} h).
              </p>
            )}
          </Card>
        ) : null}
        {meta ? (
          <Card className="xl:col-span-5">
            <CardHeader title="Se paga con tu meta" subtitle={meta.name} />
            <div className="flex items-end justify-between gap-2">
              <p className="figure text-[40px]">
                {Math.round(pct(meta.current_amount, meta.target_amount))}
                <span className="text-[20px] text-muted"> %</span>
              </p>
              <p className="num pb-1.5 text-[13.5px]">
                {formatCOP(meta.current_amount)} de {formatCOP(meta.target_amount)}
              </p>
            </div>
            <div
              className="mt-2 h-3 overflow-hidden rounded-full bg-bg-2"
              role="progressbar"
              aria-label={`Avance de ${meta.name}`}
              aria-valuenow={Math.round(pct(meta.current_amount, meta.target_amount))}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-fg" style={{ width: `${pct(meta.current_amount, meta.target_amount)}%` }} />
            </div>
            <Link href="/finanzas?tab=ahorros" className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded-full text-[13.5px] font-medium hover:underline">
              Ver meta <ArrowUpRight size={15} />
            </Link>
          </Card>
        ) : null}
      </div>
      {ajustesModal}
      {cierreModal}
    </div>
  );
}

/* ═════════ Presupuesto y avisos del proyecto ═════════ */
export function AjustesDinero({ proyecto: p, onClose }: { proyecto: Project; onClose: () => void }) {
  const { db, update } = useData();
  const d = dineroDe(p);
  const [monto, setMonto] = useState(d.presupuesto ? formatAmountInput(String(d.presupuesto.monto)) : "");
  const [periodo, setPeriodo] = useState<PeriodoPresupuesto>(d.presupuesto?.periodo ?? "total");
  const [ingresos, setIngresos] = useState(d.generaIngresos);
  const [alertas, setAlertas] = useState<number[]>(d.alertas);
  const [metaId, setMetaId] = useState(d.metaAhorroId ?? "");
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    const v = monto ? parseCOP(monto) : null;
    if (monto && (v === null || v <= 0)) {
      setError("Escribe un valor mayor a 0, o déjalo vacío para quitar el presupuesto.");
      return false;
    }
    await update(
      "projects",
      p.id,
      cambioDinero(d, { presupuesto: v ? { monto: v, periodo } : null, generaIngresos: ingresos, alertas: alertas.length ? alertas : [], metaAhorroId: metaId || null }),
    );
    return v ? `Presupuesto de ${p.name}: ${formatCOP(v)}${periodo === "mensual" ? " al mes" : ""}.` : `${p.name} quedó sin presupuesto.`;
  };

  return (
    <FormModal open onClose={onClose} title="Presupuesto del proyecto" description="Es informativo: no separa ni bloquea dinero de tus cuentas." onSubmit={guardar}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <Field label="Presupuesto (COP)" error={error ?? undefined}>
          {(id) => <AmountInput id={id} value={monto} onChange={setMonto} invalid={!!error} />}
        </Field>
        <Field label="Periodo">{() => <ChoiceGroup value={periodo} onChange={setPeriodo} options={[{ value: "total", label: "Total" }, { value: "mensual", label: "Mensual" }]} />}</Field>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-[18px] bg-bg-2 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[14px]">Genera ingresos</p>
          <p className="text-[12.5px] text-muted">Cliente, emprendimiento o venta: muestra ingresos, balance y valor por hora.</p>
        </div>
        <Switch checked={ingresos} onChange={setIngresos} label="Genera ingresos" />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-[13px] text-muted">Avisos de Centavo al llegar a</legend>
        <div className="flex flex-wrap gap-1.5">
          {OPCIONES_ALERTA.map((a) => {
            const on = alertas.includes(a);
            return (
              <button
                key={a}
                type="button"
                aria-pressed={on}
                onClick={() => setAlertas((x) => (on ? x.filter((y) => y !== a) : [...x, a].sort((m, n) => m - n)))}
                className={cn("focus-ring min-h-10 cursor-pointer rounded-full px-3.5 text-[13.5px] font-medium transition-colors", on ? "bg-fg text-on-fg" : "bg-elev text-muted hover:text-fg")}
              >
                {a} %
              </button>
            );
          })}
        </div>
      </fieldset>
      {db.savings_goals.length ? (
        <Field label="Se paga con una meta de ahorro (opcional)">
          {(id) => (
            <Select id={id} value={metaId} onChange={(e) => setMetaId(e.target.value)}>
              <option value="">Ninguna</option>
              {db.savings_goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
    </FormModal>
  );
}
