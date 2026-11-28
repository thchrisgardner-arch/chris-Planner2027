/**
 * Exportar datos a Word, Excel, PDF o texto. Todo se arma en el navegador; nada sale del dispositivo.
 * Un `Documento` es un título y varias secciones (una tabla cada una): Movimientos, Cuentas, Proyectos…
 * Este archivo tiene el modelo y el texto plano (funciones puras); `formatos.ts` crea los archivos.
 */
import { formatCOP } from "../../utils/money";

export type TipoColumna = "texto" | "dinero" | "numero" | "fecha";
export interface Columna {
  titulo: string;
  tipo?: TipoColumna;
}
export type Celda = string | number | null | undefined;
export interface Seccion {
  titulo: string;
  columnas: Columna[];
  filas: Celda[][];
}
export interface Documento {
  titulo: string;
  subtitulo?: string;
  secciones: Seccion[];
}

export type Formato = "word" | "excel" | "pdf" | "texto";
export const FORMATOS: { value: Formato; label: string; ext: string; detalle: string }[] = [
  { value: "word", label: "Word", ext: "docx", detalle: "Documento con tablas" },
  { value: "excel", label: "Excel", ext: "xlsx", detalle: "Una hoja por sección" },
  { value: "pdf", label: "PDF", ext: "pdf", detalle: "Para imprimir o compartir" },
  { value: "texto", label: "Texto", ext: "txt", detalle: "Texto plano" },
];

/** "2026-11-27" → "27/11/2026" (si no es una fecha, la deja igual) */
export function fechaCorta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Una celda como texto, según el tipo de su columna */
export function celdaTexto(v: Celda, tipo: TipoColumna = "texto"): string {
  if (v == null || v === "") return "";
  if (tipo === "dinero" && typeof v === "number") return formatCOP(v);
  if (tipo === "numero" && typeof v === "number") return v.toLocaleString("es-CO");
  if (tipo === "fecha" && typeof v === "string") return fechaCorta(v);
  return String(v);
}

/** Texto plano: cada sección como una tabla alineada con espacios */
export function aTexto(doc: Documento): string {
  const ANCHO_MAX = 40;
  const recortar = (s: string) => (s.length > ANCHO_MAX ? `${s.slice(0, ANCHO_MAX - 1)}…` : s);
  const lineas: string[] = [doc.titulo];
  if (doc.subtitulo) lineas.push(doc.subtitulo);
  for (const s of doc.secciones) {
    lineas.push("", `${s.titulo} (${s.filas.length})`, "=".repeat(Math.min(60, s.titulo.length + String(s.filas.length).length + 3)));
    if (!s.filas.length) {
      lineas.push("Sin registros.");
      continue;
    }
    const textos = s.filas.map((f) => s.columnas.map((c, i) => recortar(celdaTexto(f[i], c.tipo)).replace(/\s+/g, " ")));
    const anchos = s.columnas.map((c, i) => Math.max(c.titulo.length, ...textos.map((t) => t[i].length)));
    // Dinero y números alineados a la derecha
    const celda = (t: string, i: number) => (s.columnas[i].tipo === "dinero" || s.columnas[i].tipo === "numero" ? t.padStart(anchos[i]) : t.padEnd(anchos[i]));
    lineas.push(s.columnas.map((c, i) => celda(c.titulo, i)).join("  ").trimEnd());
    lineas.push(anchos.map((a) => "-".repeat(a)).join("  "));
    for (const t of textos) lineas.push(t.map(celda).join("  ").trimEnd());
  }
  return `${lineas.join("\n")}\n`;
}

/** Nombre de archivo sin tildes ni espacios: "Mis datos" → "mis-datos" */
export const nombreArchivo = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
