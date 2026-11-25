/**
 * Sonidos y vibración de la gamificación (sin archivos: los sonidos se generan con Web Audio).
 *  - El navegador solo deja sonar después de que tocas la pantalla: `prepararAudio` desbloquea el
 *    audio con el primer toque.
 *  - Vibración: Vibration API (Android). Safari en iPhone no la tiene; como respaldo se usa el
 *    "switch" nativo de iOS 18+, que da un golpecito háptico al cambiar. Puede no sentirse en todos.
 */
export type Retro = "xp" | "mision" | "celebracion" | "racha" | "negativo" | "toque";

type Ajustes = { sonido?: boolean; vibracion?: boolean };

/* ═════════ Audio ═════════ */
let ctx: AudioContext | null = null;
let salida: GainNode | null = null;

function audio(): { c: AudioContext; out: GainNode } | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    salida = ctx.createGain();
    salida.gain.value = 0.9;
    salida.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { c: ctx, out: salida! };
}

/** Desbloquea el audio con el primer toque (los navegadores lo exigen). Devuelve la limpieza. */
export function prepararAudio() {
  const activar = () => {
    audio();
    ensamblarSwitch();
  };
  window.addEventListener("pointerdown", activar, { once: true, capture: true });
  window.addEventListener("keydown", activar, { once: true, capture: true });
  return () => {
    window.removeEventListener("pointerdown", activar, true);
    window.removeEventListener("keydown", activar, true);
  };
}

function nota(c: AudioContext, out: GainNode, freq: number, t0: number, dur: number, opts: { tipo?: OscillatorType; vol?: number; hasta?: number } = {}) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.tipo ?? "sine";
  o.frequency.setValueAtTime(freq, t0);
  if (opts.hasta) o.frequency.exponentialRampToValueAtTime(opts.hasta, t0 + dur * 0.8);
  const vol = opts.vol ?? 0.12;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(out);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

// Notas (Hz)
const N = { F4: 349.2, A4: 440, C5: 523.3, E5: 659.3, G5: 784, C6: 1046.5, D6: 1174.7, E6: 1318.5, G6: 1568, A6: 1760, C7: 2093 };

function sonar(tipo: Retro) {
  const a = audio();
  if (!a || a.c.state !== "running") return;
  const { c, out } = a;
  const t = c.currentTime + 0.01;
  switch (tipo) {
    case "toque":
      nota(c, out, 1800, t, 0.035, { tipo: "triangle", vol: 0.04 });
      break;
    case "xp":
      // "ding" corto de dos notas
      nota(c, out, N.E6, t, 0.12, { tipo: "triangle", vol: 0.09 });
      nota(c, out, N.A6, t + 0.06, 0.18, { tipo: "triangle", vol: 0.08 });
      break;
    case "mision":
      [N.C6, N.E6, N.G6].forEach((f, k) => nota(c, out, f, t + k * 0.07, 0.18, { tipo: "triangle", vol: 0.09 }));
      break;
    case "racha":
      nota(c, out, N.G5, t, 0.32, { tipo: "sine", vol: 0.12, hasta: N.D6 });
      nota(c, out, N.D6, t + 0.18, 0.3, { tipo: "triangle", vol: 0.07 });
      nota(c, out, N.G6, t + 0.3, 0.35, { tipo: "sine", vol: 0.05 });
      break;
    case "celebracion":
      // Arpegio ascendente + acorde final + brillo
      [N.C5, N.E5, N.G5, N.C6].forEach((f, k) => nota(c, out, f, t + k * 0.08, 0.22, { tipo: "triangle", vol: 0.1 }));
      [N.C6, N.E6, N.G6].forEach((f) => nota(c, out, f, t + 0.34, 0.7, { tipo: "sine", vol: 0.06 }));
      [N.C7, N.G6, N.C7].forEach((f, k) => nota(c, out, f, t + 0.42 + k * 0.09, 0.12, { tipo: "sine", vol: 0.03 }));
      break;
    case "negativo":
      nota(c, out, N.A4, t, 0.38, { tipo: "sine", vol: 0.09, hasta: N.F4 });
      break;
  }
}

/* ═════════ Vibración ═════════ */
const PATRONES: Record<Retro, number[]> = {
  toque: [8],
  xp: [12],
  mision: [15, 40, 15],
  racha: [30, 50, 30],
  celebracion: [20, 60, 30, 60, 60],
  negativo: [80],
};

let etiquetaSwitch: HTMLLabelElement | null = null;
function ensamblarSwitch() {
  if (etiquetaSwitch || typeof document === "undefined") return;
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  etiquetaSwitch = label;
}

function vibrar(tipo: Retro) {
  if (typeof navigator === "undefined") return;
  const patron = PATRONES[tipo];
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(patron);
    return;
  }
  // iPhone (iOS 18+): cada cambio del switch nativo da un golpecito háptico
  ensamblarSwitch();
  if (!etiquetaSwitch) return;
  const golpes = Math.ceil(patron.length / 2);
  for (let k = 0; k < golpes; k++) setTimeout(() => etiquetaSwitch?.click(), k * 90);
}

/** Sonido + vibración según los ajustes de la persona. */
export function retro(tipo: Retro, ajustes: Ajustes) {
  try {
    if (ajustes.sonido !== false) sonar(tipo);
    if (ajustes.vibracion !== false) vibrar(tipo);
  } catch {
    /* sin audio o sin vibración: no pasa nada */
  }
}
