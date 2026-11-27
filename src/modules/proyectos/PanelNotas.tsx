"use client";

/**
 * Panel Notas del proyecto: lista de notas y editor de documento (se carga solo al abrir este panel).
 * Guardado automático con un aviso discreto («Guardando…» / «Guardado»). N crea una nota nueva.
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { MoreHorizontal, NotebookPen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Popover";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { registrarNuevo } from "@/lib/atajoNuevo";
import { almacenDocumentos, documentos, migrarNotas, textoAContenido, textoPlano, type Documento, type Nodo } from "@/lib/proyectos/documentos";
import { leerEspacio } from "@/lib/proyectos/espacio";
import type { Project } from "@/types/db";
import { cn } from "@/utils/cn";
import { Seccion } from "./Seccion";

const EditorNota = lazy(() => import("./EditorNota").then((m) => ({ default: m.EditorNota })));

const hace = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(iso));
};

const NOTA_DEMO = `Ideas para la portada
- Foto en blanco y negro, fondo claro
- Una frase corta: qué hago y para quién

Acuerdos con Laura: paleta lila y negro, tipografía sin serifas.`;

export function PanelNotas({ proyecto }: { proyecto: Project }) {
  const { mode } = useData();
  const docs = almacenDocumentos.useValor().docs;
  const lista = docs.filter((d) => d.proyectoId === proyecto.id).sort((a, b) => b.actualizado.localeCompare(a.actualizado));
  const [sel, setSel] = useState<string | null>(null);
  const actual = lista.find((d) => d.id === sel) ?? lista[0] ?? null;

  // La nota única de antes pasa a ser la primera nota (una sola vez); en demo, una nota de ejemplo
  useEffect(() => {
    migrarNotas(leerEspacio().notas);
    if (mode === "demo" && proyecto.name === "Portafolio 2027" && !almacenDocumentos.leer().docs.some((d) => d.proyectoId === proyecto.id)) {
      documentos.crear(proyecto.id, "Ideas y acuerdos", textoAContenido(NOTA_DEMO));
    }
  }, [mode, proyecto.id, proyecto.name]);

  const nueva = () => setSel(documentos.crear(proyecto.id));
  const pid = proyecto.id;
  useEffect(() => registrarNuevo(() => setSel(documentos.crear(pid))), [pid]);

  return (
    <Seccion
      id="notas"
      titulo="Notas"
      icon={NotebookPen}
      cuenta={lista.length}
      accion={
        <Button size="sm" variant="primary" onClick={nueva} title="Nueva nota (N)">
          <Plus size={16} /> Nueva
        </Button>
      }
    >
      {!lista.length ? (
        <div className="rounded-[20px] bg-bg-2 p-5 text-center">
          <p className="text-[14px] font-medium">Aún no hay notas</p>
          <p className="mt-0.5 text-[12.5px] text-muted">Crea la primera: ideas, actas, listas o lo que necesites.</p>
          <Button size="sm" variant="primary" className="mt-3" onClick={nueva}>
            <Plus size={16} /> Nueva nota
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label="Notas del proyecto">
            <ul className="flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
              {lista.map((d) => {
                const activa = d.id === actual?.id;
                return (
                  <li key={d.id} className="shrink-0 md:shrink">
                    <button
                      type="button"
                      onClick={() => setSel(d.id)}
                      aria-current={activa ? "true" : undefined}
                      className={cn("focus-ring flex w-44 cursor-pointer flex-col rounded-[16px] px-3 py-2 text-left md:w-full", activa ? "bg-fg text-on-fg" : "bg-bg-2 hover:bg-elev")}
                    >
                      <span className="truncate text-[13.5px] font-medium">{d.titulo || "Sin título"}</span>
                      <span className={cn("truncate text-[12px]", activa ? "opacity-75" : "text-muted")}>{textoPlano(d.contenido).split("\n")[0] || hace(d.actualizado)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          {actual ? <Documento key={actual.id} doc={actual} proyectoId={proyecto.id} /> : null}
        </div>
      )}
    </Seccion>
  );
}

function Documento({ doc, proyectoId }: { doc: Documento; proyectoId: string }) {
  const { confirm, toast } = useFeedback();
  const [titulo, setTitulo] = useState(doc.titulo);
  const [estado, setEstado] = useState<"guardado" | "guardando">("guardado");
  const pendiente = useRef<{ contenido?: Nodo; titulo?: string } | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const guardarYa = () => {
    clearTimeout(reloj.current);
    if (!pendiente.current) return;
    documentos.guardar(doc.id, pendiente.current);
    pendiente.current = null;
    setEstado("guardado");
  };
  const programar = (cambio: { contenido?: Nodo; titulo?: string }) => {
    pendiente.current = { ...pendiente.current, ...cambio };
    setEstado("guardando");
    clearTimeout(reloj.current);
    reloj.current = setTimeout(guardarYa, 700);
  };
  // Lo último escrito se guarda también al cambiar de nota, salir del panel o cerrar la pestaña
  const guardarRef = useRef(guardarYa);
  useEffect(() => {
    guardarRef.current = guardarYa;
  });
  useEffect(() => {
    const salir = () => guardarRef.current();
    window.addEventListener("pagehide", salir);
    return () => {
      window.removeEventListener("pagehide", salir);
      salir();
    };
  }, []);

  const borrar = async () => {
    if (!(await confirm({ title: `¿Eliminar «${doc.titulo || "Sin título"}»?`, description: "La nota se borra de este proyecto.", confirmLabel: "Eliminar", destructive: true }))) return;
    clearTimeout(reloj.current);
    pendiente.current = null;
    documentos.borrar(doc.id);
    toast("Nota eliminada");
  };

  return (
    <article className="min-w-0 rounded-[20px] bg-bg-2 p-4 sm:p-5" aria-label={doc.titulo || "Nota sin título"}>
      <div className="mb-2 flex items-start gap-2">
        <input
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            programar({ titulo: e.target.value.slice(0, 120) });
          }}
          placeholder="Sin título"
          aria-label="Título de la nota"
          maxLength={120}
          className="focus-ring min-w-0 flex-1 rounded-[10px] bg-transparent text-[22px] font-bold leading-tight tracking-[-0.01em] outline-none placeholder:text-dim"
        />
        <span className="mt-1.5 shrink-0 text-[12px] text-muted" aria-live="polite">
          {estado === "guardando" ? "Guardando…" : "Guardado"}
        </span>
        <Popover
          side="bottom"
          trigger={({ open, toggle }) => (
            <Button size="icon-sm" variant="ghost" className="-mr-1.5 shrink-0" aria-label="Opciones de la nota" aria-expanded={open} onClick={toggle}>
              <MoreHorizontal size={17} />
            </Button>
          )}
        >
          {(cerrar: () => void) => (
            <div className="grid min-w-[160px] gap-0.5 p-1">
              <button type="button" onClick={() => (cerrar(), void borrar())} className="flex cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13.5px] text-danger hover:bg-card">
                <Trash2 size={15} /> Eliminar nota
              </button>
            </div>
          )}
        </Popover>
      </div>
      <Suspense fallback={<div className="h-[300px] animate-pulse rounded-[12px] bg-bg" aria-hidden />}>
        <EditorNota contenido={doc.contenido} proyectoId={proyectoId} onCambio={(c) => programar({ contenido: c })} />
      </Suspense>
    </article>
  );
}
