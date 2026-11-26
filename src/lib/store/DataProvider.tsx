"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { localAdapter } from "@/services/localAdapter";
import { supabaseAdapter } from "@/services/supabaseAdapter";
import { demoAdapter, setDemoVariant } from "@/services/demoAdapter";
import type { DataAdapter, DataMode } from "@/services/types";
import {
  CASCADES,
  emptyDatabase,
  type BaseRow,
  type Database,
  type NewRow,
  type Profile,
  type Row,
  type TableName,
} from "@/types/db";

type Status = "loading" | "ready" | "auth_required" | "error";

interface DataContextValue {
  db: Database;
  profile: Profile | null;
  status: Status;
  error: string | null;
  mode: DataMode;
  insert<T extends TableName>(table: T, data: NewRow<T>): Promise<Row<T>>;
  /** Varios registros con una sola actualización de pantalla (p. ej. importar un extracto) */
  insertMany<T extends TableName>(table: T, data: NewRow<T>[], onProgress?: (hechos: number) => void): Promise<Row<T>[]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<NewRow<T>>): Promise<Row<T>>;
  remove(table: TableName, id: string): Promise<void>;
  saveProfile(patch: Partial<Profile>): Promise<void>;
  reload(): Promise<void>;
  clearAll(): Promise<void>;
  /** Reemplaza todos los datos por un respaldo (solo modo local) */
  importAll(data: Database, profile: Profile | null): Promise<void>;
  signOut(): Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

/**
 * Adaptador de datos:
 *  - Supabase si está configurado.
 *  - Modo demo (?demo=1, se recuerda en la pestaña; ?demo=0 lo apaga): ejemplos en memoria,
 *    nunca toca los datos reales.
 *  - Local (localStorage) en los demás casos.
 */
let chosen: DataAdapter | null = null;
function getAdapter(): DataAdapter {
  if (typeof window === "undefined") return isSupabaseConfigured ? supabaseAdapter : localAdapter;
  if (chosen) return chosen;
  const q = new URLSearchParams(window.location.search).get("demo");
  if (q === "1" || q === "vacio") sessionStorage.setItem("lifeos-demo", q);
  if (q === "0") sessionStorage.removeItem("lifeos-demo");
  const flag = sessionStorage.getItem("lifeos-demo");
  const demo = flag === "1" || flag === "vacio";
  if (demo) setDemoVariant(flag === "vacio" ? "vacio" : "completo");
  chosen = demo ? demoAdapter : isSupabaseConfigured ? supabaseAdapter : localAdapter;
  return chosen;
}

function applyCascade(db: Database, table: TableName, id: string): Database {
  let next = db;
  for (const rule of CASCADES[table] ?? []) {
    const rows = next[rule.table] as unknown as (BaseRow & Record<string, unknown>)[];
    if (rule.action === "delete") {
      const removed = rows.filter((r) => r[rule.field] === id);
      next = { ...next, [rule.table]: rows.filter((r) => r[rule.field] !== id) };
      for (const r of removed) next = applyCascade(next, rule.table, r.id);
    } else {
      next = {
        ...next,
        [rule.table]: rows.map((r) => (r[rule.field] === id ? { ...r, [rule.field]: null } : r)),
      };
    }
  }
  return next;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database>(emptyDatabase);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  // El modo se fija al cargar en el navegador (en el servidor no se conoce el modo demo)
  const [mode, setMode] = useState<DataMode>(isSupabaseConfigured ? "supabase" : "local");

  const reload = useCallback(async () => {
    try {
      setMode(getAdapter().mode);
      const [data, prof] = await Promise.all([getAdapter().loadAll(), getAdapter().loadProfile()]);
      // En una transición: React arma la app por partes y le cede el hilo al navegador entre una y
      // otra (sin una tarea larga que congele la pantalla al abrir).
      startTransition(() => {
        setDb(data);
        setProfile(prof);
        setStatus("ready");
        setError(null);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      if (msg === "AUTH_REQUIRED") setStatus("auth_required");
      else {
        setError(msg);
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    // Carga inicial desde el almacenamiento (navegador o Supabase).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde el almacenamiento
    void reload();
  }, [reload]);

  const insert = useCallback(async <T extends TableName>(table: T, data: NewRow<T>) => {
    const row = await getAdapter().insert(table, data);
    setDb((prev) => ({ ...prev, [table]: [...prev[table], row] }));
    return row;
  }, []);

  const insertMany = useCallback(async <T extends TableName>(table: T, data: NewRow<T>[], onProgress?: (hechos: number) => void) => {
    const rows: Row<T>[] = [];
    try {
      for (const d of data) {
        rows.push(await getAdapter().insert(table, d));
        onProgress?.(rows.length);
      }
    } finally {
      // Aunque falle a mitad de camino, lo que sí se guardó aparece en pantalla
      setDb((prev) => ({ ...prev, [table]: [...prev[table], ...rows] }));
    }
    return rows;
  }, []);

  const update = useCallback(async <T extends TableName>(table: T, id: string, patch: Partial<NewRow<T>>) => {
    const row = await getAdapter().update(table, id, patch);
    setDb((prev) => ({
      ...prev,
      [table]: (prev[table] as BaseRow[]).map((r) => (r.id === id ? row : r)),
    }));
    return row;
  }, []);

  const remove = useCallback(async (table: TableName, id: string) => {
    await getAdapter().remove(table, id);
    setDb((prev) => {
      const next = { ...prev, [table]: (prev[table] as BaseRow[]).filter((r) => r.id !== id) } as Database;
      return applyCascade(next, table, id);
    });
  }, []);

  const saveProfile = useCallback(async (patch: Partial<Profile>) => {
    const p = await getAdapter().saveProfile(patch);
    setProfile(p);
  }, []);

  const clearAll = useCallback(async () => {
    const a = getAdapter();
    if (!a.clearAll) throw new Error("No disponible en este modo.");
    await a.clearAll();
    setDb(emptyDatabase());
    setProfile(null);
    await reload();
  }, [reload]);

  const importAll = useCallback(
    async (data: Database, prof: Profile | null) => {
      const a = getAdapter();
      if (!a.importAll) throw new Error("Importar solo está disponible con los datos guardados en este dispositivo.");
      await a.importAll(data, prof);
      await reload();
    },
    [reload],
  );

  const signOut = useCallback(async () => {
    const a = getAdapter();
    if (!a.signOut) return;
    await a.signOut();
    setDb(emptyDatabase());
    setProfile(null);
    setStatus("auth_required");
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      db,
      profile,
      status,
      error,
      mode,
      insert,
      insertMany,
      update,
      remove,
      saveProfile,
      reload,
      clearAll,
      importAll,
      signOut,
    }),
    [db, profile, status, error, mode, insert, insertMany, update, remove, saveProfile, reload, clearAll, importAll, signOut],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData debe usarse dentro de <DataProvider>");
  return ctx;
}
