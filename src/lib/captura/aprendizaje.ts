/**
 * Lo que la captura rápida y el importador recuerdan (`lifeos:captura`, versión 1):
 *  - categorias: palabra → categoría que la persona eligió al corregir ("almuerzo" → Alimentación).
 *  - plantillas: cómo se leen las columnas del extracto de cada banco.
 *  - proyectos: palabra → { proyecto: veces que se asignó }. Con 2 veces, la captura lo sugiere
 *    (solo sugiere: nunca asigna un movimiento a un proyecto sin que la persona lo elija).
 */
import { crearAlmacen } from "@/lib/almacenLocal";

export interface PlantillaBanco {
  nombre: string;
  /** Índices de columna (null si el extracto no la trae) */
  fecha: number;
  descripcion: number;
  monto: number | null;
  debito: number | null;
  credito: number | null;
  /** El extracto muestra los gastos como números positivos (hay que invertir el signo) */
  invertirSigno: boolean;
  cuentaId: string | null;
  /** Encabezados con los que se reconoce el archivo */
  encabezados: string[];
}

export interface DatosCaptura {
  version: 1;
  categorias: Record<string, string>;
  plantillas: PlantillaBanco[];
  proyectos?: Record<string, Record<string, number>>;
}

const vacio = (): DatosCaptura => ({ version: 1, categorias: {}, plantillas: [], proyectos: {} });

export const almacenCaptura = crearAlmacen<DatosCaptura>("lifeos:captura", vacio, (crudo) => ({
  ...vacio(),
  ...(crudo as Partial<DatosCaptura>),
  version: 1,
}));

export function recordarCategoria(palabra: string | null, categoria: string) {
  if (!palabra) return;
  almacenCaptura.cambiar((d) => ({ ...d, categorias: { ...d.categorias, [palabra]: categoria } }));
}

export function guardarPlantilla(p: PlantillaBanco) {
  almacenCaptura.cambiar((d) => ({ ...d, plantillas: [...d.plantillas.filter((x) => x.nombre !== p.nombre), p] }));
}

/** Veces que hay que asignar una descripción a un proyecto para que se sugiera sola */
export const VECES_PARA_SUGERIR = 2;

/** Se asignó un movimiento con esta palabra a un proyecto */
export function recordarProyecto(palabra: string | null, proyectoId: string | null) {
  if (!palabra || !proyectoId) return;
  almacenCaptura.cambiar((d) => {
    const prev = d.proyectos?.[palabra] ?? {};
    return { ...d, proyectos: { ...d.proyectos, [palabra]: { ...prev, [proyectoId]: (prev[proyectoId] ?? 0) + 1 } } };
  });
}

/** Palabra → proyecto que ya se eligió al menos dos veces (el más usado) */
export function proyectosAprendidos(d: DatosCaptura): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [palabra, veces] of Object.entries(d.proyectos ?? {})) {
    const top = Object.entries(veces).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= VECES_PARA_SUGERIR) out[palabra] = top[0];
  }
  return out;
}
