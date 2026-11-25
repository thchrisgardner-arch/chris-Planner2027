import { almacenListo, borrar, guardar, todas } from "@/lib/avisos/almacen";
import { ahoraBogota, armarAviso, enviar, pushListo } from "@/lib/avisos/envio";

/**
 * GET /api/avisos/enviar  (Authorization: Bearer CRON_SECRET)
 * Lo llama cada hora el flujo de GitHub Actions (.github/workflows/avisos.yml). Envía el recordatorio
 * a los dispositivos que eligieron la hora actual de Bogotá, máximo uno por hora y dispositivo.
 * ?hora=20 permite probar una hora concreta.
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || request.headers.get("authorization") !== `Bearer ${secreto}`) return Response.json({ error: "No autorizado." }, { status: 401 });
  if (!pushListo() || !almacenListo()) return Response.json({ error: "Avisos sin configurar (llaves VAPID o almacenamiento)." }, { status: 503 });

  const { fecha, hora: horaReal } = ahoraBogota();
  const forzada = Number(new URL(request.url).searchParams.get("hora"));
  const hora = Number.isInteger(forzada) && forzada >= 0 && forzada <= 23 && new URL(request.url).searchParams.has("hora") ? forzada : horaReal;
  const marca = `${fecha}T${String(hora).padStart(2, "0")}`;

  const subs = await todas();
  const resultado = { hora, enviados: 0, omitidos: 0, vencidos: 0, errores: 0 };
  for (const [id, s] of Object.entries(subs)) {
    if (!s.horas.includes(hora) || s.ultimoEnvio === marca) continue;
    const aviso = armarAviso(s.estado, fecha, hora);
    if (!aviso) {
      resultado.omitidos += 1;
      continue;
    }
    const r = await enviar(s, aviso);
    if (r === "ok") {
      resultado.enviados += 1;
      await guardar(id, { ...s, ultimoEnvio: marca });
    } else if (r === "vencida") {
      resultado.vencidos += 1;
      await borrar(id);
    } else resultado.errores += 1;
  }
  return Response.json(resultado, { headers: { "cache-control": "no-store" } });
}
