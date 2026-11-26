import { almacenListo, borrar, guardar, todas } from "@/lib/avisos/almacen";
import { ahoraBogota, armarAviso, enviar, pushListo } from "@/lib/avisos/envio";
import { armarAvisos } from "@/lib/avisos/mensajes";

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
    // Versión 2: un aviso por asistente y tema; versión 1: el aviso general de siempre
    const avisos = s.estado?.version === 2 ? armarAvisos(s.estado, fecha, hora) : [armarAviso(s.estado, fecha, hora)].filter((a) => a !== null);
    if (!avisos.length) {
      resultado.omitidos += 1;
      continue;
    }
    let vencida = false;
    let alguno = false;
    for (const aviso of avisos) {
      const r = await enviar(s, aviso);
      if (r === "ok") {
        resultado.enviados += 1;
        alguno = true;
      } else if (r === "vencida") {
        vencida = true;
        break;
      } else resultado.errores += 1;
    }
    if (vencida) {
      resultado.vencidos += 1;
      await borrar(id);
    } else if (alguno) await guardar(id, { ...s, ultimoEnvio: marca });
  }
  return Response.json(resultado, { headers: { "cache-control": "no-store" } });
}
