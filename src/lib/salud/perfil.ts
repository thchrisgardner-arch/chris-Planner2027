/**
 * Perfil físico para entrenamiento y alimentación (localStorage `lifeos:salud`).
 * En modo demo vive solo en memoria, con un perfil de ejemplo, y nunca toca tus datos reales.
 */
import { useSyncExternalStore } from "react";

export type Sexo = "hombre" | "mujer";
export type Actividad = "sedentaria" | "ligera" | "moderada" | "alta";
export type Objetivo = "perder" | "mantener" | "ganar";
export type Lugar = "gym" | "casa";
export type Nivel = "principiante" | "intermedio" | "avanzado";

export interface PerfilFisico {
  sexo: Sexo | null;
  edad: number | null;
  pesoKg: number | null;
  alturaCm: number | null;
  actividad: Actividad;
  objetivo: Objetivo;
  lugar: Lugar;
  nivel: Nivel;
}

export const PERFIL_VACIO: PerfilFisico = {
  sexo: null,
  edad: null,
  pesoKg: null,
  alturaCm: null,
  actividad: "ligera",
  objetivo: "mantener",
  lugar: "gym",
  nivel: "principiante",
};

const PERFIL_DEMO: PerfilFisico = { sexo: "hombre", edad: 29, pesoKg: 78, alturaCm: 176, actividad: "moderada", objetivo: "perder", lugar: "gym", nivel: "intermedio" };

const CLAVE = "lifeos:salud";
const enDemo = () => typeof window !== "undefined" && !!window.sessionStorage.getItem("lifeos-demo");
let cache: PerfilFisico | null = null;
const oyentes = new Set<() => void>();

function leer(): PerfilFisico {
  if (cache) return cache;
  if (typeof window === "undefined") return PERFIL_VACIO;
  if (enDemo()) return (cache = PERFIL_DEMO);
  try {
    const raw = window.localStorage.getItem(CLAVE);
    cache = raw ? { ...PERFIL_VACIO, ...JSON.parse(raw) } : PERFIL_VACIO;
  } catch {
    cache = PERFIL_VACIO;
  }
  return cache!;
}

export function guardarPerfil(p: Partial<PerfilFisico>) {
  cache = { ...leer(), ...p };
  if (typeof window !== "undefined" && !enDemo()) {
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(cache));
    } catch {
      /* sin almacenamiento: queda en memoria */
    }
  }
  oyentes.forEach((f) => f());
}

export function usePerfilFisico() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    leer,
    () => PERFIL_VACIO,
  );
}

export const perfilCompleto = (p: PerfilFisico) => !!(p.sexo && p.edad && p.pesoKg && p.alturaCm);

/** Rangos válidos para no calcular con datos imposibles */
export const RANGOS = { edad: [14, 90], pesoKg: [35, 250], alturaCm: [130, 220] } as const;
