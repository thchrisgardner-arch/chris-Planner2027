/**
 * Lo que la captura rápida y el importador recuerdan (`lifeos:captura`, versión 1):
 *  - categorias: palabra → categoría que la persona eligió al corregir ("almuerzo" → Alimentación).
 *  - plantillas: cómo se leen las columnas del extracto de cada banco.
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
}

const vacio = (): DatosCaptura => ({ version: 1, categorias: {}, plantillas: [] });

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
