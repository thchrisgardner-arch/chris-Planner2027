/**
 * Dónde viven las suscripciones a avisos (solo servidor).
 *  - En producción: Upstash Redis por REST (Vercel → Storage → Upstash). Lee KV_REST_API_URL/TOKEN
 *    o UPSTASH_REDIS_REST_URL/TOKEN, según cómo lo haya creado la integración.
 *  - En desarrollo sin esas variables: un archivo JSON en la carpeta temporal del sistema.
 * Solo se guarda la suscripción del navegador, las horas elegidas y un resumen mínimo del día
 * (racha y número de pendientes). Ningún dato financiero sale del dispositivo.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export interface EstadoAvisos {
  fecha: string;
  racha: number;
  hechoHoy: boolean;
  habitosPendientes: number;
  tareasPendientes: number;
  asistente: string;
  /* ── Versión 2: recordatorios por asistente (solo conteos y horas; nunca nombres ni montos) ── */
  version?: 2;
  /** Nombre y modo de avisos de cada asistente activo (el campo `avisos` del editor) */
  voces?: Partial<Record<IdVoz, { nombre: string; modo: "nunca" | "resumen-diario" | "en-el-momento" }>>;
  principal?: IdVoz;
  /** Horas elegidas (null = apagado) */
  recordatorios?: { habitos: number | null; agenda: number | null; racha: boolean };
  hoy?: DiaAvisos;
  /** Lo de mañana, por si el dispositivo no se abre ese día */
  manana?: DiaAvisos;
}

export type IdVoz = "centavo" | "brote" | "tuerca" | "tic" | "cima" | "antojo";

export interface DiaAvisos {
  eventos: number;
  /** Hora del primer evento ("10:00") o null */
  primerEvento: string | null;
  /** Pagos fijos pendientes que vencen ese día o en los dos siguientes */
  pagosVencen: number;
  pagosVencidos: number;
  /** Hábitos programados ese día */
  habitos: number;
  /** Aportes de ahorro por confirmar */
  aportes?: number;
}

export interface SuscripcionGuardada {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  horas: number[];
  estado?: EstadoAvisos;
  actualizado: string;
  ultimoEnvio?: string;
}

const CLAVE = "lifeos:avisos";
const MAX_SUSCRIPCIONES = 10;
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const ARCHIVO = path.join(os.tmpdir(), "lifeos-avisos.json");

export const almacenListo = () => Boolean(url && token) || process.env.NODE_ENV !== "production";
export const idDe = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 24);

async function redis(cmd: (string | number)[]) {
  const r = await fetch(url!, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Redis ${r.status}`);
  return ((await r.json()) as { result: unknown }).result;
}

async function leerArchivo(): Promise<Record<string, SuscripcionGuardada>> {
  try {
    return JSON.parse(await fs.readFile(ARCHIVO, "utf8"));
  } catch {
    return {};
  }
}

export async function todas(): Promise<Record<string, SuscripcionGuardada>> {
  if (!url || !token) return leerArchivo();
  const plano = ((await redis(["HGETALL", CLAVE])) as string[] | null) ?? [];
  const out: Record<string, SuscripcionGuardada> = {};
  for (let i = 0; i < plano.length; i += 2) {
    try {
      out[plano[i]] = JSON.parse(plano[i + 1]);
    } catch {
      /* registro dañado: se ignora */
    }
  }
  return out;
}

export async function leer(id: string): Promise<SuscripcionGuardada | null> {
  if (!url || !token) return (await leerArchivo())[id] ?? null;
  const v = (await redis(["HGET", CLAVE, id])) as string | null;
  return v ? JSON.parse(v) : null;
}

/** Devuelve false si ya hay demasiadas suscripciones (protección básica de una app personal) */
export async function guardar(id: string, s: SuscripcionGuardada): Promise<boolean> {
  if (!url || !token) {
    const all = await leerArchivo();
    if (!all[id] && Object.keys(all).length >= MAX_SUSCRIPCIONES) return false;
    all[id] = s;
    await fs.writeFile(ARCHIVO, JSON.stringify(all));
    return true;
  }
  const existe = await redis(["HEXISTS", CLAVE, id]);
  if (!existe && Number(await redis(["HLEN", CLAVE])) >= MAX_SUSCRIPCIONES) return false;
  await redis(["HSET", CLAVE, id, JSON.stringify(s)]);
  return true;
}

export async function borrar(id: string) {
  if (!url || !token) {
    const all = await leerArchivo();
    delete all[id];
    await fs.writeFile(ARCHIVO, JSON.stringify(all));
    return;
  }
  await redis(["HDEL", CLAVE, id]);
}
