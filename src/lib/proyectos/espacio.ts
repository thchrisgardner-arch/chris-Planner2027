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
  /** Nombre elegido por la persona; sin él se usan las primeras palabras de la transcripción (tituloVoz) */
  titulo?: string;
  /** Por qué no hay transcripción: el navegador no la tiene, falló o no se detectó voz */
  sinTexto?: "no-soportado" | "error" | "silencio";
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
/** Registro al que se adjuntó una imagen (p. ej. la factura de un gasto) */
export type VinculoImagen = { tabla: "tasks" | "transactions"; id: string };

export interface ImagenProyecto {
  id: string;
  proyectoId: string;
  nombre: string;
  ancho: number;
  alto: number;
  creada: string;
  /** Descripción opcional (también sirve de texto alternativo) */
  descripcion?: string;
  /** Tareas o gastos a los que está adjunta: se ve en los dos lados */
  vinculos?: VinculoImagen[];
  /** Peso guardado (comprimida) y peso original, en bytes */
  bytes?: number;
  original?: number;
}

interface Espacio {
  /**
   * 2: el título de las notas de voz es opcional (antes se guardaba «Nota de voz · fecha»).
   * 3: las reuniones viven en el calendario (calendar_events con project_id y meeting); aquí quedan
   *    vacías y `reunionId` de las notas de voz apunta al evento.
   */
  version?: 2 | 3;
  notas: Record<string, NotaProyecto>;
  voz: NotaVoz[];
  /** Solo para migrar (versión ≤ 2) */
  reuniones: Reunion[];
  imagenes: ImagenProyecto[];
  portadas: Record<string, string>;
}

const VACIO: Espacio = { version: 3, notas: {}, voz: [], reuniones: [], imagenes: [], portadas: {} };

/** Versión 1 → 2: los títulos automáticos («Nota de voz · 26 de nov, 12:52 p. m.») se quitan; la fecha ya va aparte */
export function migrarEspacio(e: Espacio): Espacio {
  if ((e.version ?? 1) >= 2) return e;
  return {
    ...e,
    version: 2,
    voz: e.voz.map((v) => {
      if (!v.titulo || !/^Nota de voz · /.test(v.titulo)) return v;
      const sinTitulo = { ...v };
      delete sinTitulo.titulo;
      return sinTitulo;
    }),
  };
}

/** Título que se muestra: el elegido, o las primeras 6 palabras de la transcripción, o «Nota de voz» */
export function tituloVoz(v: Pick<NotaVoz, "titulo" | "transcripcion">): string {
  if (v.titulo?.trim()) return v.titulo.trim();
  const palabras = v.transcripcion
    .map((s) => s.texto)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean);
  if (!palabras.length) return "Nota de voz";
  const corto = palabras.slice(0, 6).join(" ").replace(/[.,;:]+$/, "");
  return palabras.length > 6 ? `${corto}…` : corto;
}
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
    const crudo: Espacio = raw ? { ...VACIO, version: undefined, ...JSON.parse(raw) } : { ...VACIO };
    cache = migrarEspacio(crudo);
    if (raw && crudo.version !== 2) window.localStorage.setItem(CLAVE, JSON.stringify(cache));
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
  /** Fin de la migración de reuniones: las notas de voz apuntan al evento y la lista queda vacía */
  cerrarMigracionReuniones(mapa: Record<string, string>) {
    const e = leer();
    guardar({ ...e, version: 3, reuniones: [], voz: e.voz.map((v) => (v.reunionId && mapa[v.reunionId] ? { ...v, reunionId: mapa[v.reunionId] } : v)) });
  },
  actualizarImagen(id: string, cambios: Partial<Omit<ImagenProyecto, "id" | "proyectoId">>) {
    const e = leer();
    guardar({ ...e, imagenes: e.imagenes.map((i) => (i.id === id ? { ...i, ...cambios } : i)) });
  },
  /** Orden manual: las imágenes del proyecto quedan en el orden de `ids` (las demás no se mueven) */
  ordenarImagenes(proyectoId: string, ids: string[]) {
    const e = leer();
    const propias = new Map(e.imagenes.filter((i) => i.proyectoId === proyectoId).map((i) => [i.id, i]));
    const ordenadas = [...ids.map((id) => propias.get(id)!).filter(Boolean), ...[...propias.values()].filter((i) => !ids.includes(i.id))];
    let k = 0;
    guardar({ ...e, imagenes: e.imagenes.map((i) => (i.proyectoId === proyectoId ? ordenadas[k++] : i)) });
  },
  vincularImagen(id: string, v: VinculoImagen) {
    const e = leer();
    guardar({
      ...e,
      imagenes: e.imagenes.map((i) => (i.id === id && !(i.vinculos ?? []).some((x) => x.tabla === v.tabla && x.id === v.id) ? { ...i, vinculos: [...(i.vinculos ?? []), v] } : i)),
    });
  },
  desvincularImagen(id: string, v: VinculoImagen) {
    const e = leer();
    guardar({ ...e, imagenes: e.imagenes.map((i) => (i.id === id ? { ...i, vinculos: (i.vinculos ?? []).filter((x) => !(x.tabla === v.tabla && x.id === v.id)) } : i)) });
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
      imagenes: e.imagenes.filter((i) => i.proyectoId === proyectoId).length,
    };
  },
  /**
   * Borra todo el espacio de un proyecto: nota, notas de voz, imágenes, portada y archivos.
   * (Sus reuniones son eventos del calendario: se borran desde ProjectsPage.)
   */
  async borrarProyecto(proyectoId: string): Promise<void> {
    const e = leer();
    const voz = e.voz.filter((v) => v.proyectoId === proyectoId);
    const imagenes = e.imagenes.filter((i) => i.proyectoId === proyectoId);
    const notas = { ...e.notas };
    delete notas[proyectoId];
    const portadas = { ...e.portadas };
    delete portadas[proyectoId];
    guardar({
      version: e.version,
      notas,
      portadas,
      voz: e.voz.filter((v) => v.proyectoId !== proyectoId),
      reuniones: e.reuniones,
      imagenes: e.imagenes.filter((i) => i.proyectoId !== proyectoId),
    });
    await Promise.all([...voz, ...imagenes].map((x) => borrarArchivo(x.id)));
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
