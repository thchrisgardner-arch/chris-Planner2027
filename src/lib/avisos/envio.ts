/** Envío de avisos con Web Push (solo servidor). */
import webpush from "web-push";
import type { EstadoAvisos, SuscripcionGuardada } from "./almacen";

export const ZONA = "America/Bogota";

let listo = false;
export function pushListo() {
  if (listo) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  // Apple exige un "subject" real: la URL pública del proyecto en Vercel o la de VAPID_SUBJECT
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const subject = process.env.VAPID_SUBJECT ?? (host ? `https://${host}` : "https://example.com");
  webpush.setVapidDetails(subject, pub, priv);
  listo = true;
  return true;
}

export interface Aviso {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

/** Hora y fecha actuales en Bogotá */
export function ahoraBogota(now = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return { fecha: `${v("year")}-${v("month")}-${v("day")}`, hora: Number(v("hour")) };
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Arma el aviso según la hora y el último resumen que mandó el dispositivo.
 * Devuelve null si ese día ya está todo hecho (no se molesta de más).
 */
export function armarAviso(estado: EstadoAvisos | undefined, fecha: string, hora: number): Aviso | null {
  const deHoy = estado && estado.fecha === fecha;
  const nombre = estado?.asistente || "LIFE for LIFE";
  const racha = estado?.racha ?? 0;
  const pendientes: string[] = [];
  if (deHoy && estado.habitosPendientes) pendientes.push(plural(estado.habitosPendientes, "hábito", "hábitos"));
  if (deHoy && estado.tareasPendientes) pendientes.push(plural(estado.tareasPendientes, "tarea", "tareas"));
  const faltan = pendientes.join(" y ");

  if (deHoy && estado.hechoHoy && !faltan) return null;

  if (hora < 12) {
    return {
      title: `${nombre} · Buenos días`,
      body: faltan ? `Hoy tienes ${faltan}. Arranca con uno y suma a tu racha.` : racha > 0 ? `Llevas ${plural(racha, "día", "días")} de racha. Planea tu día y mantenla viva.` : "Planea tu día: registra un movimiento, un hábito o una tarea.",
      url: "/",
      tag: "lifeos-dia",
    };
  }
  if (hora < 18) {
    return {
      title: `${nombre} · ¿Cómo va el día?`,
      body: faltan ? `Te faltan ${faltan}. Todavía hay tiempo.` : "Haz una pausa y registra lo que llevas del día.",
      url: "/",
      tag: "lifeos-dia",
    };
  }
  return {
    title: racha > 0 && !(deHoy && estado.hechoHoy) ? `No pierdas tu racha de ${plural(racha, "día", "días")}` : `${nombre} · Cierra el día`,
    body: faltan ? `Te faltan ${faltan} antes de dormir.` : "Registra algo hoy para que la racha siga.",
    url: "/",
    tag: "lifeos-dia",
  };
}

/** Envía un aviso. Devuelve "vencida" si el navegador ya no acepta avisos (hay que borrarla). */
export async function enviar(s: SuscripcionGuardada, aviso: Aviso): Promise<"ok" | "vencida" | "error"> {
  try {
    await webpush.sendNotification(s.subscription, JSON.stringify(aviso), { TTL: 60 * 60 * 3, urgency: "normal" });
    return "ok";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) return "vencida";
    console.error("[avisos] error al enviar", code ?? e);
    return "error";
  }
}
