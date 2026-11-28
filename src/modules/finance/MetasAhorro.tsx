"use client";

/**
 * Metas de ahorro con plan de aporte (Fase 4): lo que se agrega a la tarjeta de cada meta en
 * Finanzas → Ahorros (texto del plan, ritmo y aportes por confirmar), el formulario del plan y la
 * imagen propia de la meta (pegar, subir o la del deseo vinculado), guardada en IndexedDB.
 */
import { useRef, useState } from "react";
import { Check, ClipboardPaste, ImagePlus, Pencil, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, Field } from "@/components/ui/Field";
import { AmountInput, FormModal } from "@/components/ui/FormModal";
import { useData } from "@/lib/store/DataProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useToday } from "@/hooks/useToday";
import { almacenAportes, marcarAporte, olvidarAportes } from "@/lib/finanzas/aportes";
import {
  FRECUENCIAS,
  aporteNecesario,
  aportesPendientes,
  fechaEstimada,
  proximaFecha,
  recalcularPlan,
  ritmo,
  textoPlan,
  type FrecuenciaAporte,
  type PlanAporte,
} from "@/lib/finanzas/planAporte";
import { comprimir } from "@/lib/proyectos/imagenes";
import { guardarArchivo } from "@/lib/proyectos/espacio";
import { useArchivoUrl } from "@/modules/proyectos/Imagenes";
import type { SavingsGoal } from "@/types/db";
import { formatShortDate } from "@/utils/dates";
import { formatAmountInput, formatCOP, parseCOP } from "@/utils/money";

/**
 * Demo (?demo=1): los aportes viejos del fondo quedan ahorrados y los del viaje, saltados, para ver
 * una meta adelantada, una atrasada y una con aportes por confirmar. Una vez por sesión.
 */
let sembrado = false;
export function sembrarAportesDemo(metas: SavingsGoal[], hoy: string) {
  if (sembrado || !hoy) return;
  sembrado = true;
  for (const m of metas) {
    if (!m.plan) continue;
    const fechas = aportesPendientes(m.plan, {}, hoy, 999);
    const viejas = m.name.startsWith("Fondo") ? fechas : m.name.startsWith("Viaje") ? fechas.slice(0, -1) : [];
    for (const f of viejas) marcarAporte(m.id, f, m.name.startsWith("Fondo") ? "ahorrado" : "saltado", m.name.startsWith("Fondo") ? m.plan.monto : 0);
  }
}

/* ═════════ En la tarjeta de la meta ═════════ */
/** Recuadro de información de la meta (proyección o plan): el mismo en todas las tarjetas */
export const CAJA_META = "mt-3 grid gap-1 rounded-[16px] bg-bg-2 px-3.5 py-3 text-[13px] leading-snug";

/**
 * Plan de aporte en la tarjeta: el recuadro con el plan y el ritmo, y debajo los aportes por confirmar
 * (cada uno en su fila: fecha y monto arriba, botones abajo). «Editar plan» va en los botones de la tarjeta.
 */
export function PlanEnTarjeta({ meta }: { meta: SavingsGoal }) {
  const { update } = useData();
  const { toast } = useFeedback();
  const today = useToday();
  const estados = almacenAportes.useValor().estados[meta.id] ?? {};
  const [editar, setEditar] = useState<string | null>(null);
  const [montoEdit, setMontoEdit] = useState("");
  const plan = meta.plan;
  if (!plan || !today) return null;
  const pendientes = meta.current_amount >= meta.target_amount ? [] : aportesPendientes(plan, estados, today, 3);

  const confirmar = async (fecha: string, monto: number, silencio = false) => {
    const nuevo = meta.current_amount + monto;
    // Igual que «Abonar»: sube lo ahorrado; con fecha, si se aportó de más o de menos, se recalcula el plan
    await update("savings_goals", meta.id, { current_amount: nuevo, plan: recalcularPlan({ ...meta, current_amount: nuevo }, plan, monto, today) });
    marcarAporte(meta.id, fecha, "ahorrado", monto);
    if (!silencio) toast(`Aporte de ${formatCOP(monto)} a ${meta.name}.`);
  };

  const r = ritmo(meta, plan, today);
  return (
    <>
      <div className={CAJA_META}>
        <p>{textoPlan(meta, plan, today)}</p>
        <p className={r.diferencia < 0 ? "text-warn" : "text-muted"} aria-live="polite">
          {r.texto}
        </p>
      </div>
      {pendientes.length ? (
        <ul className="mt-2 grid gap-2" aria-label={`Aportes por confirmar de ${meta.name}`}>
          {pendientes.map((f) => (
            <li key={f} className="rounded-[16px] border border-line px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-muted">Aporte del {formatShortDate(f)}</span>
                <span className="num text-[14.5px] font-medium">{formatCOP(plan.monto)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="primary" onClick={() => void confirmar(f, plan.monto)} aria-label={`Ahorrado: aporte del ${formatShortDate(f)} a ${meta.name}`}>
                  <Check size={15} /> Ahorrado
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => (setEditar(f), setMontoEdit(formatAmountInput(String(plan.monto))))} aria-label={`Cambiar el monto del aporte del ${formatShortDate(f)}`} title="Cambiar monto">
                  <Pencil size={15} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => {
                    marcarAporte(meta.id, f, "saltado", 0);
                    toast("Listo, ese aporte queda para otra vez.");
                  }}
                >
                  Esta vez no
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {editar ? (
        <FormModal
          open
          onClose={() => setEditar(null)}
          title="Aporte de esta vez"
          description={`${meta.name} · ${formatShortDate(editar)}`}
          submitLabel="Ahorrado"
          size="sm"
          onSubmit={async () => {
            const v = parseCOP(montoEdit);
            if (!v || v <= 0) return false;
            await confirmar(editar, v, true);
            return `Aporte de ${formatCOP(v)} a ${meta.name}.`;
          }}
        >
          <Field label="Monto">{(id) => <AmountInput id={id} value={montoEdit} onChange={setMontoEdit} />}</Field>
        </FormModal>
      ) : null}
    </>
  );
}

/* ═════════ Formulario del plan ═════════ */
export function PlanAporteForm({ meta, onClose }: { meta: SavingsGoal; onClose: () => void }) {
  const { update } = useData();
  const today = useToday();
  const [frecuencia, setFrecuencia] = useState<FrecuenciaAporte>(meta.plan?.frecuencia ?? "quincenal");
  const [monto, setMonto] = useState(meta.plan && !meta.target_date ? formatAmountInput(String(meta.plan.monto)) : "");
  const [error, setError] = useState<string | null>(null);
  const borrador = { frecuencia, inicio: today };
  const necesario = meta.target_date ? aporteNecesario(meta, borrador, today) : null;
  const v = parseCOP(monto);
  const estimada = !meta.target_date && v ? fechaEstimada(meta, { ...borrador, monto: v, base: meta.current_amount }, today) : null;

  return (
    <FormModal
      open
      onClose={onClose}
      title="Plan de aporte"
      description="La app no mueve dinero: cada aporte queda por confirmar y lo marcas con un toque."
      size="sm"
      extraFooter={
        meta.plan ? (
          <Button
            type="button"
            variant="ghost"
            onClick={async () => {
              await update("savings_goals", meta.id, { plan: null });
              olvidarAportes(meta.id);
              onClose();
            }}
          >
            Quitar plan
          </Button>
        ) : null
      }
      onSubmit={async () => {
        const valor = meta.target_date ? necesario : v;
        if (!valor || valor <= 0) {
          setError(meta.target_date ? "La meta ya está cumplida." : "Escribe cuánto vas a ahorrar en cada aporte.");
          return false;
        }
        const inicio = proximaFecha({ frecuencia, inicio: today }, today) ?? today;
        const plan: PlanAporte = { frecuencia, monto: valor, inicio, base: meta.current_amount };
        await update("savings_goals", meta.id, { plan });
        return `Plan de ${meta.name}: ${formatCOP(valor)} ${FRECUENCIAS.find((f) => f.value === frecuencia)!.cada}.`;
      }}
    >
      <Field label="Frecuencia">{() => <ChoiceGroup value={frecuencia} onChange={setFrecuencia} options={FRECUENCIAS.map(({ value, label }) => ({ value, label }))} />}</Field>
      {meta.target_date ? (
        <p className="rounded-[16px] bg-bg-2 px-4 py-3 text-[13.5px]" aria-live="polite">
          {necesario ? textoPlan(meta, { frecuencia, inicio: today, monto: necesario, base: meta.current_amount }, today) : "La meta ya está cumplida."}
        </p>
      ) : (
        <>
          <Field label="Cuánto en cada aporte" error={error}>
            {(id) => <AmountInput id={id} value={monto} onChange={setMonto} invalid={!!error} />}
          </Field>
          <p className="text-[13px] text-muted" aria-live="polite">
            {estimada ? textoPlan(meta, { frecuencia, inicio: today, monto: v!, base: meta.current_amount }, today) : "Sin fecha: con el aporte que elijas te digo cuándo llegas."}
          </p>
        </>
      )}
    </FormModal>
  );
}

/* ═════════ Imagen de la meta ═════════ */
const ARCHIVO = "archivo:";

/** URL que se puede mostrar: un archivo de este dispositivo o un enlace */
export function useImagenMeta(meta: Pick<SavingsGoal, "id" | "image">) {
  const { db } = useData();
  // Sin imagen propia: la del deseo de la wishlist vinculado a la meta (también puede ser «archivo:<id>»)
  const valor = meta.image || (db.wishlist_items.find((w) => w.savings_goal_id === meta.id && w.image_url)?.image_url ?? null);
  const archivo = valor?.startsWith(ARCHIVO) ? valor.slice(ARCHIVO.length) : null;
  const local = useArchivoUrl(archivo);
  return archivo ? local : valor;
}

export function ImagenMeta({ meta }: { meta: Pick<SavingsGoal, "id" | "image" | "name"> }) {
  const url = useImagenMeta(meta);
  if (!url) return null;
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[12px] border border-line bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
    </span>
  );
}

/** Campo del formulario de la meta: pegar (Ctrl+V o botón), subir un archivo o usar la del deseo */
export function CampoImagenMeta({ metaId, valor, onChange }: { metaId?: string; valor: string; onChange: (v: string) => void }) {
  const { db } = useData();
  const { toast } = useFeedback();
  const input = useRef<HTMLInputElement>(null);
  const vista = useImagenMeta({ id: metaId ?? "", image: valor || null });
  const deseo = metaId ? db.wishlist_items.find((w) => w.savings_goal_id === metaId && w.image_url) : undefined;

  const guardar = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast("Eso no es una imagen.", "error");
    const { blob } = await comprimir(file);
    const id = `meta-${Date.now().toString(36)}`;
    await guardarArchivo(id, blob);
    onChange(`${ARCHIVO}${id}`);
  };
  const pegar = async () => {
    try {
      for (const item of await navigator.clipboard.read()) {
        const tipo = item.types.find((t) => t.startsWith("image/"));
        if (tipo) return void guardar(new File([await item.getType(tipo)], "pegada", { type: tipo }));
      }
      toast("No hay una imagen copiada.", "error");
    } catch {
      toast("El navegador no dejó leer el portapapeles. Usa Ctrl+V o sube el archivo.", "error");
    }
  };

  return (
    <Field label="Imagen (opcional)" hint="Pega una imagen (Ctrl+V), súbela o usa la del deseo vinculado.">
      {() => (
        <div
          className="flex flex-wrap items-center gap-2 rounded-[16px] bg-bg-2 p-2"
          tabIndex={0}
          aria-label="Imagen de la meta: pega con Ctrl+V"
          onPaste={(e) => {
            const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/"));
            if (f) {
              e.preventDefault();
              void guardar(f);
            }
          }}
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[12px] border border-line bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {vista ? <img src={vista} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <ImagePlus size={18} className="text-dim" />}
          </span>
          <Button type="button" size="sm" variant="secondary" className="bg-bg" onClick={() => void pegar()}>
            <ClipboardPaste size={15} /> Pegar
          </Button>
          <Button type="button" size="sm" variant="secondary" className="bg-bg" onClick={() => input.current?.click()}>
            <Upload size={15} /> Subir
          </Button>
          {deseo && valor !== deseo.image_url ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(deseo.image_url!)}>
              La del deseo
            </Button>
          ) : null}
          {valor ? (
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Quitar imagen" onClick={() => onChange("")}>
              <X size={16} />
            </Button>
          ) : null}
          <input
            ref={input}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void guardar(f);
            }}
          />
        </div>
      )}
    </Field>
  );
}
