"use client";

/**
 * Panel Tareas del proyecto: las tareas globales con este project_id (lo que se cambia aquí se ve
 * en Proyectos y en Inicio, y al revés). Vista Lista o Tablero (Por hacer / En curso / Hecho),
 * recordada por proyecto. En el tablero: arrastrar entre columnas (escritorio), deslizar (celular)
 * y siempre el menú «Mover a…» para teclado y lector de pantalla.
 * Crear: escribe y Enter (o la tecla N). Entiende fecha y responsable: «Ana: enviar la propuesta el viernes».
 */
import { useEspacio } from "@/lib/proyectos/espacio";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckSquare, MoreHorizontal, Paperclip, Pencil, Plus, Timer, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, Segmented } from "@/components/ui/misc";
import { Popover } from "@/components/ui/Popover";
import { Deslizable } from "@/components/ui/Deslizable";
import { useDeleteRecord } from "@/components/ui/RowActions";
import { useForms } from "@/components/providers/FormsProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { registrarNuevo } from "@/lib/atajoNuevo";
import { interpretarAcuerdo } from "@/lib/proyectos/acuerdos";
import { almacenVistas, type VistaTareas } from "@/lib/proyectos/vistas";
import type { Project, Task, TaskStatus } from "@/types/db";
import { relativeDay } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { CheckCircle, useToggleTask } from "@/modules/dashboard/DashboardWidgets";
import { iniciarEnfoque } from "@/modules/enfoque/ModoEnfoque";
import { priorityLabel, priorityTone } from "@/modules/projects/constants";
import { TaskRow } from "@/modules/projects/ProjectsPage";
import { Seccion } from "./Seccion";

export const COLUMNAS: { status: TaskStatus; label: string }[] = [
  { status: "pendiente", label: "Por hacer" },
  { status: "en_proceso", label: "En curso" },
  { status: "completada", label: "Hecho" },
];
const etiqueta = (s: TaskStatus) => COLUMNAS.find((c) => c.status === s)!.label;

export function PanelTareas({ proyecto }: { proyecto: Project }) {
  const { db, insert } = useData();
  const { toast } = useFeedback();
  const today = useToday();
  const vista = almacenVistas.useValor().tareas[proyecto.id] ?? "lista";
  const [nueva, setNueva] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  const tareas = db.tasks.filter((t) => t.project_id === proyecto.id && !t.parent_task_id);

  useEffect(() => registrarNuevo(() => campo.current?.focus()), []);

  const cambiarVista = (v: VistaTareas) => almacenVistas.cambiar((x) => ({ ...x, tareas: { ...x.tareas, [proyecto.id]: v } }));

  const agregar = async () => {
    const texto = nueva.trim();
    if (!texto) return;
    const a = interpretarAcuerdo(texto, today);
    await insert("tasks", {
      project_id: proyecto.id,
      parent_task_id: null,
      name: a.nombre || texto,
      description: null,
      due_date: a.fecha,
      priority: "media",
      status: "pendiente",
      assignee: a.responsable,
    });
    setNueva("");
    const extra = [a.fecha ? relativeDay(a.fecha, today).toLowerCase() : "", a.responsable ? `para ${a.responsable}` : ""].filter(Boolean).join(", ");
    toast(extra ? `Tarea creada: ${extra}` : "Tarea creada");
  };

  return (
    <Seccion
      id="tareas"
      titulo="Tareas"
      icon={CheckSquare}
      cuenta={tareas.length}
      accion={
        <>
          <Segmented
            size="sm"
            label="Vista de las tareas"
            className="shrink-0 flex-nowrap"
            value={vista}
            onChange={cambiarVista}
            options={[
              { value: "lista", label: "Lista" },
              { value: "tablero", label: "Tablero" },
            ]}
          />
          <Button size="sm" variant="primary" onClick={() => campo.current?.focus()} title="Nueva tarea (N)">
            <Plus size={16} /> Nueva
          </Button>
        </>
      }
    >
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          void agregar();
        }}
        className="mb-3 flex items-center gap-2 rounded-[16px] bg-bg-2 p-1.5 pl-3"
      >
        <Plus size={17} className="shrink-0 text-dim" />
        <input
          ref={campo}
          value={nueva}
          onChange={(ev) => setNueva(ev.target.value)}
          placeholder="Escribe una tarea y presiona Enter"
          aria-label="Nueva tarea"
          aria-describedby="tareas-ayuda"
          className="min-w-0 flex-1 rounded-[8px] bg-transparent px-1 py-1.5 text-[14px] outline-none placeholder:text-dim focus-visible:ring-2 focus-visible:ring-fg"
        />
        <Button type="submit" size="sm" variant="primary" disabled={!nueva.trim()}>
          Agregar
        </Button>
      </form>
      <p id="tareas-ayuda" className="sr-only">
        Puedes escribir la fecha y el responsable, por ejemplo: Ana, enviar la propuesta el viernes.
      </p>

      {!tareas.length ? (
        <p className="px-1 py-3 text-[13px] text-dim">Aún no hay tareas. Escribe la primera arriba.</p>
      ) : vista === "lista" ? (
        <ul className="-mx-2 flex flex-col">
          {tareas.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      ) : (
        <Tablero tareas={tareas} />
      )}
    </Seccion>
  );
}

/* ═════════ Tablero ═════════ */
function useMover() {
  const { update } = useData();
  const { toast } = useFeedback();
  return async (t: Task, status: TaskStatus) => {
    if (t.status === status) return;
    try {
      await update("tasks", t.id, { status });
      toast(`«${t.name}» pasó a ${etiqueta(status)}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo mover la tarea.", "error");
    }
  };
}

function Tablero({ tareas }: { tareas: Task[] }) {
  const mover = useMover();
  const [sobre, setSobre] = useState<TaskStatus | null>(null);
  const porId = new Map(tareas.map((t) => [t.id, t]));

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {COLUMNAS.map((c) => {
        const lista = tareas.filter((t) => t.status === c.status);
        return (
          <section
            key={c.status}
            aria-label={`${c.label}, ${lista.length} ${lista.length === 1 ? "tarea" : "tareas"}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (sobre !== c.status) setSobre(c.status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setSobre(null);
              const t = porId.get(e.dataTransfer.getData("text/plain"));
              if (t) void mover(t, c.status);
            }}
            className={cn("min-w-0 rounded-[20px] bg-bg-2 p-2.5", sobre === c.status && "ring-2 ring-fg")}
          >
            <h3 className="mb-2 flex items-center gap-2 px-1.5 pt-0.5 text-[13.5px] font-bold">
              {c.label}
              <span className="num rounded-full bg-bg px-2 py-0.5 text-[12px] font-normal text-muted">{lista.length}</span>
            </h3>
            <ul className="flex min-h-12 flex-col gap-2">
              {lista.map((t) => (
                <li key={t.id}>
                  <TarjetaTarea tarea={t} mover={mover} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TarjetaTarea({ tarea: t, mover }: { tarea: Task; mover: (t: Task, s: TaskStatus) => Promise<void> }) {
  const { db } = useData();
  const open = useForms();
  const toggle = useToggleTask();
  const del = useDeleteRecord();
  const today = useToday();
  const subs = db.tasks.filter((s) => s.parent_task_id === t.id);
  const adjuntos = useEspacio().imagenes.filter((i) => i.vinculos?.some((v) => v.tabla === "tasks" && v.id === t.id)).length;
  const done = t.status === "completada";
  const vencida = !done && t.due_date && t.due_date < today;
  const i = COLUMNAS.findIndex((c) => c.status === t.status);
  const siguiente = COLUMNAS[i + 1];
  const anterior = COLUMNAS[i - 1];

  return (
    <Deslizable
      fondo="bg-bg"
      redondeo={16}
      derecha={siguiente ? { label: `Mover a ${siguiente.label}`, icono: <ArrowRight size={18} />, tono: "marca", onAccion: () => void mover(t, siguiente.status) } : null}
      acciones={anterior ? [{ label: `Mover a ${anterior.label}`, icono: <ArrowLeft size={18} />, onAccion: () => void mover(t, anterior.status) }] : []}
    >
      <article
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", t.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        aria-label={t.name}
        className="cursor-grab rounded-[16px] bg-bg p-3 active:cursor-grabbing"
      >
        <div className="flex items-start gap-2">
          <button type="button" onClick={() => open({ kind: "task", record: t })} className={cn("focus-ring min-w-0 flex-1 cursor-pointer rounded-[8px] text-left text-[14px] font-medium leading-snug", done && "text-dim line-through")}>
            {t.name}
          </button>
          <Popover
            side="bottom"
            trigger={({ open: abierto, toggle: alternar }) => (
              <Button size="icon-sm" variant="ghost" className="-mr-1.5 -mt-1.5 shrink-0" aria-label={`Opciones de ${t.name}`} aria-expanded={abierto} onClick={alternar}>
                <MoreHorizontal size={17} />
              </Button>
            )}
          >
            {(cerrar: () => void) => (
              <div className="grid min-w-[190px] gap-0.5 p-1" role="menu" aria-label={`Opciones de ${t.name}`}>
                <p className="px-3 pb-1 pt-1.5 text-[11.5px] font-medium text-muted">Mover a…</p>
                {COLUMNAS.filter((c) => c.status !== t.status).map((c) => (
                  <button key={c.status} type="button" role="menuitem" onClick={() => (cerrar(), void mover(t, c.status))} className="flex cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13.5px] hover:bg-card">
                    <ArrowRight size={15} /> {c.label}
                  </button>
                ))}
                <div className="my-1 h-px bg-line" aria-hidden />
                <button type="button" role="menuitem" onClick={() => (cerrar(), open({ kind: "task", record: t }))} className="flex cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13.5px] hover:bg-card">
                  <Pencil size={15} /> Editar
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => (cerrar(), open({ kind: "task", defaults: { parent_task_id: t.id, project_id: t.project_id } }))}
                  className="flex cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13.5px] hover:bg-card"
                >
                  <Plus size={15} /> Agregar subtarea
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => (cerrar(), void del("tasks", t.id, `¿Eliminar «${t.name}»?`, subs.length ? `También se eliminarán ${subs.length} subtareas.` : undefined))}
                  className="flex cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13.5px] text-danger hover:bg-card"
                >
                  <Trash2 size={15} /> Eliminar
                </button>
              </div>
            )}
          </Popover>
        </div>
        {t.description ? <p className="mt-1 line-clamp-2 text-[12.5px] text-muted">{t.description}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
          <span className={cn(vencida && "text-danger")}>{t.due_date ? relativeDay(t.due_date, today) : "Sin fecha"}</span>
          <Badge tone={priorityTone(t.priority)}>{priorityLabel(t.priority)}</Badge>
          {adjuntos ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-bg-2 px-2 py-0.5" title="Imágenes adjuntas">
              <Paperclip size={12} aria-hidden /> {adjuntos}
              <span className="sr-only">{adjuntos === 1 ? "imagen adjunta" : "imágenes adjuntas"}</span>
            </span>
          ) : null}
          {t.assignee ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-bg-2 px-2 py-0.5">
              <UserRound size={12} aria-hidden /> {t.assignee}
            </span>
          ) : null}
        </div>
        {subs.length ? (
          <ul className="mt-2.5 flex flex-col gap-1" aria-label={`Subtareas de ${t.name}`}>
            {subs.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-[13px]">
                <CheckCircle checked={s.status === "completada"} onToggle={() => void toggle(s)} label={`${s.status === "completada" ? "Reabrir" : "Completar"} ${s.name}`} />
                <span className={cn("min-w-0 truncate", s.status === "completada" && "text-dim line-through")}>{s.name}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {!done ? (
          <div className="mt-2.5 flex">
            <button
              type="button"
              onClick={() => iniciarEnfoque(t.id)}
              className="focus-ring inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-bg-2 px-3 text-[12.5px] font-medium hover:bg-elev"
              aria-label={`Enfocar en ${t.name}`}
            >
              <Timer size={14} /> Enfocar
            </button>
          </div>
        ) : null}
      </article>
    </Deslizable>
  );
}
