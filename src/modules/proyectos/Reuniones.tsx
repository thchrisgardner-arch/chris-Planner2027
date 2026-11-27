"use client";

/**
 * Panel Reuniones del proyecto. Cada reunión es un evento del calendario (con project_id y meeting):
 * aparece en el calendario general, Tic la recuerda con los mismos avisos y lo que se cambie en
 * cualquiera de los dos lados se ve en el otro. Próximas arriba (con cuenta regresiva y «Unirse»),
 * pasadas abajo. Cada una tiene notas, acuerdos que se vuelven tarea en un toque y notas de voz.
 */
import { useEffect, useState } from "react";
import { CalendarClock, Check, ChevronDown, MapPin, Mic, MoreHorizontal, Pencil, Phone, Plus, Trash2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormModal } from "@/components/ui/FormModal";
import { DatePicker } from "@/components/ui/DatePicker";
import { ChoiceGroup, Field, Input, Textarea } from "@/components/ui/Field";
import { Popover } from "@/components/ui/Popover";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { registrarNuevo } from "@/lib/atajoNuevo";
import { interpretarAcuerdo } from "@/lib/proyectos/acuerdos";
import { nuevoId, useEspacio, type Modalidad } from "@/lib/proyectos/espacio";
import { PREFIJO, cuenta, esReunion, notasEvento, ordenarReuniones, tituloReunion, type DatosReunion, type ReunionEvento } from "@/lib/proyectos/reuniones";
import type { Project } from "@/types/db";
import { formatTime, relativeDay, todayISO } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { Grabadora, TarjetaVoz } from "./NotasVoz";
import { Seccion } from "./Seccion";

export { cuenta };

const MODALIDADES: { value: Modalidad; label: string }[] = [
  { value: "video", label: "Videollamada" },
  { value: "llamada", label: "Llamada" },
  { value: "presencial", label: "Presencial" },
];
const ICONO: Record<Modalidad, typeof Video> = { video: Video, llamada: Phone, presencial: MapPin };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export function PanelReuniones({ proyecto }: { proyecto: Project }) {
  const { db } = useData();
  const [form, setForm] = useState<{ abierto: boolean; registro?: ReunionEvento }>({ abierto: false });
  const [, refrescar] = useState(0);
  const today = useToday();

  // La cuenta regresiva se actualiza cada minuto
  useEffect(() => {
    const t = setInterval(() => refrescar((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => registrarNuevo(() => setForm({ abierto: true })), []);

  const lista = db.calendar_events.filter((e) => e.project_id === proyecto.id).filter(esReunion).sort(ordenarReuniones);
  const proximas = lista.filter((r) => cuenta(r).tono !== "pasada");
  const pasadas = lista.filter((r) => cuenta(r).tono === "pasada").reverse();

  return (
    <Seccion
      id="reuniones"
      titulo="Reuniones"
      icon={CalendarClock}
      cuenta={lista.length}
      accion={
        <Button size="sm" variant="primary" onClick={() => setForm({ abierto: true })} title="Nueva reunión (N)">
          <Plus size={16} /> Nueva
        </Button>
      }
    >
      <h3 className="mb-2 px-1 text-[13px] font-medium text-muted">Próximas</h3>
      {proximas.length === 0 ? (
        <div className="rounded-[20px] bg-bg-2 p-4 text-center">
          <p className="text-[14px] font-medium">Sin reuniones próximas</p>
          <p className="mt-0.5 text-[12.5px] text-muted">Agenda una y queda en tu calendario.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {proximas.map((r) => (
            <TarjetaReunion key={r.id} r={r} proyecto={proyecto} onEditar={() => setForm({ abierto: true, registro: r })} />
          ))}
        </div>
      )}
      {pasadas.length ? (
        <>
          <h3 className="mb-2 mt-5 px-1 text-[13px] font-medium text-muted">Pasadas</h3>
          <div className="grid grid-cols-1 gap-2">
            {pasadas.map((r) => (
              <TarjetaReunion key={r.id} r={r} proyecto={proyecto} compacta onEditar={() => setForm({ abierto: true, registro: r })} />
            ))}
          </div>
        </>
      ) : null}
      {form.abierto ? <FormReunion proyecto={proyecto} registro={form.registro} hoy={today} onClose={() => setForm({ abierto: false })} /> : null}
    </Seccion>
  );
}

function TarjetaReunion({ r, proyecto, onEditar, compacta }: { r: ReunionEvento; proyecto: Project; onEditar: () => void; compacta?: boolean }) {
  const { remove } = useData();
  const { confirm } = useFeedback();
  const [abierta, setAbierta] = useState(false);
  const c = cuenta(r);
  const m = r.meeting;
  const Icono = ICONO[m.modalidad] ?? Video;
  const titulo = tituloReunion(r);
  const [, mes, dia] = r.date.split("-");
  const borrar = async () => {
    if (!(await confirm({ title: `¿Eliminar «${titulo}»?`, description: "También se quita de tu calendario.", confirmLabel: "Eliminar", destructive: true }))) return;
    await remove("calendar_events", r.id).catch(() => {});
  };
  const pendientes = m.acuerdos.filter((a) => !a.tareaId).length;
  return (
    <article className={cn("rounded-[20px] p-3.5", compacta ? "bg-bg" : "bg-bg-2", c.tono === "ahora" && "ring-2 ring-[var(--color-brand)]")}>
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-bg text-center leading-none">
          <span className="num text-[17px] font-bold">{Number(dia)}</span>
          <span className="-mt-2 text-[10.5px] uppercase text-muted">{MES[Number(mes) - 1]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-bold">{titulo}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted">
            <Icono size={13} /> {r.start_time ? formatTime(r.start_time) : "Todo el día"}
            {r.end_time ? `–${formatTime(r.end_time)}` : ""}
            {m.modalidad === "presencial" && m.lugar ? <span className="truncate">· {m.lugar}</span> : null}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-medium",
            c.tono === "ahora" ? "bg-brand text-[#0a0a0a]" : c.tono === "pronto" ? "bg-warn-fill text-[#0a0a0a]" : "bg-bg text-muted",
          )}
        >
          {c.texto}
        </span>
      </div>
      {!compacta && (m.participantes.length || m.agenda) ? (
        <div className="mt-3 flex items-center gap-2">
          {m.participantes.length ? (
            <div className="flex -space-x-2" aria-label={`Asistentes: ${m.participantes.join(", ")}`}>
              {m.participantes.slice(0, 4).map((p) => (
                <span key={p} title={p} className="grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--color-bg-2)] bg-fg text-[10.5px] font-bold text-on-fg">
                  {iniciales(p)}
                </span>
              ))}
              {m.participantes.length > 4 ? (
                <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--color-bg-2)] bg-elev text-[10.5px] font-bold">+{m.participantes.length - 4}</span>
              ) : null}
            </div>
          ) : null}
          {m.agenda ? <p className="min-w-0 flex-1 truncate text-[12.5px] text-muted">{m.agenda}</p> : null}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {m.modalidad === "video" && m.enlace && c.tono !== "pasada" ? (
          <a href={m.enlace} target="_blank" rel="noreferrer" className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full bg-fg px-3.5 text-[13px] font-medium text-on-fg">
            <Video size={15} /> Unirse
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          className="focus-ring inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-bg px-3 text-[13px] font-medium hover:bg-elev"
        >
          Notas y acuerdos
          {pendientes ? <span className="num rounded-full bg-bg-2 px-1.5 text-[11.5px] text-muted">{pendientes}</span> : null}
          <ChevronDown size={14} className={cn("transition-transform motion-reduce:transition-none", abierta && "rotate-180")} />
        </button>
        <div className="ml-auto">
          <Popover
            side="bottom"
            trigger={({ open, toggle }) => (
              <Button size="icon-sm" variant="ghost" aria-label={`Opciones de ${titulo}`} aria-expanded={open} onClick={toggle}>
                <MoreHorizontal size={17} />
              </Button>
            )}
          >
            {(cerrar: () => void) => (
              <div className="grid min-w-[160px] gap-0.5 p-1">
                <button type="button" onClick={() => (cerrar(), onEditar())} className="flex cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13.5px] hover:bg-card">
                  <Pencil size={15} /> Editar
                </button>
                <button type="button" onClick={() => (cerrar(), void borrar())} className="flex cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13.5px] text-danger hover:bg-card">
                  <Trash2 size={15} /> Eliminar
                </button>
              </div>
            )}
          </Popover>
        </div>
      </div>
      {abierta ? <DetalleReunion r={r} proyecto={proyecto} /> : null}
    </article>
  );
}

/** Notas, acuerdos y notas de voz de la reunión */
function DetalleReunion({ r, proyecto }: { r: ReunionEvento; proyecto: Project }) {
  const { insert, update } = useData();
  const { toast } = useFeedback();
  const today = useToday();
  const e = useEspacio();
  const [notas, setNotas] = useState(r.meeting.notas ?? "");
  const [acuerdo, setAcuerdo] = useState("");
  const [grabando, setGrabando] = useState(false);
  const titulo = tituloReunion(r);
  const voces = e.voz.filter((v) => v.reunionId === r.id);

  const cambiar = (patch: Partial<DatosReunion>) => update("calendar_events", r.id, { meeting: { ...r.meeting, ...patch } });

  const guardarNotas = async () => {
    if (notas === (r.meeting.notas ?? "")) return;
    await cambiar({ notas });
    toast("Notas guardadas");
  };
  const agregarAcuerdo = async () => {
    const texto = acuerdo.trim();
    if (!texto) return;
    await cambiar({ acuerdos: [...r.meeting.acuerdos, { id: nuevoId("acu"), texto }] });
    setAcuerdo("");
  };
  /** «Volver tarea»: crea la tarea en el proyecto con responsable y fecha si el texto los trae */
  const volverTarea = async (id: string) => {
    const a = r.meeting.acuerdos.find((x) => x.id === id);
    if (!a) return;
    const leido = interpretarAcuerdo(a.texto, today);
    const tarea = await insert("tasks", {
      project_id: proyecto.id,
      parent_task_id: null,
      name: leido.nombre || a.texto,
      description: `Acuerdo de la reunión «${titulo}» (${relativeDay(r.date, today).toLowerCase()})`,
      due_date: leido.fecha,
      priority: "media",
      status: "pendiente",
      assignee: leido.responsable,
    });
    await cambiar({ acuerdos: r.meeting.acuerdos.map((x) => (x.id === id ? { ...x, tareaId: tarea.id } : x)) });
    const extra = [leido.responsable ? `para ${leido.responsable}` : "", leido.fecha ? relativeDay(leido.fecha, today).toLowerCase() : ""].filter(Boolean).join(", ");
    toast(extra ? `Tarea creada ${extra}` : "Tarea creada en el proyecto");
  };

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 border-t border-line pt-3">
      <div>
        <label htmlFor={`notas-${r.id}`} className="mb-1.5 block text-[12.5px] font-medium text-muted">
          Notas de la reunión
        </label>
        <Textarea id={`notas-${r.id}`} value={notas} onChange={(ev) => setNotas(ev.target.value)} onBlur={() => void guardarNotas()} placeholder="Qué se habló" />
      </div>

      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-muted" id={`acuerdos-${r.id}`}>
          Acuerdos
        </p>
        {r.meeting.acuerdos.length ? (
          <ul className="mb-2 flex flex-col gap-1.5" aria-labelledby={`acuerdos-${r.id}`}>
            {r.meeting.acuerdos.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-[14px] bg-bg px-3 py-2">
                <span className="min-w-0 flex-1 text-[13.5px]">{a.texto}</span>
                {a.tareaId ? (
                  <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-[var(--color-brand-soft)]">
                    <Check size={13} /> Tarea creada
                  </span>
                ) : (
                  <button type="button" onClick={() => void volverTarea(a.id)} className="focus-ring shrink-0 cursor-pointer rounded-full bg-fg px-3 py-1 text-[12px] font-medium text-on-fg">
                    Volver tarea
                  </button>
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  aria-label={`Quitar el acuerdo «${a.texto}»`}
                  onClick={() => void cambiar({ acuerdos: r.meeting.acuerdos.filter((x) => x.id !== a.id) })}
                >
                  <X size={14} />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            void agregarAcuerdo();
          }}
          className="flex items-center gap-2 rounded-[14px] bg-bg p-1 pl-3"
        >
          <input
            value={acuerdo}
            onChange={(ev) => setAcuerdo(ev.target.value)}
            placeholder="Ej. Ana: enviar la propuesta el viernes"
            aria-label="Nuevo acuerdo"
            className="min-w-0 flex-1 rounded-[8px] bg-transparent py-1.5 text-[13.5px] outline-none placeholder:text-dim focus-visible:ring-2 focus-visible:ring-fg"
          />
          <Button type="submit" size="sm" variant="secondary" className="bg-bg-2" disabled={!acuerdo.trim()}>
            Agregar
          </Button>
        </form>
      </div>

      <div>
        <p className="mb-1.5 text-[12.5px] font-medium text-muted">Notas de voz</p>
        <div className="grid grid-cols-1 gap-2">
          {voces.map((v) => (
            <TarjetaVoz key={v.id} nota={v} />
          ))}
          {grabando ? (
            <Grabadora proyectoId={proyecto.id} reunionId={r.id} onGuardada={() => setGrabando(false)} />
          ) : (
            <button type="button" onClick={() => setGrabando(true)} className="focus-ring inline-flex h-9 w-fit cursor-pointer items-center gap-1.5 rounded-full bg-bg px-3 text-[13px] font-medium hover:bg-elev">
              <Mic size={15} /> Grabar nota de voz
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FormReunion({ proyecto, registro, hoy, onClose }: { proyecto: Project; registro?: ReunionEvento; hoy: string; onClose: () => void }) {
  const { insert, update } = useData();
  const m = registro?.meeting;
  const [titulo, setTitulo] = useState(registro ? tituloReunion(registro) : "");
  const [fecha, setFecha] = useState(registro?.date ?? (hoy || todayISO()));
  const [inicio, setInicio] = useState(registro?.start_time ?? "10:00");
  const [fin, setFin] = useState(registro?.end_time ?? "10:30");
  const [modalidad, setModalidad] = useState<Modalidad>(m?.modalidad ?? "video");
  const [enlace, setEnlace] = useState(m?.enlace ?? "");
  const [lugar, setLugar] = useState(m?.lugar ?? "");
  const [participantes, setParticipantes] = useState(m?.participantes.join(", ") ?? "");
  const [agenda, setAgenda] = useState(m?.agenda ?? "");
  const [errores, setErrores] = useState<Record<string, string>>({});

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!titulo.trim()) e.titulo = "Ponle un nombre a la reunión.";
    if (!fecha) e.fecha = "Elige la fecha.";
    if (!inicio) e.inicio = "Elige la hora.";
    if (fin && inicio && fin <= inicio) e.fin = "Debe terminar después de empezar.";
    const link = enlace.trim();
    if (modalidad === "video" && link && !/^https?:\/\//i.test(link)) e.enlace = "Pega el enlace completo (https://…).";
    setErrores(e);
    if (Object.keys(e).length) return false;

    const meeting: DatosReunion = {
      notas: "",
      acuerdos: [],
      ...m,
      modalidad,
      enlace: link,
      lugar: lugar.trim(),
      participantes: participantes
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      agenda: agenda.trim(),
    };
    const evento = {
      title: `${PREFIJO}${titulo.trim()}`,
      date: fecha,
      start_time: inicio,
      end_time: fin || null,
      notes: notasEvento(proyecto.name, meeting),
      project_id: proyecto.id,
      meeting,
    };
    if (registro) await update("calendar_events", registro.id, evento);
    else await insert("calendar_events", { ...evento, type: "personal" });
    return registro ? "Reunión actualizada." : "Reunión agendada y agregada a tu calendario.";
  };

  return (
    <FormModal open onClose={onClose} title={registro ? "Editar reunión" : "Agendar reunión"} description={proyecto.name} onSubmit={submit} submitLabel={registro ? "Guardar" : "Agendar"}>
      <Field label="Título" error={errores.titulo}>
        {(id) => <Input id={id} value={titulo} placeholder="Ej. Revisión de diseño con el cliente" onChange={(ev) => setTitulo(ev.target.value)} />}
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Field label="Fecha" error={errores.fecha}>
          {(id) => <DatePicker id={id} clearable={false} value={fecha} onChange={(ev) => setFecha(ev.target.value)} />}
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:contents">
          <Field label="Empieza" error={errores.inicio}>
            {(id) => <Input id={id} type="time" value={inicio} onChange={(ev) => setInicio(ev.target.value)} />}
          </Field>
          <Field label="Termina" error={errores.fin}>
            {(id) => <Input id={id} type="time" value={fin} onChange={(ev) => setFin(ev.target.value)} />}
          </Field>
        </div>
      </div>
      <Field label="Tipo">{() => <ChoiceGroup value={modalidad} onChange={setModalidad} options={MODALIDADES} />}</Field>
      {modalidad === "video" ? (
        <Field label="Enlace de la videollamada" error={errores.enlace} hint="Meet, Zoom o Teams. Puedes dejarlo vacío y agregarlo después.">
          {(id) => (
            <div className="flex gap-2">
              <Input id={id} value={enlace} placeholder="https://meet.google.com/…" onChange={(ev) => setEnlace(ev.target.value)} className="min-w-0 flex-1" />
              <a href="https://meet.google.com/new" target="_blank" rel="noreferrer" className="focus-ring inline-flex h-11 shrink-0 items-center rounded-full bg-card px-3.5 text-[13px] font-medium hover:bg-elev">
                Crear Meet
              </a>
            </div>
          )}
        </Field>
      ) : modalidad === "presencial" ? (
        <Field label="Lugar">{(id) => <Input id={id} value={lugar} placeholder="Ej. Oficina del cliente" onChange={(ev) => setLugar(ev.target.value)} />}</Field>
      ) : null}
      <Field label="Asistentes" hint="Separa los nombres con comas.">
        {(id) => <Input id={id} value={participantes} placeholder="Ej. Mara Ellison, Milo Orden" onChange={(ev) => setParticipantes(ev.target.value)} />}
      </Field>
      <Field label="Agenda (opcional)">{(id) => <Textarea id={id} value={agenda} placeholder="Temas a tratar" onChange={(ev) => setAgenda(ev.target.value)} />}</Field>
    </FormModal>
  );
}
