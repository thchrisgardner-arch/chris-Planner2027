import { borrar, idDe, leer } from "@/lib/avisos/almacen";
import { enviar, pushListo } from "@/lib/avisos/envio";

/** POST /api/avisos/prueba  { endpoint } → manda un aviso de prueba a ese dispositivo (ya suscrito) */
export async function POST(request: Request) {
  if (!pushListo()) return Response.json({ error: "Faltan las llaves VAPID en el servidor." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") return Response.json({ error: "Falta el endpoint." }, { status: 400 });
  const id = idDe(body.endpoint);
  const s = await leer(id);
  if (!s) return Response.json({ error: "Este dispositivo no tiene avisos activos." }, { status: 404 });
  const r = await enviar(s, { title: "Poku Poku · Aviso de prueba", body: "Así te van a llegar los recordatorios de tu día.", url: "/", tag: "lifeos-prueba" });
  if (r === "vencida") await borrar(id);
  if (r !== "ok") return Response.json({ error: r === "vencida" ? "El dispositivo ya no acepta avisos. Actívalos de nuevo." : "No se pudo enviar el aviso." }, { status: 502 });
  return Response.json({ ok: true });
}
