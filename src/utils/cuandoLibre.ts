/**
 * Ejecuta algo cuando la página ya cargó y el navegador está libre (para precargar código que no
 * hace falta en la primera pantalla). Devuelve la función que lo cancela (útil en un useEffect).
 */
export function cuandoLibre(fn: () => void, espera = 1500): () => void {
  if (typeof window === "undefined") return () => {};
  let t = 0;
  let idle = 0;
  const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  const programar = () => {
    t = window.setTimeout(() => {
      if (w.requestIdleCallback) idle = w.requestIdleCallback(fn, { timeout: 4000 });
      else fn();
    }, espera);
  };
  if (document.readyState === "complete") programar();
  else window.addEventListener("load", programar, { once: true });
  return () => {
    window.removeEventListener("load", programar);
    window.clearTimeout(t);
    if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle);
  };
}
