"use client";

import { useSyncExternalStore } from "react";
import { todayISO } from "@/utils/dates";

function subscribe(onChange: () => void) {
  // Revisa cada minuto por si la app queda abierta pasada la medianoche.
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

/**
 * Fecha de hoy en Bogotá ("YYYY-MM-DD").
 * En el servidor devuelve "" para no congelar la fecha en el prerender;
 * el contenido que depende de ella solo se muestra cuando los datos cargan en el navegador.
 */
export function useToday(): string {
  return useSyncExternalStore(subscribe, todayISO, () => "");
}
