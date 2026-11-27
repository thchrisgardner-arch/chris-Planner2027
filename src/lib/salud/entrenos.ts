/**
 * Detalle opcional de cada entrenamiento marcado (`lifeos:entrenos`, versión 1): tipo y duración por
 * día. Nunca es obligatorio: marcar el día es el registro del hábito «Entrenar» (habit_logs); esto
 * solo le agrega información. Solo en este dispositivo; viaja en el respaldo y se borra con todo.
 */
import { crearAlmacen } from "@/lib/almacenLocal";

export type TipoEntreno = "fuerza" | "cardio" | "pierna" | "tren-superior" | "otro";

export const TIPOS_ENTRENO: { value: TipoEntreno; label: string }[] = [
  { value: "fuerza", label: "Fuerza" },
  { value: "cardio", label: "Cardio" },
  { value: "pierna", label: "Pierna" },
  { value: "tren-superior", label: "Tren superior" },
  { value: "otro", label: "Otro" },
];

export interface DetalleEntreno {
  tipo: TipoEntreno | null;
  minutos: number | null;
}

interface DatosEntrenos {
  version: 1;
  /** Fecha (YYYY-MM-DD) → detalle */
  detalles: Record<string, DetalleEntreno>;
}

export const almacenEntrenos = crearAlmacen<DatosEntrenos>("lifeos:entrenos", () => ({ version: 1, detalles: {} }), (c) => ({
  version: 1,
  detalles: (c.detalles as DatosEntrenos["detalles"]) ?? {},
}));

export function guardarDetalle(fecha: string, d: DetalleEntreno | null) {
  almacenEntrenos.cambiar((x) => {
    const detalles = { ...x.detalles };
    if (!d || (!d.tipo && !d.minutos)) delete detalles[fecha];
    else detalles[fecha] = d;
    return { ...x, detalles };
  });
}

/** "Pierna · 45 min" */
export function textoDetalle(d: DetalleEntreno | undefined): string | null {
  if (!d) return null;
  const partes = [d.tipo ? TIPOS_ENTRENO.find((t) => t.value === d.tipo)?.label : null, d.minutos ? `${d.minutos} min` : null].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}
