import { getSupabase } from "@/lib/supabase";
import { TABLES, emptyDatabase, type Database, type Profile, type TableName } from "@/types/db";
import { TIMEZONE } from "@/utils/dates";
import type { DataAdapter } from "./types";

/** Campos numeric(14,2) que PostgREST puede devolver como string. */
const MONEY_FIELDS: Partial<Record<TableName, string[]>> = {
  accounts: ["initial_balance"],
  transactions: ["amount"],
  savings_goals: ["target_amount", "current_amount"],
  debts: ["total_amount", "pending_amount", "installment_amount", "overdue_amount"],
  debt_payments: ["amount"],
  projects: ["budget"],
  wishlist_items: ["price"],
};

function normalize<T>(table: TableName, row: Record<string, unknown>): T {
  const fields = MONEY_FIELDS[table];
  if (!fields) return row as T;
  const out = { ...row };
  for (const f of fields) if (out[f] != null) out[f] = Math.round(Number(out[f]));
  return out as T;
}

async function userId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getUser();
  if (error || !data.user) throw new Error("AUTH_REQUIRED");
  return data.user.id;
}

export const supabaseAdapter: DataAdapter = {
  mode: "supabase",

  async loadAll() {
    await userId();
    const sb = getSupabase();
    const db = emptyDatabase() as Record<TableName, unknown[]>;
    const results = await Promise.all(TABLES.map((t) => sb.from(t).select("*").order("created_at")));
    results.forEach((res, i) => {
      if (res.error) throw new Error(res.error.message);
      const t = TABLES[i];
      db[t] = (res.data ?? []).map((r) => normalize(t, r));
    });
    return db as Database;
  },

  async loadProfile() {
    const sb = getSupabase();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) throw new Error("AUTH_REQUIRED");
    const { data } = await sb.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
    return {
      id: auth.user.id,
      full_name: data?.full_name ?? null,
      email: auth.user.email ?? null,
      currency: data?.currency ?? "COP",
      timezone: data?.timezone ?? TIMEZONE,
      avatar_url: data?.avatar_url ?? null,
    } satisfies Profile;
  },

  async saveProfile(patch) {
    const id = await userId();
    const { email: _email, ...rest } = patch;
    void _email;
    const { error } = await getSupabase().from("profiles").upsert({ id, ...rest });
    if (error) throw new Error(error.message);
    return this.loadProfile();
  },

  async insert(table, data) {
    const user_id = await userId();
    const { data: row, error } = await getSupabase()
      .from(table)
      .insert({ ...data, user_id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return normalize(table, row);
  },

  async update(table, id, patch) {
    const { data: row, error } = await getSupabase().from(table).update(patch as Record<string, unknown>).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return normalize(table, row);
  },

  async remove(table, id) {
    const { error } = await getSupabase().from(table).delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  async signOut() {
    await getSupabase().auth.signOut();
  },
};
