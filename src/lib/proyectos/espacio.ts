/**
 * Espacio de trabajo de cada proyecto (tipo Notion): notas, notas de voz, reuniones e imágenes.
 *  - Los datos pequeños van en localStorage (`lifeos:espacio`).
 *  - Los archivos (audio e imágenes) van en IndexedDB (`lifeos-archivos`), que aguanta archivos grandes.
 *  - En modo demo todo vive solo en memoria: nada se guarda.
 */
import { useSyncExternalStore } from "react";

export interface NotaProyecto {
  texto: string;
  actualizado: string;
}
export interface SegmentoVoz {
  /** Segundos desde el inicio de la grabación */
  t: number;
  texto: string;
}
export interface NotaVoz {
  id: string;
  proyectoId: string;
  titulo: string;
  creada: string;
  duracion: number;
  /** Alturas normalizadas 0–1 para dibujar la onda */
  picos: number[];
  transcripcion: SegmentoVoz[];
  reunionId?: string;
  tipo: string;
}
export type Modalidad = "video" | "llamada" | "presencial";
export interface Reunion {
  id: string;
  proyectoId: string;
  titulo: string;
  fecha: string;
  inicio: string;
  fin: string;
  modalidad: Modalidad;
  enlace: string;
  lugar: string;
  participantes: string[];
  agenda: string;
  eventoId?: string;
  creada: string;
}
export interface ImagenProyecto {
  id: string;
  proyectoId: string;
  nombre: string;
  ancho: number;
  alto: number;
  creada: string;
}

interface Espacio {
  notas: Record<string, NotaProyecto>;
  voz: NotaVoz[];
  reuniones: Reunion[];
  imagenes: ImagenProyecto[];
  portadas: Record<string, string>;
}

const VACIO: Espacio = { notas: {}, voz: [], reuniones: [], imagenes: [], portadas: {} };
const CLAVE = "lifeos:espacio";
const enDemo = () => typeof window !== "undefined" && !!window.sessionStorage.getItem("lifeos-demo");

let cache: Espacio | null = null;
const oyentes = new Set<() => void>();

function leer(): Espacio {
  if (cache) return cache;
  if (typeof window === "undefined") return VACIO;
  if (enDemo()) return (cache = { ...VACIO });
  try {
    const raw = window.localStorage.getItem(CLAVE);
    cache = raw ? { ...VACIO, ...JSON.parse(raw) } : { ...VACIO };
  } catch {
    cache = { ...VACIO };
  }
  return cache!;
}


// Otra pestaña o la sincronización cambiaron el espacio de proyectos: se vuelve a leer
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== CLAVE) return;
    cache = null;
    oyentes.forEach((f) => f());
  });
}

function guardar(e: Espacio) {
  cache = e;
  if (typeof window !== "undefined" && !enDemo()) {
    try {
      window.localStorage.setItem(CLAVE, JSON.stringify(e));
    } catch {
      /* almacenamiento lleno: queda en memoria */
    }
  }
  oyentes.forEach((f) => f());
}

export function useEspacio() {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    leer,
    () => VACIO,
  );
}

/** Lectura directa (fuera de React), p. ej. para saber qué imagen acaba de subirse */
export const leerEspacio = () => leer();

export const nuevoId =(p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ═════════ Escrituras ═════════ */
export const espacio = {
  guardarNota(proyectoId: string, texto: string) {
    const e = leer();
    guardar({ ...e, notas: { ...e.notas, [proyectoId]: { texto, actualizado: new Date().toISOString() } } });
  },
  agregarVoz(v: NotaVoz) {
    const e = leer();
    guardar({ ...e, voz: [v, ...e.voz] });
  },
  actualizarVoz(id: string, cambios: Partial<NotaVoz>) {
    const e = leer();
    guardar({ ...e, voz: e.voz.map((v) => (v.id === id ? { ...v, ...cambios } : v)) });
  },
  async borrarVoz(id: string) {
    const e = leer();
    guardar({ ...e, voz: e.voz.filter((v) => v.id !== id) });
    await borrarArchivo(id);
  },
  guardarReunion(r: Reunion) {
    const e = leer();
    const existe = e.reuniones.some((x) => x.id === r.id);
    guardar({ ...e, reuniones: existe ? e.reuniones.map((x) => (x.id === r.id ? r : x)) : [...e.reuniones, r] });
  },
  borrarReunion(id: string) {
    const e = leer();
    guardar({ ...e, reuniones: e.reuniones.filter((r) => r.id !== id) });
  },
  agregarImagen(img: ImagenProyecto) {
    const e = leer();
    guardar({ ...e, imagenes: [img, ...e.imagenes] });
  },
  async borrarImagen(id: string) {
    const e = leer();
    const portadas = Object.fromEntries(Object.entries(e.portadas).filter(([, v]) => v !== id));
    guardar({ ...e, imagenes: e.imagenes.filter((i) => i.id !== id), portadas });
    await borrarArchivo(id);
  },
  /** Cuánto se perdería al borrar el proyecto (para el aviso de confirmación). */
  resumenProyecto(proyectoId: string) {
    const e = leer();
    return {
      nota: !!e.notas[proyectoId]?.texto.trim(),
      voz: e.voz.filter((v) => v.proyectoId === proyectoId).length,
      reuniones: e.reuniones.filter((r) => r.proyectoId === proyectoId).length,
      imagenes: e.imagenes.filter((i) => i.proyectoId === proyectoId).length,
    };
  },
  /**
   * Borra todo el espacio de un proyecto: nota, notas de voz, reuniones, imágenes, portada y archivos.
   * Devuelve los ids de los eventos de calendario de sus reuniones, para borrarlos también.
   */
  async borrarProyecto(proyectoId: string): Promise<string[]> {
    const e = leer();
    const voz = e.voz.filter((v) => v.proyectoId === proyectoId);
    const imagenes = e.imagenes.filter((i) => i.proyectoId === proyectoId);
    const eventos = e.reuniones.filter((r) => r.proyectoId === proyectoId && r.eventoId).map((r) => r.eventoId!);
    const notas = { ...e.notas };
    delete notas[proyectoId];
    const portadas = { ...e.portadas };
    delete portadas[proyectoId];
    guardar({
      notas,
      portadas,
      voz: e.voz.filter((v) => v.proyectoId !== proyectoId),
      reuniones: e.reuniones.filter((r) => r.proyectoId !== proyectoId),
      imagenes: e.imagenes.filter((i) => i.proyectoId !== proyectoId),
    });
    await Promise.all([...voz, ...imagenes].map((x) => borrarArchivo(x.id)));
    return eventos;
  },
  ponerPortada(proyectoId: string, imagenId: string | null) {
    const e = leer();
    const portadas = { ...e.portadas };
    if (imagenId) portadas[proyectoId] = imagenId;
    else delete portadas[proyectoId];
    guardar({ ...e, portadas });
  },
};

/* ═════════ Archivos (IndexedDB; en demo, memoria) ═════════ */
const memoria = new Map<string, Blob>();
let dbPromesa: Promise<IDBDatabase> | null = null;

function abrirDB(): Promise<IDBDatabase> {
  if (dbPromesa) return dbPromesa;
  dbPromesa = new Promise((res, rej) => {
    const req = indexedDB.open("lifeos-archivos", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("blobs");
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  return dbPromesa;
}

export async function guardarArchivo(id: string, blob: Blob) {
  if (enDemo() || typeof indexedDB === "undefined") return void memoria.set(id, blob);
  const db = await abrirDB();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction("blobs", "readwrite");
    tx.objectStore("blobs").put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function leerArchivo(id: string): Promise<Blob | null> {
  if (memoria.has(id)) return memoria.get(id)!;
  if (enDemo() || typeof indexedDB === "undefined") return null;
  const db = await abrirDB();
  return new Promise((res, rej) => {
    const req = db.transaction("blobs").objectStore("blobs").get(id);
    req.onsuccess = () => res((req.result as Blob) ?? null);
    req.onerror = () => rej(req.error);
  });
}

async function borrarArchivo(id: string) {
  memoria.delete(id);
  if (enDemo() || typeof indexedDB === "undefined") return;
  const db = await abrirDB();
  await new Promise<void>((res) => {
    const tx = db.transaction("blobs", "readwrite");
    tx.objectStore("blobs").delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

/** «Borrar todo»: vacía el espacio de todos los proyectos y la base de archivos (audios e imágenes). */
export async function borrarTodoEspacio() {
  guardar({ ...VACIO });
  memoria.clear();
  if (typeof window !== "undefined" && !enDemo()) {
    try {
      window.localStorage.removeItem(CLAVE);
    } catch {
      /* sin acceso al almacenamiento */
    }
  }
  if (enDemo() || typeof indexedDB === "undefined") return;
  const db = await abrirDB();
  await new Promise<void>((res) => {
    const tx = db.transaction("blobs", "readwrite");
    tx.objectStore("blobs").clear();
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

/* ═════════ Destacados de una transcripción (reglas simples, sin IA) ═════════ */
export type TipoDestacado = "fecha" | "monto" | "accion";
const REGLAS: { tipo: TipoDestacado; re: RegExp }[] = [
  { tipo: "monto", re: /(\$\s?\d[\d.,]*|\d[\d.,]*\s?(mil|millones?|pesos|k)\b)/i },
  { tipo: "fecha", re: /\b(hoy|mañana|pasado mañana|lunes|martes|miércoles|jueves|viernes|sábado|domingo|próxima semana|\d{1,2} de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))\b/i },
  { tipo: "accion", re: /\b(enviar|mandar|llamar|agendar|pagar|comprar|revisar|entregar|terminar|preparar|cotizar|confirmar|diseñar|escribir|subir)\w*\b/i },
];
export function destacados(texto: string): TipoDestacado[] {
  return REGLAS.filter((r) => r.re.test(texto)).map((r) => r.tipo);
}
export const ETIQUETA_DESTACADO: Record<TipoDestacado, string> = { fecha: "Fecha", monto: "Monto", accion: "Acción" };
