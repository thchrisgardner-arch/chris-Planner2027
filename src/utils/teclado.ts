import type { KeyboardEvent } from "react";

/**
 * Flechas en grupos de opciones (pestañas segmentadas y radios): ←/→ (o ↑/↓) pasan a la opción
 * vecina, Inicio/Fin a la primera y la última. Elige la opción y le pasa el foco, como pide WAI-ARIA.
 */
export function flechasGrupo<T extends string>(e: KeyboardEvent<HTMLElement>, valores: T[], actual: T, elegir: (v: T) => void) {
  const i = valores.indexOf(actual);
  const destino: Record<string, number> = {
    ArrowRight: i + 1,
    ArrowDown: i + 1,
    ArrowLeft: i - 1,
    ArrowUp: i - 1,
    Home: 0,
    End: valores.length - 1,
  };
  if (!(e.key in destino)) return;
  e.preventDefault();
  const n = (destino[e.key] + valores.length) % valores.length;
  elegir(valores[n]);
  const botones = e.currentTarget.querySelectorAll<HTMLElement>("[role=tab], [role=radio]");
  botones[n]?.focus();
}
