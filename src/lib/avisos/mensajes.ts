/**
 * Recordatorios en la voz de cada asistente (versión 2). Función pura: recibe el resumen que mandó
 * el dispositivo y la hora de Bogotá, y devuelve los avisos de esa hora.
 *  - Brote: hábitos pendientes, a la hora elegida.
 *  - Tic: agenda del día (eventos y pagos fijos por vencer o vencidos), a la hora elegida.
 *  - El asistente principal: racha en riesgo a las 8 p. m.
 * Un asistente con avisos "Nunca" no envía nada; con "Resumen diario" se mueve a la hora de la agenda.
 */
import type { DiaAvisos, EstadoAvisos, IdVoz } from "./almacen";

export interface Aviso {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export const HORA_RACHA = 20;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const horaTexto = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "a. m." : "p. m."}`;
};
function ayerDe(fecha: string) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Horas a las que el servidor debe revisar este dispositivo */
export function horasDeRecordatorios(e: Pick<EstadoAvisos, "recordatorios" | "voces">): number[] {
  const r = e.recordatorios;
  if (!r) return [];
  const horas = new Set<number>();
  const modo = (id: IdVoz) => e.voces?.[id]?.modo ?? "en-el-momento";
  if (r.habitos !== null && modo("brote") !== "nunca") horas.add(modo("brote") === "resumen-diario" && r.agenda !== null ? r.agenda : r.habitos);
  if (r.agenda !== null) horas.add(r.agenda);
  if (r.racha) horas.add(HORA_RACHA);
  return [...horas].sort((a, b) => a - b);
}

export function armarAvisos(e: EstadoAvisos | undefined, fecha: string, hora: number): Aviso[] {
  if (!e?.recordatorios || e.version !== 2) return [];
  const r = e.recordatorios;
  // ¿De qué día es lo que sabemos? Si el resumen es de ayer, se usa lo que ya decía de "mañana"
  const delDia: DiaAvisos | null = e.fecha === fecha ? (e.hoy ?? null) : e.fecha === ayerDe(fecha) ? (e.manana ?? null) : null;
  const esHoy = e.fecha === fecha;
  const voz = (id: IdVoz) => e.voces?.[id];
  const activa = (id: IdVoz) => !!voz(id) && voz(id)!.modo !== "nunca";
  const nombre = (id: IdVoz) => voz(id)?.nombre || "LIFE for LIFE";
  const out: Aviso[] = [];

  // Brote · hábitos
  const horaHabitos = r.habitos === null ? null : voz("brote")?.modo === "resumen-diario" && r.agenda !== null ? r.agenda : r.habitos;
  const habitosPend = esHoy ? e.habitosPendientes : (delDia?.habitos ?? 0);
  if (horaHabitos === hora && activa("brote") && habitosPend > 0) {
    out.push({
      title: nombre("brote"),
      body: habitosPend === 1 ? "Te falta 1 hábito. Sin afán, pero hoy." : `Te faltan ${habitosPend} hábitos. Sin afán, pero hoy.`,
      url: "/salud?vista=habitos",
      tag: "lifeos-habitos",
    });
  }

  // Tic · agenda del día y pagos fijos
  if (r.agenda === hora && activa("tic") && delDia) {
    const partes: string[] = [];
    if (delDia.eventos) {
      const t = `Hoy tienes ${plural(delDia.eventos, "evento", "eventos")}${delDia.primerEvento ? `; el primero a las ${horaTexto(delDia.primerEvento)}` : ""}`;
      partes.push(t.endsWith(".") ? t : `${t}.`);
    }
    if (delDia.pagosVencidos) partes.push(`${plural(delDia.pagosVencidos, "pago fijo sigue", "pagos fijos siguen")} sin confirmar. Si ya pagaste, confírmalo.`);
    if (delDia.pagosVencen) partes.push(`${plural(delDia.pagosVencen, "pago fijo vence", "pagos fijos vencen")} en estos días. Yo aviso, tú confirmas.`);
    if (partes.length) {
      out.push({
        title: nombre("tic"),
        body: partes.join(" "),
        url: delDia.eventos ? "/calendario" : "/finanzas?tab=fijos",
        tag: "lifeos-agenda",
      });
    }
  }

  // Principal · racha en riesgo a las 8 p. m.
  const principal = e.principal ?? "centavo";
  const racha = esHoy ? (e.hechoHoy ? 0 : e.racha) : e.fecha === ayerDe(fecha) && e.hechoHoy ? e.racha : 0;
  if (r.racha && hora === HORA_RACHA && activa(principal) && racha > 0) {
    out.push({
      title: nombre(principal),
      body: `Tu racha de ${plural(racha, "día", "días")} está en riesgo. Un registro y listo.`,
      url: "/?captura=1",
      tag: "lifeos-racha",
    });
  }
  return out;
}
