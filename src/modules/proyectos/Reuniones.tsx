"use client";

/**
 * Reuniones del proyecto: agendar (videollamada, llamada o presencial), participantes y agenda.
 * Cada reunión se agrega al calendario de la app. Las próximas muestran cuenta regresiva y
 * "Unirse"; desde cualquiera se puede grabar una nota de voz ligada a la reunión.
 */
import { useEffect, useState } from "react";
import { MapPin, Mic, MoreHorizontal, Pencil, Phone, Plus, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormModal } from "@/components/ui/FormModal";
import { DatePicker } from "@/components/ui/DatePicker";
import { ChoiceGroup, Field, Input, Textarea } from "@/components/ui/Field";
import { Popover } from "@/components/ui/Popover";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { espacio, nuevoId, useEspacio, type Modalidad, type Reunion } from "@/lib/proyectos/espacio";
import type { Project } from "@/types/db";
import { formatTime, todayISO } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { Grabadora } from "./NotasVoz";

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

/** Minutos que faltan (negativo si ya empezó), en hora de Bogotá */
function minutosHasta(fecha: string, hora: string) {
  const objetivo = new Date(`${fecha}T${hora || "00:00"}:00-05:00`).getTime();
  return Math.round((objetivo - Date.now()) / 60000);
}
function cuenta(r: Reunion): { texto: string; tono: "ahora" | "pronto" | "luego" | "pasada" } {
  const m = minutosHasta(r.fecha, r.inicio);
  const fin = minutosHasta(r.fecha, r.fin || r.inicio);
  if (m <= 0 && fin >= 0) return { texto: "Ahora", tono: "ahora" };
  if (fin < 0) return { texto: "Terminó", tono: "pasada" };
  if (m < 60) return { texto: `En ${m} min`, tono: "pronto" };
  if (m < 60 * 24) return { texto: `En ${Math.round(m / 60)} h`, tono: "pronto" };
  const d = Math.round(m / (60 * 24));
  return { texto: d === 1 ? "Mañana" : `En ${d} días`, tono: "luego" };
}

export function Reuniones({ proyecto }: { proyecto: Project }) {
  const e = useEspacio();
  const [form, setForm] = useState<{ abierto: boolean; registro?: Reunion }>({ abierto: false });
  const [grabarPara, setGrabarPara] = useState<string | null>(null);
  const [, refrescar] = useState(0);
  const today = useToday();

  // La cuenta regresiva se actualiza cada minuto
  useEffect(() => {
    const t = setInterval(() => refrescar((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const lista = e.reuniones.filter((r) => r.proyectoId === proyecto.id).sort((a, b) => `${a.fecha}${a.inicio}`.localeCompare(`${b.fecha}${b.inicio}`));
  const proximas = lista.filter((r) => cuenta(r).tono !== "pasada");
  const pasadas = lista.filter((r) => cuenta(r).tono === "pasada").reverse();

  return (
    <div className="grid grid-cols-1 gap-2.5">
      {proximas.length === 0 ? (
        <div className="rounded-[20px] bg-bg-2 p-4 text-center">
          <p className="text-[14px] font-medium">Sin reuniones próximas</p>
          <p className="mt-0.5 text-[12.5px] text-muted">Agenda una y queda en tu calendario.</p>
        </div>
      ) : (
        proximas.map((r) => <TarjetaReunion key={r.id} r={r} onEditar={() => setForm({ abierto: true, registro: r })} onGrabar={() => setGrabarPara(r.id)} />)
      )}
      {grabarPara ? (
        <div className="grid gap-1.5">
          <p className="px-1 text-[12.5px] text-muted">Nota de voz para «{lista.find((r) => r.id === grabarPara)?.titulo}»</p>
          <Grabadora proyectoId={proyecto.id} reunionId={grabarPara} onGuardada={() => setGrabarPara(null)} />
        </div>
      ) : null}
      <Button variant="primary" className="w-full" onClick={() => setForm({ abierto: true })}>
        <Plus size={18} /> Agendar reunión
      </Button>
      {pasadas.length ? (
        <details className="group rounded-[18px] bg-bg-2 px-3 py-2">
          <summary className="cursor-pointer list-none text-[13px] font-medium text-muted marker:hidden">Reuniones pasadas ({pasadas.length})</summary>
          <div className="mt-2 grid gap-2">
            {pasadas.map((r) => (
              <TarjetaReunion key={r.id} r={r} compacta onEditar={() => setForm({ abierto: true, registro: r })} onGrabar={() => setGrabarPara(r.id)} />
            ))}
          </div>
        </details>
      ) : null}
      {form.abierto ? <FormReunion proyecto={proyecto} registro={form.registro} hoy={today} onClose={() => setForm({ abierto: false })} /> : null}
    </div>
  );
}

function TarjetaReunion({ r, onEditar, onGrabar, compacta }: { r: Reunion; onEditar: () => void; onGrabar: () => void; compacta?: boolean }) {
  const { remove } = useData();
  const { confirm } = useFeedback();
  const c = cuenta(r);
  const Icono = ICONO[r.modalidad];
  const [, m, d] = r.fecha.split("-");
  const borrar = async () => {
    if (!(await confirm({ title: `¿Eliminar «${r.titulo}»?`, description: "También se quita de tu calendario.", confirmLabel: "Eliminar", destructive: true }))) return;
    if (r.eventoId) await remove("calendar_events", r.eventoId).catch(() => {});
    espacio.borrarReunion(r.id);
  };
  return (
    <article className={cn("rounded-[20px] p-3.5", compacta ? "bg-bg" : "bg-bg-2", c.tono === "ahora" && "ring-2 ring-[var(--color-brand)]")}>
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-bg text-center leading-none">
          <span className="num text-[17px] font-bold">{Number(d)}</span>
          <span className="-mt-2 text-[10.5px] uppercase text-muted">{MES[Number(m) - 1]}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-bold">{r.titulo}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted">
            <Icono size={13} /> {formatTime(r.inicio)}
            {r.fin ? `–${formatTime(r.fin)}` : ""}
            {r.modalidad === "presencial" && r.lugar ? <span className="truncate">· {r.lugar}</span> : null}
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
      {!compacta && (r.participantes.length || r.agenda) ? (
        <div className="mt-3 flex items-center gap-2">
          {r.participantes.length ? (
            <div className="flex -space-x-2" aria-label={`Participantes: ${r.participantes.join(", ")}`}>
              {r.participantes.slice(0, 4).map((p) => (
                <span key={p} title={p} className="grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--color-bg-2)] bg-fg text-[10.5px] font-bold text-on-fg">
                  {iniciales(p)}
                </span>
              ))}
              {r.participantes.length > 4 ? (
                <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[var(--color-bg-2)] bg-elev text-[10.5px] font-bold">+{r.participantes.length - 4}</span>
              ) : null}
            </div>
          ) : null}
          {r.agenda ? <p className="min-w-0 flex-1 truncate text-[12.5px] text-muted">{r.agenda}</p> : null}
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-1.5">
        {r.modalidad === "video" && r.enlace && c.tono !== "pasada" ? (
          <a href={r.enlace} target="_blank" rel="noreferrer" className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full bg-fg px-3.5 text-[13px] font-medium text-on-fg">
            <Video size={15} /> Unirse
          </a>
        ) : null}
        <button type="button" onClick={onGrabar} className="focus-ring inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-bg px-3 text-[13px] font-medium hover:bg-elev">
          <Mic size={15} /> Nota de voz
        </button>
        <div className="ml-auto">
          <Popover
            side="bottom"
            trigger={({ toggle }) => (
              <Button size="icon-sm" variant="ghost" aria-label={`Opciones de ${r.titulo}`} onClick={toggle}>
                <MoreHorizontal size={17} />
              </Button>
            )}
          >
            {(cerrar: () => void) => (
              <div className="grid min-w-[160px] gap-0.5 p-1">
                <button type="button" onClick={() => (cerrar(), onEditar())} className="flex cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13.5px] hover:bg-card">
                  <Pencil size={15} /> Editar
                </button>
                <button type="button" onClick={() => (cerrar(), borrar())} className="flex cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13.5px] text-danger hover:bg-card">
                  <Trash2 size={15} /> Eliminar
                </button>
              </div>
            )}
          </Popover>
        </div>
      </div>
    </article>
  );
}

function FormReunion({ proyecto, registro, hoy, onClose }: { proyecto: Project; registro?: Reunion; hoy: string; onClose: () => void }) {
  const { insert, update } = useData();
  const [titulo, setTitulo] = useState(registro?.titulo ?? "");
  const [fecha, setFecha] = useState(registro?.fecha ?? (hoy || todayISO()));
  const [inicio, setInicio] = useState(registro?.inicio ?? "10:00");
  const [fin, setFin] = useState(registro?.fin ?? "10:30");
  const [modalidad, setModalidad] = useState<Modalidad>(registro?.modalidad ?? "video");
  const [enlace, setEnlace] = useState(registro?.enlace ?? "");
  const [lugar, setLugar] = useState(registro?.lugar ?? "");
  const [participantes, setParticipantes] = useState(registro?.participantes.join(", ") ?? "");
  const [agenda, setAgenda] = useState(registro?.agenda ?? "");
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

    const notas = [`Proyecto: ${proyecto.name}`, modalidad === "video" && link ? `Enlace: ${link}` : "", modalidad === "presencial" && lugar ? `Lugar: ${lugar}` : "", agenda.trim()]
      .filter(Boolean)
      .join("\n");
    const evento = { title: `Reunión: ${titulo.trim()}`, date: fecha, start_time: inicio, end_time: fin || null, type: "personal" as const, notes: notas };
    let eventoId = registro?.eventoId;
    if (eventoId) await update("calendar_events", eventoId, evento).catch(() => (eventoId = undefined));
    if (!eventoId) eventoId = (await insert("calendar_events", evento)).id;

    espacio.guardarReunion({
      id: registro?.id ?? nuevoId("reu"),
      proyectoId: proyecto.id,
      titulo: titulo.trim(),
      fecha,
      inicio,
      fin,
      modalidad,
      enlace: link,
      lugar: lugar.trim(),
      participantes: participantes
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      agenda: agenda.trim(),
      eventoId,
      creada: registro?.creada ?? new Date().toISOString(),
    });
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
      <Field label="Participantes" hint="Separa los nombres con comas.">
        {(id) => <Input id={id} value={participantes} placeholder="Ej. Mara Ellison, Milo Orden" onChange={(ev) => setParticipantes(ev.target.value)} />}
      </Field>
      <Field label="Agenda (opcional)">{(id) => <Textarea id={id} value={agenda} placeholder="Temas a tratar" onChange={(ev) => setAgenda(ev.target.value)} />}</Field>
    </FormModal>
  );
}
