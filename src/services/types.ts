import type { Database, NewRow, Profile, Row, TableName } from "@/types/db";

export type DataMode = "local" | "supabase" | "demo";

/**
 * Contrato común para guardar datos. Hoy existen dos implementaciones:
 *  - localAdapter: guarda en este navegador (localStorage). No hay nube.
 *  - supabaseAdapter: PostgreSQL + Auth + RLS, se activa al definir las variables de entorno.
 */
export interface DataAdapter {
  mode: DataMode;
  loadAll(): Promise<Database>;
  loadProfile(): Promise<Profile>;
  saveProfile(patch: Partial<Profile>): Promise<Profile>;
  insert<T extends TableName>(table: T, data: NewRow<T>): Promise<Row<T>>;
  update<T extends TableName>(table: T, id: string, patch: Partial<NewRow<T>>): Promise<Row<T>>;
  remove(table: TableName, id: string): Promise<void>;
  /** Borra todos los datos del usuario (solo modo local) */
  clearAll?(): Promise<void>;
  signOut?(): Promise<void>;
}
