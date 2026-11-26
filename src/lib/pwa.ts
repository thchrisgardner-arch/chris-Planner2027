/**
 * App instalable (PWA): registro del service worker, aviso de instalación del navegador y días
 * de uso en el celular (para sugerir instalarla una sola vez, al tercer día).
 */
import { useSyncExternalStore } from "react";
import { crearAlmacen } from "@/lib/almacenLocal";

/** En producción el service worker también guarda la app en caché (funciona sin conexión) */
export const URL_SW = process.env.NODE_ENV === "production" ? "/sw.js?cache=1" : "/sw.js";

export async function registrarSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register(URL_SW, { scope: "/", updateViaCache: "none" });
}

/* ═════════ Instalación ═════════ */
interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let diferido: EventoInstalar | null = null;
let instaladaAhora = false;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
let escuchando = false;

/** Se llama una vez al iniciar: guarda el aviso de instalación para mostrarlo con nuestro botón */
export function escucharInstalacion() {
  if (escuchando || typeof window === "undefined") return;
  escuchando = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    diferido = e as EventoInstalar;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    diferido = null;
    instaladaAhora = true;
    avisar();
  });
}

export const esIOS = () =>
  typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
export const esInstalada = () =>
  typeof window !== "undefined" &&
  (instaladaAhora || window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
export const esMovil = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 1024;

export type EstadoInstalacion = "instalada" | "disponible" | "ios" | "no-disponible";

function estadoActual(): EstadoInstalacion {
  if (esInstalada()) return "instalada";
  if (diferido) return "disponible";
  if (esIOS()) return "ios";
  return "no-disponible";
}

export function useInstalacion(): EstadoInstalacion {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    estadoActual,
    () => "no-disponible",
  );
}

/** Abre el diálogo de instalación del navegador. Devuelve true si la persona aceptó. */
export async function instalarApp(): Promise<boolean> {
  if (!diferido) return false;
  const e = diferido;
  diferido = null;
  await e.prompt();
  const r = await e.userChoice;
  avisar();
  return r.outcome === "accepted";
}

/* ═════════ Días de uso en el celular ═════════ */
interface DatosUso {
  version: 1;
  diasMovil: string[];
  sugerenciaInstalar: "pendiente" | "mostrada";
}
export const almacenUso = crearAlmacen<DatosUso>(
  "lifeos:uso",
  () => ({ version: 1, diasMovil: [], sugerenciaInstalar: "pendiente" }),
  (c) => ({ version: 1, diasMovil: Array.isArray(c.diasMovil) ? (c.diasMovil as string[]).slice(-30) : [], sugerenciaInstalar: c.sugerenciaInstalar === "mostrada" ? "mostrada" : "pendiente" }),
);

export function registrarDiaMovil(hoy: string) {
  const d = almacenUso.leer();
  if (d.diasMovil.includes(hoy)) return;
  almacenUso.guardar({ ...d, diasMovil: [...d.diasMovil, hoy].slice(-30) });
}
