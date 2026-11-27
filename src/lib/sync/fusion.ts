/**
 * Cómo se juntan dos versiones de un mismo documento cuando cambió en los dos dispositivos
 * desde la última sincronización.
 *  - progreso: XP sin perder ni duplicar nada (un evento por tipo + registro), logros con la fecha
 *    más antigua, racha recalculada con los días activos de ambos, nivel máximo el mayor.
 *  - closet: unión de piezas (la fecha más antigua).
 *  - historial de ánimo: unión de días.
 *  - enfoque, chequeos de ánimo y conexiones (registros que solo se agregan): unión por id.
 *  - el resto (ajustes de asistentes, pagos fijos, perfil de salud, espacio…): gana este dispositivo,
 *    que es donde la persona acaba de hacer el cambio.
 */
import { calcularRacha, type EventoXP, type Progreso } from "@/lib/asistentes/progreso";
import type { ClaveDoc } from "./tipos";

type Obj = Record<string, unknown>;
const esObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** La fecha más antigua de dos (o la que exista) */
const menor = (a?: string, b?: string) => (a && b ? (a < b ? a : b) : (a ?? b));

export function fusionarProgreso(local: Progreso, remoto: Progreso, hoy: string): Progreso {
  const eventos = new Map<string, EventoXP>();
  for (const e of [...remoto.eventos, ...local.eventos]) {
    const k = `${e.tipo}:${e.refId}`;
    const previo = eventos.get(k);
    if (!previo || e.fecha < previo.fecha) eventos.set(k, e);
  }
  const logros: Progreso["logros"] = { ...remoto.logros };
  for (const [id, f] of Object.entries(local.logros) as [keyof Progreso["logros"], string][]) logros[id] = menor(logros[id], f);

  const historico: Progreso["historico"] = {};
  for (const fuente of [remoto.historico ?? {}, local.historico ?? {}]) {
    for (const [mes, valores] of Object.entries(fuente)) {
      historico[mes] ??= {};
      for (const [k, n] of Object.entries(valores)) historico[mes][k] = Math.max(historico[mes][k] ?? 0, n);
    }
  }
  const union = (a: string[] = [], b: string[] = []) => [...new Set([...a, ...b])].sort();
  const diasActivos = union(local.racha.diasActivos, remoto.racha.diasActivos);
  const reparados = union(local.racha.reparados, remoto.racha.reparados);
  const racha = calcularRacha(diasActivos, hoy, Math.max(local.racha.mejor, remoto.racha.mejor), reparados);

  return {
    ...local,
    eventos: [...eventos.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)),
    logros,
    historico,
    compactados: union(local.compactados, remoto.compactados),
    racha: { ...racha, inicio: menor(local.racha.inicio, remoto.racha.inicio) },
    ui: {
      ...remoto.ui,
      ...local.ui,
      nivelMax: Math.max(local.ui.nivelMax ?? 1, remoto.ui.nivelMax ?? 1),
      iniciado: menor(local.ui.iniciado, remoto.ui.iniciado),
    },
  };
}

function fusionarCloset(local: Obj, remoto: Obj): Obj {
  const piezas: Record<string, { fecha: string; fuente: string }> = { ...((remoto.piezas as Obj) ?? {}) } as never;
  for (const [acc, v] of Object.entries((local.piezas as Record<string, { fecha: string; fuente: string }>) ?? {})) {
    const otra = piezas[acc];
    piezas[acc] = !otra || v.fecha < otra.fecha ? v : otra;
  }
  return { ...local, piezas };
}

/** Une los arreglos de objetos con id (gana la versión local si el id está en ambos) */
export function unirPorId(local: Obj, remoto: Obj): Obj {
  const out: Obj = { ...remoto, ...local };
  for (const k of Object.keys(out)) {
    const a = local[k];
    const b = remoto[k];
    if (Array.isArray(a) && Array.isArray(b) && [...a, ...b].every((x) => esObj(x) && typeof x.id === "string")) {
      const m = new Map<string, unknown>();
      for (const x of b as Obj[]) m.set(x.id as string, x);
      for (const x of a as Obj[]) m.set(x.id as string, x);
      out[k] = [...m.values()];
    }
  }
  return out;
}

export function fusionarDoc(clave: ClaveDoc, local: unknown, remoto: unknown, hoy: string): unknown {
  if (local == null) return remoto;
  if (remoto == null) return local;
  if (!esObj(local) || !esObj(remoto)) return local;
  switch (clave) {
    case "progreso":
      return fusionarProgreso(local as unknown as Progreso, remoto as unknown as Progreso, hoy);
    case "closet":
      return fusionarCloset(local, remoto);
    case "animo-historial":
      return { ...remoto, ...local, dias: { ...((remoto.dias as Obj) ?? {}), ...((local.dias as Obj) ?? {}) } };
    case "enfoque":
    case "animo-usuario":
    case "conexiones":
      return unirPorId(local, remoto);
    default:
      return local;
  }
}

/** Huella corta de un valor (para saber si un documento cambió) */
export function huella(v: unknown): string {
  const s = JSON.stringify(v ?? null);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${(h >>> 0).toString(36)}.${s.length}`;
}
