/**
 * Almacén pequeño en localStorage con versión y migración. En modo demo vive solo en memoria
 * (nunca toca los datos reales). Se lee con un hook que se actualiza en todas las pantallas.
 */
import { useSyncExternalStore } from "react";

export interface Versionado {
  version: number;
}

const enDemo = () => typeof window !== "undefined" && !!window.sessionStorage.getItem("lifeos-demo");

export function crearAlmacen<T extends Versionado>(clave: string, vacio: () => T, migrar: (crudo: Record<string, unknown>) => T) {
  let cache: T | null = null;
  const servidor = vacio();
  const oyentes = new Set<() => void>();

  function leer(): T {
    if (cache) return cache;
    if (typeof window === "undefined") return servidor;
    if (enDemo()) return (cache = vacio());
    try {
      const raw = window.localStorage.getItem(clave);
      cache = raw ? migrar(JSON.parse(raw)) : vacio();
    } catch {
      cache = vacio();
    }
    return cache;
  }
  function guardar(v: T) {
    cache = v;
    if (typeof window !== "undefined" && !enDemo()) {
      try {
        window.localStorage.setItem(clave, JSON.stringify(v));
      } catch {
        /* almacenamiento lleno: queda en memoria */
      }
    }
    oyentes.forEach((f) => f());
  }
  function cambiar(fn: (v: T) => T) {
    guardar(fn(leer()));
  }
  function borrar() {
    if (typeof window !== "undefined" && !enDemo()) window.localStorage.removeItem(clave);
    cache = null;
    oyentes.forEach((f) => f());
  }
  function suscribir(f: () => void) {
    oyentes.add(f);
    return () => oyentes.delete(f);
  }
  // Otra pestaña o la sincronización cambiaron la clave: se olvida la copia en memoria
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key !== clave) return;
      cache = null;
      oyentes.forEach((f) => f());
    });
  }
  function useValor(): T {
    return useSyncExternalStore(suscribir, leer, () => servidor);
  }
  return { clave, leer, guardar, cambiar, borrar, useValor };
}
