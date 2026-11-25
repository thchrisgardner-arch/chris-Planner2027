"use client";

import { useState } from "react";
import { AmountInput, FormModal } from "@/components/ui/FormModal";
import { DatePicker } from "@/components/ui/DatePicker";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { AccountIcon } from "@/components/ui/BrandIcons";
import { useData } from "@/lib/store/DataProvider";
import type { Debt, DebtStatus, DebtType } from "@/types/db";
import { todayISO } from "@/utils/dates";
import { formatAmountInput, formatCOP, parseCOP } from "@/utils/money";
import { DEBT_TYPES } from "./constants";

type Errors = Record<string, string>;
const toInput = (n: number | null | undefined) => (n == null || n === 0 ? "" : formatAmountInput(String(Math.abs(n))));
const entero = (v: string) => (v.trim() === "" ? null : Math.max(0, Math.round(Number(v.replace(",", ".")))));
const decimal = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

/** Estado según saldo y mora: pagada, en mora o activa */
export function estadoDeuda(pendiente: number, mora: number): DebtStatus {
  if (pendiente <= 0) return "pagada";
  if (mora > 0) return "en_mora";
  return "activa";
}

/* ───────────── Deuda ───────────── */
export function DebtForm({ open, onClose, record }: { open: boolean; onClose: () => void; record?: Debt }) {
  const { insert, update } = useData();
  const [creditor, setCreditor] = useState(record?.creditor ?? "");
  const [type, setType] = useState<DebtType>(record?.type ?? "credito_libre");
  const [total, setTotal] = useState(toInput(record?.total_amount));
  const [pending, setPending] = useState(toInput(record?.pending_amount));
  const [cuota, setCuota] = useState(toInput(record?.installment_amount));
  const [cuotas, setCuotas] = useState(record?.installments ? String(record.installments) : "");
  const [pagadas, setPagadas] = useState(record?.installments_paid ? String(record.installments_paid) : "");
  const [tasa, setTasa] = useState(record?.interest_rate != null ? String(record.interest_rate).replace(".", ",") : "");
  const [dia, setDia] = useState(record?.payment_day ? String(record.payment_day) : "");
  const [venc, setVenc] = useState(record?.due_date ?? "");
  const [mora, setMora] = useState(toInput(record?.overdue_amount));
  const [diasMora, setDiasMora] = useState(record?.overdue_days ? String(record.overdue_days) : "");
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [errors, setErrors] = useState<Errors>({});

  const submit = async () => {
    const e: Errors = {};
    const t = parseCOP(total);
    const p = pending ? parseCOP(pending) : t;
    const c = cuota ? parseCOP(cuota) : null;
    const m = mora ? parseCOP(mora) : 0;
    const n = entero(cuotas);
    const np = entero(pagadas) ?? 0;
    const d = entero(dia);
    const r = decimal(tasa);
    if (!creditor.trim()) e.creditor = "Escribe la entidad o persona.";
    if (!t || t <= 0) e.total = "Ingresa el monto prestado.";
    if (p === null || p < 0) e.pending = "Valor no válido.";
    else if (t && p > t) e.pending = "El saldo no puede ser mayor al monto prestado.";
    if (c !== null && c < 0) e.cuota = "Valor no válido.";
    if (n !== null && n < 1) e.cuotas = "Debe ser al menos 1.";
    if (n !== null && np > n) e.pagadas = "No puede superar el total de cuotas.";
    if (d !== null && (d < 1 || d > 31)) e.dia = "Entre 1 y 31.";
    if (r !== null && (Number.isNaN(r) || r < 0 || r > 100)) e.tasa = "Porcentaje no válido.";
    if (m === null || m < 0) e.mora = "Valor no válido.";
    setErrors(e);
    if (Object.keys(e).length) return false;
    const data = {
      creditor: creditor.trim(),
      type,
      total_amount: t!,
      pending_amount: p!,
      installment_amount: c,
      installments: n,
      installments_paid: np,
      interest_rate: r,
      payment_day: d,
      due_date: venc || null,
      overdue_amount: m!,
      overdue_days: m ? (entero(diasMora) ?? 0) : 0,
      status: estadoDeuda(p!, m!),
      notes: notes.trim() || null,
    };
    if (record) {
      await update("debts", record.id, data);
      return "Deuda actualizada.";
    }
    await insert("debts", data);
    return "Deuda agregada.";
  };

  return (
    <FormModal open={open} onClose={onClose} title={record ? "Editar deuda" : "Nueva deuda"} description="Anota a quién le debes, las cuotas y lo que esté en mora." onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Entidad o persona" error={errors.creditor}>
          {(id) => <Input id={id} value={creditor} placeholder="Ej. Bancolombia, Nu, Kevin" onChange={(e) => setCreditor(e.target.value)} />}
        </Field>
        <Field label="Tipo de deuda">
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as DebtType)}>
              {DEBT_TYPES.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Monto prestado" error={errors.total}>
          {(id) => <AmountInput id={id} value={total} onChange={setTotal} invalid={!!errors.total} />}
        </Field>
        <Field label="Saldo pendiente hoy" error={errors.pending} hint="Si lo dejas vacío, se toma el monto prestado.">
          {(id) => <AmountInput id={id} value={pending} onChange={setPending} invalid={!!errors.pending} />}
        </Field>
        <Field label="Cuota mensual" error={errors.cuota}>
          {(id) => <AmountInput id={id} value={cuota} onChange={setCuota} invalid={!!errors.cuota} />}
        </Field>
        <Field label="Día de pago" error={errors.dia} hint="Día del mes (1 a 31).">
          {(id) => <Input id={id} inputMode="numeric" value={dia} placeholder="Ej. 15" onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))} />}
        </Field>
        <Field label="Número de cuotas" error={errors.cuotas} hint="Déjalo vacío si es tarjeta o no tiene plazo.">
          {(id) => <Input id={id} inputMode="numeric" value={cuotas} placeholder="Ej. 36" onChange={(e) => setCuotas(e.target.value.replace(/\D/g, "").slice(0, 3))} />}
        </Field>
        <Field label="Cuotas pagadas" error={errors.pagadas}>
          {(id) => <Input id={id} inputMode="numeric" value={pagadas} placeholder="0" onChange={(e) => setPagadas(e.target.value.replace(/\D/g, "").slice(0, 3))} />}
        </Field>
        <Field label="Tasa de interés (%)" error={errors.tasa} hint="La que aparece en tu extracto, p. ej. 1,6 mensual.">
          {(id) => <Input id={id} inputMode="decimal" value={tasa} placeholder="Ej. 1,6" onChange={(e) => setTasa(e.target.value.replace(/[^\d,.]/g, "").slice(0, 6))} />}
        </Field>
        <Field label="Fecha final (opcional)">
          {(id) => <DatePicker id={id} value={venc} onChange={(e) => setVenc(e.target.value)} />}
        </Field>
      </div>
      <div className="rounded-[20px] bg-card p-4">
        <p className="text-[14px] font-bold">Mora</p>
        <p className="mt-0.5 text-[12.5px] text-muted">Si tienes cuotas vencidas sin pagar, anótalas aquí.</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Monto en mora" error={errors.mora}>
            {(id) => <AmountInput id={id} value={mora} onChange={setMora} invalid={!!errors.mora} />}
          </Field>
          <Field label="Días en mora">
            {(id) => <Input id={id} inputMode="numeric" value={diasMora} placeholder="0" onChange={(e) => setDiasMora(e.target.value.replace(/\D/g, "").slice(0, 4))} />}
          </Field>
        </div>
      </div>
      <Field label="Notas (opcional)">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
    </FormModal>
  );
}

/* ───────────── Pago de cuota ───────────── */
export function DebtPaymentForm({ open, onClose, record }: { open: boolean; onClose: () => void; record: Debt }) {
  const { db, insert, update } = useData();
  const [amount, setAmount] = useState(toInput(record.overdue_amount || record.installment_amount));
  const [date, setDate] = useState(todayISO());
  const [cuotaCompleta, setCuotaCompleta] = useState(true);
  const [comoGasto, setComoGasto] = useState(false);
  const [accountId, setAccountId] = useState(db.accounts[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const submit = async () => {
    const e: Errors = {};
    const v = parseCOP(amount);
    if (!v || v <= 0) e.amount = "Ingresa un valor mayor a 0.";
    else if (v > record.pending_amount + record.overdue_amount) e.amount = `No puede superar lo que debes (${formatCOP(record.pending_amount)}).`;
    if (comoGasto && !accountId) e.account = "Elige la cuenta de donde salió el pago.";
    setErrors(e);
    if (Object.keys(e).length) return false;
    let transaction_id: string | null = null;
    if (comoGasto) {
      const tx = await insert("transactions", {
        type: "gasto",
        description: `Pago ${record.creditor}`,
        amount: v!,
        category: "Deudas",
        account_id: accountId,
        to_account_id: null,
        date,
        payment_method: null,
        status: "completado",
        beneficiary: "para_mi",
        notes: notes.trim() || null,
      });
      transaction_id = tx.id;
    }
    await insert("debt_payments", { debt_id: record.id, amount: v!, date, transaction_id, notes: notes.trim() || null });
    // El pago cubre primero la mora y baja el saldo pendiente
    const mora = Math.max(0, record.overdue_amount - v!);
    const pendiente = Math.max(0, record.pending_amount - v!);
    const pagadas = cuotaCompleta ? record.installments_paid + 1 : record.installments_paid;
    await update("debts", record.id, {
      pending_amount: pendiente,
      overdue_amount: mora,
      overdue_days: mora ? record.overdue_days : 0,
      installments_paid: record.installments ? Math.min(record.installments, pagadas) : pagadas,
      status: estadoDeuda(pendiente, mora),
    });
    return pendiente <= 0 ? `Deuda con ${record.creditor} pagada por completo.` : `Pago de ${formatCOP(v!)} registrado.`;
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={`Registrar pago · ${record.creditor}`}
      description={`Saldo pendiente: ${formatCOP(record.pending_amount)}${record.overdue_amount ? ` · En mora: ${formatCOP(record.overdue_amount)}` : ""}`}
      onSubmit={submit}
      size="sm"
      submitLabel="Registrar pago"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor pagado" error={errors.amount}>
          {(id) => <AmountInput id={id} value={amount} onChange={setAmount} invalid={!!errors.amount} />}
        </Field>
        <Field label="Fecha">{(id) => <DatePicker id={id} clearable={false} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
      </div>
      {record.overdue_amount ? <p className="text-[12.5px] text-muted">El pago se aplica primero a la mora y luego al saldo.</p> : null}
      <label className="flex items-center justify-between gap-3 text-[14px]">
        Cuenta como una cuota completa
        <Switch checked={cuotaCompleta} onChange={setCuotaCompleta} label="Cuenta como una cuota completa" />
      </label>
      <label className="flex items-center justify-between gap-3 text-[14px]">
        Registrar también como gasto en Movimientos
        <Switch checked={comoGasto} onChange={setComoGasto} label="Registrar también como gasto" />
      </label>
      {comoGasto ? (
        <Field label="Cuenta de donde salió" error={errors.account}>
          {(id) => (
            <Select
              id={id}
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              renderIcon={(v) => {
                const a = db.accounts.find((x) => x.id === v);
                return a ? <AccountIcon account={a} /> : null;
              }}
            >
              <option value="">Selecciona…</option>
              {db.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <Field label="Notas (opcional)">{(id) => <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
    </FormModal>
  );
}
