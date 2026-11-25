"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { localAdapter } from "@/services/localAdapter";
import { supabaseAdapter } from "@/services/supabaseAdapter";
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
  update<T extends TableName>(table: T, id: string, patch: Partial<NewRow<T>>): Promise<Row<T>>;
  remove(table: TableName, id: string): Promise<void>;
  saveProfile(patch: Partial<Profile>): Promise<void>;
  reload(): Promise<void>;
  clearAll(): Promise<void>;
  signOut(): Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

/** El adaptador se decide una vez según las variables de entorno. */
const adapter: DataAdapter = isSupabaseConfigured ? supabaseAdapter : localAdapter;

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

  const reload = useCallback(async () => {
    try {
      const [data, prof] = await Promise.all([adapter.loadAll(), adapter.loadProfile()]);
      setDb(data);
      setProfile(prof);
      setStatus("ready");
      setError(null);
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
    const row = await adapter.insert(table, data);
    setDb((prev) => ({ ...prev, [table]: [...prev[table], row] }));
    return row;
  }, []);

  const update = useCallback(async <T extends TableName>(table: T, id: string, patch: Partial<NewRow<T>>) => {
    const row = await adapter.update(table, id, patch);
    setDb((prev) => ({
      ...prev,
      [table]: (prev[table] as BaseRow[]).map((r) => (r.id === id ? row : r)),
    }));
    return row;
  }, []);

  const remove = useCallback(async (table: TableName, id: string) => {
    await adapter.remove(table, id);
    setDb((prev) => {
      const next = { ...prev, [table]: (prev[table] as BaseRow[]).filter((r) => r.id !== id) } as Database;
      return applyCascade(next, table, id);
    });
  }, []);

  const saveProfile = useCallback(async (patch: Partial<Profile>) => {
    const p = await adapter.saveProfile(patch);
    setProfile(p);
  }, []);

  const clearAll = useCallback(async () => {
    if (!adapter.clearAll) throw new Error("No disponible en este modo.");
    await adapter.clearAll();
    setDb(emptyDatabase());
    setProfile(null);
    await reload();
  }, [reload]);

  const signOut = useCallback(async () => {
    if (!adapter.signOut) return;
    await adapter.signOut();
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
      mode: adapter.mode,
      insert,
      update,
      remove,
      saveProfile,
      reload,
      clearAll,
      signOut,
    }),
    [db, profile, status, error, insert, update, remove, saveProfile, reload, clearAll, signOut],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData debe usarse dentro de <DataProvider>");
  return ctx;
}
