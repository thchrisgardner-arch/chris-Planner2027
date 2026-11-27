import { almacenListo, borrar, guardar, idDe, leer, type DiaAvisos, type EstadoAvisos, type SuscripcionGuardada } from "@/lib/avisos/almacen";

// Suscripción a avisos del celular. Dinámica por naturaleza (POST/DELETE); con cacheComponents no se
// declaran `dynamic` ni `runtime`.

const HORAS_VALIDAS = (h: unknown): h is number[] => Array.isArray(h) && h.length <= 24 && h.every((x) => Number.isInteger(x) && x >= 0 && x <= 23);

function validarSub(s: unknown): s is SuscripcionGuardada["subscription"] {
  const x = s as SuscripcionGuardada["subscription"];
  return !!x && typeof x.endpoint === "string" && x.endpoint.startsWith("https://") && typeof x.keys?.p256dh === "string" && typeof x.keys?.auth === "string";
}

function validarEstado(e: unknown): e is EstadoAvisos {
  const x = e as EstadoAvisos;
  return (
    !!x &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(x.fecha)) &&
    Number.isFinite(x.racha) &&
    typeof x.hechoHoy === "boolean" &&
    Number.isFinite(x.habitosPendientes) &&
    Number.isFinite(x.tareasPendientes) &&
    typeof x.asistente === "string" &&
    x.asistente.length <= 40
  );
}

const IDS = ["centavo", "brote", "tuerca", "tic", "cima", "antojo"] as const;
const MODOS = ["nunca", "resumen-diario", "en-el-momento"];
const conteo = (n: unknown) => (Number.isInteger(n) && (n as number) >= 0 && (n as number) < 1000 ? (n as number) : 0);
const horaOpc = (h: unknown) => (Number.isInteger(h) && (h as number) >= 0 && (h as number) <= 23 ? (h as number) : null);
function limpiarDia(d: unknown): DiaAvisos | undefined {
  if (!d || typeof d !== "object") return undefined;
  const x = d as Record<string, unknown>;
  return {
    eventos: conteo(x.eventos),
    primerEvento: typeof x.primerEvento === "string" && /^\d{2}:\d{2}$/.test(x.primerEvento) ? x.primerEvento : null,
    pagosVencen: conteo(x.pagosVencen),
    pagosVencidos: conteo(x.pagosVencidos),
    habitos: conteo(x.habitos),
    aportes: conteo(x.aportes),
  };
}
/** Campos de la versión 2, saneados (solo conteos, horas y nombres cortos) */
function limpiarV2(e: EstadoAvisos): EstadoAvisos {
  if (e.version !== 2) return e;
  const voces: EstadoAvisos["voces"] = {};
  for (const id of IDS) {
    const v = e.voces?.[id];
    if (v && typeof v.nombre === "string" && v.nombre.length <= 40 && MODOS.includes(v.modo)) voces[id] = { nombre: v.nombre, modo: v.modo };
  }
  const r = e.recordatorios;
  return {
    ...e,
    voces,
    principal: IDS.includes(e.principal as (typeof IDS)[number]) ? e.principal : "centavo",
    recordatorios: r ? { habitos: horaOpc(r.habitos), agenda: horaOpc(r.agenda), racha: r.racha === true } : undefined,
    hoy: limpiarDia(e.hoy),
    manana: limpiarDia(e.manana),
  };
}

/** POST /api/avisos  { subscription, horas?, estado? } → crea o actualiza la suscripción */
export async function POST(request: Request) {
  if (!almacenListo()) return Response.json({ error: "Falta conectar el almacenamiento de avisos en Vercel." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { subscription?: unknown; horas?: unknown; estado?: unknown } | null;
  if (!body || !validarSub(body.subscription)) return Response.json({ error: "Suscripción inválida." }, { status: 400 });
  const id = idDe(body.subscription.endpoint);
  const previa = await leer(id);
  const horas = HORAS_VALIDAS(body.horas) ? body.horas : (previa?.horas ?? [9, 20]);
  const estado = validarEstado(body.estado) ? limpiarV2(body.estado) : previa?.estado;
  const ok = await guardar(id, { subscription: body.subscription, horas, estado, actualizado: new Date().toISOString(), ultimoEnvio: previa?.ultimoEnvio });
  if (!ok) return Response.json({ error: "Hay demasiados dispositivos con avisos activos." }, { status: 429 });
  return Response.json({ id, horas }, { headers: { "cache-control": "no-store" } });
}

/** DELETE /api/avisos  { endpoint } → desactiva los avisos de ese dispositivo */
export async function DELETE(request: Request) {
  if (!almacenListo()) return Response.json({ ok: true });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") return Response.json({ error: "Falta el endpoint." }, { status: 400 });
  await borrar(idDe(body.endpoint));
  return Response.json({ ok: true });
}
