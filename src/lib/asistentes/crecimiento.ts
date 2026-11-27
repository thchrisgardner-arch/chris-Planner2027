/**
 * Etapas de crecimiento (Fase 5), derivadas del vínculo 1–10 que ya existe:
 * Inicial 1–3 · Crece 4–6 · Experto 7–9 · Rey 10.
 * El personaje nunca cambia de forma ni de tamaño: cada etapa solo suma detalles encima.
 */
import { createContext, useContext } from "react";
import type { AsistenteId } from "./tipos";

export const ETAPAS_CRECIMIENTO = ["inicial", "crece", "experto", "rey"] as const;
export type EtapaCrecimiento = (typeof ETAPAS_CRECIMIENTO)[number];

export const CRECIMIENTO_LABEL: Record<EtapaCrecimiento, string> = {
  inicial: "Inicial",
  crece: "Crece",
  experto: "Experto",
  rey: "Rey",
};

export const RANGO_CRECIMIENTO: Record<EtapaCrecimiento, [number, number]> = {
  inicial: [1, 3],
  crece: [4, 6],
  experto: [7, 9],
  rey: [10, 10],
};

export function crecimientoDeVinculo(vinculo: number): EtapaCrecimiento {
  if (vinculo >= 10) return "rey";
  if (vinculo >= 7) return "experto";
  if (vinculo >= 4) return "crece";
  return "inicial";
}

/** Orden numérico (para "a partir de experto") */
export const nivelCrecimiento = (e: EtapaCrecimiento) => ETAPAS_CRECIMIENTO.indexOf(e);

/**
 * Etapa de cada asistente en la app. Lo provee la gamificación; fuera de ella (hojas de desarrollo,
 * pruebas) no hay contexto y todos quedan en "inicial", que es el dibujo de siempre.
 */
export const CrecimientoCtx = createContext<Partial<Record<AsistenteId, EtapaCrecimiento>> | null>(null);
export const useCrecimiento = (id: AsistenteId): EtapaCrecimiento => useContext(CrecimientoCtx)?.[id] ?? "inicial";
