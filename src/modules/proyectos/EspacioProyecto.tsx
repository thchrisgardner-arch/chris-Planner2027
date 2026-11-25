"use client";

/**
 * Espacio de trabajo de un proyecto (tipo Notion): portada, encabezado con estado y progreso, y
 * secciones de tareas, notas, notas de voz, reuniones, imágenes y calendario interno.
 * Escritorio: dos columnas (contenido a la izquierda, voz/reuniones/calendario a la derecha).
 * Celular: una columna, con atajos para saltar entre secciones.
 */
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CalendarClock, CheckSquare, Image as ImageIcon, ImagePlus, Mic, NotebookPen, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/misc";
import { useForms } from "@/components/providers/FormsProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { espacio, leerEspacio, useEspacio } from "@/lib/proyectos/espacio";
import type { Project, ProjectStatus } from "@/types/db";
import { relativeDay } from "@/utils/dates";
import { formatCOP } from "@/utils/money";
import { cn } from "@/utils/cn";
import { PROJECT_STATUSES, priorityLabel, projectProgress, projectStatusLabel } from "@/modules/projects/constants";
import { TaskRow } from "@/modules/projects/ProjectsPage";
import { CalendarioProyecto } from "./CalendarioProyecto";
import { Imagenes, useArchivoUrl, useSubirImagenes } from "./Imagenes";
import { NotasProyecto } from "./NotasProyecto";
import { Grabadora, TarjetaVoz } from "./NotasVoz";
import { Reuniones } from "./Reuniones";

const SECCIONES = [
  { id: "tareas", label: "Tareas", icon: CheckSquare },
  { id: "voz", label: "Notas de voz", icon: Mic },
  { id: "reuniones", label: "Reuniones", icon: CalendarClock },
  { id: "notas", label: "Notas", icon: NotebookPen },
  { id: "imagenes", label: "Imágenes", icon: ImageIcon },
  { id: "calendario", label: "Calendario", icon: CalendarDays },
] as const;

function Seccion({ id, titulo, icon: Icon, cuenta, accion, children }: { id: string; titulo: string; icon: typeof Mic; cuenta?: number; accion?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="card min-w-0 scroll-mt-24 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-bg-2">
          <Icon size={16} />
        </span>
        <h2 id={`${id}-titulo`} className="text-[16px] font-bold">
          {titulo}
        </h2>
        {cuenta ? <span className="num rounded-full bg-bg-2 px-2 py-0.5 text-[12px] text-muted">{cuenta}</span> : null}
        <div className="ml-auto">{accion}</div>
      </div>
      {children}
    </section>
  );
}

export function EspacioProyecto({ id }: { id: string }) {
  const { db } = useData();
  const proyecto = db.projects.find((p) => p.id === id);
  if (!proyecto) {
    return (
      <div className="mx-auto mt-10 max-w-md">
        <EmptyState title="Este proyecto ya no existe" />
        <Link href="/proyectos" className="focus-ring mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-full bg-card px-4 py-2 text-[14px] font-medium">
          <ArrowLeft size={16} /> Volver a proyectos
        </Link>
      </div>
    );
  }
  return <Espacio proyecto={proyecto} />;
}

function Espacio({ proyecto: p }: { proyecto: Project }) {
  const { db, update, insert } = useData();
  const open = useForms();
  const { toast } = useFeedback();
  const today = useToday();
  const e = useEspacio();
  const subir = useSubirImagenes(p.id);
  const inputPortada = useRef<HTMLInputElement>(null);
  const [nueva, setNueva] = useState("");

  const prog = projectProgress(p, db.tasks);
  const tareas = db.tasks.filter((t) => t.project_id === p.id && !t.parent_task_id);
  const voces = e.voz.filter((v) => v.proyectoId === p.id);
  const reuniones = e.reuniones.filter((r) => r.proyectoId === p.id);
  const imagenes = e.imagenes.filter((i) => i.proyectoId === p.id);
  const portadaId = e.portadas[p.id];
  const portada = useArchivoUrl(portadaId);
  const proxima = reuniones.filter((r) => `${r.fecha}${r.inicio}` >= `${today}`).sort((a, b) => `${a.fecha}${a.inicio}`.localeCompare(`${b.fecha}${b.inicio}`))[0];

  const agregarTarea = async () => {
    const nombre = nueva.trim();
    if (!nombre) return;
    await insert("tasks", { project_id: p.id, parent_task_id: null, name: nombre, description: null, due_date: null, priority: "media", status: "pendiente" });
    setNueva("");
  };

  return (
    <div className="mx-auto max-w-[1280px]">
      {/* Portada */}
      <div className="relative -mx-4 -mt-5 mb-5 h-36 overflow-hidden sm:mx-0 sm:mt-0 sm:h-48 sm:rounded-[28px]">
        {portada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portada} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            aria-hidden
            className="h-full w-full"
            style={{
              background: `radial-gradient(120% 140% at 0% 0%, color-mix(in oklab, ${p.color} 55%, transparent) 0%, transparent 60%), radial-gradient(90% 120% at 100% 100%, color-mix(in oklab, var(--color-brand) 45%, transparent) 0%, transparent 60%), var(--color-card)`,
            }}
          />
        )}
        <div className="absolute right-3 top-3 flex gap-1.5">
          <button
            type="button"
            onClick={() => inputPortada.current?.click()}
            className="focus-ring inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-bg/90 px-3 text-[12.5px] font-medium backdrop-blur hover:bg-bg"
          >
            <ImagePlus size={14} /> {portada ? "Cambiar portada" : "Agregar portada"}
          </button>
          {portada ? (
            <button type="button" onClick={() => espacio.ponerPortada(p.id, null)} className="focus-ring h-8 cursor-pointer rounded-full bg-bg/90 px-3 text-[12.5px] font-medium backdrop-blur hover:bg-bg">
              Quitar
            </button>
          ) : null}
        </div>
        <input
          ref={inputPortada}
          type="file"
          accept="image/*"
          hidden
          onChange={async (ev) => {
            const f = ev.target.files;
            ev.target.value = "";
            if (!f?.length) return;
            // La imagen recién subida queda como portada
            const antes = new Set(leerEspacio().imagenes.map((i) => i.id));
            await subir(f);
            const nuevaId = leerEspacio().imagenes.find((i) => !antes.has(i.id))?.id;
            if (nuevaId) espacio.ponerPortada(p.id, nuevaId);
          }}
        />
      </div>

      {/* Encabezado */}
      <Link href="/proyectos" className="focus-ring mb-3 inline-flex items-center gap-1.5 rounded-full text-[13px] font-medium text-muted hover:text-fg">
        <ArrowLeft size={15} /> Proyectos
      </Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
            <h1 className="min-w-0 text-[30px] leading-tight tracking-[-0.02em] sm:text-[38px]">{p.name}</h1>
          </div>
          {p.description ? <p className="mt-1.5 max-w-[62ch] text-[14.5px] text-muted">{p.description}</p> : null}
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
            {p.category ? <span>{p.category}</span> : null}
            <span>Prioridad {priorityLabel(p.priority).toLowerCase()}</span>
            {p.due_date ? <span className={cn(p.status !== "completado" && p.due_date < today && "text-warn")}>Entrega {relativeDay(p.due_date, today).toLowerCase()}</span> : null}
            {p.budget ? <span>Presupuesto {formatCOP(p.budget)}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={p.status}
            aria-label={`Estado de ${p.name}`}
            className="h-11 w-[170px] rounded-full bg-card text-[13.5px]"
            onChange={async (ev) => {
              await update("projects", p.id, { status: ev.target.value as ProjectStatus });
              toast(`${p.name}: ${projectStatusLabel(ev.target.value as ProjectStatus)}`);
            }}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Button variant="secondary" className="bg-card" onClick={() => open({ kind: "project", record: p })}>
            <Pencil size={16} /> Editar
          </Button>
        </div>
      </div>

      {/* Resumen en cifras */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="col-span-2 rounded-[20px] bg-card p-4 sm:col-span-1">
          <p className="text-[12.5px] text-muted">Progreso</p>
          <p className="figure mt-1 text-[30px] leading-none">
            {Math.round(prog.pct)}
            <span className="text-[15px] text-muted"> %</span>
          </p>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-bg-2" role="progressbar" aria-label="Progreso del proyecto" aria-valuenow={Math.round(prog.pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className={cn("h-full rounded-full", prog.pct >= 100 ? "bg-brand" : "bg-fg")} style={{ width: `${prog.pct}%` }} />
          </div>
        </div>
        {[
          { label: "Tareas", valor: `${prog.done}/${prog.total}`, nota: prog.total ? "completadas" : "aún sin tareas" },
          { label: "Notas de voz", valor: String(voces.length), nota: voces.length ? "grabadas" : "graba la primera" },
          { label: "Próxima reunión", valor: proxima ? relativeDay(proxima.fecha, today) : "—", nota: proxima ? proxima.titulo : "nada agendado" },
        ].map((k) => (
          <div key={k.label} className="min-w-0 rounded-[20px] bg-card p-4">
            <p className="text-[12.5px] text-muted">{k.label}</p>
            <p className="num mt-1 truncate text-[22px] font-bold leading-tight">{k.valor}</p>
            <p className="mt-1 truncate text-[12.5px] text-dim">{k.nota}</p>
          </div>
        ))}
      </div>

      {/* Atajos a las secciones */}
      <nav aria-label="Secciones del proyecto" className="mt-4 flex flex-wrap gap-1.5">
        {SECCIONES.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-[13px] font-medium hover:bg-elev">
            <s.icon size={15} /> {s.label}
          </a>
        ))}
      </nav>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="grid min-w-0 grid-cols-1 gap-3">
          <Seccion id="tareas" titulo="Tareas" icon={CheckSquare} cuenta={tareas.length}>
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                void agregarTarea();
              }}
              className="mb-2 flex items-center gap-2 rounded-[16px] bg-bg-2 p-1.5 pl-3"
            >
              <Plus size={17} className="shrink-0 text-dim" />
              <input
                value={nueva}
                onChange={(ev) => setNueva(ev.target.value)}
                placeholder="Escribe una tarea y presiona Enter"
                aria-label="Nueva tarea"
                className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] outline-none placeholder:text-dim"
              />
              <Button type="submit" size="sm" variant="primary" disabled={!nueva.trim()}>
                Agregar
              </Button>
            </form>
            {tareas.length ? (
              <ul className="-mx-2 flex flex-col">
                {tareas.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </ul>
            ) : (
              <p className="px-1 py-3 text-[13px] text-dim">Aún no hay tareas. Escribe la primera arriba.</p>
            )}
          </Seccion>

          <Seccion id="notas" titulo="Notas" icon={NotebookPen}>
            <NotasProyecto proyectoId={p.id} />
          </Seccion>

          <Seccion id="imagenes" titulo="Imágenes" icon={ImageIcon} cuenta={imagenes.length}>
            <Imagenes proyectoId={p.id} />
          </Seccion>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 lg:sticky lg:top-24">
          <Seccion id="voz" titulo="Notas de voz" icon={Mic} cuenta={voces.length}>
            <div className="grid grid-cols-1 gap-2.5">
              <Grabadora proyectoId={p.id} />
              {voces.map((v) => (
                <TarjetaVoz key={v.id} nota={v} reunionTitulo={v.reunionId ? reuniones.find((r) => r.id === v.reunionId)?.titulo : undefined} />
              ))}
            </div>
          </Seccion>
          <Seccion id="reuniones" titulo="Reuniones" icon={CalendarClock} cuenta={reuniones.length}>
            <Reuniones proyecto={p} />
          </Seccion>
          <Seccion id="calendario" titulo="Calendario del proyecto" icon={CalendarDays}>
            <CalendarioProyecto proyecto={p} />
          </Seccion>
        </div>
      </div>
    </div>
  );
}

