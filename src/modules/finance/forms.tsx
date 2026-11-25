"use client";

import { useMemo, useState } from "react";
import { AmountInput, FormModal } from "@/components/ui/FormModal";
import { DatePicker } from "@/components/ui/DatePicker";
import { ChoiceGroup, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useData } from "@/lib/store/DataProvider";
import type { Account, AccountType, Beneficiary, Priority, SavingsGoal, Transaction, TxStatus, TxType } from "@/types/db";
import { todayISO } from "@/utils/dates";
import { formatAmountInput, formatCOP, parseCOP } from "@/utils/money";
import { PRIORITIES } from "@/modules/projects/constants";
import {
  ACCOUNT_TYPES,
  BENEFICIARIES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  TX_STATUSES,
} from "./constants";
import { accountBalance } from "./selectors";
import { StoreLogo } from "@/components/ui/StoreLogo";
import { BANK_PRESETS, detectStoreInText, findStore } from "@/modules/other/stores";
import { AccountIcon, PaymentMethodIcon } from "@/components/ui/BrandIcons";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useForms } from "@/components/providers/FormsProvider";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import { cn } from "@/utils/cn";

/** Bancos que se pueden crear al vuelo desde el selector de cuenta. */
const QUICK_BANKS = ["nequi", "nu", "morse", "plata"];

type Errors = Record<string, string>;
const toInput = (n: number | null | undefined) => (n == null ? "" : formatAmountInput(String(Math.abs(n))));

/* ───────────── Movimiento ───────────── */
export function TransactionForm({
  open,
  onClose,
  record,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  record?: Transaction;
  defaults?: Partial<Transaction>;
}) {
  const { db, insert, update } = useData();
  const init = { ...defaults, ...record };
  const [type, setType] = useState<TxType>(init.type ?? "gasto");
  const [description, setDescription] = useState(init.description ?? "");
  const [amount, setAmount] = useState(toInput(init.amount));
  const [category, setCategory] = useState(init.category ?? "");
  const [accountId, setAccountId] = useState(init.account_id ?? db.accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(init.to_account_id ?? "");
  const [date, setDate] = useState(init.date ?? todayISO());
  const [method, setMethod] = useState(init.payment_method ?? "");
  const [status, setStatus] = useState<TxStatus>(init.status ?? "completado");
  const [beneficiary, setBeneficiary] = useState<Beneficiary>(init.beneficiary ?? "para_mi");
  const [notes, setNotes] = useState(init.notes ?? "");
  const [errors, setErrors] = useState<Errors>({});

  const categories = useMemo(() => {
    const kind = type === "ingreso" ? "ingreso" : "gasto";
    const base = kind === "ingreso" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const custom = db.transaction_categories.filter((c) => c.kind === kind).map((c) => c.name);
    return [...base, ...custom.filter((c) => !base.includes(c))];
  }, [type, db.transaction_categories]);

  const noAccounts = db.accounts.length === 0;
  const { toast } = useFeedback();
  const openForm = useForms();

  /** Abre «Nueva cuenta» y, al guardarla, vuelve a este movimiento con lo escrito y la cuenta elegida. */
  const addAccountAndReturn = () => {
    const draft: Partial<Transaction> = {
      type,
      description,
      amount: parseCOP(amount) ?? undefined,
      category: category || null,
      date,
      payment_method: method || null,
      status,
      beneficiary,
      notes: notes || null,
    };
    openForm({
      kind: "account",
      onCreated: (acc) => openForm({ kind: "transaction", defaults: { ...draft, account_id: acc.id } }),
    });
  };

  // Bancos sugeridos que aún no tienes como cuenta
  const suggestions = QUICK_BANKS.filter((id) => !db.accounts.some((a) => detectStoreInText(a.name, ["banco"])?.id === id));
  const accountIconFor = (v: string) => {
    if (v.startsWith("new:")) {
      const b = findStore(v.slice(4));
      return b ? <AccountIcon account={{ name: b.name, type: "banco" }} /> : null;
    }
    const a = db.accounts.find((x) => x.id === v);
    return a ? <AccountIcon account={a} /> : null;
  };
  /** Crea la cuenta con saldo inicial $0 (la persona lo ajusta luego) y la selecciona. */
  const pickAccount = async (v: string, set: (id: string) => void) => {
    if (!v.startsWith("new:")) return set(v);
    const bank = findStore(v.slice(4));
    if (!bank) return;
    try {
      const row = await insert("accounts", {
        name: bank.name,
        type: BANK_PRESETS.find((b) => b.id === bank.id)?.type ?? "banco",
        initial_balance: 0,
        currency: "COP",
      });
      set(row.id);
      toast(`Cuenta ${bank.name} creada con saldo inicial $0. Ajústalo en Finanzas → Cuentas.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo crear la cuenta.", "error");
    }
  };
  const methodOptions = [
    ...PAYMENT_METHODS.map((m) => m.value),
    ...(method && !PAYMENT_METHODS.some((m) => m.value === method) ? [method] : []),
  ];

  const submit = async () => {
    const e: Errors = {};
    const value = parseCOP(amount);
    if (!description.trim()) e.description = "Escribe una descripción.";
    if (!value || value <= 0) e.amount = "Ingresa un valor mayor a 0.";
    if (!accountId) e.account = "Elige una cuenta.";
    if (type !== "transferencia" && !category) e.category = "Elige una categoría.";
    if (type === "transferencia") {
      if (!toAccountId) e.to = "Elige la cuenta destino.";
      else if (toAccountId === accountId) e.to = "La cuenta destino debe ser distinta.";
    }
    if (!date) e.date = "Elige una fecha.";
    setErrors(e);
    if (Object.keys(e).length) return false;

    const data = {
      type,
      description: description.trim(),
      amount: value!,
      category: type === "transferencia" ? null : category,
      account_id: accountId,
      to_account_id: type === "transferencia" ? toAccountId : null,
      date,
      payment_method: type === "transferencia" ? "Transferencia" : method || null,
      status,
      beneficiary: type === "gasto" ? beneficiary : null,
      notes: notes.trim() || null,
    };
    if (record) {
      await update("transactions", record.id, data);
      return "Movimiento actualizado.";
    }
    await insert("transactions", data);
    return type === "transferencia" ? "Transferencia registrada." : "Movimiento registrado.";
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={record ? "Editar movimiento" : "Nuevo movimiento"}
      description="Los saldos de tus cuentas se recalculan automáticamente."
      onSubmit={submit}
    >
      {noAccounts ? (
        <div className="flex flex-col gap-3 rounded-[20px] bg-warn-fill px-4 py-3.5 text-[13.5px] text-[#0a0a0a] sm:flex-row sm:items-center">
          <p className="flex-1">Aún no tienes cuentas. Agrega una para registrar este movimiento.</p>
          <Button type="button" size="sm" variant="primary" className="self-start sm:self-auto" onClick={addAccountAndReturn}>
            <Plus size={15} /> Agregar cuenta
          </Button>
        </div>
      ) : null}
      <ChoiceGroup
        value={type}
        onChange={(v) => {
          setType(v);
          setCategory("");
        }}
        options={[
          { value: "gasto", label: "Gasto" },
          { value: "ingreso", label: "Ingreso" },
          { value: "transferencia", label: "Transferencia" },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor (COP)" error={errors.amount}>
          {(id) => <AmountInput id={id} value={amount} onChange={setAmount} invalid={!!errors.amount} />}
        </Field>
        <Field label="Fecha" error={errors.date}>
          {(id) => <DatePicker id={id} clearable={false} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      </div>
      <Field label="Descripción" error={errors.description}>
        {(id) => (
          <Input
            id={id}
            value={description}
            placeholder={type === "ingreso" ? "Ej. Pago proyecto web" : type === "gasto" ? "Ej. Mercado semanal" : "Ej. Paso a ahorros"}
            aria-invalid={!!errors.description || undefined}
            onChange={(e) => setDescription(e.target.value)}
          />
        )}
      </Field>
      {type !== "transferencia" && detectStoreInText(description) ? (
        <div className="-mt-2 flex items-center gap-2 text-[12.5px] text-muted">
          <StoreLogo store={detectStoreInText(description)!} size={22} />
          Comercio reconocido: <span className="font-medium text-fg">{detectStoreInText(description)!.name}</span>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={type === "transferencia" ? "Desde la cuenta" : "Cuenta"} error={errors.account}>
          {(id) => (
            <Select id={id} value={accountId} onChange={(e) => pickAccount(e.target.value, setAccountId)} renderIcon={accountIconFor}>
              <option value="">Selecciona…</option>
              {db.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
              {suggestions.map((b) => (
                <option key={b} value={`new:${b}`}>
                  {`Agregar ${findStore(b)?.name ?? b}`}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {type === "transferencia" ? (
          <Field label="Hacia la cuenta" error={errors.to}>
            {(id) => (
              <Select id={id} value={toAccountId} onChange={(e) => pickAccount(e.target.value, setToAccountId)} renderIcon={accountIconFor}>
                <option value="">Selecciona…</option>
                {db.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                {suggestions.map((b) => (
                  <option key={b} value={`new:${b}`}>
                    {`Agregar ${findStore(b)?.name ?? b}`}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <Field label="Categoría" error={errors.category}>
            {(id) => (
              <Select id={id} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Selecciona…</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </div>
      {type === "gasto" ? (
        <Field label="¿Para quién es este gasto?" hint="Solo se usa para estadísticas; no genera alertas.">
          {() => <ChoiceGroup value={beneficiary} onChange={setBeneficiary} options={BENEFICIARIES} />}
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {type !== "transferencia" ? (
          <Field label="Método de pago">
            {(id) => (
              <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)} renderIcon={(v) => (v ? <PaymentMethodIcon value={v} /> : null)}>
                <option value="">Sin especificar</option>
                {methodOptions.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            )}
          </Field>
        ) : null}
        <Field label="Estado" hint={status === "pendiente" ? "Los pendientes no afectan el saldo." : undefined}>
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as TxStatus)}>
              {TX_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Notas (opcional)">
        {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
    </FormModal>
  );
}

/* ───────────── Cuenta ───────────── */
export function AccountForm({
  open,
  onClose,
  record,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  record?: Account;
  onCreated?: (account: Account) => void;
}) {
  const { db, insert, update } = useData();
  const [name, setName] = useState(record?.name ?? "");
  const [type, setType] = useState<AccountType>(record?.type ?? "banco");
  const [initial, setInitial] = useState(toInput(record?.initial_balance));
  const [errors, setErrors] = useState<Errors>({});
  const isCard = type === "tarjeta_credito";

  const submit = async () => {
    const e: Errors = {};
    const value = initial ? parseCOP(initial) : 0;
    if (!name.trim()) e.name = "Ponle un nombre a la cuenta.";
    if (value === null || value < 0) e.initial = "Ingresa un valor válido.";
    setErrors(e);
    if (Object.keys(e).length) return false;
    // En tarjetas de crédito, el saldo inicial es deuda: se guarda en negativo.
    const initial_balance = isCard ? -Math.abs(value!) : value!;
    const data = { name: name.trim(), type, initial_balance, currency: "COP" };
    if (record) {
      await update("accounts", record.id, data);
      return "Cuenta actualizada.";
    }
    const row = await insert("accounts", data);
    // Tras cerrar este formulario, se abre el siguiente (el cierre ocurre justo después del return).
    if (onCreated) setTimeout(() => onCreated(row), 0);
    return onCreated ? "Cuenta agregada. Sigue con tu movimiento." : "Cuenta agregada.";
  };

  const current = record ? accountBalance(record, db.transactions) : null;

  return (
    <FormModal open={open} onClose={onClose} title={record ? "Editar cuenta" : "Nueva cuenta"} onSubmit={submit}>
      <Field label="Banco o billetera" hint="Elige uno para completar el nombre y el tipo, o escribe otro abajo.">
        {() => (
          <div className="grid grid-cols-3 gap-1.5 min-[460px]:grid-cols-4">
            {BANK_PRESETS.map((b) => {
              const bank = findStore(b.id);
              if (!bank) return null;
              const active = normalizeName(name) === normalizeName(bank.name);
              return (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setName(bank.name);
                    setType(b.type);
                  }}
                  className={cn(
                    "focus-ring flex cursor-pointer flex-col items-center gap-1.5 rounded-[14px] border px-1 py-2.5 transition-all duration-200",
                    active ? "border-fg bg-card" : "border-line bg-bg-2 hover:border-line-strong hover:bg-card",
                  )}
                >
                  <AccountIcon account={{ name: bank.name, type: b.type }} size={30} />
                  <span className={cn("max-w-full truncate px-0.5 text-[11.5px]", active ? "font-medium text-fg" : "text-muted")}>{bank.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </Field>
      <Field label="Nombre" error={errors.name}>
        {(id) => (
          <Input id={id} value={name} placeholder="Ej. Bancolombia, Nequi, Efectivo" onChange={(e) => setName(e.target.value)} />
        )}
      </Field>
      <Field label="Tipo">
        {(id) => (
          <Select
            id={id}
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
            renderIcon={(v) => <AccountIcon account={{ name: "", type: v as AccountType }} />}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field
        label={isCard ? "Deuda actual de la tarjeta" : "Saldo inicial"}
        error={errors.initial}
        hint={isCard ? "Se registra como saldo negativo." : "El saldo actual se calcula con tus movimientos."}
      >
        {(id) => <AmountInput id={id} value={initial} onChange={setInitial} invalid={!!errors.initial} />}
      </Field>
      {current !== null ? (
        <p className="text-[12.5px] text-muted">
          Saldo actual calculado: <span className="num font-medium text-fg">{formatCOP(current)}</span>
        </p>
      ) : null}
      <p className="text-[12px] text-dim">Moneda: COP</p>
    </FormModal>
  );
}

/* ───────────── Meta de ahorro ───────────── */
export function SavingsGoalForm({ open, onClose, record }: { open: boolean; onClose: () => void; record?: SavingsGoal }) {
  const { db, insert, update } = useData();
  const [name, setName] = useState(record?.name ?? "");
  const [target, setTarget] = useState(toInput(record?.target_amount));
  const [current, setCurrent] = useState(toInput(record?.current_amount));
  const [date, setDate] = useState(record?.target_date ?? "");
  const [priority, setPriority] = useState<Priority>(record?.priority ?? "media");
  const [accountId, setAccountId] = useState(record?.account_id ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [errors, setErrors] = useState<Errors>({});

  const submit = async () => {
    const e: Errors = {};
    const t = parseCOP(target);
    const c = current ? parseCOP(current) : 0;
    if (!name.trim()) e.name = "Ponle un nombre al objetivo.";
    if (!t || t <= 0) e.target = "Ingresa el valor que quieres ahorrar.";
    if (c === null || c < 0) e.current = "Valor no válido.";
    setErrors(e);
    if (Object.keys(e).length) return false;
    const data = {
      name: name.trim(),
      target_amount: t!,
      current_amount: c!,
      target_date: date || null,
      priority,
      account_id: accountId || null,
      description: description.trim() || null,
    };
    if (record) {
      await update("savings_goals", record.id, data);
      return "Objetivo de ahorro actualizado.";
    }
    await insert("savings_goals", data);
    return "Objetivo de ahorro creado.";
  };

  return (
    <FormModal open={open} onClose={onClose} title={record ? "Editar objetivo de ahorro" : "Nuevo objetivo de ahorro"} onSubmit={submit}>
      <Field label="Nombre del objetivo" error={errors.name}>
        {(id) => <Input id={id} value={name} placeholder="Ej. Fondo de emergencia" onChange={(e) => setName(e.target.value)} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valor deseado" error={errors.target}>
          {(id) => <AmountInput id={id} value={target} onChange={setTarget} invalid={!!errors.target} />}
        </Field>
        <Field label="Valor ahorrado hoy" error={errors.current}>
          {(id) => <AmountInput id={id} value={current} onChange={setCurrent} invalid={!!errors.current} />}
        </Field>
        <Field label="Fecha objetivo">
          {(id) => <DatePicker id={id} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Cuenta asociada">
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
              <option value="">Ninguna</option>
              {db.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Prioridad">{() => <ChoiceGroup value={priority} onChange={setPriority} options={PRIORITIES} />}</Field>
      <Field label="Descripción (opcional)">
        {(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </Field>
    </FormModal>
  );
}

/* ───────────── Abono a meta ───────────── */
export function SavingsDepositForm({ open, onClose, record }: { open: boolean; onClose: () => void; record: SavingsGoal }) {
  const { update } = useData();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"abono" | "retiro">("abono");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const v = parseCOP(amount);
    if (!v || v <= 0) {
      setError("Ingresa un valor mayor a 0.");
      return false;
    }
    const next = mode === "abono" ? record.current_amount + v : record.current_amount - v;
    if (next < 0) {
      setError("No puedes retirar más de lo ahorrado.");
      return false;
    }
    await update("savings_goals", record.id, { current_amount: next });
    return mode === "abono" ? `Abonaste ${formatCOP(v)} a ${record.name}.` : `Retiraste ${formatCOP(v)} de ${record.name}.`;
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={record.name}
      description={`Ahorrado: ${formatCOP(record.current_amount)} de ${formatCOP(record.target_amount)}`}
      onSubmit={submit}
      size="sm"
      submitLabel={mode === "abono" ? "Abonar" : "Retirar"}
    >
      <ChoiceGroup
        value={mode}
        onChange={setMode}
        options={[
          { value: "abono", label: "Abonar" },
          { value: "retiro", label: "Retirar" },
        ]}
      />
      <Field label="Valor" error={error}>
        {(id) => <AmountInput id={id} value={amount} onChange={setAmount} invalid={!!error} />}
      </Field>
    </FormModal>
  );
}

const normalizeName = (x: string) =>
  x
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
