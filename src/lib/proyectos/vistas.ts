/**
 * Paneles de un proyecto: sus direcciones y lo que se recuerda por proyecto (`lifeos:vistas`):
 * el último panel abierto y la vista de tareas (lista o tablero).
 */
import { crearAlmacen } from "@/lib/almacenLocal";
import type { ModoOrden } from "./ordenTareas";

import { PANELES, esPanel, type Panel } from "./paneles";

export { PANELES, esPanel, type Panel };

export type VistaTareas = "lista" | "tablero";

interface Vistas {
  version: 1;
  panel: Record<string, Panel>;
  tareas: Record<string, VistaTareas>;
  /** Orden de las tareas por proyecto («global» en Proyectos): manual, por fecha o por prioridad */
  orden?: Record<string, ModoOrden>;
  /** 1 cuando las tareas existentes ya quedaron numeradas (orden manual) */
  ordenMigrado?: number;
}

export const almacenVistas = crearAlmacen<Vistas>("lifeos:vistas", () => ({ version: 1, panel: {}, tareas: {} }), (c) => ({
  version: 1,
  panel: (c.panel as Vistas["panel"]) ?? {},
  tareas: (c.tareas as Vistas["tareas"]) ?? {},
  orden: (c.orden as Vistas["orden"]) ?? {},
  ordenMigrado: Number(c.ordenMigrado) || 0,
}));

export function recordarPanel(proyectoId: string, panel: Panel) {
  if (almacenVistas.leer().panel[proyectoId] === panel) return;
  almacenVistas.cambiar((v) => ({ ...v, panel: { ...v.panel, [proyectoId]: panel } }));
}
export const ultimoPanel = (proyectoId: string): Panel => almacenVistas.leer().panel[proyectoId] ?? "tareas";

/**
 * /proyectos/panel/<panel>?id=<id>; sin panel abre el último usado (o Tareas).
 * (El id va en la consulta: un segmento [id] no se puede prerenderizar con Cache Components.)
 */
export const rutaProyecto = (id: string, panel?: Panel) => `/proyectos/panel${panel ? `/${panel}` : ""}?id=${encodeURIComponent(id)}`;
