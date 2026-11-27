/**
 * Sincronización entre dispositivos (Fase 6). Tipos compartidos por el motor, el lado local
 * (localStorage) y el lado remoto (Supabase). El motor no conoce ni el navegador ni Supabase:
 * recibe estas dos interfaces, así se prueba con dos dispositivos simulados.
 */
import { TABLES, type TableName } from "@/types/db";

export type Fila = Record<string, unknown> & { id: string };
export type FilaRemota = Fila & { updated_at: string; deleted_at: string | null; client_id: string | null };

/** Almacenes del navegador que viajan a user_state (mismas claves que permite 0004_sincronizacion.sql) */
export const CLAVES_DOC = [
  "asistentes",
  "progreso",
  "closet",
  "pagos-fijos",
  "enfoque",
  "animo-usuario",
  "animo-historial",
  "conexiones",
  "salud",
  "espacio",
  "captura",
  "tutorial",
  "onboarding",
  "vistas",
] as const;
export type ClaveDoc = (typeof CLAVES_DOC)[number];

/** Clave de cada documento en localStorage */
export const CLAVE_LOCAL: Record<ClaveDoc, string> = {
  asistentes: "lifeos:asistentes",
  progreso: "lifeos:progreso",
  closet: "lifeos:closet",
  "pagos-fijos": "lifeos:pagos-fijos",
  enfoque: "lifeos:enfoque",
  "animo-usuario": "lifeos:animo-usuario",
  "animo-historial": "lifeos:animo-historial",
  conexiones: "lifeos:conexiones",
  salud: "lifeos:salud",
  espacio: "lifeos:espacio",
  captura: "lifeos:captura",
  tutorial: "lifeos:tutorial",
  onboarding: "lifeos:onboarding-done",
  vistas: "lifeos:vistas",
};

export type DocRemoto = { clave: ClaveDoc; data: unknown; updated_at: string; deleted_at: string | null; client_id: string | null };

/** Padres antes que hijos (las llaves foráneas y el disparador de dueño lo exigen al subir) */
export const ORDEN_SUBIDA: TableName[] = [
  "accounts",
  "transaction_categories",
  "savings_goals",
  "transactions",
  "debts",
  "debt_payments",
  "projects",
  "tasks",
  "habits",
  "habit_logs",
  "wishlist_items",
  "annual_goals",
  "calendar_events",
];
// Si mañana se agrega una tabla a TABLES y no aquí, la prueba del motor lo detecta
export const TABLAS_SYNC: TableName[] = TABLES;

export interface Remoto {
  /** upsert por id; el servidor pone updated_at */
  subirFilas(tabla: TableName, filas: Fila[], clientId: string): Promise<void>;
  /** Borrado suave (deleted_at) */
  marcarBorradas(tabla: TableName, ids: string[], clientId: string): Promise<void>;
  /** Filas con updated_at > desde (todas si desde es null), incluidas las borradas, en orden */
  traerFilas(tabla: TableName, desde: string | null): Promise<FilaRemota[]>;
  /** ids que siguen vivos en la nube */
  idsVivos(tabla: TableName): Promise<string[]>;
  /** Guarda un documento y devuelve su updated_at */
  subirDoc(clave: ClaveDoc, data: unknown, clientId: string): Promise<string>;
  traerDocs(desde: string | null): Promise<DocRemoto[]>;
  /** ¿Hay algún registro vivo en la nube? */
  hayDatos(): Promise<boolean>;
  /** Borra todo lo del usuario en la nube (filas, documentos y archivos) */
  borrarTodo(): Promise<void>;
}

export interface Local {
  filas(tabla: TableName): Fila[];
  guardarFilas(tabla: TableName, filas: Fila[]): void;
  doc(clave: ClaveDoc): unknown | null;
  guardarDoc(clave: ClaveDoc, data: unknown): void;
}

export type Cambio = { seq: number; t: TableName; id: string; op: "guardar" | "borrar" };

export interface EstadoSync {
  version: 1;
  /** El usuario activó la sincronización en este dispositivo */
  activo: boolean;
  /** Identifica a este dispositivo en client_id */
  clientId: string;
  /** Usuario de Supabase con el que se activó (si cambia, se vuelve a conectar) */
  userId: string | null;
  email: string | null;
  /** Última marca updated_at traída por tabla */
  marcas: Partial<Record<TableName, string>>;
  marcaDocs: string | null;
  /** Huella de cada documento tal como quedó en la nube la última vez */
  docs: Partial<Record<ClaveDoc, { hash: string; remoto: string }>>;
  ultimo: string | null;
  error: string | null;
  /** 6.5: incluir audios e imágenes del espacio de proyectos */
  archivos: boolean;
  /** Archivos ya subidos */
  subidos: string[];
}

/** Lo que el motor necesita para un ciclo */
export interface Contexto {
  local: Local;
  remoto: Remoto;
  estado: { leer(): EstadoSync; guardar(e: EstadoSync): void };
  pendientes: { leer(): Cambio[]; quitarHasta(seq: number): void; vaciar(): void; agregar(c: Omit<Cambio, "seq">[]): void };
  /** Hoy en Bogotá (para recalcular la racha al fusionar) */
  hoy: string;
}
