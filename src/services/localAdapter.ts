import {
  CASCADES,
  TABLES,
  emptyDatabase,
  type BaseRow,
  type Database,
  type NewRow,
  type Profile,
  type Row,
  type TableName,
} from "@/types/db";
import { TIMEZONE } from "@/utils/dates";
import type { DataAdapter } from "./types";
import { endLocalSession, getLocalAccount, hasLocalSession, removeLocalAccount } from "./localAuth";

const PREFIX = "lifeos:v1:";
export const LOCAL_USER_ID = "local-user";

function key(name: string) {
  return PREFIX + name;
}

function read<T>(name: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key(name));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(name: string, value: unknown) {
  window.localStorage.setItem(key(name), JSON.stringify(value));
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Aplica borrados en cascada / desvinculaciones igual que lo haría PostgreSQL. */
function cascade(table: TableName, id: string) {
  for (const rule of CASCADES[table] ?? []) {
    const rows = read<Record<string, unknown>[]>(rule.table, []);
    if (rule.action === "delete") {
      const removed = rows.filter((r) => r[rule.field] === id);
      write(rule.table, rows.filter((r) => r[rule.field] !== id));
      for (const r of removed) cascade(rule.table, r.id as string);
    } else {
      write(
        rule.table,
        rows.map((r) => (r[rule.field] === id ? { ...r, [rule.field]: null } : r)),
      );
    }
  }
}

export const localAdapter: DataAdapter = {
  mode: "local",

  async loadAll() {
    if (!hasLocalSession()) throw new Error("AUTH_REQUIRED");
    const db = emptyDatabase();
    for (const t of TABLES) {
      (db as Record<TableName, unknown[]>)[t] = read<unknown[]>(t, []);
    }
    return db as Database;
  },

  async loadProfile() {
    if (!hasLocalSession()) throw new Error("AUTH_REQUIRED");
    const profile = read<Profile>("profile", {
      id: LOCAL_USER_ID,
      full_name: null,
      email: null,
      currency: "COP",
      timezone: TIMEZONE,
    });
    return { ...profile, email: getLocalAccount()?.email ?? profile.email };
  },

  async saveProfile(patch) {
    const current = await this.loadProfile();
    const next = { ...current, ...patch, id: LOCAL_USER_ID };
    write("profile", next);
    return next;
  },

  async insert<T extends TableName>(table: T, data: NewRow<T>) {
    const row = {
      ...data,
      id: uuid(),
      user_id: LOCAL_USER_ID,
      created_at: new Date().toISOString(),
    } as Row<T>;
    const rows = read<Row<T>[]>(table, []);
    write(table, [...rows, row]);
    return row;
  },

  async update<T extends TableName>(table: T, id: string, patch: Partial<NewRow<T>>) {
    const rows = read<Row<T>[]>(table, []);
    let updated: Row<T> | undefined;
    const next = rows.map((r) => {
      if ((r as BaseRow).id !== id) return r;
      updated = { ...r, ...patch } as Row<T>;
      return updated;
    });
    if (!updated) throw new Error("El registro ya no existe.");
    write(table, next);
    return updated;
  },

  async remove(table, id) {
    const rows = read<BaseRow[]>(table, []);
    write(table, rows.filter((r) => r.id !== id));
    cascade(table, id);
  },

  /** Reemplaza todos los datos por los de un respaldo (conserva ids y fechas) */
  async importAll(data, profile) {
    for (const t of TABLES) {
      const filas = Array.isArray((data as Record<string, unknown>)[t]) ? ((data as Record<string, unknown[]>)[t] as BaseRow[]) : [];
      write(
        t,
        filas.filter((r) => r && typeof r.id === "string").map((r) => ({ ...r, user_id: LOCAL_USER_ID })),
      );
    }
    if (profile) write("profile", { ...profile, id: LOCAL_USER_ID });
  },

  async clearAll() {
    for (const t of TABLES) window.localStorage.removeItem(key(t));
    window.localStorage.removeItem(key("profile"));
    removeLocalAccount();
  },

  async signOut() {
    endLocalSession();
  },
};
