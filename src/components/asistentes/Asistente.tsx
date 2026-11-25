"use client";

import "./asistentes.css";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import {
  DARK_COLORS,
  charVar,
  type Accesorio,
  type AsistenteId,
  type Colores,
  type Expresion,
} from "@/lib/asistentes/tipos";
import { FIGURAS, type Ceja, type Figura, type Punto } from "./figuras";

/** Colores por defecto de cada personaje (primario / secundario / detalle). */
export const COLORES_POR_DEFECTO: Record<AsistenteId, Colores> = {
  centavo: { primario: "yellow", secundario: "yellow-soft", detalle: "sand" },
  brote: { primario: "lime-soft", secundario: "cream", detalle: "lime" },
  tuerca: { primario: "sand", secundario: "cream", detalle: "charcoal" },
  tic: { primario: "charcoal", secundario: "white", detalle: "lime" },
  cima: { primario: "cream", secundario: "white", detalle: "sand" },
  antojo: { primario: "gray-light", secundario: "white", detalle: "ink" },
};

const MODULO: Record<AsistenteId, string> = {
  centavo: "finanzas",
  brote: "hábitos",
  tuerca: "proyectos",
  tic: "calendario",
  cima: "objetivos",
  antojo: "wishlist",
};

export interface AsistenteProps {
  id: AsistenteId;
  size?: number;
  colores?: Colores;
  expresion?: Expresion;
  accesorio?: Accesorio;
  mostrarProp?: boolean;
  /** Respira, parpadea y mueve su accesorio */
  animado?: boolean;
  /** Sigue el cursor con la mirada y reacciona al pasar el mouse o al hacer clic */
  interactivo?: boolean;
  /** Cambia para disparar un rebote (p. ej. al celebrar) */
  celebrar?: number;
  nombre?: string;
  /** Decorativo junto a un texto que ya lo nombra */
  decorativo?: boolean;
  className?: string;
}

/**
 * Personaje en SVG inline. Capas con nombre (data-capa) y colores desde los tokens --char-*.
 * Interacción: parpadeo, respiración, mirada que sigue el cursor, inclinación al pasar el mouse
 * y, al hacer clic, un rebote con un gesto propio y una expresión momentánea.
 */
export function Asistente({
  id,
  size = 96,
  colores,
  expresion = "neutral",
  accesorio = "ninguno",
  mostrarProp = true,
  animado = true,
  interactivo = false,
  celebrar,
  nombre,
  decorativo,
  className,
}: AsistenteProps) {
  const fig = FIGURAS[id];
  const col = colores ?? COLORES_POR_DEFECTO[id];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<HTMLSpanElement>(null);
  const [mirada, setMirada] = useState<Punto>({ x: 0, y: 0 });
  const [reaccion, setReaccion] = useState<Expresion | null>(null);
  const [rebote, setRebote] = useState(0);
  const fino = size > 64;

  // Desfase de parpadeo estable por instancia (derivado del id de React, sin aleatorio en render)
  const semilla = [...uid].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 997, 7);
  const blink = `${4 + (semilla % 20) / 10}s`;
  const blinkDelay = `-${(semilla % 40) / 10}s`;

  // Mirada que sigue el cursor (solo si es interactivo y no hay movimiento reducido)
  useEffect(() => {
    if (!interactivo || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height * 0.42;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 260);
        setMirada({ x: (dx / d) * 3.2 * k, y: (dy / d) * 2.6 * k });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, [interactivo]);

  // Rebote al celebrar
  useEffect(() => {
    if (celebrar === undefined || celebrar === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRebote((n) => n + 1);
  }, [celebrar]);

  useEffect(() => {
    if (!rebote) return;
    const t = setTimeout(() => setRebote(0), 720);
    return () => clearTimeout(t);
  }, [rebote]);

  useEffect(() => {
    if (!reaccion) return;
    const t = setTimeout(() => setReaccion(null), 1100);
    return () => clearTimeout(t);
  }, [reaccion]);

  const onClick = useCallback(() => {
    if (!interactivo) return;
    setRebote((n) => n + 1);
    setReaccion(expresion === "contento" ? "alerta" : "contento");
  }, [interactivo, expresion]);

  const exp = reaccion ?? expresion;
  const tinta = DARK_COLORS.includes(col.primario) ? "var(--char-white)" : "var(--char-ink)";
  const accFill = col.primario === "yellow" || col.secundario === "yellow" ? charVar("lime-soft") : charVar("yellow");
  const sw = Math.max(4, 400 / size);
  const stk = size >= 120 ? 3.5 : size >= 80 ? 3 : 2;
  const label = `${nombre ?? fig.nombre}, asistente de ${MODULO[id]}`;

  return (
    <span
      ref={ref}
      role={decorativo ? undefined : "img"}
      aria-label={decorativo ? undefined : label}
      aria-hidden={decorativo || undefined}
      onClick={onClick}
      className={cn(
        "relative inline-block shrink-0 select-none align-middle",
        `asis-id-${id}`,
        animado && "asis-animado",
        interactivo && "asis-interactivo",
        rebote > 0 && "asis-rebote asis-gesto",
        className,
      )}
      style={
        {
          width: size,
          height: size,
          "--a-primary": charVar(col.primario),
          "--a-secondary": charVar(col.secundario),
          "--a-detail": charVar(col.detalle),
          "--a-acc": accFill,
          "--sw": `${sw}px`,
          "--stk": `${stk}px`,
          "--blink": blink,
          "--blink-delay": blinkDelay,
          ...Object.fromEntries(VOLUMENES.map(([k]) => [`--g-${k}`, `url(#${uid}-${k})`])),
        } as React.CSSProperties
      }
    >
      <svg key={rebote ? `r${rebote}` : "r0"} viewBox="0 0 200 200" width={size} height={size} className="asis-svg block overflow-visible" aria-hidden>
        <defs>
          {VOLUMENES.map(([k, color]) => (
            <radialGradient key={k} id={`${uid}-${k}`} cx="0.36" cy="0.28" r="0.85" fx="0.32" fy="0.22">
              <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${color} 62%, var(--char-white))` }} />
              <stop offset="0.45" style={{ stopColor: color }} />
              <stop offset="1" style={{ stopColor: `color-mix(in srgb, ${color} 80%, var(--char-charcoal))` }} />
            </radialGradient>
          ))}
        </defs>
        <g className="asis-salto">
          <g className="asis-inclina">
            <g className="asis-cuerpo">
              {fig.render({ fino, mostrarProp, uid })}
              <g data-capa="face">
                <Cara fig={fig} exp={exp} tinta={tinta} mirada={mirada} />
              </g>
              {accesorio !== "ninguno" ? (
                <g data-capa={`slot-${accesorio === "gafas" ? "eyes" : accesorio === "bufanda" ? "neck" : "head"}`}>
                  <AccesorioSvg fig={fig} acc={accesorio} />
                </g>
              ) : null}
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
}

/** Colores con volumen: [clave, color]. Cada relleno usa su degradado radial. */
const VOLUMENES: [string, string][] = [
  ["p", "var(--a-primary)"],
  ["s", "var(--a-secondary)"],
  ["d", "var(--a-detail)"],
  ["acc", "var(--a-acc)"],
  ["lime", "var(--char-lime)"],
  ["yellow", "var(--char-yellow)"],
  ["yellow-soft", "var(--char-yellow-soft)"],
  ["sand", "var(--char-sand)"],
  ["cream", "var(--char-cream)"],
  ["white", "var(--char-white)"],
  ["charcoal", "var(--char-charcoal)"],
  ["ink", "var(--char-ink)"],
];

/* ═════════ Cara: ojos de punto con brillo, cejas y boca mínima ═════════ */
function Cara({ fig, exp, tinta, mirada }: { fig: Figura; exp: Expresion; tinta: string; mirada: Punto }) {
  const [a, b] = fig.ojos;
  const ink = fig.ojosBlancos ? "var(--char-ink)" : tinta;
  const linea = { stroke: tinta, strokeWidth: "calc(var(--sw) * 0.9)", strokeLinecap: "round" as const, fill: "none" };
  const lineaOjo = { ...linea, stroke: fig.ojosBlancos ? "var(--char-white)" : tinta };

  // Ojos según expresión y actitud base
  const cerrados = exp === "dormido" || (exp === "neutral" && fig.ojo === "calma");
  const r = exp === "alerta" ? 6.6 : 5.4;

  const ojo = (p: Punto, i: number) => {
    if (cerrados) {
      const d = exp === "dormido" ? `M${p.x - 7} ${p.y - 1} Q${p.x} ${p.y + 5} ${p.x + 7} ${p.y - 1}` : `M${p.x - 8} ${p.y} Q${p.x} ${p.y + 3.5} ${p.x + 8} ${p.y}`;
      return <path key={i} d={d} style={lineaOjo} />;
    }
    const picaro = fig.ojo === "picaro" && (exp === "neutral" || exp === "contento");
    return (
      <g key={i}>
        {fig.ojosBlancos ? <ellipse cx={p.x} cy={p.y} rx={8.5} ry={picaro ? 5.2 : 7} style={{ fill: "var(--char-white)" }} /> : null}
        <g className="asis-pupilas" style={{ transform: `translate(${mirada.x + (picaro ? 2.6 : 0)}px, ${mirada.y + (picaro ? 0.8 : 0)}px)` }}>
          <circle cx={p.x} cy={p.y} r={fig.ojosBlancos ? r - 0.8 : r} style={{ fill: ink }} />
          <circle cx={p.x + 1.8} cy={p.y - 1.8} r={1.7} style={{ fill: ink === "var(--char-white)" ? "var(--char-ink)" : "var(--char-white)" }} />
        </g>
        {picaro ? <path d={`M${p.x - 9.5} ${p.y - 2.5} L${p.x + 9.5} ${p.y - 2.5}`} style={{ ...linea, stroke: "var(--char-ink)" }} /> : null}
      </g>
    );
  };

  return (
    <>
      <g className="asis-ojos">{[a, b].map(ojo)}</g>
      <Cejas a={a} b={b} tipo={cejaPara(fig.ceja, exp)} estilo={fig.ojosBlancos ? { ...linea, stroke: "var(--char-white)" } : linea} />
      <Boca fig={fig} exp={exp} estilo={linea} />
      {exp === "dormido" ? (
        <text x={b.x + 14} y={b.y - 14} style={{ fill: tinta, fontSize: 16, fontWeight: 700, fontFamily: "inherit" }}>
          z
        </text>
      ) : null}
    </>
  );
}

type CejaTipo = Ceja | "relajada" | "alta" | "molesta";
function cejaPara(base: Ceja, exp: Expresion): CejaTipo {
  if (exp === "neutral") return base;
  if (exp === "contento") return base === "ninguna" ? "ninguna" : "relajada";
  if (exp === "alerta") return "alta";
  if (exp === "molesto") return "molesta";
  return "ninguna";
}

function Cejas({ a, b, tipo, estilo }: { a: Punto; b: Punto; tipo: CejaTipo; estilo: React.CSSProperties }) {
  if (tipo === "ninguna") return null;
  const y = (p: Punto) => p.y - 13;
  let d = "";
  switch (tipo) {
    case "serio": // escéptico: una ceja más alta
      d = `M${a.x - 8} ${y(a) + 1} L${a.x + 7} ${y(a) + 3} M${b.x - 7} ${y(b) - 1} L${b.x + 8} ${y(b) - 4}`;
      break;
    case "gruñon":
    case "fruncido":
    case "molesta":
      d = `M${a.x - 9} ${y(a) - 3} L${a.x + 7} ${y(a) + 3} M${b.x - 7} ${y(b) + 3} L${b.x + 9} ${y(b) - 3}`;
      break;
    case "decidido":
      d = `M${a.x - 8} ${y(a) - 2} L${a.x + 7} ${y(a) + 2.5} M${b.x - 7} ${y(b) + 2.5} L${b.x + 8} ${y(b) - 2}`;
      break;
    case "picaro":
      d = `M${a.x - 8} ${y(a) - 1} L${a.x + 8} ${y(a) - 1} M${b.x - 8} ${y(b) - 3} Q${b.x} ${y(b) - 7} ${b.x + 8} ${y(b) - 2}`;
      break;
    case "relajada":
      d = `M${a.x - 7} ${y(a) - 1} Q${a.x} ${y(a) - 4} ${a.x + 7} ${y(a) - 1} M${b.x - 7} ${y(b) - 1} Q${b.x} ${y(b) - 4} ${b.x + 7} ${y(b) - 1}`;
      break;
    case "alta":
      d = `M${a.x - 7} ${y(a) - 5} Q${a.x} ${y(a) - 9} ${a.x + 7} ${y(a) - 5} M${b.x - 7} ${y(b) - 5} Q${b.x} ${y(b) - 9} ${b.x + 7} ${y(b) - 5}`;
      break;
  }
  return <path d={d} style={estilo} />;
}

function Boca({ fig, exp, estilo }: { fig: Figura; exp: Expresion; estilo: React.CSSProperties }) {
  if (fig.bocaBase === "ninguna") return null; // pico (Tic) o dientes (Tuerca)
  const { x, y } = fig.boca;
  if (exp === "alerta") return <ellipse cx={x} cy={y + 1} rx={3} ry={3.6} style={{ ...estilo, fill: "none" }} />;
  if (exp === "contento") return <path d={`M${x - 5} ${y - 1} Q${x} ${y + 3.5} ${x + 5} ${y - 1}`} style={estilo} />;
  if (exp === "molesto") return <path d={`M${x - 5} ${y + 2} Q${x} ${y - 2.5} ${x + 5} ${y + 2}`} style={estilo} />;
  if (exp === "dormido") return <path d={`M${x - 2.5} ${y} L${x + 2.5} ${y}`} style={estilo} />;
  switch (fig.bocaBase) {
    case "mini":
      return <path d={`M${x - 2.5} ${y} L${x + 2.5} ${y}`} style={estilo} />;
    case "frown":
      return <path d={`M${x - 4.5} ${y + 1.5} Q${x} ${y - 2} ${x + 4.5} ${y + 1.5}`} style={estilo} />;
    case "sonrisa-lado":
      return <path d={`M${x - 5} ${y} Q${x + 1} ${y + 4} ${x + 7} ${y - 2}`} style={estilo} />;
    default:
      return <path d={`M${x - 4} ${y} L${x + 4} ${y}`} style={estilo} />;
  }
}

/* ═════════ Accesorios extra del editor ═════════ */
function AccesorioSvg({ fig, acc }: { fig: Figura; acc: Accesorio }) {
  const [a, b] = fig.ojos;
  if (acc === "gafas") {
    return (
      <g>
        <circle className="t" cx={a.x} cy={a.y} r="11" style={{ "--tc": "var(--char-charcoal)", fill: "var(--char-white)", fillOpacity: 0.3 } as React.CSSProperties} />
        <circle className="t" cx={b.x} cy={b.y} r="11" style={{ "--tc": "var(--char-charcoal)", fill: "var(--char-white)", fillOpacity: 0.3 } as React.CSSProperties} />
        <path className="t" d={`M${a.x + 11} ${a.y - 1} Q${(a.x + b.x) / 2} ${a.y - 6} ${b.x - 11} ${b.y - 1}`} style={{ "--tc": "var(--char-charcoal)" } as React.CSSProperties} />
      </g>
    );
  }
  if (acc === "gorro") {
    const { x, y, w } = fig.cabeza;
    // Beanie: copa tejida alta, doblez con nervaduras y pompón
    const h = w * 0.55;
    const half = w / 2 - 4;
    return (
      <g>
        <path className="o f-acc" d={`M${x - half} ${y + 4} C${x - half} ${y - h * 0.9} ${x + half} ${y - h * 0.9} ${x + half} ${y + 4} Z`} />
        <rect className="o f-acc" x={x - half - 2} y={y - 2} width={half * 2 + 4} height={14} rx={5} />
        <path className="o-fino" d={[-0.6, -0.3, 0, 0.3, 0.6].map((k) => `M${x + k * half} ${y + 1} L${x + k * half} ${y + 9}`).join(" ")} />
        <circle className="o f-acc" cx={x} cy={y - h * 0.68 - 4} r={7} />
      </g>
    );
  }
  if (acc === "audifonos") {
    const cx = (a.x + b.x) / 2;
    const half = fig.anchoCara;
    const top = fig.cabeza.y - 6;
    return (
      <g>
        <path className="t" d={`M${cx - half + 4} ${a.y} Q${cx - half} ${top} ${cx} ${top} Q${cx + half} ${top} ${cx + half - 4} ${b.y}`} style={{ "--tc": "var(--char-charcoal)", strokeWidth: "calc(var(--sw) * 1.4)" } as React.CSSProperties} />
        <rect className="o f-charcoal" x={cx - half - 6} y={a.y - 12} width={14} height={24} rx={6} />
        <rect className="o f-charcoal" x={cx + half - 8} y={b.y - 12} width={14} height={24} rx={6} />
      </g>
    );
  }
  // bufanda
  const { x, y, w } = fig.cuello;
  return (
    <g>
      <rect className="o f-acc" x={x - w / 2} y={y - 7} width={w} height={15} rx={7.5} />
      <path className="o f-acc" d={`M${x + w / 4} ${y + 4} l10 26 l-14 2 l-6 -26 Z`} />
    </g>
  );
}

export function asistenteLabel(id: AsistenteId, nombre?: string) {
  return `${nombre ?? FIGURAS[id].nombre}, asistente de ${MODULO[id]}`;
}
