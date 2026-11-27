"use client";

/**
 * Orden manual de las tareas (Fase 2), sin librerías:
 *  - Escritorio: arrastrar con el asa que aparece al pasar el cursor (o al enfocarla).
 *  - Celular: mantener presionada la tarea y arrastrar.
 *  - Siempre: el asa abre el menú «Mover arriba / abajo / al principio / al final», y con la tarea
 *    enfocada, Alt+↑ y Alt+↓.
 * Arrastrar estando en «Por fecha» o «Por prioridad» pasa a Manual y lo avisa.
 * Sin animaciones de arrastre: se marca dónde va a caer con una línea (respeta reduced motion).
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, GripVertical } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { Segmented } from "@/components/ui/misc";
import { useData } from "@/lib/store/DataProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { almacenVistas } from "@/lib/proyectos/vistas";
import { hermanasDe, migrarOrden, mover, moverA, MODOS_ORDEN, type ModoOrden } from "@/lib/proyectos/ordenTareas";
import type { Task } from "@/types/db";
import { cn } from "@/utils/cn";

/* ═════════ Modo de orden, recordado por proyecto («global» en Proyectos) ═════════ */
export function useModoOrden(clave: string): [ModoOrden, (m: ModoOrden) => void] {
  const modo = almacenVistas.useValor().orden?.[clave] ?? "manual";
  const fijar = (m: ModoOrden) => almacenVistas.cambiar((v) => ({ ...v, orden: { ...v.orden, [clave]: m } }));
  return [modo, fijar];
}

export function SelectorOrden({ clave, className }: { clave: string; className?: string }) {
  const [modo, fijar] = useModoOrden(clave);
  return <Segmented size="sm" label="Orden de las tareas" className={className} value={modo} onChange={fijar} options={MODOS_ORDEN} />;
}

/** Aplica un movimiento (y pasa a Manual si hacía falta) */
export function useMoverTarea(clave: string) {
  const { db, update } = useData();
  const { toast } = useFeedback();
  const [modo, fijar] = useModoOrden(clave);
  const aplicar = async (cambios: { id: string; sort_order: number }[], extra?: { id: string; patch: Partial<Task> }) => {
    if (modo !== "manual" && (cambios.length || extra)) {
      fijar("manual");
      toast("Orden cambiado a Manual para respetar tu cambio.");
    }
    for (const c of cambios) await update("tasks", c.id, { sort_order: c.sort_order, ...(extra?.id === c.id ? extra.patch : {}) });
    if (extra && !cambios.some((c) => c.id === extra.id)) await update("tasks", extra.id, extra.patch);
  };
  return {
    /** Mover arriba, abajo, al principio o al final */
    a: (t: Task, destino: "arriba" | "abajo" | "principio" | "final") => aplicar(moverA(hermanasDe(db.tasks, t), t.id, destino)),
    /** Soltar antes de otra tarea (null = al final); `patch` para cambiar también el estado (tablero) */
    antesDe: (t: Task, antes: string | null, patch?: Partial<Task>) => aplicar(mover(hermanasDe(db.tasks, t), t.id, antes), patch ? { id: t.id, patch } : undefined),
  };
}

/* ═════════ Arrastre con el puntero (uno a la vez) ═════════ */
interface Arrastre {
  id: string;
  grupo: string;
  /** Id de la fila antes de la que caería; "fin" = al final */
  destino: string | null;
}
let actual: Arrastre | null = null;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};
export const useArrastre = () => useSyncExternalStore(suscribir, () => actual, () => null);

function destinoEn(grupo: string, y: number, id: string): string {
  const filas = [...document.querySelectorAll<HTMLElement>(`[data-orden-grupo="${CSS.escape(grupo)}"]`)].filter((el) => el.dataset.ordenId !== id);
  for (const el of filas) {
    const r = el.getBoundingClientRect();
    if (y < r.top + r.height / 2) return el.dataset.ordenId!;
  }
  return "fin";
}

/**
 * Empieza a arrastrar una fila. `alSoltar(antesDe)` recibe el id de la fila que quedará después,
 * o null si va al final. En pantallas táctiles se llama tras mantener presionado.
 */
export function iniciarArrastre(id: string, grupo: string, y: number, alSoltar: (antes: string | null) => void) {
  actual = { id, grupo, destino: destinoEn(grupo, y, id) };
  avisar();
  const bloquearScroll = (e: TouchEvent) => e.preventDefault();
  const mover = (e: PointerEvent) => {
    if (!actual) return;
    const d = destinoEn(grupo, e.clientY, id);
    if (d !== actual.destino) {
      actual = { ...actual, destino: d };
      avisar();
    }
  };
  const fin = (e: PointerEvent | KeyboardEvent) => {
    window.removeEventListener("pointermove", mover);
    window.removeEventListener("pointerup", fin);
    window.removeEventListener("pointercancel", fin);
    window.removeEventListener("keydown", escape);
    window.removeEventListener("touchmove", bloquearScroll);
    const d = actual?.destino;
    actual = null;
    avisar();
    if (e.type === "pointerup" && d) alSoltar(d === "fin" ? null : d);
  };
  const escape = (e: KeyboardEvent) => {
    if (e.key === "Escape") fin(e);
  };
  window.addEventListener("pointermove", mover);
  window.addEventListener("pointerup", fin);
  window.addEventListener("pointercancel", fin);
  window.addEventListener("keydown", escape);
  window.addEventListener("touchmove", bloquearScroll, { passive: false });
}

/**
 * Props para la fila: data-attrs, mantener presionado (táctil) y Alt+↑ / Alt+↓.
 * La línea de destino se dibuja con una sombra interna (no mueve nada de lugar).
 */
export function useFilaOrdenable(t: Task, clave: string) {
  const mov = useMoverTarea(clave);
  const arr = useArrastre();
  const grupo = `${t.project_id ?? ""}|${t.parent_task_id ?? ""}`;
  const arrastrando = arr?.id === t.id;
  const lineaArriba = arr && arr.grupo === grupo && arr.destino === t.id;
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  return {
    grupo,
    arrastrando,
    props: {
      "data-orden-grupo": grupo,
      "data-orden-id": t.id,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
        e.preventDefault();
        // El foco se queda en la misma tarea después de moverla
        const enfocado = document.activeElement as HTMLElement | null;
        void mov.a(t, e.key === "ArrowUp" ? "arriba" : "abajo").then(() => setTimeout(() => enfocado?.focus(), 60));
      },
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType !== "touch") return;
        inicio.current = { x: e.clientX, y: e.clientY };
        const y = e.clientY;
        espera.current = setTimeout(() => {
          espera.current = null;
          if ("vibrate" in navigator) navigator.vibrate?.(10);
          iniciarArrastre(t.id, grupo, y, (antes) => void mov.antesDe(t, antes));
        }, 380);
      },
      onPointerMove: (e: React.PointerEvent) => {
        if (espera.current && inicio.current && Math.hypot(e.clientX - inicio.current.x, e.clientY - inicio.current.y) > 8) {
          clearTimeout(espera.current);
          espera.current = null;
        }
      },
      onPointerUp: () => {
        if (espera.current) clearTimeout(espera.current);
        espera.current = null;
      },
      onContextMenu: (e: React.MouseEvent) => {
        // Mantener presionado en el celular arrastra; no abre el menú del navegador
        if (arr || espera.current) e.preventDefault();
      },
    },
    clase: cn(arrastrando && "opacity-40", lineaArriba && "shadow-[inset_0_2px_0_0_var(--color-fg)]"),
    /** Línea al final del grupo (va en la última fila) */
    lineaAbajo: !!arr && arr.grupo === grupo && arr.destino === "fin",
  };
}

/**
 * Asa de la tarea: aparece al pasar el cursor o al enfocarla (no ocupa lugar: va por fuera, a la
 * izquierda). Arrastrar desde aquí mueve la tarea; un clic (o Enter) abre el menú «Mover…».
 */
export function AsaTarea({ tarea: t, clave, className }: { tarea: Task; clave: string; className?: string }) {
  const mov = useMoverTarea(clave);
  const grupo = `${t.project_id ?? ""}|${t.parent_task_id ?? ""}`;
  return (
    <Popover
      side="bottom"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-label={`Mover ${t.name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Arrastra para mover (o Alt+↑ / Alt+↓)"
          onClick={toggle}
          onPointerDown={(e) => {
            if (e.pointerType === "touch" || e.button !== 0) return;
            const x0 = e.clientX;
            const y0 = e.clientY;
            // Si el puntero se mueve unos píxeles, es un arrastre; si no, es un clic (menú)
            const mover = (ev: PointerEvent) => {
              if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
              quitar();
              iniciarArrastre(t.id, grupo, ev.clientY, (antes) => void mov.antesDe(t, antes));
            };
            const quitar = () => {
              window.removeEventListener("pointermove", mover);
              window.removeEventListener("pointerup", quitar);
            };
            window.addEventListener("pointermove", mover);
            window.addEventListener("pointerup", quitar);
          }}
          className={cn(
            "focus-ring grid h-8 w-5 cursor-grab touch-none place-items-center rounded-[6px] text-dim opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 aria-expanded:opacity-100 active:cursor-grabbing",
            className,
          )}
        >
          <GripVertical size={15} />
        </button>
      )}
    >
      {(cerrar) => <MenuMover tarea={t} clave={clave} cerrar={cerrar} mov={mov} />}
    </Popover>
  );
}

export function MenuMover({ tarea: t, cerrar, mov, titulo = true }: { tarea: Task; clave: string; cerrar: () => void; mov: ReturnType<typeof useMoverTarea>; titulo?: boolean }) {
  const op = (label: string, Icono: typeof ArrowUp, destino: "arriba" | "abajo" | "principio" | "final") => (
    <button
      key={destino}
      type="button"
      role="menuitem"
      onClick={() => {
        cerrar();
        void mov.a(t, destino);
      }}
      className="flex cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13.5px] hover:bg-card"
    >
      <Icono size={15} /> {label}
    </button>
  );
  return (
    <div className="grid min-w-[190px] gap-0.5 p-1" role="menu" aria-label={`Mover ${t.name}`}>
      {titulo ? <p className="px-3 pb-1 pt-1.5 text-[11.5px] font-medium text-muted">Orden</p> : null}
      {op("Mover arriba", ArrowUp, "arriba")}
      {op("Mover abajo", ArrowDown, "abajo")}
      {op("Al principio", ArrowUpToLine, "principio")}
      {op("Al final", ArrowDownToLine, "final")}
    </div>
  );
}

/* ═════════ Migración (una vez): las tareas existentes quedan numeradas en el orden en que se veían ═════════ */
let migrando = false;
export function MigracionOrden() {
  const { db, status, mode, update } = useData();
  const listo = status === "ready" && mode !== "demo";
  useEffect(() => {
    if (!listo || migrando || (almacenVistas.leer().ordenMigrado ?? 0) >= 1) return;
    migrando = true;
    void (async () => {
      try {
        for (const c of migrarOrden(db.tasks)) await update("tasks", c.id, { sort_order: c.sort_order });
        almacenVistas.cambiar((v) => ({ ...v, ordenMigrado: 1 }));
      } catch {
        /* se reintenta al abrir otra vez la app */
      } finally {
        migrando = false;
      }
    })();
    // Solo al quedar listos los datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);
  return null;
}

/** Línea al final de una lista mientras se arrastra hacia el final */
export function LineaFinal({ grupo }: { grupo: string }) {
  const arr = useArrastre();
  if (!arr || arr.grupo !== grupo || arr.destino !== "fin") return null;
  return <li aria-hidden className="mx-2 h-0.5 rounded-full bg-fg" />;
}
