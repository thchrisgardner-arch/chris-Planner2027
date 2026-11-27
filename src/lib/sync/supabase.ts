/**
 * Lado remoto del motor: Supabase (PostgREST + Storage) con la sesión del usuario.
 * Toda consulta pasa por la RLS «solo el dueño»; aquí nunca se usa la llave de servicio.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalize } from "@/services/supabaseAdapter";
import type { TableName } from "@/types/db";
import { ORDEN_SUBIDA, TABLAS_SYNC, type ClaveDoc, type DocRemoto, type Fila, type FilaRemota, type Remoto } from "./tipos";

const LOTE = 500;
const PAGINA = 1000;
export const BUCKET = "archivos";

const trozos = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/** Errores de datos (restricciones de Postgres): esa fila se salta y se avisa; el resto sigue */
const esErrorDeDatos = (code?: string) => !!code && /^(22|23)/.test(code);

export function remotoSupabase(sb: SupabaseClient, uid: string, alRechazar: (t: TableName, id: string, motivo: string) => void): Remoto {
  const preparar = (f: Fila, clientId: string) => {
    const fila: Record<string, unknown> = { ...f, user_id: uid, client_id: clientId, deleted_at: null };
    delete fila.updated_at;
    return fila;
  };

  return {
    async subirFilas(t, filas, clientId) {
      for (const lote of trozos(filas, LOTE)) {
        const { error } = await sb.from(t).upsert(lote.map((f) => preparar(f, clientId)), { onConflict: "id" });
        if (!error) continue;
        if (!esErrorDeDatos(error.code)) throw new Error(error.message);
        // Un registro inválido no frena a los demás: se sube uno por uno
        for (const f of lote) {
          const r = await sb.from(t).upsert(preparar(f, clientId), { onConflict: "id" });
          if (r.error) {
            if (!esErrorDeDatos(r.error.code)) throw new Error(r.error.message);
            alRechazar(t, f.id, r.error.message);
          }
        }
      }
    },

    async marcarBorradas(t, ids, clientId) {
      for (const lote of trozos(ids, LOTE)) {
        const { error } = await sb.from(t).update({ deleted_at: new Date().toISOString(), client_id: clientId }).in("id", lote);
        if (error) throw new Error(error.message);
      }
    },

    async traerFilas(t, desde) {
      const out: FilaRemota[] = [];
      for (let i = 0; ; i += PAGINA) {
        let q = sb.from(t).select("*").order("updated_at").order("id").range(i, i + PAGINA - 1);
        if (desde) q = q.gt("updated_at", desde);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        out.push(...(data ?? []).map((r) => normalize<FilaRemota>(t, r)));
        if (!data || data.length < PAGINA) break;
      }
      return out;
    },

    async idsVivos(t) {
      const out: string[] = [];
      for (let i = 0; ; i += PAGINA) {
        const { data, error } = await sb.from(t).select("id").is("deleted_at", null).order("id").range(i, i + PAGINA - 1);
        if (error) throw new Error(error.message);
        out.push(...(data ?? []).map((r) => r.id as string));
        if (!data || data.length < PAGINA) break;
      }
      return out;
    },

    async subirDoc(clave, data, clientId) {
      const { data: fila, error } = await sb
        .from("user_state")
        .upsert({ user_id: uid, clave, data, client_id: clientId, deleted_at: null }, { onConflict: "user_id,clave" })
        .select("updated_at")
        .single();
      if (error) throw new Error(error.message);
      return fila.updated_at as string;
    },

    async traerDocs(desde) {
      let q = sb.from("user_state").select("clave, data, updated_at, deleted_at, client_id").order("updated_at");
      if (desde) q = q.gt("updated_at", desde);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as DocRemoto[];
    },

    async hayDatos() {
      const conteos = await Promise.all(
        TABLAS_SYNC.map((t) => sb.from(t).select("id", { count: "exact", head: true }).is("deleted_at", null)),
      );
      for (const c of conteos) if (c.error) throw new Error(c.error.message);
      return conteos.some((c) => (c.count ?? 0) > 0);
    },

    async borrarTodo() {
      for (const t of [...ORDEN_SUBIDA].reverse()) {
        const { error } = await sb.from(t).delete().eq("user_id", uid);
        if (error) throw new Error(error.message);
      }
      const { error } = await sb.from("user_state").delete().eq("user_id", uid);
      if (error) throw new Error(error.message);
      // Archivos del espacio de proyectos (6.5)
      const { data: lista } = await sb.storage.from(BUCKET).list(uid, { limit: 1000 });
      if (lista?.length) await sb.storage.from(BUCKET).remove(lista.map((o) => `${uid}/${o.name}`));
    },
  };
}

export type { ClaveDoc };
