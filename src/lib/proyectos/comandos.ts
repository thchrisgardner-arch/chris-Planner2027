/**
 * Comando «/» del editor de notas: bloques (títulos, listas, casillas, cita, texto) y registros
 * reales (/tarea, /evento, /gasto) que pasan el resto de la línea por la captura rápida.
 * «/gasto almuerzo 25 mil» → abre la vista previa de la captura con ese texto, ya como gasto.
 */
import { normalizar } from "@/lib/captura/interpretar";

export type Comando =
  | { id: "h1" | "h2" | "h3" | "texto" | "vinetas" | "numerada" | "casillas" | "cita"; tipo: "bloque"; label: string; ayuda: string; claves: string[] }
  | { id: "tarea" | "evento" | "gasto"; tipo: "registro"; label: string; ayuda: string; claves: string[] };

export const COMANDOS: Comando[] = [
  { id: "h1", tipo: "bloque", label: "Título 1", ayuda: "Título grande", claves: ["h1", "titulo", "titulo1", "encabezado"] },
  { id: "h2", tipo: "bloque", label: "Título 2", ayuda: "Título mediano", claves: ["h2", "titulo2", "subtitulo"] },
  { id: "h3", tipo: "bloque", label: "Título 3", ayuda: "Título pequeño", claves: ["h3", "titulo3"] },
  { id: "texto", tipo: "bloque", label: "Texto", ayuda: "Párrafo normal", claves: ["texto", "parrafo", "p"] },
  { id: "vinetas", tipo: "bloque", label: "Lista con viñetas", ayuda: "También con «- »", claves: ["lista", "vinetas", "bullets", "ul"] },
  { id: "numerada", tipo: "bloque", label: "Lista numerada", ayuda: "También con «1. »", claves: ["numerada", "numeros", "ol", "lista"] },
  { id: "casillas", tipo: "bloque", label: "Casillas", ayuda: "También con «[] »", claves: ["casillas", "checklist", "pendientes", "todo"] },
  { id: "cita", tipo: "bloque", label: "Cita", ayuda: "También con «> »", claves: ["cita", "quote"] },
  { id: "tarea", tipo: "registro", label: "Tarea", ayuda: "Crea una tarea del proyecto", claves: ["tarea", "todo", "pendiente"] },
  { id: "evento", tipo: "registro", label: "Evento", ayuda: "Lo agenda en tu calendario", claves: ["evento", "cita", "reunion", "agenda"] },
  { id: "gasto", tipo: "registro", label: "Gasto", ayuda: "Lo registra en tus finanzas", claves: ["gasto", "pago", "compra"] },
];

/**
 * Lee la línea hasta el cursor: «/gas» o «/gasto almuerzo 25 mil».
 * Devuelve null si la línea no empieza con «/» o si nada coincide.
 */
export function leerComando(linea: string): { consulta: string; resto: string; opciones: Comando[] } | null {
  const m = linea.match(/^\/(\S*)(?:\s+([^]*))?$/);
  if (!m) return null;
  const consulta = normalizar(m[1] ?? "");
  const resto = (m[2] ?? "").trim();
  // Con texto después de la palabra, solo cuentan los que coinciden exacto (el usuario ya eligió)
  const opciones = COMANDOS.filter((c) => (resto ? c.claves.includes(consulta) || normalizar(c.label) === consulta : !consulta || c.claves.some((k) => k.startsWith(consulta)) || normalizar(c.label).startsWith(consulta)));
  if (!opciones.length) return null;
  // Los registros primero si la palabra es justo la de un registro («/gasto …»)
  opciones.sort((a, b) => Number(b.claves[0] === consulta) - Number(a.claves[0] === consulta));
  return { consulta, resto, opciones };
}
