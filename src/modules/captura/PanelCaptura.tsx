"use client";

/**
 * Captura rápida: un campo, una frase, Enter. Se abre con Ctrl+K / ⌘K, con la tecla N, desde el
 * botón "Nuevo" y desde el botón + del celular. La vista previa es editable antes de guardar y el
 * asistente del módulo confirma con una frase.
 */
import { MOMENTO_DE_LUGAR } from "@/lib/asistentes/momentos";
import { useEffect, useMemo, useRef, useState } from "react";
import { cerrarCaptura, quitarPuente, opcionesCaptura, type OpcionesCaptura } from "./CapturaRapida";
import { ArrowLeftRight, CalendarPlus, FolderPlus, Gift, ListTodo, PiggyBank, Repeat, Target, Wallet } from "lucide-react";
import { useForms, type FormRequest } from "@/components/providers/FormsProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { AmountInput } from "@/components/ui/FormModal";
import { DatePicker, TimeSelect } from "@/components/ui/DatePicker";
import { Asistente } from "@/components/asistentes/Asistente";
import { useData } from "@/lib/store/DataProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useAsistentes } from "@/lib/asistentes/estado";
import { useToday } from "@/hooks/useToday";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/modules/finance/constants";
import { WISH_CATEGORIES } from "@/modules/other/constants";
import { HABIT_COLORS } from "@/modules/habits/selectors";
import { BANK_PRESETS } from "@/modules/other/stores";
import { almacenCaptura, recordarCategoria } from "@/lib/captura/aprendizaje";
import { interpretarCaptura, palabraClave, TIPO_CAPTURA_LABEL, type Propuesta, type TipoCaptura } from "@/lib/captura/interpretar";
import { almacenPagosFijos, nuevoIdPago, TIPOS_PAGO_FIJO } from "@/lib/finanzas/pagosFijos";
import { formatAmountInput, formatCOP, parseCOP } from "@/utils/money";
import { relativeDay, WEEKDAYS_SHORT } from "@/utils/dates";
import type { AsistenteId } from "@/lib/asistentes/tipos";
import type { EventType } from "@/types/db";
import { cn } from "@/utils/cn";

const ASISTENTE_DE: Record<TipoCaptura, AsistenteId> = {
  gasto: "centavo",
  ingreso: "centavo",
  "pago-fijo": "centavo",
  habito: "brote",
  tarea: "tuerca",
  evento: "tic",
  deseo: "antojo",
};
const TIPOS = Object.keys(TIPO_CAPTURA_LABEL) as TipoCaptura[];
const EVENTO_TIPOS: { value: EventType; label: string }[] = [
  { value: "personal", label: "Personal" },
  { value: "entrenamiento", label: "Entrenamiento" },
  { value: "pago", label: "Pago" },
  { value: "vencimiento", label: "Vencimiento" },
  { value: "otro", label: "Otro" },
];
const EJEMPLOS = ["almuerzo 25 mil nequi", "me pagaron 3,2 millones", "arriendo 1.200.000 el 5 de cada mes", "gym lunes miércoles viernes", "reunión con Ana mañana 3pm"];

const FORMULARIOS: { kind: FormRequest["kind"]; label: string; Icono: typeof Wallet }[] = [
  { kind: "transaction", label: "Movimiento", Icono: ArrowLeftRight },
  { kind: "task", label: "Tarea", Icono: ListTodo },
  { kind: "habit", label: "Hábito", Icono: Repeat },
  { kind: "event", label: "Evento", Icono: CalendarPlus },
  { kind: "wish", label: "Deseo", Icono: Gift },
  { kind: "account", label: "Cuenta", Icono: Wallet },
  { kind: "savings", label: "Objetivo de ahorro", Icono: PiggyBank },
  { kind: "project", label: "Proyecto", Icono: FolderPlus },
  { kind: "goal", label: "Objetivo 2027", Icono: Target },
];

const NOMBRE_DIA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábados", "Domingos"];
/** [0, 2, 4] → "Lunes, miércoles y viernes" */
function listaDias(dias: number[]) {
  const n = dias.map((d, i) => (i === 0 ? NOMBRE_DIA[d] : NOMBRE_DIA[d].toLowerCase()));
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}` : (n[0] ?? "Sin días");
}

const esMovimiento = (t: TipoCaptura) => t === "gasto" || t === "ingreso" || t === "pago-fijo";

/** El que abrió la captura pidió un tipo (y un proyecto): la propuesta se ajusta sin perder lo leído */
function forzar(p: Propuesta, o: OpcionesCaptura, hoy: string): Propuesta {
  let r = p;
  if (o.tipo && p.tipo !== o.tipo) {
    const t = o.tipo;
    r = {
      ...p,
      tipo: t,
      categoria: t === "evento" ? "personal" : t === "gasto" || t === "ingreso" ? (p.tipo === t ? p.categoria : "Otros") : p.categoria,
      fecha: p.fecha ?? (t === "gasto" || t === "ingreso" || t === "evento" ? hoy : null),
    };
  }
  if (o.proyectoId !== undefined && r.tipo === "tarea") r = { ...r, proyectoId: o.proyectoId };
  return r;
}

type Edicion = Partial<Omit<Propuesta, "monto">> & { montoTxt?: string; cuentaSel?: string };

export function Panel() {
  const { db, insert } = useData();
  const abrirFormulario = useForms();
  const { toast } = useFeedback();
  const { estado } = useAsistentes();
  const today = useToday();
  const aprendidas = almacenCaptura.useValor().categorias;
  const input = useRef<HTMLInputElement>(null);
  // Abierta desde otra parte (comando de una nota): texto, tipo y proyecto ya vienen
  const [origen] = useState(opcionesCaptura);
  const [texto, setTexto] = useState(origen.texto ?? "");
  const [base, setBase] = useState<Propuesta | null>(null);
  const [ed, setEd] = useState<Edicion>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // El campo real ya tiene el foco (y el teclado): el puente invisible sobra
  useEffect(() => {
    input.current?.focus();
    const t = setTimeout(quitarPuente, 400);
    return () => clearTimeout(t);
  }, []);

  const categoriasGasto = useMemo(
    () => [...EXPENSE_CATEGORIES, ...db.transaction_categories.filter((c) => c.kind === "gasto").map((c) => c.name).filter((c) => !EXPENSE_CATEGORIES.includes(c))],
    [db.transaction_categories],
  );
  const categoriasIngreso = useMemo(
    () => [...INCOME_CATEGORIES, ...db.transaction_categories.filter((c) => c.kind === "ingreso").map((c) => c.name).filter((c) => !INCOME_CATEGORIES.includes(c))],
    [db.transaction_categories],
  );
  // Cuenta por defecto: la más usada en los últimos movimientos
  const cuentaPorDefecto = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const t of db.transactions.slice(-60)) cuenta.set(t.account_id, (cuenta.get(t.account_id) ?? 0) + 1);
    const top = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return db.accounts.some((a) => a.id === top) ? top! : (db.accounts.find((a) => a.type !== "tarjeta_credito")?.id ?? db.accounts[0]?.id ?? null);
  }, [db.transactions, db.accounts]);

  // Interpretar mientras se escribe (las correcciones se reinician con cada frase nueva)
  useEffect(() => {
    let vigente = true;
    const t = texto.trim();
    if (!t || !today) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpia la vista previa al borrar el texto
      setBase(null);
      return;
    }
    void interpretarCaptura(t, {
      hoy: today,
      cuentas: db.accounts.map((a) => ({ id: a.id, name: a.name, type: a.type })),
      proyectos: db.projects.map((p) => ({ id: p.id, name: p.name })),
      categoriasGasto,
      categoriasIngreso,
      aprendidas,
      cuentaPorDefecto,
    }).then((leida) => {
      if (!vigente) return;
      const p = forzar(leida, origen, today);
      setBase(p);
      setEd({});
      setError(null);
    });
    return () => {
      vigente = false;
    };
  }, [texto, today, db.accounts, db.projects, categoriasGasto, categoriasIngreso, aprendidas, cuentaPorDefecto, origen]);

  const p: Propuesta | null = base ? { ...base, ...ed, monto: ed.montoTxt !== undefined ? parseCOP(ed.montoTxt) : base.monto } : null;
  const tipo = p?.tipo ?? "gasto";
  const asistente = ASISTENTE_DE[tipo];
  const ajustes = estado.ajustes[asistente];
  const cuentaSel = ed.cuentaSel ?? (p?.cuentaId ?? (p?.cuentaMencionada ? `new:${p.cuentaMencionada}` : db.accounts.length ? "" : "new:Efectivo"));
  const categorias = tipo === "ingreso" ? categoriasIngreso : tipo === "deseo" ? WISH_CATEGORIES : categoriasGasto;

  const frase = ((): string => {
    if (!p) return "";
    const monto = p.monto ? formatCOP(p.monto) : "";
    const cuando = p.fecha && today ? relativeDay(p.fecha, today).toLowerCase() : "";
    switch (p.tipo) {
      case "gasto":
        return monto ? `Anotado: ${monto} en ${p.categoria ?? "Otros"}.` : "Dime cuánto fue y lo anoto.";
      case "ingreso":
        return monto ? `Entraron ${monto}. Así da gusto.` : "¿Cuánto entró? Escribe el valor.";
      case "pago-fijo":
        return `Cada ${p.diaDelMes ?? 1} del mes te lo dejo pendiente para confirmar.`;
      case "habito":
        return p.dias?.length === 7 ? "Todos los días. Sin afán, pero constante." : `${listaDias(p.dias ?? [])}. Sin afán, pero constante.`;
      case "tarea":
        return cuando ? `A la lista, para ${cuando}.` : "A la lista. Sin fecha por ahora.";
      case "evento":
        return `Agendado para ${cuando || "hoy"}${p.hora ? ` a las ${p.hora}` : ""}.`;
      case "deseo":
        return monto ? `A la lista de deseos: ${monto}. Sin culpa.` : "A la lista de deseos. ¿Cuánto cuesta más o menos?";
    }
  })();

  const cambiar = (patch: Edicion) => setEd((e) => ({ ...e, ...patch }));
  const cambiarTipo = (t: TipoCaptura) => {
    const cats = t === "ingreso" ? categoriasIngreso : t === "deseo" ? WISH_CATEGORIES : categoriasGasto;
    cambiar({
      tipo: t,
      categoria: t === "evento" ? "personal" : cats.includes(p?.categoria ?? "") ? p!.categoria : (cats.includes("Otros") ? "Otros" : cats[cats.length - 1]),
      fecha: p?.fecha ?? (t === "gasto" || t === "ingreso" || t === "evento" ? today : null),
      dias: t === "habito" ? (p?.dias ?? [0, 1, 2, 3, 4, 5, 6]) : p?.dias ?? null,
      diaDelMes: t === "pago-fijo" ? (p?.diaDelMes ?? Number(today.slice(8))) : p?.diaDelMes ?? null,
    });
  };

  const resolverCuenta = async (sel: string) => {
    if (!sel.startsWith("new:")) return sel;
    const nombre = sel.slice(4);
    const preset = BANK_PRESETS.find((b) => b.id === nombre.toLowerCase());
    const row = await insert("accounts", {
      name: nombre,
      type: nombre.toLowerCase() === "efectivo" ? "efectivo" : (preset?.type ?? "billetera"),
      initial_balance: 0,
      currency: "COP",
    });
    return row.id;
  };

  const guardar = async () => {
    if (!p || guardando) return;
    const desc = (p.descripcion ?? "").trim();
    if (esMovimiento(p.tipo) && (!p.monto || p.monto <= 0)) return setError("Falta el valor. Escríbelo en la frase o en el campo Monto.");
    if (p.tipo === "deseo" && (!p.monto || p.monto <= 0)) return setError("Agrega un precio estimado.");
    if (!desc && !esMovimiento(p.tipo)) return setError("Escribe un nombre.");
    if (p.tipo === "habito" && !p.dias?.length) return setError("Elige al menos un día.");
    if (esMovimiento(p.tipo) && !cuentaSel) return setError("Elige una cuenta.");
    setGuardando(true);
    try {
      if (p.tipo === "gasto" || p.tipo === "ingreso") {
        const cuenta = await resolverCuenta(cuentaSel);
        await insert("transactions", {
          type: p.tipo,
          description: desc || p.categoria || "Movimiento",
          amount: p.monto!,
          category: p.categoria,
          account_id: cuenta,
          to_account_id: null,
          date: p.fecha ?? today,
          payment_method: null,
          status: "completado",
          beneficiary: p.tipo === "gasto" ? "para_mi" : null,
          notes: null,
        });
        // Aprendizaje: si se corrigió la categoría, se recuerda para la próxima
        if (ed.categoria && base && ed.categoria !== base.categoria) recordarCategoria(palabraClave(desc), ed.categoria);
      } else if (p.tipo === "pago-fijo") {
        const cuenta = await resolverCuenta(cuentaSel);
        const tipoPago = TIPOS_PAGO_FIJO.find((t) => t.categoria === p.categoria)?.value ?? "otro";
        almacenPagosFijos.cambiar((d) => ({
          ...d,
          pagos: [
            ...d.pagos,
            { id: nuevoIdPago(), nombre: desc || p.categoria || "Pago fijo", monto: p.monto!, categoria: p.categoria ?? "Otros", cuentaId: cuenta, dia: p.diaDelMes ?? 1, tipo: tipoPago, activo: true, creado: today },
          ],
        }));
        if (ed.categoria && base && ed.categoria !== base.categoria) recordarCategoria(palabraClave(desc), ed.categoria);
      } else if (p.tipo === "habito") {
        await insert("habits", { name: desc, days: p.dias!, color: HABIT_COLORS[0] });
      } else if (p.tipo === "evento") {
        await insert("calendar_events", {
          title: desc,
          date: p.fecha ?? today,
          start_time: p.hora,
          end_time: null,
          type: (EVENTO_TIPOS.some((t) => t.value === p.categoria) ? p.categoria : "personal") as EventType,
          notes: null,
        });
      } else if (p.tipo === "tarea") {
        await insert("tasks", { name: desc, description: null, project_id: p.proyectoId, parent_task_id: null, due_date: p.fecha, priority: "media", status: "pendiente" });
      } else if (p.tipo === "deseo") {
        await insert("wishlist_items", {
          name: desc,
          image_url: null,
          description: null,
          price: p.monto!,
          category: p.categoria ?? "Otros",
          classification: "gusto",
          priority: "media",
          desired_date: null,
          link: null,
          store: null,
          status: "en_consideracion",
          savings_goal_id: null,
        });
      }
      toast(`${ajustes.nombre}: ${frase}`);
      origen.alGuardar?.({ tipo: p.tipo, descripcion: desc, monto: p.monto, fecha: p.fecha, hora: p.hora });
      cerrarCaptura();
    } catch (e) {
      setError(e instanceof Error ? `No se pudo guardar: ${e.message}` : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      open
      onClose={cerrarCaptura}
      title="Captura rápida"
      description="Escríbelo como se lo contarías a alguien. Enter para guardar."
      footer={
        <>
          <Button variant="ghost" onClick={cerrarCaptura} type="button">
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => void guardar()} loading={guardando} disabled={!p}>
            Guardar
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <Field label="¿Qué pasó?" hint={p ? undefined : "Montos como 25 mil, 25k, 1,2 millones o una luca; fechas como mañana, el viernes o el 15."}>
          {(id) => (
            <Input
              ref={input}
              id={id}
              value={texto}
              autoFocus
              autoComplete="off"
              enterKeyHint="done"
              placeholder="Ej. almuerzo 25 mil nequi"
              className="h-12 text-[16px]"
              onChange={(e) => setTexto(e.target.value)}
            />
          )}
        </Field>

        {!p ? (
          <>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ejemplos">
              {EJEMPLOS.map((ej) => (
                <button
                  key={ej}
                  type="button"
                  onClick={() => {
                    setTexto(ej);
                    input.current?.focus();
                  }}
                  className="focus-ring min-h-9 cursor-pointer rounded-full border border-line px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:text-fg"
                >
                  {ej}
                </button>
              ))}
            </div>
            <div>
              <p className="mb-2 text-[13px] text-muted" id="captura-formularios">
                O abre un formulario
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="group" aria-labelledby="captura-formularios">
                {FORMULARIOS.map(({ kind, label, Icono }) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      cerrarCaptura();
                      abrirFormulario({ kind } as FormRequest);
                    }}
                    className="focus-ring flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[14px] bg-card px-3 text-left text-[13.5px] transition-colors hover:bg-elev"
                  >
                    <Icono size={17} aria-hidden className="shrink-0 text-muted" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <section aria-label="Vista previa" className="rounded-[20px] bg-card p-4">
            <div className="flex items-center gap-3">
              <Asistente id={asistente} size={56} momento={MOMENTO_DE_LUGAR.captura} colores={ajustes.colores} accesorio={ajustes.accesorio} decorativo animado={false} />
              <p aria-live="polite" className="min-w-0 flex-1 text-[14px] leading-snug">
                <span className="font-medium">{ajustes.nombre}:</span> {frase}
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label="Tipo">
                {(id) => (
                  <Select id={id} value={tipo} onChange={(e) => cambiarTipo(e.target.value as TipoCaptura)}>
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {TIPO_CAPTURA_LABEL[t]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label={tipo === "evento" ? "Título" : tipo === "gasto" || tipo === "ingreso" ? "Descripción" : "Nombre"}>
                {(id) => <Input id={id} value={p.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} />}
              </Field>

              {esMovimiento(tipo) || tipo === "deseo" ? (
                <Field label={tipo === "deseo" ? "Precio" : "Monto"}>
                  {(id) => (
                    <AmountInput id={id} value={ed.montoTxt ?? (p.monto ? formatAmountInput(String(p.monto)) : "")} onChange={(v) => cambiar({ montoTxt: v })} />
                  )}
                </Field>
              ) : null}
              {esMovimiento(tipo) || tipo === "deseo" ? (
                <Field label="Categoría">
                  {(id) => (
                    <Select id={id} value={p.categoria ?? ""} onChange={(e) => cambiar({ categoria: e.target.value })}>
                      {categorias.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ) : null}
              {esMovimiento(tipo) ? (
                <Field label="Cuenta">
                  {(id) => (
                    <Select id={id} value={cuentaSel} onChange={(e) => cambiar({ cuentaSel: e.target.value })}>
                      {db.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                      {p.cuentaMencionada ? <option value={`new:${p.cuentaMencionada}`}>Crear cuenta {p.cuentaMencionada}</option> : null}
                      {!db.accounts.length && p.cuentaMencionada !== "Efectivo" ? <option value="new:Efectivo">Crear cuenta Efectivo</option> : null}
                    </Select>
                  )}
                </Field>
              ) : null}
              {tipo === "pago-fijo" ? (
                <Field label="Día de pago">
                  {(id) => (
                    <Select id={id} value={String(p.diaDelMes ?? 1)} onChange={(e) => cambiar({ diaDelMes: Number(e.target.value) })}>
                      {Array.from({ length: 31 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1)}>
                          {`Cada ${i + 1}`}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ) : null}
              {tipo === "gasto" || tipo === "ingreso" || tipo === "evento" || tipo === "tarea" ? (
                <Field label="Fecha">
                  {(id) => <DatePicker id={id} value={p.fecha ?? ""} clearable={tipo === "tarea"} onChange={(e) => cambiar({ fecha: e.target.value || null })} />}
                </Field>
              ) : null}
              {tipo === "evento" ? (
                <Field label="Hora">{(id) => <TimeSelect id={id} value={p.hora ?? ""} onChange={(e) => cambiar({ hora: e.target.value || null })} />}</Field>
              ) : null}
              {tipo === "evento" ? (
                <Field label="Tipo de evento">
                  {(id) => (
                    <Select id={id} value={p.categoria ?? "personal"} onChange={(e) => cambiar({ categoria: e.target.value })}>
                      {EVENTO_TIPOS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ) : null}
              {tipo === "tarea" ? (
                <Field label="Proyecto">
                  {(id) => (
                    <Select id={id} value={p.proyectoId ?? ""} onChange={(e) => cambiar({ proyectoId: e.target.value || null })}>
                      <option value="">Sin proyecto</option>
                      {db.projects.map((pr) => (
                        <option key={pr.id} value={pr.id}>
                          {pr.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ) : null}
              {tipo === "habito" ? (
                <div className="col-span-2 flex flex-col gap-1.5">
                  <p className="text-[13px] text-muted" id="captura-dias">
                    Días
                  </p>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="captura-dias">
                    {WEEKDAYS_SHORT.map((d, i) => {
                      const on = !!p.dias?.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-pressed={on}
                          aria-label={["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][i]}
                          onClick={() => cambiar({ dias: on ? (p.dias ?? []).filter((x) => x !== i) : [...(p.dias ?? []), i].sort() })}
                          className={cn(
                            "focus-ring grid h-11 w-11 cursor-pointer place-items-center rounded-full text-[13.5px] font-medium transition-colors",
                            on ? "bg-fg text-on-fg" : "bg-elev text-muted hover:text-fg",
                          )}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        )}
        {error ? (
          <p className="text-[12.5px] text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
