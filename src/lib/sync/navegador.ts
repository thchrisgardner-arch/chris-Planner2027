/**
 * Lado local del motor: las mismas claves que usa la app en localStorage. Al escribir un documento
 * se emite un evento "storage" para que su almacén olvide la copia en memoria y vuelva a leer
 * (la app se actualiza sin recargar la página).
 */
import type { TableName } from "@/types/db";
import { CLAVE_LOCAL, type ClaveDoc, type Fila, type Local } from "./tipos";

const PREFIJO_TABLAS = "lifeos:v1:";

function avisar(key: string, newValue: string | null) {
  try {
    window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
  } catch {
    /* navegadores sin StorageEvent construible: la app lo verá al recargar */
  }
}

export const localNavegador: Local = {
  filas(t: TableName) {
    try {
      const raw = window.localStorage.getItem(PREFIJO_TABLAS + t);
      return raw ? (JSON.parse(raw) as Fila[]) : [];
    } catch {
      return [];
    }
  },
  guardarFilas(t: TableName, filas: Fila[]) {
    window.localStorage.setItem(PREFIJO_TABLAS + t, JSON.stringify(filas));
  },
  doc(clave: ClaveDoc) {
    const raw = window.localStorage.getItem(CLAVE_LOCAL[clave]);
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      // Algunas banderas se guardan como texto plano ("visto")
      return { __texto: raw };
    }
  },
  guardarDoc(clave: ClaveDoc, data: unknown) {
    const key = CLAVE_LOCAL[clave];
    const texto =
      data && typeof data === "object" && "__texto" in (data as Record<string, unknown>) ? String((data as Record<string, unknown>).__texto) : JSON.stringify(data);
    window.localStorage.setItem(key, texto);
    avisar(key, texto);
  },
};
