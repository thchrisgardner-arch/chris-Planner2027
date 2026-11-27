/**
 * Tecla N: en toda la app abre la captura rápida; dentro de un panel que crea algo (tareas,
 * reuniones…), crea en ese panel. El panel activo se registra aquí y la captura rápida le cede la tecla.
 */
let actual: (() => void) | null = null;

export function registrarNuevo(fn: () => void) {
  actual = fn;
  return () => {
    if (actual === fn) actual = null;
  };
}

export const nuevoDelPanel = () => actual;
