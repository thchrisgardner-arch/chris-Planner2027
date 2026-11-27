/**
 * Une el motor con el navegador y con Supabase. Lo usan el sincronizador en segundo plano y la
 * tarjeta de Configuración. Nada de esto corre si la persona no activó la sincronización.
 */
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { TableName } from "@/types/db";
import { todayISO } from "@/utils/dates";
import { sincronizarArchivos } from "./archivos";
import { almacenSync, bandejaNavegador, syncActivo } from "./almacenes";
import { conectar, hayDatosLocales, sincronizar, type ModoConexion, type Resultado } from "./motor";
import { localNavegador } from "./navegador";
import { remotoSupabase } from "./supabase";
import type { Contexto } from "./tipos";

export async function sesionNube(): Promise<{ id: string; email: string | null } | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await (await getSupabase()).auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

const alRechazar = (t: TableName, id: string, motivo: string) =>
  almacenSync.cambiar((e) => ({ ...e, rechazadas: [{ t, id, motivo }, ...e.rechazadas.filter((r) => r.id !== id)].slice(0, 50) }));

async function contexto(): Promise<{ ctx: Contexto; uid: string }> {
  const sb = await getSupabase();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new Error("Tu sesión de la nube se cerró. Vuelve a iniciar sesión para seguir sincronizando.");
  return {
    uid: data.user.id,
    ctx: {
      local: localNavegador,
      remoto: remotoSupabase(sb, data.user.id, alRechazar),
      estado: { leer: almacenSync.leer, guardar: (e) => almacenSync.guardar({ ...almacenSync.leer(), ...e }) },
      pendientes: bandejaNavegador,
      hoy: todayISO(),
    },
  };
}

let enCurso: Promise<Resultado | null> | null = null;

async function conArchivos(r: Resultado, uid: string) {
  const e = almacenSync.leer();
  if (!e.archivos) return r;
  const { subidos } = await sincronizarArchivos(await getSupabase(), uid, e.subidos);
  almacenSync.cambiar((x) => ({ ...x, subidos }));
  return r;
}

/** Un ciclo completo (si ya hay uno corriendo, espera ese) */
export function cicloSync(): Promise<Resultado | null> {
  if (!syncActivo() || !isSupabaseConfigured) return Promise.resolve(null);
  enCurso ??= (async () => {
    try {
      const { ctx, uid } = await contexto();
      if (almacenSync.leer().userId !== uid) throw new Error("Iniciaste sesión con otra cuenta. Desactiva y vuelve a activar la sincronización.");
      return await conArchivos(await sincronizar(ctx), uid);
    } catch (e) {
      const msg = !navigator.onLine ? "Sin conexión: los cambios se guardan aquí y se suben al volver." : e instanceof Error ? e.message : "No se pudo sincronizar.";
      almacenSync.cambiar((x) => ({ ...x, error: msg }));
      throw e;
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}

/** Antes de activar: ¿hay datos aquí y en la nube? */
export async function situacion(): Promise<{ local: boolean; nube: boolean }> {
  const { ctx } = await contexto();
  return { local: hayDatosLocales(ctx), nube: await ctx.remoto.hayDatos() };
}

export async function activar(modo: ModoConexion): Promise<Resultado> {
  const { ctx, uid } = await contexto();
  const s = await sesionNube();
  almacenSync.cambiar((e) => ({ ...e, activo: true, userId: uid, email: s?.email ?? null, error: null, rechazadas: [], subidos: [] }));
  try {
    return await conArchivos(await conectar(ctx, modo), uid);
  } catch (e) {
    almacenSync.cambiar((x) => ({ ...x, error: e instanceof Error ? e.message : "No se pudo sincronizar." }));
    throw e;
  }
}

/** Deja de sincronizar; los datos de este dispositivo quedan como están */
export async function desactivar(cerrarSesion = true) {
  almacenSync.cambiar((e) => ({ ...e, activo: false, marcas: {}, marcaDocs: null, docs: {}, error: null }));
  bandejaNavegador.vaciar();
  if (cerrarSesion && isSupabaseConfigured) await (await getSupabase()).auth.signOut();
}

/** Borra todo lo del usuario en la nube y apaga la sincronización */
export async function borrarNube() {
  const { ctx } = await contexto();
  await ctx.remoto.borrarTodo();
  almacenSync.cambiar((e) => ({ ...e, subidos: [] }));
  await desactivar(true);
}
