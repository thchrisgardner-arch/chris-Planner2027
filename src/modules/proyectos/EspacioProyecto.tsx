"use client";

/**
 * Espacio de trabajo de un proyecto (tipo Notion): portada, encabezado con estado y progreso, y
 * pestañas que abren un panel a la vez, cada uno con su dirección (/proyectos/<id>/<panel>):
 * Tareas, Dinero, Notas de voz, Reuniones, Notas, Imágenes y Calendario. Cada panel es una vista filtrada
 * por proyecto de los datos de toda la app (tareas, eventos, notas de voz…), no una copia.
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/Enlace";
import { ArrowLeft, CalendarDays, CalendarClock, CheckSquare, FolderDown, Image as ImageIcon, ImagePlus, Mic, NotebookPen, Pencil, Wallet, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/misc";
import { useForms } from "@/components/providers/FormsProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { espacio, leerArchivo, leerEspacio, useEspacio } from "@/lib/proyectos/espacio";
import { descargar, slug, zipNotas } from "@/lib/proyectos/exportarVoz";
import { cuenta, esReunion, ordenarReuniones, tituloReunion } from "@/lib/proyectos/reuniones";
import { PANELES, recordarPanel, rutaProyecto, type Panel } from "@/lib/proyectos/vistas";
import type { Project, ProjectStatus } from "@/types/db";
import { relativeDay } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { PROJECT_STATUSES, priorityLabel, projectProgress, projectStatusLabel } from "@/modules/projects/constants";
import { PanelCalendario } from "./PanelCalendario";
import { Imagenes, crearImagenesEjemplo, useArchivoUrl, useSubirImagenes } from "./Imagenes";
import { Grabadora, TarjetaVoz, crearNotaEjemplo } from "./NotasVoz";
import { PanelReuniones } from "./Reuniones";
import { PanelTareas } from "./PanelTareas";
import { PanelDinero } from "./PanelDinero";
import { CierreProyecto } from "./CierreProyecto";
import { lineaPresupuesto, resumenDinero } from "@/lib/proyectos/dinero";
import { almacenEnfoque } from "@/modules/enfoque/ModoEnfoque";
import { Seccion } from "./Seccion";

// El editor de notas (Tiptap) solo se descarga al abrir el panel Notas
const PanelNotas = lazy(() => import("./PanelNotas").then((m) => ({ default: m.PanelNotas })));

const PESTANAS: Record<Panel, { label: string; icon: LucideIcon }> = {
  tareas: { label: "Tareas", icon: CheckSquare },
  dinero: { label: "Dinero", icon: Wallet },
  "notas-de-voz": { label: "Notas de voz", icon: Mic },
  reuniones: { label: "Reuniones", icon: CalendarClock },
  notas: { label: "Notas", icon: NotebookPen },
  imagenes: { label: "Imágenes", icon: ImageIcon },
  calendario: { label: "Calendario", icon: CalendarDays },
};

export function EspacioProyecto({ id, panel }: { id: string; panel: Panel }) {
  const { db, status } = useData();
  const proyecto = db.projects.find((p) => p.id === id);
  if (status !== "ready") return null;
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
  return <Espacio proyecto={proyecto} panel={panel} />;
}

/** Se cambió de pestaña con el teclado: la nueva pestaña recibe el foco al aparecer */
let focoPendiente = false;

/** Barra de pestañas (mismos chips de siempre): enlaces reales, con flechas, Inicio y Fin */
function Pestanas({ proyectoId, activo }: { proyectoId: string; activo: Panel }) {
  const router = useRouter();
  const refs = useRef<Record<string, HTMLAnchorElement | null>>({});
  // Cada panel es otra página: al llegar, el foco vuelve a la pestaña activa
  useEffect(() => {
    if (!focoPendiente) return;
    focoPendiente = false;
    refs.current[activo]?.focus();
  }, [activo]);
  const ir = (p: Panel) => {
    focoPendiente = true;
    router.push(rutaProyecto(proyectoId, p), { scroll: false });
    refs.current[p]?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = PANELES.indexOf(activo);
    const destino =
      e.key === "ArrowRight" ? PANELES[(i + 1) % PANELES.length] : e.key === "ArrowLeft" ? PANELES[(i - 1 + PANELES.length) % PANELES.length] : e.key === "Home" ? PANELES[0] : e.key === "End" ? PANELES[PANELES.length - 1] : null;
    if (!destino) return;
    e.preventDefault();
    ir(destino);
  };
  return (
    <nav aria-label="Paneles del proyecto" className="mt-4">
      <div role="tablist" aria-label="Paneles del proyecto" className="flex flex-wrap gap-1.5" onKeyDown={onKeyDown}>
        {PANELES.map((p) => {
          const { label, icon: Icon } = PESTANAS[p];
          const sel = p === activo;
          return (
            <Link
              key={p}
              ref={(el: HTMLAnchorElement | null) => {
                refs.current[p] = el;
              }}
              href={rutaProyecto(proyectoId, p)}
              scroll={false}
              role="tab"
              id={`pestana-${p}`}
              aria-selected={sel}
              aria-controls="panel-proyecto"
              tabIndex={sel ? 0 : -1}
              className={cn("focus-ring inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium", sel ? "bg-fg text-on-fg" : "bg-card hover:bg-elev")}
            >
              <Icon size={15} /> {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Demo: el proyecto de ejemplo trae una nota de voz (una vez por sesión) */
const sembrados = new Set<string>();

function Espacio({ proyecto: p, panel }: { proyecto: Project; panel: Panel }) {
  const { db, update, mode } = useData();
  const open = useForms();
  const { toast } = useFeedback();
  const today = useToday();
  const e = useEspacio();
  const [exportando, setExportando] = useState(false);
  // Al marcarlo como terminado: resumen de cierre con Tuerca y Centavo
  const [cierre, setCierre] = useState(false);
  const subir = useSubirImagenes(p.id);
  const inputPortada = useRef<HTMLInputElement>(null);

  useEffect(() => recordarPanel(p.id, panel), [p.id, panel]);
  useEffect(() => {
    if (mode !== "demo" || p.name !== "Portafolio 2027" || sembrados.has(p.id)) return;
    sembrados.add(p.id);
    if (!leerEspacio().voz.some((v) => v.proyectoId === p.id)) void crearNotaEjemplo(p.id);
    if (!leerEspacio().imagenes.some((i) => i.proyectoId === p.id)) void crearImagenesEjemplo(p.id, db.tasks.find((t) => t.project_id === p.id && t.name === "Seleccionar casos de estudio")?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- una vez por sesión
  }, [mode, p.id, p.name]);
  useEffect(() => {
    // Demo: el proyecto con ingresos trae 10 h de enfoque (alcanza para el valor por hora), una vez por sesión
    if (mode !== "demo" || !p.money?.generaIngresos || sembrados.has(`enfoque:${p.id}`) || !today) return;
    sembrados.add(`enfoque:${p.id}`);
    if (almacenEnfoque.leer().sesiones.some((x) => x.proyectoId === p.id)) return;
    const sesiones = Array.from({ length: 12 }, (_, i) => ({ id: `ef-demo-${i}`, tareaId: null, proyectoId: p.id, fecha: today, minutos: 50 }));
    almacenEnfoque.cambiar((d) => ({ ...d, sesiones: [...d.sesiones, ...sesiones] }));
  }, [mode, p.id, p.money?.generaIngresos, today]);

  const prog = projectProgress(p, db.tasks);
  // "$320.000 de $500.000 · 64 %" (si tiene presupuesto)
  const linea = today ? lineaPresupuesto(resumenDinero(p, db.transactions, today)) : null;
  const voces = e.voz.filter((v) => v.proyectoId === p.id);
  const reuniones = db.calendar_events.filter((x) => x.project_id === p.id).filter(esReunion).sort(ordenarReuniones);
  const imagenes = e.imagenes.filter((i) => i.proyectoId === p.id);
  const portadaId = e.portadas[p.id];
  const portada = useArchivoUrl(portadaId);
  // Las reuniones que ya terminaron hoy no cuentan como «próxima»
  const siguiente = reuniones.find((r) => r.date >= today && cuenta(r).tono !== "pasada");
  const proxima = siguiente ? { fecha: siguiente.date, titulo: tituloReunion(siguiente) } : null;

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
            {linea ? <span>{linea}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={p.status}
            aria-label={`Estado de ${p.name}`}
            className="h-11 w-[170px] rounded-full bg-card text-[13.5px]"
            onChange={async (ev) => {
              const antes = p.status;
              await update("projects", p.id, { status: ev.target.value as ProjectStatus });
              toast(`${p.name}: ${projectStatusLabel(ev.target.value as ProjectStatus)}`);
              if (ev.target.value === "completado" && antes !== "completado") setCierre(true);
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

      <Pestanas proyectoId={p.id} activo={panel} />

      <div role="tabpanel" id="panel-proyecto" aria-labelledby={`pestana-${panel}`} className="mt-4 min-w-0">
        {panel === "tareas" ? (
          <PanelTareas proyecto={p} />
        ) : panel === "dinero" ? (
          <PanelDinero proyecto={p} />
        ) : panel === "reuniones" ? (
          <PanelReuniones proyecto={p} />
        ) : panel === "notas-de-voz" ? (
          <Seccion
            id="voz"
            titulo="Notas de voz"
            icon={Mic}
            cuenta={voces.length}
            accion={
              voces.length ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Exportar todas las notas de voz en un .zip"
                  title="Exportar todas (.zip)"
                  disabled={exportando}
                  onClick={async () => {
                    setExportando(true);
                    try {
                      const { zip, sinAudio } = await zipNotas(voces, leerArchivo, p.name);
                      descargar(zip, `notas-de-voz-${slug(p.name)}-${today}.zip`);
                      toast(sinAudio ? `Notas exportadas. ${sinAudio === 1 ? "1 no tenía" : `${sinAudio} no tenían`} el audio en este dispositivo.` : "Notas de voz exportadas");
                    } catch {
                      toast("No se pudieron exportar las notas.", "error");
                    } finally {
                      setExportando(false);
                    }
                  }}
                >
                  <FolderDown size={17} />
                </Button>
              ) : null
            }
          >
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              <Grabadora proyectoId={p.id} />
              {voces.map((v) => {
                const r = v.reunionId ? reuniones.find((x) => x.id === v.reunionId) : undefined;
                return <TarjetaVoz key={v.id} nota={v} reunionTitulo={r ? tituloReunion(r) : undefined} />;
              })}
            </div>
          </Seccion>
        ) : panel === "notas" ? (
          <Suspense fallback={null}>
            <PanelNotas proyecto={p} />
          </Suspense>
        ) : panel === "imagenes" ? (
          <Seccion id="imagenes" titulo="Imágenes" icon={ImageIcon} cuenta={imagenes.length}>
            <Imagenes proyectoId={p.id} />
          </Seccion>
        ) : (
          <PanelCalendario proyecto={p} />
        )}
      </div>
      {cierre ? <CierreProyecto proyecto={p} onClose={() => setCierre(false)} /> : null}
    </div>
  );
}
