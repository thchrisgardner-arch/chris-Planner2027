"use client";

import { Plus, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyCard } from "@/components/ui/misc";
import { RowActions, useDeleteRecord } from "@/components/ui/RowActions";
import { StoreLogo } from "@/components/ui/StoreLogo";
import { useForms } from "@/components/providers/FormsProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import type { Debt } from "@/types/db";
import { formatShortDate, relativeDay } from "@/utils/dates";
import { formatCOP, formatKpiCOP, sum } from "@/utils/money";
import { cn } from "@/utils/cn";
import { detectStoreInText } from "@/modules/other/stores";
import { debtTypeLabel } from "./constants";

/** Próxima fecha de pago según el día del mes (ajusta a meses cortos). */
export function proximoPago(dia: number | null, today: string): string | null {
  if (!dia) return null;
  const [y, m, d] = today.split("-").map(Number);
  const ultimo = (yy: number, mm: number) => new Date(yy, mm, 0).getDate();
  let yy = y;
  let mm = m;
  if (d > Math.min(dia, ultimo(y, m))) {
    mm += 1;
    if (mm > 12) {
      mm = 1;
      yy += 1;
    }
  }
  const dd = Math.min(dia, ultimo(yy, mm));
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function Kpi({ label, value, hint, alerta, inverse }: { label: string; value: string; hint?: string; alerta?: boolean; inverse?: boolean }) {
  return (
    <Card variant={inverse ? "inverse" : "default"} className="flex min-h-[132px] flex-col">
      <h2 className={cn("text-[14px]", inverse ? "text-on-fg" : "text-fg")}>{label}</h2>
      <p className={cn("figure mt-auto whitespace-nowrap pt-4 text-[28px] sm:text-[40px]", inverse ? "text-on-fg" : alerta ? "text-danger" : value === "$0" ? "text-dim" : "text-fg")}>{value}</p>
      {hint ? <p className={cn("mt-1 text-[12.5px]", inverse ? "text-on-fg/60" : "text-muted")}>{hint}</p> : null}
    </Card>
  );
}

export function Deudas() {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const activas = db.debts.filter((d) => d.status !== "pagada");
  const pagadas = db.debts.filter((d) => d.status === "pagada");

  if (!db.debts.length) {
    return (
      <EmptyCard
        ghost="list"
        title="Sin deudas registradas"
        description="Anota a qué entidades o personas les debes, la cuota, el día de pago y lo que esté en mora."
        action={
          <Button variant="secondary" className="bg-bg" onClick={() => open({ kind: "debt" })}>
            <Plus size={18} /> Agregar deuda
          </Button>
        }
      />
    );
  }

  const total = sum(activas.map((d) => d.pending_amount));
  const cuotasMes = sum(activas.map((d) => d.installment_amount ?? 0));
  const mora = sum(activas.map((d) => d.overdue_amount));
  const enMora = activas.filter((d) => d.overdue_amount > 0).length;
  const proximas = activas
    .map((d) => ({ d, f: proximoPago(d.payment_day, today) }))
    .filter((x) => x.f)
    .sort((a, b) => a.f!.localeCompare(b.f!));
  const prox = proximas[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 [&>*]:min-w-0">
        <Kpi inverse label="Deuda total" value={formatKpiCOP(total)} hint={`${activas.length} ${activas.length === 1 ? "deuda activa" : "deudas activas"}`} />
        <Kpi label="Cuotas del mes" value={formatKpiCOP(cuotasMes)} hint="Suma de las cuotas mensuales" />
        <Kpi label="En mora" value={formatKpiCOP(mora)} alerta={mora > 0} hint={enMora ? `${enMora} ${enMora === 1 ? "deuda vencida" : "deudas vencidas"}` : "Todo al día"} />
        <Kpi label="Próximo pago" value={prox ? formatKpiCOP(prox.d.installment_amount ?? 0) : "—"} hint={prox ? `${prox.d.creditor} · ${relativeDay(prox.f!, today)}` : "Sin día de pago"} />
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => open({ kind: "debt" })}>
          <Plus size={18} /> Agregar deuda
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 [&>*]:min-w-0">
        {activas
          .sort((a, b) => b.overdue_amount - a.overdue_amount || b.pending_amount - a.pending_amount)
          .map((d) => (
            <TarjetaDeuda key={d.id} d={d} today={today} />
          ))}
      </div>

      {pagadas.length ? (
        <Card>
          <h2 className="text-[16px]">Deudas pagadas</h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {pagadas.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-[16px] bg-bg-2 px-3 py-2.5">
                <LogoEntidad nombre={d.creditor} size={32} />
                <span className="min-w-0 flex-1 truncate text-[14px]">{d.creditor}</span>
                <span className="num text-[13px] text-muted">{formatCOP(d.total_amount)}</span>
                <Badge tone="brand">Pagada</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function LogoEntidad({ nombre, size = 40 }: { nombre: string; size?: number }) {
  const s = detectStoreInText(nombre);
  if (s) return <StoreLogo store={s} size={size} />;
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-bg-2 text-muted" style={{ width: size, height: size }} aria-hidden>
      <Wallet size={size * 0.45} />
    </span>
  );
}

function TarjetaDeuda({ d, today }: { d: Debt; today: string }) {
  const { db } = useData();
  const open = useForms();
  const del = useDeleteRecord();
  const pagado = Math.max(0, d.total_amount - d.pending_amount);
  const pct = d.total_amount ? Math.min(100, Math.round((pagado / d.total_amount) * 100)) : 0;
  const prox = proximoPago(d.payment_day, today);
  const pagos = db.debt_payments.filter((p) => p.debt_id === d.id).sort((a, b) => b.date.localeCompare(a.date));
  const cuotasRest = d.installments ? Math.max(0, d.installments - d.installments_paid) : null;

  return (
    <Card className={cn("flex flex-col", d.overdue_amount > 0 && "ring-1 ring-danger/40")}>
      <div className="flex items-start gap-3">
        <LogoEntidad nombre={d.creditor} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px]">{d.creditor}</h3>
          <p className="text-[12.5px] text-muted">
            {debtTypeLabel(d.type)}
            {d.interest_rate != null ? ` · ${String(d.interest_rate).replace(".", ",")} %` : ""}
          </p>
        </div>
        {d.overdue_amount > 0 ? <Badge tone="danger">En mora</Badge> : <Badge>Al día</Badge>}
        <RowActions
          label={d.creditor}
          onEdit={() => open({ kind: "debt", record: d })}
          onDelete={() => del("debts", d.id, `¿Eliminar la deuda con ${d.creditor}?`, pagos.length ? `También se borrará su historial de ${pagos.length} pagos.` : undefined)}
        />
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="figure text-[28px] sm:text-[34px]">{formatCOP(d.pending_amount)}</p>
          <p className="mt-1 text-[12.5px] text-muted">Saldo pendiente de {formatCOP(d.total_amount)}</p>
        </div>
        <p className="num pb-1 text-[13px] text-muted">{pct} % pagado</p>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-bg-2" role="progressbar" aria-label={`Pagado de la deuda con ${d.creditor}`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-fg" style={{ width: `${pct}%` }} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-[12.5px]">
        <div className="rounded-[14px] bg-bg-2 px-3 py-2">
          <dt className="text-muted">Cuota</dt>
          <dd className="num mt-0.5 text-[14px] font-bold">{d.installment_amount ? formatKpiCOP(d.installment_amount) : "—"}</dd>
        </div>
        <div className="rounded-[14px] bg-bg-2 px-3 py-2">
          <dt className="text-muted">Cuotas</dt>
          <dd className="num mt-0.5 text-[14px] font-bold">{d.installments ? `${d.installments_paid}/${d.installments}` : d.installments_paid ? `${d.installments_paid} pagadas` : "—"}</dd>
        </div>
        <div className="rounded-[14px] bg-bg-2 px-3 py-2">
          <dt className="text-muted">Próximo pago</dt>
          <dd className="mt-0.5 text-[14px] font-bold">{prox ? relativeDay(prox, today) : "—"}</dd>
        </div>
      </dl>

      {d.overdue_amount > 0 ? (
        <div className="mt-3 rounded-[16px] bg-danger/10 px-3.5 py-2.5 text-[13px] text-fg">
          <span className="font-bold text-danger">{formatCOP(d.overdue_amount)} en mora</span>
          {d.overdue_days ? ` · ${d.overdue_days} ${d.overdue_days === 1 ? "día" : "días"} de atraso` : ""}
        </div>
      ) : null}

      {cuotasRest !== null && cuotasRest > 0 ? <p className="mt-3 text-[12.5px] text-muted">Te faltan {cuotasRest} {cuotasRest === 1 ? "cuota" : "cuotas"}.</p> : null}
      {d.notes ? <p className="mt-2 text-[12.5px] text-muted">{d.notes}</p> : null}

      {pagos.length ? (
        <div className="mt-3">
          <p className="text-[12.5px] text-muted">Últimos pagos</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {pagos.slice(0, 3).map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-[12px] bg-bg-2 px-3 py-1.5 text-[13px]">
                <span className="text-muted">{formatShortDate(p.date)}</span>
                <span className="num font-bold">{formatCOP(p.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-auto pt-4">
        <Button size="sm" variant="secondary" className="bg-bg-2" onClick={() => open({ kind: "debt-payment", record: d })}>
          <Plus size={15} /> Registrar pago
        </Button>
      </div>
    </Card>
  );
}
