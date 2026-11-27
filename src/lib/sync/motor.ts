/**
 * Motor de sincronización (Fase 6.2). Local primero: la app lee y escribe en el navegador como
 * siempre; el motor sube lo pendiente y trae lo que cambió en otros dispositivos.
 *
 * Un ciclo:
 *  1. Sube las filas pendientes (padres antes que hijos) y marca en la nube las borradas.
 *  2. Trae las filas con updated_at posterior a la última marca (con 5 s de margen) y las aplica,
 *     salvo las que tienen un cambio local todavía sin subir (ese gana hasta que suba).
 *  3. Documentos (asistentes, progreso, clóset…): trae los cambiados; si cambiaron en los dos lados
 *     los fusiona (fusion.ts); después sube los que quedaron distintos a la nube.
 * Las filas: gana el último cambio que llegó al servidor (updated_at lo pone Postgres).
 */
import { CASCADES, type TableName } from "@/types/db";
import { LOCAL_USER_ID } from "@/services/localAdapter";
import { fusionarDoc, huella } from "./fusion";
import { CLAVES_DOC, ORDEN_SUBIDA, TABLAS_SYNC, type Cambio, type Contexto, type EstadoSync, type Fila, type FilaRemota } from "./tipos";

export const MARGEN_MS = 5000;
const CAMPOS_SYNC = ["updated_at", "deleted_at", "client_id"];

export interface Resultado {
  /** Cambiaron filas locales (la app debe recargar sus datos) */
  tablas: boolean;
  /** Documentos que cambiaron en este dispositivo */
  docs: string[];
  subidas: number;
  traidas: number;
}

const restarMargen = (iso: string) => new Date(new Date(iso).getTime() - MARGEN_MS).toISOString();

/** La fila tal como la guarda el navegador (sin campos de sincronización y con el usuario local) */
function aLocal(r: FilaRemota): Fila {
  const f: Fila = { ...r, user_id: LOCAL_USER_ID };
  for (const c of CAMPOS_SYNC) delete f[c];
  return f;
}
const comparable = (f: Fila) => {
  const c: Record<string, unknown> = { ...f };
  for (const k of [...CAMPOS_SYNC, "user_id"]) delete c[k];
  return JSON.stringify(Object.keys(c).sort().map((k) => [k, c[k]]));
};

/** Borra una fila local y aplica las cascadas igual que Postgres (sin anotar cambios: viene de la nube) */
function borrarLocal(ctx: Contexto, tabla: TableName, id: string) {
  const filas = ctx.local.filas(tabla);
  if (!filas.some((f) => f.id === id)) return false;
  ctx.local.guardarFilas(
    tabla,
    filas.filter((f) => f.id !== id),
  );
  for (const regla of CASCADES[tabla] ?? []) {
    const hijas = ctx.local.filas(regla.table);
    if (regla.action === "delete") {
      for (const h of hijas.filter((x) => x[regla.field] === id)) borrarLocal(ctx, regla.table, h.id);
    } else if (hijas.some((x) => x[regla.field] === id)) {
      ctx.local.guardarFilas(
        regla.table,
        hijas.map((x) => (x[regla.field] === id ? { ...x, [regla.field]: null } : x)),
      );
    }
  }
  return true;
}

export type Preferir = "fusion" | "remoto" | "local";

export async function sincronizar(ctx: Contexto, preferir: Preferir = "fusion"): Promise<Resultado> {
  const res: Resultado = { tablas: false, docs: [], subidas: 0, traidas: 0 };
  let estado: EstadoSync = ctx.estado.leer();

  // ── 1. Subir filas pendientes ──
  const pend = ctx.pendientes.leer();
  if (pend.length) {
    const ultimo = new Map<string, Cambio>();
    for (const c of pend) ultimo.set(`${c.t}:${c.id}`, c);
    const guardar = new Map<TableName, Set<string>>();
    const borrar = new Map<TableName, string[]>();
    for (const c of ultimo.values()) {
      if (c.op === "guardar") (guardar.get(c.t) ?? guardar.set(c.t, new Set()).get(c.t)!).add(c.id);
      else (borrar.get(c.t) ?? borrar.set(c.t, []).get(c.t)!).push(c.id);
    }
    for (const t of ORDEN_SUBIDA) {
      const ids = guardar.get(t);
      if (!ids?.size) continue;
      const filas = ctx.local.filas(t).filter((f) => ids.has(f.id));
      if (filas.length) await ctx.remoto.subirFilas(t, filas, estado.clientId);
      res.subidas += filas.length;
    }
    for (const t of [...ORDEN_SUBIDA].reverse()) {
      const ids = borrar.get(t);
      if (!ids?.length) continue;
      await ctx.remoto.marcarBorradas(t, ids, estado.clientId);
      res.subidas += ids.length;
    }
    ctx.pendientes.quitarHasta(Math.max(...pend.map((c) => c.seq)));
  }

  // ── 2. Traer filas ──
  // Lo que se anotó mientras se subía queda pendiente: no se pisa con la versión de la nube
  const sinSubir = new Set(ctx.pendientes.leer().map((c) => `${c.t}:${c.id}`));
  const marcas = { ...estado.marcas };
  for (const t of TABLAS_SYNC) {
    const desde = marcas[t] ? restarMargen(marcas[t]!) : null;
    const remotas = await ctx.remoto.traerFilas(t, desde);
    if (!remotas.length) continue;
    let filas = ctx.local.filas(t);
    let cambio = false;
    const borradas: string[] = [];
    for (const r of remotas) {
      if (!marcas[t] || r.updated_at > marcas[t]!) marcas[t] = r.updated_at;
      if (sinSubir.has(`${t}:${r.id}`)) continue;
      if (r.deleted_at) {
        if (filas.some((f) => f.id === r.id)) borradas.push(r.id);
        continue;
      }
      const nueva = aLocal(r);
      const i = filas.findIndex((f) => f.id === r.id);
      if (i === -1) {
        filas = [...filas, nueva];
        cambio = true;
      } else if (comparable(filas[i]) !== comparable(nueva)) {
        filas = filas.map((f, k) => (k === i ? nueva : f));
        cambio = true;
      }
      res.traidas += 1;
    }
    if (cambio) ctx.local.guardarFilas(t, filas);
    for (const id of borradas) borrarLocal(ctx, t, id);
    if (cambio || borradas.length) res.tablas = true;
  }
  estado = { ...ctx.estado.leer(), marcas };
  ctx.estado.guardar(estado);

  // ── 3. Documentos ──
  const docs = { ...estado.docs };
  let marcaDocs = estado.marcaDocs;
  const remotos = await ctx.remoto.traerDocs(marcaDocs ? restarMargen(marcaDocs) : null);
  for (const d of remotos) {
    if (!marcaDocs || d.updated_at > marcaDocs) marcaDocs = d.updated_at;
    if (d.deleted_at || !(CLAVES_DOC as readonly string[]).includes(d.clave)) continue;
    // Ya lo teníamos así (es lo que este mismo dispositivo subió)
    if (docs[d.clave]?.remoto === d.updated_at) continue;
    const local = ctx.local.doc(d.clave);
    const hLocal = huella(local);
    const cambioLocal = local != null && (preferir === "local" || docs[d.clave]?.hash !== hLocal);
    const nuevo =
      preferir === "remoto" || !cambioLocal ? d.data : preferir === "local" ? local : fusionarDoc(d.clave, local, d.data, ctx.hoy);
    if (huella(nuevo) !== hLocal) {
      ctx.local.guardarDoc(d.clave, nuevo);
      res.docs.push(d.clave);
    }
    // Lo que hay en la nube: si lo fusionado es distinto, se sube en el paso siguiente
    docs[d.clave] = { hash: huella(d.data), remoto: d.updated_at };
  }
  for (const clave of CLAVES_DOC) {
    const v = ctx.local.doc(clave);
    if (v == null) continue;
    const h = huella(v);
    if (docs[clave]?.hash === h) continue;
    const remoto = await ctx.remoto.subirDoc(clave, v, estado.clientId);
    docs[clave] = { hash: h, remoto };
    if (!marcaDocs || remoto > marcaDocs) marcaDocs = remoto;
    res.subidas += 1;
  }
  ctx.estado.guardar({ ...ctx.estado.leer(), docs, marcaDocs, ultimo: new Date().toISOString(), error: null });
  return res;
}

/** ¿Este dispositivo tiene registros propios? (los ajustes por defecto no cuentan) */
export const hayDatosLocales = (ctx: Contexto) => TABLAS_SYNC.some((t) => ctx.local.filas(t).length > 0);

export type ModoConexion = "combinar" | "nube" | "dispositivo";

/**
 * Primera sincronización (o reconexión):
 *  - combinar: sube todo lo de aquí y trae todo lo de la nube; los documentos se fusionan.
 *  - nube: este dispositivo queda igual a la nube.
 *  - dispositivo: la nube queda igual a este dispositivo (lo que sobra allá se marca borrado).
 */
export async function conectar(ctx: Contexto, modo: ModoConexion): Promise<Resultado> {
  const base = ctx.estado.leer();
  ctx.estado.guardar({ ...base, marcas: {}, marcaDocs: null, docs: {}, error: null });
  ctx.pendientes.vaciar();
  if (modo === "nube") {
    for (const t of TABLAS_SYNC) ctx.local.guardarFilas(t, []);
    return sincronizar(ctx, "remoto");
  }
  if (modo === "dispositivo") {
    for (const t of ORDEN_SUBIDA) {
      const locales = new Set(ctx.local.filas(t).map((f) => f.id));
      const sobran = (await ctx.remoto.idsVivos(t)).filter((id) => !locales.has(id));
      if (sobran.length) await ctx.remoto.marcarBorradas(t, sobran, base.clientId);
    }
  }
  ctx.pendientes.agregar(TABLAS_SYNC.flatMap((t) => ctx.local.filas(t).map((f) => ({ t, id: f.id, op: "guardar" as const }))));
  return sincronizar(ctx, modo === "dispositivo" ? "local" : "fusion");
}
