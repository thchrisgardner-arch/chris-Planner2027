/**
 * Exportar notas de voz (todo en el navegador, nada sale del dispositivo):
 *  - una nota: audio original (extensión según su formato) o transcripción en .txt;
 *    en el celular, con «Compartir» del sistema cuando el navegador lo permite;
 *  - todas: un .zip con los audios, las transcripciones y un indice.json.
 */
import { todayISO } from "@/utils/dates";
import { crearZip, type EntradaZip } from "@/utils/zip";
import { tituloVoz, type NotaVoz } from "./espacio";

export function extensionAudio(mime: string | undefined): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  return "webm";
}

export function slug(texto: string): string {
  const s = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return s || "nota-de-voz";
}

const tiempoTexto = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** «llamada-con-el-cliente-2026-11-26» */
export const nombreBase = (n: NotaVoz) => `${slug(tituloVoz(n))}-${todayISO(new Date(n.creada))}`;

export function transcripcionTxt(n: NotaVoz): string {
  const fecha = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "long", timeStyle: "short" }).format(new Date(n.creada));
  const lineas = n.transcripcion.map((s) => `[${tiempoTexto(s.t)}] ${s.texto}`);
  return `${tituloVoz(n)}\n${fecha} · ${tiempoTexto(n.duracion)}\n\n${lineas.join("\n")}\n`;
}

export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** En el celular usa «Compartir» del sistema si puede con archivos; si no, descarga */
export async function compartirODescargar(blob: Blob, nombre: string, titulo: string): Promise<"compartido" | "descargado" | "cancelado"> {
  const tactil = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  if (tactil && typeof navigator.canShare === "function") {
    const archivo = new File([blob], nombre, { type: blob.type || "application/octet-stream" });
    if (navigator.canShare({ files: [archivo] })) {
      try {
        await navigator.share({ files: [archivo], title: titulo });
        return "compartido";
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return "cancelado";
        /* si compartir falla, se descarga */
      }
    }
  }
  descargar(blob, nombre);
  return "descargado";
}

/** .zip con audios, transcripciones e índice. leer devuelve el audio guardado de cada nota. */
export async function zipNotas(notas: NotaVoz[], leer: (id: string) => Promise<Blob | null>, proyecto?: string): Promise<{ zip: Blob; sinAudio: number }> {
  const utf8 = new TextEncoder();
  const entradas: EntradaZip[] = [];
  const usados = new Set<string>();
  const indice: Record<string, unknown>[] = [];
  let sinAudio = 0;
  for (const n of notas) {
    let base = nombreBase(n);
    for (let k = 2; usados.has(base); k++) base = `${nombreBase(n)}-${k}`;
    usados.add(base);
    const fecha = new Date(n.creada);
    const blob = await leer(n.id);
    const audio = blob ? `${base}.${extensionAudio(blob.type || n.tipo)}` : null;
    if (blob && audio) entradas.push({ nombre: audio, datos: new Uint8Array(await blob.arrayBuffer()), fecha });
    else sinAudio += 1;
    const txt = n.transcripcion.length ? `${base}.txt` : null;
    if (txt) entradas.push({ nombre: txt, datos: utf8.encode(transcripcionTxt(n)), fecha });
    indice.push({ titulo: tituloVoz(n), fecha: n.creada, duracionSegundos: Math.round(n.duracion * 10) / 10, audio, transcripcion: txt, ...(proyecto ? { proyecto } : {}) });
  }
  entradas.push({ nombre: "indice.json", datos: utf8.encode(JSON.stringify(indice, null, 2)) });
  const datos = crearZip(entradas);
  return { zip: new Blob([datos.buffer as ArrayBuffer], { type: "application/zip" }), sinAudio };
}
