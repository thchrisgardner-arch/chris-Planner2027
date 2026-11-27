"use client";

/**
 * Monta su contenido cuando la página ya cargó y el navegador está libre. Para piezas que no se ven
 * en la primera pantalla (avisos, sugerencias, paneles): su código se descarga después y no compite
 * con lo que la persona está esperando ver.
 */
import { startTransition, Suspense, useEffect, useState } from "react";
import { cuandoLibre } from "@/utils/cuandoLibre";

export function Diferido({ children, espera = 1200 }: { children: React.ReactNode; espera?: number }) {
  const [listo, setListo] = useState(false);
  useEffect(() => cuandoLibre(() => setListo(true), espera), [espera]);
  return listo ? <Suspense fallback={null}>{children}</Suspense> : null;
}

/**
 * Dibuja su contenido justo después del primer pintado (dos cuadros después), en una transición
 * que cede el hilo al navegador. Para lo que está más abajo en la pantalla: lo de arriba se ve
 * primero y lo demás aparece una fracción de segundo después (debajo, así que nada salta).
 */
export function DespuesDelPrimerPintado({ children }: { children: React.ReactNode }) {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    let r2 = 0;
    const mostrar = () => startTransition(() => setListo(true));
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(mostrar);
    });
    // Respaldo: sin cuadros (pestaña en segundo plano) igual se dibuja
    const t = window.setTimeout(mostrar, 300);
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      window.clearTimeout(t);
    };
  }, []);
  return listo ? <>{children}</> : null;
}
