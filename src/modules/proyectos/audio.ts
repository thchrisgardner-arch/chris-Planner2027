/** Utilidades de audio para las notas de voz (solo navegador). */

/** Formato que el navegador puede grabar (Safari usa mp4, Chrome webm) */
export function formatoGrabacion(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

/** Reconocimiento de voz del navegador (Chrome, Edge, Safari), si existe */
type Reconocedor = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] & { length: number } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};
export function crearReconocedor(): Reconocedor | null {
  if (typeof window === "undefined") return null;
  const W = window as unknown as { SpeechRecognition?: new () => Reconocedor; webkitSpeechRecognition?: new () => Reconocedor };
  const C = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!C) return null;
  const r = new C();
  r.lang = "es-CO";
  r.continuous = true;
  r.interimResults = true;
  return r;
}

/** Alturas de la onda (0–1) y duración a partir del archivo grabado */
export async function analizarAudio(blob: Blob, barras = 64): Promise<{ picos: number[]; duracion: number }> {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const datos = buf.getChannelData(0);
    const paso = Math.max(1, Math.floor(datos.length / barras));
    const picos: number[] = [];
    for (let i = 0; i < barras; i++) {
      let suma = 0;
      for (let j = i * paso; j < Math.min(datos.length, (i + 1) * paso); j++) suma += datos[j] * datos[j];
      picos.push(Math.sqrt(suma / paso));
    }
    const max = Math.max(...picos, 0.0001);
    return { picos: picos.map((p) => Math.max(0.06, Math.min(1, p / max))), duracion: buf.duration };
  } finally {
    void ctx.close();
  }
}

export const tiempo = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** Convierte audio en WAV (para la nota de ejemplo del modo demo) */
function aWav(buf: AudioBuffer): Blob {
  const d = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const ab = new ArrayBuffer(44 + d.length * 2);
  const v = new DataView(ab);
  const txt = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, "RIFF");
  v.setUint32(4, 36 + d.length * 2, true);
  txt(8, "WAVE");
  txt(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  txt(36, "data");
  v.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 0x7fff, true);
  return new Blob([ab], { type: "audio/wav" });
}

/** Audio sintético con ritmo de habla (sílabas y pausas) para probar el reproductor en demo */
export async function audioEjemplo(segundos = 24): Promise<Blob> {
  const sr = 16000;
  const ctx = new OfflineAudioContext(1, sr * segundos, sr);
  let t = 0.3;
  let k = 0;
  while (t < segundos - 0.5) {
    const dur = 0.12 + ((k * 37) % 10) / 50;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(140 + ((k * 53) % 90), t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 + ((k * 13) % 10) / 30, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
    t += dur + (k % 7 === 6 ? 0.7 : 0.06);
    k++;
  }
  return aWav(await ctx.startRendering());
}
