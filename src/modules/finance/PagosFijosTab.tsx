"use client";

/**
 * Finanzas → Pagos fijos: arriendo, servicios, suscripciones y cuotas. Cada mes se crean como
 * movimientos pendientes; se confirman con un toque ("Pagado", con el monto editable).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Repeat } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyCard, Progress } from "@/components/ui/misc";
import { RowActions } from "@/components/ui/RowActions";
import { FormModal, AmountInput } from "@/components/ui/FormModal";
import { ChoiceGroup, Field, Input, Select } from "@/components/ui/Field";
import { Asistente } from "@/components/asistentes/Asistente";
import { useData } from "@/lib/store/DataProvider";
import { useAsistentes } from "@/lib/asistentes/estado";
import { useToday } from "@/hooks/useToday";
import {
  almacenPagosFijos,
  completarPendiente,
  fechaDelMes,
  nuevoIdPago,
  pagosDelMes,
  resumenMes,
  TIPOS_PAGO_FIJO,
  type PagoDelMes,
  type PagoFijo,
  type TipoPagoFijo,
} from "@/lib/finanzas/pagosFijos";
import { EXPENSE_CATEGORIES } from "./constants";
import { Kpi } from "./DeudasTab";
import { monthKey, monthLabel, relativeDay } from "@/utils/dates";
import { formatAmountInput, formatCOP, formatKpiCOP, parseCOP } from "@/utils/money";

/** Crea el movimiento pendiente del mes de cada pago fijo activo (una sola vez por mes). */
export function GenerarPagosFijos() {
  const { db, insert, status } = useData();
  const today = useToday();
  const datos = almacenPagosFijos.useValor();
  const enCurso = useRef(new Set<string>());

  useEffect(() => {
    if (status !== "ready" || !today) return;
    const mes = monthKey(today);
    for (const p of datos.pagos) {
      const clave = `${p.id}:${mes}`;
      if (!p.activo || datos.generados[p.id]?.[mes] || enCurso.current.has(clave)) continue;
      const cuenta = db.accounts.find((a) => a.id === p.cuentaId)?.id ?? db.accounts.find((a) => a.type !== "tarjeta_credito")?.id ?? db.accounts[0]?.id;
      if (!cuenta) continue;
      enCurso.current.add(clave);
      void insert("transactions", {
        type: "gasto",
        description: p.nombre,
        amount: p.monto,
        category: p.categoria,
        account_id: cuenta,
        to_account_id: null,
        date: fechaDelMes(p, mes),
        payment_method: null,
        status: "pendiente",
        beneficiary: "para_mi",
        notes: null,
      })
        .then((tx) =>
          almacenPagosFijos.cambiar((d) => ({ ...d, generados: { ...d.generados, [p.id]: { ...(d.generados[p.id] ?? {}), [mes]: tx.id } } })),
        )
        .finally(() => enCurso.current.delete(clave));
    }
  }, [status, today, datos, db.accounts, insert]);

  return null;
}

export function PagosFijos() {
  const { db } = useData();
  const today = useToday();
  const datos = almacenPagosFijos.useValor();
  const { estado } = useAsistentes();
  const tic = estado.ajustes.tic;
  const [form, setForm] = useState<{ pago?: PagoFijo } | null>(null);
  const [confirmar, setConfirmar] = useState<PagoDelMes | null>(null);
  const mes = today ? monthKey(today) : "";
  const lista = useMemo(() => (mes ? pagosDelMes(datos, db, mes) : []), [datos, db, mes]);
  const r = resumenMes(lista);
  const pendientes = lista.filter((x) => x.estado === "pendiente");
  const proximo = pendientes[0];
  const vencidos = pendientes.filter((x) => x.fecha < today);

  const modales = (
    <>
      {form ? <PagoFijoForm pago={form.pago} onClose={() => setForm(null)} /> : null}
      {confirmar ? <ConfirmarPago item={confirmar} onClose={() => setConfirmar(null)} /> : null}
    </>
  );

  if (!datos.pagos.length) {
    return (
      <>
        <EmptyCard
          ghost="list"
          title="Sin pagos fijos"
          description="Arriendo, servicios, suscripciones y cuotas. Cada mes quedan pendientes y los confirmas con un toque."
          action={
            <Button variant="secondary" className="bg-bg" onClick={() => setForm({})}>
              <Plus size={18} /> Agregar pago fijo
            </Button>
          }
        />
        {modales}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 [&>*]:min-w-0">
        <Kpi inverse label="Pagado este mes" value={formatKpiCOP(r.pagado)} hint={`${r.cuantosPagados} de ${r.cuantos} pagos`} />
        <Kpi label="Falta por pagar" value={formatKpiCOP(r.falta)} alerta={vencidos.length > 0} hint={vencidos.length ? `${vencidos.length} ${vencidos.length === 1 ? "pago vencido" : "pagos vencidos"}` : "En fijos este mes"} />
        <Kpi label="Total en fijos" value={formatKpiCOP(r.total)} hint={monthLabel(mes)} />
        <Kpi label="Próximo pago" value={proximo ? formatKpiCOP(proximo.monto) : "—"} hint={proximo ? `${proximo.pago.nombre} · ${relativeDay(proximo.fecha, today)}` : "Todo pagado"} />
      </div>

      {proximo ? (
        <Card className="flex items-center gap-3">
          <Asistente id="tic" size={56} pose={vencidos.length ? "preocupado" : "feliz"} colores={tic.colores} accesorio={tic.accesorio} decorativo animado={false} />
          <p className="min-w-0 flex-1 text-[14px]" aria-live="polite">
            <span className="font-medium">{tic.nombre}:</span>{" "}
            {vencidos.length
              ? `${vencidos[0].pago.nombre} era para ${relativeDay(vencidos[0].fecha, today).toLowerCase()}. Si ya lo pagaste, confírmalo y quedamos al día.`
              : `${proximo.pago.nombre} es ${relativeDay(proximo.fecha, today).toLowerCase()}. Yo te aviso, tú confirmas.`}
          </p>
        </Card>
      ) : null}

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px]">Este mes</h2>
            <p className="text-[12.5px] text-muted">
              {formatCOP(r.pagado)} de {formatCOP(r.total)}
            </p>
          </div>
          <Button variant="ghost" onClick={() => setForm({})}>
            <Plus size={18} /> Agregar
          </Button>
        </div>
        <Progress className="mt-3" value={r.total ? (r.pagado / r.total) * 100 : 0} label="Pagado de los pagos fijos del mes" />
        <ul className="mt-4 flex flex-col gap-1.5">
          {lista.map((x) => (
            <li key={x.pago.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[16px] bg-bg-2 px-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg text-muted" aria-hidden>
                <Repeat size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px]">{x.pago.nombre}</p>
                <p className="truncate text-[12.5px] text-muted">
                  {x.pago.categoria} · cada {x.pago.dia} · {relativeDay(x.fecha, today)}
                </p>
              </div>
              <span className="num shrink-0 text-[14px] font-medium">{formatCOP(x.monto)}</span>
              {/* En celular, las acciones bajan a su propia línea */}
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                {x.estado === "pagado" ? (
                  <Badge tone="brand">Pagado</Badge>
                ) : x.estado === "pendiente" ? (
                  <Button variant="primary" size="sm" onClick={() => setConfirmar(x)} aria-label={`Marcar ${x.pago.nombre} como pagado`}>
                    <Check size={16} /> Pagado
                  </Button>
                ) : x.estado === "omitido" ? (
                  <Badge>Omitido</Badge>
                ) : (
                  <Badge>Sin cuenta</Badge>
                )}
                <RowActions label={x.pago.nombre} onEdit={() => setForm({ pago: x.pago })} onDelete={() => borrarPago(x.pago)} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {modales}
    </div>
  );
}

function borrarPago(p: PagoFijo) {
  // El historial (movimientos ya creados) se conserva; solo deja de generarse
  almacenPagosFijos.cambiar((d) => ({ ...d, pagos: d.pagos.filter((x) => x.id !== p.id) }));
}

function ConfirmarPago({ item, onClose }: { item: PagoDelMes; onClose: () => void }) {
  const { insert, remove } = useData();
  const today = useToday();
  const [monto, setMonto] = useState(formatAmountInput(String(item.monto)));
  const [error, setError] = useState<string | null>(null);
  return (
    <FormModal
      open
      onClose={onClose}
      title={`Pagar ${item.pago.nombre}`}
      description="Confirma el valor que pagaste este mes."
      submitLabel="Pagado"
      size="sm"
      onSubmit={async () => {
        const v = parseCOP(monto);
        if (!v || v <= 0) {
          setError("Ingresa un valor mayor a 0.");
          return false;
        }
        // Se reemplaza el pendiente por un gasto con fecha de hoy (así la XP cuenta el día en que pagas)
        await completarPendiente(item.tx!, { insert, remove }, { amount: v, date: today });
        return `${item.pago.nombre}: pagado.`;
      }}
    >
      <Field label="Monto" error={error}>
        {(id) => <AmountInput id={id} value={monto} onChange={setMonto} invalid={!!error} />}
      </Field>
    </FormModal>
  );
}

function PagoFijoForm({ pago, onClose }: { pago?: PagoFijo; onClose: () => void }) {
  const { db } = useData();
  const today = useToday();
  const [nombre, setNombre] = useState(pago?.nombre ?? "");
  const [tipo, setTipo] = useState<TipoPagoFijo>(pago?.tipo ?? "servicio");
  const [monto, setMonto] = useState(pago ? formatAmountInput(String(pago.monto)) : "");
  const [categoria, setCategoria] = useState(pago?.categoria ?? "Servicios");
  const [cuenta, setCuenta] = useState(pago?.cuentaId ?? db.accounts.find((a) => a.type !== "tarjeta_credito")?.id ?? db.accounts[0]?.id ?? "");
  const [dia, setDia] = useState(String(pago?.dia ?? (today ? Number(today.slice(8)) : 1)));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const categorias = [...EXPENSE_CATEGORIES, ...db.transaction_categories.filter((c) => c.kind === "gasto").map((c) => c.name).filter((c) => !EXPENSE_CATEGORIES.includes(c))];

  return (
    <FormModal
      open
      onClose={onClose}
      title={pago ? "Editar pago fijo" : "Nuevo pago fijo"}
      description="Cada mes queda pendiente para que lo confirmes."
      onSubmit={async () => {
        const e: Record<string, string> = {};
        const v = parseCOP(monto);
        if (!nombre.trim()) e.nombre = "Escribe el nombre.";
        if (!v || v <= 0) e.monto = "Ingresa un valor mayor a 0.";
        if (!db.accounts.length) e.cuenta = "Primero agrega una cuenta en Finanzas → Cuentas.";
        setErrores(e);
        if (Object.keys(e).length) return false;
        const datos = { nombre: nombre.trim(), tipo, monto: v!, categoria, cuentaId: cuenta || null, dia: Number(dia) };
        almacenPagosFijos.cambiar((d) => ({
          ...d,
          pagos: pago ? d.pagos.map((x) => (x.id === pago.id ? { ...x, ...datos } : x)) : [...d.pagos, { id: nuevoIdPago(), activo: true, creado: today, ...datos }],
        }));
        return pago ? "Pago fijo actualizado. El pendiente de este mes no cambia." : "Pago fijo agregado.";
      }}
    >
      <Field label="Nombre" error={errores.nombre}>
        {(id) => <Input id={id} value={nombre} placeholder="Ej. Arriendo, Internet, Netflix" onChange={(e) => setNombre(e.target.value)} />}
      </Field>
      <Field label="Tipo">
        {() => (
          <ChoiceGroup
            value={tipo}
            onChange={(t) => {
              setTipo(t);
              const cat = TIPOS_PAGO_FIJO.find((x) => x.value === t)?.categoria;
              if (cat && categorias.includes(cat)) setCategoria(cat);
            }}
            options={TIPOS_PAGO_FIJO.map(({ value, label }) => ({ value, label }))}
          />
        )}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Monto" error={errores.monto}>
          {(id) => <AmountInput id={id} value={monto} onChange={setMonto} invalid={!!errores.monto} />}
        </Field>
        <Field label="Día de pago">
          {(id) => (
            <Select id={id} value={dia} onChange={(e) => setDia(e.target.value)}>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={String(i + 1)}>
                  {`Cada ${i + 1}`}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Categoría">
          {(id) => (
            <Select id={id} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Cuenta" error={errores.cuenta}>
          {(id) => (
            <Select id={id} value={cuenta} onChange={(e) => setCuenta(e.target.value)}>
              {db.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
    </FormModal>
  );
}
