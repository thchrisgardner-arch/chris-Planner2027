/** Compartido por el servidor (layout) y el cliente: clave y script de tema. */
export const THEME_KEY = "lifeos:ui:theme";

/**
 * Script en línea para <head>: aplica el tema guardado antes del primer pintado (sin destello).
 * Misma lógica que applyTheme() en lib/theme.ts.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"claro";var d=t==="oscuro"||(t==="sistema"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;
