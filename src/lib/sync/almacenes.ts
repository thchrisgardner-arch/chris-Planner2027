/**
 * Estado de la sincronización en este dispositivo (`lifeos:sync`) y bandeja de cambios por subir
 * (`lifeos:sync-pendientes`). Ninguno de los dos viaja a la nube. En modo demo viven en memoria
 * y la sincronización nunca se activa.
 */
import { crearAlmacen } from "@/lib/almacenLocal";
import type { TableName } from "@/types/db";
import type { Cambio, EstadoSync } from "./tipos";

const nuevoClientId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `d-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export type EstadoSyncGuardado = EstadoSync & { rechazadas: { t: string; id: string; motivo: string }[] };

const estadoVacio = (): EstadoSyncGuardado => ({
  version: 1,
  activo: false,
  clientId: nuevoClientId(),
  userId: null,
  email: null,
  marcas: {},
  marcaDocs: null,
  docs: {},
  ultimo: null,
  error: null,
  archivos: false,
  subidos: [],
  rechazadas: [],
});

export const almacenSync = crearAlmacen<EstadoSyncGuardado>("lifeos:sync", estadoVacio, (c) => ({
  ...estadoVacio(),
  ...(c as Partial<EstadoSyncGuardado>),
  version: 1,
  marcas: (c.marcas as EstadoSync["marcas"]) ?? {},
  docs: (c.docs as EstadoSync["docs"]) ?? {},
  subidos: Array.isArray(c.subidos) ? (c.subidos as string[]) : [],
  rechazadas: Array.isArray(c.rechazadas) ? (c.rechazadas as EstadoSyncGuardado["rechazadas"]) : [],
}));

interface Bandeja {
  version: 1;
  seq: number;
  cambios: Cambio[];
}
export const almacenPendientes = crearAlmacen<Bandeja>("lifeos:sync-pendientes", () => ({ version: 1, seq: 0, cambios: [] }), (c) => ({
  version: 1,
  seq: typeof c.seq === "number" ? c.seq : 0,
  cambios: Array.isArray(c.cambios) ? (c.cambios as Cambio[]) : [],
}));

const enDemo = () => typeof window !== "undefined" && !!window.sessionStorage.getItem("lifeos-demo");
export const syncActivo = () => typeof window !== "undefined" && !enDemo() && almacenSync.leer().activo;

/** Evento que avisa al sincronizador que hay algo nuevo por subir */
export const EVENTO_CAMBIO = "lifeos:sync-cambio";

export function agregarPendientes(cs: Omit<Cambio, "seq">[]) {
  if (!cs.length) return;
  almacenPendientes.cambiar((b) => {
    let seq = b.seq;
    return { version: 1, cambios: [...b.cambios, ...cs.map((c) => ({ ...c, seq: ++seq }))], seq };
  });
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_CAMBIO));
}

/** Lo llama el adaptador local en cada alta, edición o borrado (solo anota si la sincronización está activa) */
export function registrarCambio(t: TableName, id: string, op: Cambio["op"]) {
  if (syncActivo()) agregarPendientes([{ t, id, op }]);
}

export const bandejaNavegador = {
  leer: () => almacenPendientes.leer().cambios,
  quitarHasta: (n: number) => almacenPendientes.cambiar((b) => ({ ...b, cambios: b.cambios.filter((c) => c.seq > n) })),
  vaciar: () => almacenPendientes.cambiar((b) => ({ ...b, cambios: [] })),
  agregar: agregarPendientes,
};
