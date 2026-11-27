"use client";

/**
 * Sincronizador en segundo plano (Fase 6.2). Solo corre con la sincronización activa:
 * al abrir la app, cada 60 s, al volver a la pestaña, al recuperar la conexión y unos segundos
 * después de cada cambio. Si falla, reintenta cada vez más espaciado (hasta 15 min).
 */
import { useEffect } from "react";
import { useData } from "@/lib/store/DataProvider";
import { isSupabaseConfigured } from "@/lib/supabase";
import { almacenSync, EVENTO_CAMBIO } from "@/lib/sync/almacenes";
import { cicloSync } from "@/lib/sync/cliente";

const NORMAL = 60_000;
const MAXIMO = 15 * 60_000;

export function Sincronizador() {
  const { mode, status, reload } = useData();
  const activo = almacenSync.useValor().activo;

  useEffect(() => {
    if (!isSupabaseConfigured || mode === "demo" || status !== "ready" || !activo) return;
    let vivo = true;
    let espera = NORMAL;
    let reloj: ReturnType<typeof setTimeout> | undefined;
    let pronto: ReturnType<typeof setTimeout> | undefined;

    const ciclo = async () => {
      clearTimeout(reloj);
      try {
        const r = await cicloSync();
        if (vivo && r?.tablas) await reload();
        espera = NORMAL;
      } catch {
        espera = Math.min(espera * 2, MAXIMO);
      }
      if (vivo) reloj = setTimeout(ciclo, espera);
    };
    const alCambiar = () => {
      clearTimeout(pronto);
      pronto = setTimeout(ciclo, 2500);
    };
    const alVolver = () => {
      if (document.visibilityState === "visible") void ciclo();
    };
    void ciclo();
    window.addEventListener(EVENTO_CAMBIO, alCambiar);
    window.addEventListener("online", ciclo);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      clearTimeout(reloj);
      clearTimeout(pronto);
      window.removeEventListener(EVENTO_CAMBIO, alCambiar);
      window.removeEventListener("online", ciclo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [mode, status, activo, reload]);

  return null;
}
