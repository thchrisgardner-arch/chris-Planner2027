"use client";

import { useRef, useState } from "react";
import { AmountInput, FormModal } from "@/components/ui/FormModal";
import { DatePicker, TimeSelect } from "@/components/ui/DatePicker";
import { ChoiceGroup, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useData } from "@/lib/store/DataProvider";
import type {
  AnnualGoal,
  CalendarEvent,
  EventType,
  GoalArea,
  GoalStatus,
  Priority,
  WishClassification,
  WishStatus,
  WishlistItem,
} from "@/types/db";
import { todayISO } from "@/utils/dates";
import { ClipboardPaste, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useDeleteRecord } from "@/components/ui/RowActions";
import { formatAmountInput, formatCOP, parseCOP } from "@/utils/money";
import { almacenMonedas, monedaDe, MONEDAS, type Moneda } from "@/lib/monedas";
import { guardarImagenLocal, imagenDelPortapapeles, useImagenGuardada } from "@/components/ui/ImagenGuardada";
import { PRIORITIES } from "@/modules/projects/constants";
import { StorePicker } from "./StorePicker";
import { detectStore, findStore } from "./stores";
import { ProductLinkFinder, type ProductResult } from "./ProductLinkFinder";
import { Switch } from "@/components/ui/Switch";
import { FRECUENCIAS, proximaFecha, type FrecuenciaAporte, type PlanAporte } from "@/lib/finanzas/planAporte";
import { resumenCompra } from "@/lib/objetivos/compra";
import { mesTexto } from "@/lib/finanzas/proyeccionMeta";

/** Categoría sugerida según la tienda (solo si la persona no la cambió). */
const STORE_CATEGORY: Record<string, string> = {
  apple: "Tecnología",
  samsung: "Tecnología",
  alkosto: "Tecnología",
  ktronix: "Tecnología",
  zara: "Ropa",
  hm: "Ropa",
  shein: "Ropa",
  nike: "Ropa",
  adidas: "Ropa",
  ikea: "Hogar",
  homecenter: "Hogar",
};
import { EVENT_TYPES, GOAL_AREAS, GOAL_STATUSES, WISH_CATEGORIES, WISH_CLASSIFICATIONS, WISH_STATUSES } from "./constants";

type Errors = Record<string, string>;

function isValidUrl(v: string) {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/* ───────────── Wishlist ───────────── */
export function WishlistForm({ open, onClose, record }: { open: boolean; onClose: () => void; record?: WishlistItem }) {
  const { db, insert, update } = useData();
  const [name, setName] = useState(record?.name ?? "");
  const [image, setImage] = useState(record?.image_url ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [moneda, setMoneda] = useState<Moneda>(monedaDe(record ?? {}));
  const [price, setPrice] = useState(record ? (monedaDe(record) === "COP" ? formatAmountInput(String(record.price)) : record.price.toLocaleString("es-CO", { minimumFractionDigits: 2 })) : "");
  const tasas = almacenMonedas.useValor().tasas;
  const [subiendo, setSubiendo] = useState(false);
  const inputArchivo = useRef<HTMLInputElement>(null);
  const vistaImagen = useImagenGuardada(image || null);
  const [category, setCategory] = useState(record?.category ?? WISH_CATEGORIES[0]);
  const [classification, setClassification] = useState<WishClassification>(record?.classification ?? "gusto");
  const [priority, setPriority] = useState<Priority>(record?.priority ?? "media");
  const [desired, setDesired] = useState(record?.desired_date ?? "");
  const [link, setLink] = useState(record?.link ?? "");
  const [status, setStatus] = useState<WishStatus>(record?.status ?? "en_consideracion");
  const [goalId, setGoalId] = useState(record?.savings_goal_id ?? "");
  const [store, setStore] = useState<string | null>(record?.store ?? null);
  /** La tienda se reconoce sola desde el enlace mientras la persona no la elija a mano. */
  const [storeTouched, setStoreTouched] = useState(Boolean(record?.store));
  const [categoryTouched, setCategoryTouched] = useState(Boolean(record));
  const [imgBroken, setImgBroken] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  /** Campos que llenó la búsqueda: se pueden reemplazar en otra búsqueda; lo escrito a mano no se pisa. */
  const auto = useRef<Set<"name" | "price" | "image">>(new Set());

  const onLink = (v: string) => {
    setLink(v);
    if (!storeTouched) setStore(detectStore(v)?.id ?? null);
    // Al borrar el enlace se limpia solo lo que había llenado la búsqueda
    if (!v.trim() && auto.current.size) {
      if (auto.current.has("name")) setName("");
      if (auto.current.has("price")) setPrice("");
      if (auto.current.has("image")) setImage("");
      auto.current.clear();
    }
  };

  const applyResult = (r: ProductResult) => {
    const canFill = (field: "name" | "price" | "image", current: string) => !current.trim() || auto.current.has(field);
    if (r.title && canFill("name", name)) {
      setName(r.title);
      auto.current.add("name");
    }
    if (r.price !== null && canFill("price", price)) {
      const m: Moneda = r.currency === "USD" || r.currency === "EUR" ? r.currency : "COP";
      setMoneda(m);
      setPrice(m === "COP" ? formatAmountInput(String(r.price)) : r.price.toLocaleString("es-CO", { minimumFractionDigits: 2 }));
      auto.current.add("price");
    }
    if (r.image && canFill("image", image)) {
      setImage(r.image);
      setImgBroken(false);
      auto.current.add("image");
    }
    const detected = detectStore(r.url) ?? detectStore(link);
    if (detected && !storeTouched) setStore(detected.id);
    if (detected && !categoryTouched && STORE_CATEGORY[detected.id]) setCategory(STORE_CATEGORY[detected.id]);
  };

  const submit = async () => {
    const e: Errors = {};
    // En dólares o euros el precio lleva centavos ("24,00"); en pesos, como siempre
    const p = moneda === "COP" ? parseCOP(price) : Number(price.replace(/\./g, "").replace(",", ".")) || null;
    if (!name.trim()) e.name = "Escribe el nombre.";
    if (!p || p <= 0) e.price = "Ingresa un precio estimado.";
    if (image && !image.startsWith("archivo:") && !isValidUrl(image)) e.image = "Pega un enlace de imagen válido (https://…).";
    if (link && !isValidUrl(link)) e.link = "Enlace no válido.";
    setErrors(e);
    if (Object.keys(e).length) return false;
    const data = {
      name: name.trim(),
      image_url: image.trim() || null,
      description: description.trim() || null,
      price: p!,
      currency: moneda,
      category,
      classification,
      priority,
      desired_date: desired || null,
      link: link.trim() || null,
      store,
      status,
      savings_goal_id: goalId || null,
    };
    if (record) {
      await update("wishlist_items", record.id, data);
      return "Elemento actualizado.";
    }
    await insert("wishlist_items", data);
    return "Agregado a tu wishlist.";
  };

  return (
    <FormModal open={open} onClose={onClose} title={record ? "Editar deseo" : "Agregar a la wishlist"} onSubmit={submit} size="lg">
      <ProductLinkFinder value={link} onChange={onLink} onResult={applyResult} error={errors.link} autoSearch={!record} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" error={errors.name}>
          {(id) => (
            <Input
              id={id}
              value={name}
              placeholder="Ej. Monitor 27″"
              onChange={(e) => {
                setName(e.target.value);
                auto.current.delete("name");
              }}
            />
          )}
        </Field>
        <Field label={moneda === "COP" ? "Precio estimado" : `Precio estimado (${moneda})`} error={errors.price} hint={moneda !== "COP" ? (tasas[moneda] && Number(price.replace(/\./g, "").replace(",", ".")) ? `≈ ${formatCOP(Math.round(Number(price.replace(/\./g, "").replace(",", ".")) * tasas[moneda]!))}` : "Sin tasa no se suma con tus pesos.") : undefined}>
          {(id) =>
            moneda === "COP" ? (
              <AmountInput
                id={id}
                value={price}
                onChange={(v) => {
                  setPrice(v);
                  auto.current.delete("price");
                }}
                invalid={!!errors.price}
              />
            ) : (
              <Input
                id={id}
                inputMode="decimal"
                value={price}
                placeholder="24,00"
                onChange={(e) => {
                  setPrice(e.target.value.replace(/[^\d.,]/g, ""));
                  auto.current.delete("price");
                }}
              />
            )
          }
        </Field>
        {/* Siempre a la vista: si la tienda bloquea la lectura (Amazon), el precio en dólares se elige a mano */}
        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <Field label="Moneda">
            {(id) => (
              <Select
                id={id}
                value={moneda}
                onChange={(e) => {
                  // Cada moneda escribe el monto distinto ("96.000" pesos, "24,00" dólares): se vuelve a escribir
                  setMoneda(e.target.value as Moneda);
                  setPrice("");
                  auto.current.delete("price");
                }}
              >
                {MONEDAS.map((m) => (
                  <option key={m} value={m}>
                    {m === "COP" ? "COP · pesos" : m === "USD" ? "USD · dólares" : "EUR · euros"}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {moneda !== "COP" ? (
            <Field label={`1 ${moneda} en pesos (opcional)`}>
              {(id) => (
                <AmountInput
                  id={id}
                  value={tasas[moneda] ? formatAmountInput(String(tasas[moneda])) : ""}
                  onChange={(v) => almacenMonedas.cambiar((d) => ({ ...d, tasas: { ...d.tasas, [moneda]: parseCOP(v) ?? undefined } }))}
                />
              )}
            </Field>
          ) : null}
        </div>
        <Field label="Imagen (enlace)" error={errors.image} hint={image ? undefined : "Se completa con la búsqueda; también puedes pegar una imagen (Ctrl+V) o subirla."} className="sm:col-span-2">
          {(id) => (
            <div className="relative">
              <Input
                id={id}
                onPaste={(e) => {
                  // Pegar una imagen copiada (no un texto): se guarda comprimida en este dispositivo
                  const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/"));
                  if (!f) return;
                  e.preventDefault();
                  setSubiendo(true);
                  void guardarImagenLocal(f, "deseo")
                    .then((v) => {
                      setImage(v);
                      setImgBroken(false);
                      auto.current.delete("image");
                    })
                    .finally(() => setSubiendo(false));
                }}
                value={image.startsWith("archivo:") ? "Imagen guardada en este dispositivo" : image}
                readOnly={image.startsWith("archivo:")}
                placeholder="https://…"
                onChange={(e) => {
                  setImage(e.target.value);
                  setImgBroken(false);
                  auto.current.delete("image");
                }}
                className={image ? "pl-14" : undefined}
              />
              {image ? (
                <span className="absolute left-1.5 top-1/2 grid h-8 w-10 -translate-y-1/2 place-items-center overflow-hidden rounded-[9px] border border-line bg-white">
                  {!imgBroken ? (
                    // Miniatura de la imagen elegida
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={vistaImagen ?? undefined} alt="" referrerPolicy="no-referrer" onError={() => setImgBroken(true)} className="h-full w-full object-contain" />
                  ) : null}
                </span>
              ) : null}
            </div>
          )}
        </Field>
        <div className="-mt-2 flex flex-wrap gap-2 sm:col-span-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="bg-bg-2"
            disabled={subiendo}
            onClick={async () => {
              try {
                const f = await imagenDelPortapapeles();
                if (!f) return;
                setSubiendo(true);
                setImage(await guardarImagenLocal(f, "deseo"));
                setImgBroken(false);
                auto.current.delete("image");
              } catch {
                /* el navegador no dejó leer el portapapeles: queda Ctrl+V o Subir */
              } finally {
                setSubiendo(false);
              }
            }}
          >
            <ClipboardPaste size={15} /> Pegar imagen
          </Button>
          <Button type="button" size="sm" variant="secondary" className="bg-bg-2" disabled={subiendo} onClick={() => inputArchivo.current?.click()}>
            <Upload size={15} /> Subir imagen
          </Button>
          {image ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setImage("")}>
              Quitar
            </Button>
          ) : null}
          <input
            ref={inputArchivo}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setSubiendo(true);
              try {
                setImage(await guardarImagenLocal(f, "deseo"));
                setImgBroken(false);
                auto.current.delete("image");
              } finally {
                setSubiendo(false);
              }
            }}
          />
        </div>
        <Field label="Categoría">
          {(id) => (
            <Select
              id={id}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setCategoryTouched(true);
              }}
            >
              {WISH_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Estado">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as WishStatus)}>
              {WISH_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Fecha deseada de compra">
          {(id) => <DatePicker id={id} value={desired} onChange={(e) => setDesired(e.target.value)} />}
        </Field>
        <Field label="Objetivo de ahorro asociado" hint={db.savings_goals.length === 0 ? "Crea uno en Finanzas → Ahorros." : undefined}>
          {(id) => (
            <Select id={id} value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">Ninguno</option>
              {db.savings_goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Tienda" hint={store && !storeTouched ? `${findStore(store)?.name ?? "Tienda"} reconocida desde el enlace.` : undefined}>
        {() => (
          <StorePicker
            value={store}
            onChange={(v) => {
              setStore(v);
              setStoreTouched(true);
            }}
          />
        )}
      </Field>
      <Field label="Clasificación">
        {() => <ChoiceGroup value={classification} onChange={setClassification} options={WISH_CLASSIFICATIONS} />}
      </Field>
      <Field label="Prioridad">{() => <ChoiceGroup value={priority} onChange={setPriority} options={PRIORITIES} />}</Field>
      <Field label="Descripción (opcional)">
        {(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </Field>
    </FormModal>
  );
}

/* ───────────── Objetivo anual ───────────── */
export function GoalForm({ open, onClose, record }: { open: boolean; onClose: () => void; record?: AnnualGoal }) {
  const { db, insert, update } = useData();
  // Objetivo de compra de contado: precio, lo ahorrado y la cuota viven en su meta de ahorro
  const metaCompra = record?.savings_goal_id ? db.savings_goals.find((s) => s.id === record.savings_goal_id) : undefined;
  const planCompra = metaCompra?.plan as PlanAporte | null | undefined;
  const [esCompra, setEsCompra] = useState(!!metaCompra);
  const [precio, setPrecio] = useState(metaCompra ? formatAmountInput(String(metaCompra.target_amount)) : "");
  const [ahorrado, setAhorrado] = useState(metaCompra ? formatAmountInput(String(metaCompra.current_amount)) : "");
  const [cuota, setCuota] = useState(planCompra ? formatAmountInput(String(planCompra.monto)) : "");
  const [frecuencia, setFrecuencia] = useState<FrecuenciaAporte>(planCompra?.frecuencia ?? "mensual");
  const [title, setTitle] = useState(record?.title ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [area, setArea] = useState<GoalArea>(record?.area ?? "personal");
  const [date, setDate] = useState(record?.target_date ?? "");
  const [priority, setPriority] = useState<Priority>(record?.priority ?? "media");
  const [progress, setProgress] = useState(record?.progress ?? 0);
  const [status, setStatus] = useState<GoalStatus>(record?.status ?? "no_iniciado");
  const [errors, setErrors] = useState<Errors>({});

  const hoy = todayISO();
  const vPrecio = parseCOP(precio) ?? 0;
  const vAhorrado = parseCOP(ahorrado) ?? 0;
  const vCuota = parseCOP(cuota) ?? 0;
  // Vista previa de la compra con lo escrito: % y, con cuota, cuántas faltan y cuándo se llega
  const previa =
    esCompra && vPrecio > 0
      ? resumenCompra(
          {
            target_amount: vPrecio,
            current_amount: vAhorrado,
            target_date: null,
            plan: vCuota > 0 ? { frecuencia, monto: vCuota, inicio: proximaFecha({ frecuencia, inicio: hoy }, hoy) ?? hoy, base: vAhorrado } : null,
          },
          hoy,
        )
      : null;

  const submit = async () => {
    const e: Errors = {};
    if (!title.trim()) e.title = "Escribe el objetivo.";
    if (esCompra && vPrecio <= 0) e.precio = "Escribe cuánto cuesta.";
    setErrors(e);
    if (Object.keys(e).length) return false;

    let savings_goal_id: string | null = null;
    let avance = progress;
    if (esCompra) {
      // Se conserva el plan si la cuota no cambió (para no reiniciar su ritmo ni sus aportes)
      const igual = planCompra && planCompra.frecuencia === frecuencia && planCompra.monto === vCuota;
      const plan: PlanAporte | null =
        vCuota > 0 ? (igual ? planCompra! : { frecuencia, monto: vCuota, inicio: proximaFecha({ frecuencia, inicio: hoy }, hoy) ?? hoy, base: vAhorrado }) : null;
      const datosMeta = { name: title.trim(), target_amount: vPrecio, current_amount: vAhorrado, target_date: date || null, plan };
      if (metaCompra) {
        await update("savings_goals", metaCompra.id, datosMeta);
        savings_goal_id = metaCompra.id;
      } else {
        const meta = await insert("savings_goals", { ...datosMeta, priority, account_id: null, description: null });
        savings_goal_id = meta.id;
      }
      avance = Math.min(100, Math.floor((vAhorrado / vPrecio) * 100));
    }
    const data = {
      title: title.trim(),
      description: description.trim() || null,
      area,
      target_date: date || null,
      priority,
      progress: avance,
      status: avance >= 100 ? "logrado" : esCompra && avance > 0 && status === "no_iniciado" ? "en_progreso" : status,
      savings_goal_id,
    } as const;
    if (record) {
      await update("annual_goals", record.id, data);
      return esCompra && !metaCompra ? "Objetivo actualizado. Su meta de ahorro quedó en Finanzas → Ahorros." : "Objetivo actualizado.";
    }
    await insert("annual_goals", data);
    return esCompra ? "Objetivo creado. Su meta de ahorro quedó en Finanzas → Ahorros." : "Objetivo 2027 creado.";
  };

  return (
    <FormModal open={open} onClose={onClose} title={record ? "Editar objetivo" : "Nuevo objetivo 2027"} onSubmit={submit}>
      <Field label="Título" error={errors.title}>
        {(id) => <Input id={id} value={title} placeholder="Ej. Correr una media maratón" onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label="Área">
        {() => <ChoiceGroup value={area} onChange={setArea} options={GOAL_AREAS.map(({ value, label }) => ({ value, label }))} />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fecha objetivo">
          {(id) => <DatePicker id={id} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Estado">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as GoalStatus)}>
              {GOAL_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {/* Compra de contado: se ahorra en cuotas y el progreso sale solo de lo ahorrado */}
      <div className="rounded-[18px] bg-bg-2 p-3">
        <Switch checked={esCompra} onChange={setEsCompra} label="Es una compra (se ahorra en cuotas y se paga de contado)" />
        {esCompra ? (
          <div className="mt-3 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Precio total" error={errors.precio}>
                {(id) => <AmountInput id={id} value={precio} onChange={setPrecio} invalid={!!errors.precio} />}
              </Field>
              <Field label="Ya ahorrado">{(id) => <AmountInput id={id} value={ahorrado} onChange={setAhorrado} />}</Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Valor de cada cuota (opcional)">{(id) => <AmountInput id={id} value={cuota} onChange={setCuota} />}</Field>
              <Field label="Cada cuánto">
                {() => <ChoiceGroup value={frecuencia} onChange={setFrecuencia} options={FRECUENCIAS.filter((f) => f.value !== "diaria").map(({ value, label }) => ({ value, label }))} />}
              </Field>
            </div>
            {previa ? (
              <p className="text-[13px] leading-snug text-muted" aria-live="polite">
                Llevas el <span className="font-medium text-fg">{previa.pct} %</span>: faltan {formatCOP(previa.falta)}.
                {previa.cuota && previa.falta > 0
                  ? ` Con ${formatCOP(previa.cuota.monto)} ${previa.cuota.cada} son ${previa.cuotasRestantes} ${previa.cuotasRestantes === 1 ? "cuota" : "cuotas"}${previa.llega ? ` y llegas en ${mesTexto(previa.llega.slice(0, 7))}` : ""}.`
                  : ""}
              </p>
            ) : null}
            <p className="text-[12px] text-dim">Se guarda como meta de ahorro en Finanzas → Ahorros: ahí confirmas cada cuota.</p>
          </div>
        ) : null}
      </div>
      {!esCompra ? (
        <Field label={`Progreso: ${progress} %`}>
          {(id) => (
            <input
              id={id}
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full cursor-pointer accent-[#9b82f6]"
            />
          )}
        </Field>
      ) : null}
      <Field label="Prioridad">{() => <ChoiceGroup value={priority} onChange={setPriority} options={PRIORITIES} />}</Field>
      <Field label="Descripción (opcional)">
        {(id) => <Textarea id={id} value={description} onChange={(e) => setDescription(e.target.value)} />}
      </Field>
    </FormModal>
  );
}

/* ───────────── Evento ───────────── */
export function EventForm({
  open,
  onClose,
  record,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  record?: CalendarEvent;
  defaults?: Partial<CalendarEvent>;
}) {
  const { insert, update } = useData();
  const del = useDeleteRecord();
  const init = { ...defaults, ...record };
  const [title, setTitle] = useState(init.title ?? "");
  const [date, setDate] = useState(init.date ?? todayISO());
  const [start, setStart] = useState(init.start_time ?? "");
  const [end, setEnd] = useState(init.end_time ?? "");
  const [type, setType] = useState<EventType>(init.type ?? "personal");
  const [notes, setNotes] = useState(init.notes ?? "");
  const [errors, setErrors] = useState<Errors>({});

  const submit = async () => {
    const e: Errors = {};
    if (!title.trim()) e.title = "Escribe un título.";
    if (!date) e.date = "Elige una fecha.";
    if (start && end && end <= start) e.end = "Debe terminar después de empezar.";
    setErrors(e);
    if (Object.keys(e).length) return false;
    const data = { title: title.trim(), date, start_time: start || null, end_time: end || null, type, notes: notes.trim() || null };
    if (record) {
      await update("calendar_events", record.id, data);
      return "Evento actualizado.";
    }
    // Creado desde el calendario de un proyecto: queda en ese proyecto
    await insert("calendar_events", init.project_id ? { ...data, project_id: init.project_id } : data);
    return "Evento agregado al calendario.";
  };

  const eliminar = async () => {
    if (!record) return;
    const ok = await del("calendar_events", record.id, `¿Eliminar el evento ${record.title}?`);
    if (ok) onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={record ? "Editar evento" : "Nuevo evento"}
      onSubmit={submit}
      extraFooter={
        record ? (
          <Button type="button" variant="ghost" className="text-danger" onClick={eliminar}>
            <Trash2 size={16} /> Eliminar
          </Button>
        ) : null
      }
    >
      <Field label="Título" error={errors.title}>
        {(id) => <Input id={id} value={title} placeholder="Ej. Pago arriendo, Pierna en el gym" onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label="Tipo">
        {() => <ChoiceGroup value={type} onChange={setType} options={EVENT_TYPES.map(({ value, label }) => ({ value, label }))} />}
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Fecha" error={errors.date} className="col-span-2 sm:col-span-1">
          {(id) => <DatePicker id={id} clearable={false} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Inicio">
          {(id) => <TimeSelect id={id} value={start} onChange={(e) => setStart(e.target.value)} />}
        </Field>
        <Field label="Fin" error={errors.end}>
          {(id) => <TimeSelect id={id} value={end} onChange={(e) => setEnd(e.target.value)} />}
        </Field>
      </div>
      <Field label="Notas (opcional)">
        {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
    </FormModal>
  );
}
