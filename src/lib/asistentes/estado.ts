"use client";

/**
 * Ajustes de los asistentes en localStorage (clave `lifeos:asistentes`, versión 1).
 * - No toca ninguna otra clave.
 * - En modo demo (`?demo=…`) los cambios viven solo en memoria: no se escribe nada en el navegador.
 */
import { useSyncExternalStore } from "react";
import { FICHAS, type Avisos, type Tono } from "./definiciones";
import { ASISTENTE_IDS, COLORES_POR_DEFECTO, type Accesorio, type AsistenteId, type Colores, type Expresion } from "./tipos";

export const CLAVE_ASISTENTES = "lifeos:asistentes";

export type AjustesAsistente = {
  activo: boolean;
  nombre: string;
  colores: Colores;
  expresion: Expresion;
  accesorio: Accesorio;
  mostrarProp: boolean;
  tono: Tono;
  avisos: Avisos;
};

export type EstadoAsistentes = { version: 1; principal: AsistenteId; ajustes: Record<AsistenteId, AjustesAsistente> };

export function ajustesPorDefecto(id: AsistenteId): AjustesAsistente {
  return {
    activo: true,
    nombre: FICHAS[id].nombre,
    colores: { ...COLORES_POR_DEFECTO[id] },
    expresion: "neutral",
    accesorio: "ninguno",
    mostrarProp: true,
    tono: "seco",
    avisos: "en-el-momento",
  };
}

export function estadoPorDefecto(): EstadoAsistentes {
  return {
    version: 1,
    principal: "centavo",
    ajustes: Object.fromEntries(ASISTENTE_IDS.map((id) => [id, ajustesPorDefecto(id)])) as Record<AsistenteId, AjustesAsistente>,
  };
}

const enDemo = () => typeof window !== "undefined" && !!window.sessionStorage.getItem("lifeos-demo");

/** Une lo guardado con los valores por defecto (tolera claves nuevas o faltantes). */
function normalizar(raw: unknown): EstadoAsistentes {
  const base = estadoPorDefecto();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<EstadoAsistentes>;
  const principal = ASISTENTE_IDS.includes(r.principal as AsistenteId) ? (r.principal as AsistenteId) : base.principal;
  for (const id of ASISTENTE_IDS) {
    const g = r.ajustes?.[id];
    if (g) base.ajustes[id] = { ...base.ajustes[id], ...g, colores: { ...base.ajustes[id].colores, ...g.colores } };
  }
  base.principal = principal;
  base.ajustes[principal].activo = true; // el principal nunca está desactivado
  return base;
}

let cache: EstadoAsistentes | null = null;
const SERVIDOR = estadoPorDefecto();
const oyentes = new Set<() => void>();

function leer(): EstadoAsistentes {
  if (cache) return cache;
  if (typeof window === "undefined") return SERVIDOR;
  if (enDemo()) return (cache = estadoPorDefecto());
  try {
    const txt = window.localStorage.getItem(CLAVE_ASISTENTES);
    cache = normalizar(txt ? JSON.parse(txt) : null);
  } catch {
    cache = estadoPorDefecto();
  }
  return cache;
}

function guardar(next: EstadoAsistentes) {
  cache = next;
  if (typeof window !== "undefined" && !enDemo()) {
    try {
      window.localStorage.setItem(CLAVE_ASISTENTES, JSON.stringify(next));
    } catch {
      /* almacenamiento lleno o bloqueado: se mantiene en memoria */
    }
  }
  oyentes.forEach((f) => f());
}

function suscribir(f: () => void) {
  oyentes.add(f);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CLAVE_ASISTENTES) {
      cache = null;
      f();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    oyentes.delete(f);
    window.removeEventListener("storage", onStorage);
  };
}

/** Estado actual + acciones. Cambiar algo guarda al instante. */
export function useAsistentes() {
  const estado = useSyncExternalStore(suscribir, leer, () => SERVIDOR);
  return {
    estado,
    actualizar(id: AsistenteId, patch: Partial<AjustesAsistente>) {
      const cur = leer();
      // El principal no se puede desactivar
      if (patch.activo === false && cur.principal === id) return false;
      guardar({ ...cur, ajustes: { ...cur.ajustes, [id]: { ...cur.ajustes[id], ...patch } } });
      return true;
    },
    hacerPrincipal(id: AsistenteId) {
      const cur = leer();
      guardar({ ...cur, principal: id, ajustes: { ...cur.ajustes, [id]: { ...cur.ajustes[id], activo: true } } });
    },
    restablecer(id: AsistenteId) {
      const cur = leer();
      guardar({ ...cur, ajustes: { ...cur.ajustes, [id]: ajustesPorDefecto(id) } });
    },
  };
}

/** Para la exportación de "Tus datos" */
export function exportarAsistentes(): EstadoAsistentes {
  return leer();
}

/** Para "Borrar datos locales": quita solo la clave de los asistentes */
export function borrarAsistentes() {
  if (typeof window !== "undefined" && !enDemo()) window.localStorage.removeItem(CLAVE_ASISTENTES);
  cache = null;
  oyentes.forEach((f) => f());
}
