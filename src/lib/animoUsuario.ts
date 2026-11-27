/**
 * Chequeo de ánimo de la persona (`lifeos:animo-usuario`, versión 1). Solo en este dispositivo:
 * se incluye en la exportación y se borra con el resto de los datos.
 * 1 = mal · 2 = bajo · 3 = normal · 4 = bien · 5 = muy bien.
 * Con 1 o 2, ese día los asistentes usan el tono tranquilo, no hay reacciones negativas y las
 * misiones bajan de 3 a 2.
 */
import { crearAlmacen } from "@/lib/almacenLocal";
import { todayISO } from "@/utils/dates";

export type NivelAnimo = 1 | 2 | 3 | 4 | 5;

export interface DatosAnimo {
  version: 1;
  activo: boolean;
  registros: Record<string, NivelAnimo>;
  /** Días en que se saltó la pregunta (no se vuelve a preguntar ese día) */
  saltados: string[];
}

export const almacenAnimo = crearAlmacen<DatosAnimo>(
  "lifeos:animo-usuario",
  () => ({ version: 1, activo: true, registros: {}, saltados: [] }),
  (c) => ({
    version: 1,
    activo: c.activo !== false,
    registros: (c.registros as Record<string, NivelAnimo>) ?? {},
    saltados: Array.isArray(c.saltados) ? (c.saltados as string[]).slice(-14) : [],
  }),
);

export const OPCIONES_ANIMO: { nivel: NivelAnimo; label: string; pose: "triste" | "preocupado" | "idle" | "feliz" | "celebrando" }[] = [
  { nivel: 1, label: "Mal", pose: "triste" },
  { nivel: 2, label: "Bajo", pose: "preocupado" },
  { nivel: 3, label: "Normal", pose: "idle" },
  { nivel: 4, label: "Bien", pose: "feliz" },
  { nivel: 5, label: "Muy bien", pose: "celebrando" },
];

export function animoDe(d: DatosAnimo, fecha: string): NivelAnimo | null {
  return d.registros[fecha] ?? null;
}

/**
 * ¿Hoy es un día difícil? (respondió mal o bajo). Sin registros no lee la hora: en el prerender
 * del servidor (sin datos) leer la fecha actual obligaría a renderizar todo en el cliente.
 */
export function diaDificil(d: DatosAnimo, fecha?: string) {
  if (!d.activo) return false;
  if (Object.keys(d.registros).length === 0) return false;
  const n = d.registros[fecha ?? todayISO()];
  return n !== undefined && n <= 2;
}

export function chequeoPendiente(d: DatosAnimo, fecha: string) {
  return d.activo && d.registros[fecha] === undefined && !d.saltados.includes(fecha);
}

export function registrarAnimo(fecha: string, nivel: NivelAnimo) {
  almacenAnimo.cambiar((d) => ({ ...d, registros: { ...d.registros, [fecha]: nivel } }));
}
export function saltarAnimo(fecha: string) {
  almacenAnimo.cambiar((d) => ({ ...d, saltados: [...d.saltados.filter((x) => x !== fecha), fecha].slice(-14) }));
}
