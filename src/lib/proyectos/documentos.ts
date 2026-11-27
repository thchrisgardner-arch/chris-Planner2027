/**
 * Notas de los proyectos (Paneles, Fase B): varios documentos por proyecto, en `lifeos:documentos`
 * (versionado). El contenido es el JSON del editor (Tiptap/ProseMirror): títulos, párrafos, listas,
 * casillas, citas, negrita, cursiva y enlaces.
 * Migración: la nota única de antes (espacio.notas[proyecto].texto) pasa a ser la primera nota del
 * proyecto. El texto original no se borra del espacio.
 */
import { crearAlmacen } from "@/lib/almacenLocal";

export type Nodo = { type: string; attrs?: Record<string, unknown>; content?: Nodo[]; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[] };

export interface Documento {
  id: string;
  proyectoId: string;
  titulo: string;
  contenido: Nodo;
  creado: string;
  actualizado: string;
}

interface Documentos {
  version: 1;
  docs: Documento[];
  /** Ya se trajo la nota única de antes */
  migrado: boolean;
}

export const almacenDocumentos = crearAlmacen<Documentos>("lifeos:documentos", () => ({ version: 1, docs: [], migrado: false }), (c) => ({
  version: 1,
  docs: Array.isArray(c.docs) ? (c.docs as Documento[]).filter((d) => d && typeof d.id === "string" && typeof d.proyectoId === "string") : [],
  migrado: !!c.migrado,
}));

export const docVacio = (): Nodo => ({ type: "doc", content: [{ type: "paragraph" }] });

/** Texto plano → documento: cada línea es un párrafo; «- » y «* » arman listas */
export function textoAContenido(texto: string): Nodo {
  const bloques: Nodo[] = [];
  let lista: Nodo | null = null;
  for (const linea of texto.replace(/\r\n/g, "\n").split("\n")) {
    const vineta = linea.match(/^\s*[-*•]\s+(.*)$/);
    if (vineta) {
      lista ??= { type: "bulletList", content: [] };
      lista.content!.push({ type: "listItem", content: [{ type: "paragraph", content: vineta[1] ? [{ type: "text", text: vineta[1] }] : undefined }] });
      continue;
    }
    if (lista) {
      bloques.push(lista);
      lista = null;
    }
    bloques.push(linea.trim() ? { type: "paragraph", content: [{ type: "text", text: linea }] } : { type: "paragraph" });
  }
  if (lista) bloques.push(lista);
  // Sin párrafos vacíos al final
  while (bloques.length > 1 && bloques[bloques.length - 1].type === "paragraph" && !bloques[bloques.length - 1].content) bloques.pop();
  return { type: "doc", content: bloques.length ? bloques : [{ type: "paragraph" }] };
}

/** Texto plano de un documento (vista previa, búsqueda, exportar) */
export function textoPlano(n: Nodo): string {
  if (n.text) return n.text;
  const hijos = (n.content ?? []).map(textoPlano);
  return ["doc", "bulletList", "orderedList", "taskList"].includes(n.type) ? hijos.join("\n") : hijos.join("");
}

const nuevoId = () => `doc${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Notas a crear desde la nota única de antes (solo proyectos que todavía no tienen notas) */
export function notasDesdeEspacio(notas: Record<string, { texto: string; actualizado: string }>, existentes: Documento[]): Documento[] {
  const conNotas = new Set(existentes.map((d) => d.proyectoId));
  return Object.entries(notas)
    .filter(([pid, n]) => n?.texto?.trim() && !conNotas.has(pid))
    .map(([pid, n]) => ({ id: nuevoId(), proyectoId: pid, titulo: "Notas", contenido: textoAContenido(n.texto), creado: n.actualizado, actualizado: n.actualizado }));
}

export function migrarNotas(notas: Record<string, { texto: string; actualizado: string }>) {
  const d = almacenDocumentos.leer();
  if (d.migrado) return;
  almacenDocumentos.guardar({ ...d, docs: [...d.docs, ...notasDesdeEspacio(notas, d.docs)], migrado: true });
}

export const documentos = {
  crear(proyectoId: string, titulo = "", contenido: Nodo = docVacio()): string {
    const ahora = new Date().toISOString();
    const id = nuevoId();
    almacenDocumentos.cambiar((d) => ({ ...d, docs: [{ id, proyectoId, titulo, contenido, creado: ahora, actualizado: ahora }, ...d.docs] }));
    return id;
  },
  guardar(id: string, cambios: Partial<Pick<Documento, "titulo" | "contenido">>) {
    almacenDocumentos.cambiar((d) => ({ ...d, docs: d.docs.map((x) => (x.id === id ? { ...x, ...cambios, actualizado: new Date().toISOString() } : x)) }));
  },
  borrar(id: string) {
    almacenDocumentos.cambiar((d) => ({ ...d, docs: d.docs.filter((x) => x.id !== id) }));
  },
  borrarProyecto(proyectoId: string) {
    almacenDocumentos.cambiar((d) => ({ ...d, docs: d.docs.filter((x) => x.proyectoId !== proyectoId) }));
  },
  borrarTodo() {
    almacenDocumentos.borrar();
  },
};
