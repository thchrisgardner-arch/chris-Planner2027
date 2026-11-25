"use client";

import "./asistentes.css";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/utils/cn";
import {
  DARK_COLORS,
  EXPRESION_LABEL,
  charVar,
  type Accesorio,
  type AsistenteId,
  type Colores,
  type Expresion,
  type Pose,
} from "@/lib/asistentes/tipos";
import { RIGS, bloque, type Boca, type Ceja, type Fx, type PoseCfg, type Punto, type Rig } from "./figuras";
import { COLORES_POR_DEFECTO } from "@/lib/asistentes/tipos";
export { COLORES_POR_DEFECTO };

const MODULO: Record<AsistenteId, string> = {
  centavo: "finanzas",
  brote: "hábitos",
  tuerca: "proyectos",
  tic: "calendario",
  cima: "objetivos",
  antojo: "wishlist",
};

/**
 * Las 8 poses de cuerpo completo. `idle` toma la actitud base de cada personaje (rig.idle);
 * el resto es común y se adapta a la anatomía de cada rig.
 */
const POSES: Record<Exclude<Pose, "idle">, PoseCfg> = {
  feliz: { brazos: { modo: "colgar", a: 30 }, ojos: { modo: "feliz" }, boca: "sonrisa" },
  celebrando: { brazos: { modo: "colgar", a: 162 }, ojos: { modo: "feliz" }, boca: "abierta", cuerpo: { y: -6 }, fx: ["destellos"] },
  orgulloso: { brazos: { modo: "cintura" }, ojos: { modo: "abierto", tapa: 0.52, mirada: [0, -0.7] }, boca: "sonrisa", cuerpo: { rot: -3, sy: 1.02 } },
  preocupado: { brazos: { modo: "juntas" }, ojos: { modo: "abierto", grande: true, ceja: "arriba", mirada: [0, 0.3] }, boca: "o", fx: ["sudor"] },
  triste: { brazos: { modo: "colgar", a: -8 }, ojos: { modo: "llorando", grande: true, ceja: "arriba", mirada: [0, -0.4] }, boca: "triste", cuerpo: { y: 3, sy: 0.96 }, fx: ["lagrimas"] },
  molesto: { brazos: { modo: "cruzados" }, ojos: { modo: "abierto", tapa: 0.46, inclina: 24, ceja: "enojo" }, boca: "triste", fx: ["vapor"] },
  dormido: { brazos: { modo: "colgar", a: -10 }, ojos: { modo: "cerrado" }, boca: "cerrada", cuerpo: { y: 5, sy: 0.93 }, fx: ["zzz"] },
};

export function poseCfg(rig: Rig, pose: Pose): PoseCfg {
  return pose === "idle" ? rig.idle : POSES[pose];
}

export interface AsistenteProps {
  id: AsistenteId;
  size?: number;
  colores?: Colores;
  /** Pose de cuerpo completo (alias de `expresion`) */
  pose?: Pose;
  expresion?: Expresion;
  accesorio?: Accesorio;
  mostrarProp?: boolean;
  /** Muestra los efectos de la pose (destellos, lágrimas, sudor, vapor, "z") */
  fx?: boolean;
  /** Respira, parpadea, anima su pose y cambia de postura cada pocos segundos */
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

type Mov = "reposo" | "ladeado" | "ladeado-der" | "giro" | "agachado" | "puntillas" | "asoma" | "gesto";
const MOVS: Mov[] = ["ladeado", "ladeado-der", "giro", "agachado", "puntillas", "asoma", "gesto"];

const shade = (c: string) => `var(--char-${c}-shade)`;

/**
 * Personaje en SVG inline, estilo plano de dos tonos sin contorno. API estable: el render
 * podría cambiarse más adelante por una máquina de estados de Rive sin tocar a quien lo usa.
 */
export function Asistente({
  id,
  size = 96,
  colores,
  pose: poseProp,
  expresion,
  accesorio = "ninguno",
  mostrarProp = true,
  fx = true,
  animado = true,
  interactivo = false,
  celebrar,
  nombre,
  decorativo,
  className,
}: AsistenteProps) {
  const rig = RIGS[id];
  const col = colores ?? COLORES_POR_DEFECTO[id];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<HTMLSpanElement>(null);
  const [mirada, setMirada] = useState<Punto>({ x: 0, y: 0 });
  const [reaccion, setReaccion] = useState<Pose | null>(null);
  const [rebote, setRebote] = useState(0);
  const [mov, setMov] = useState<Mov>("reposo");
  const fino = size > 56;

  const semilla = [...uid].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 997, 7);
  const blink = `${4 + (semilla % 20) / 10}s`;
  const blinkDelay = `-${(semilla % 40) / 10}s`;

  // Mirada que sigue el cursor
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
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height * 0.45);
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 260);
        setMirada({ x: (dx / d) * k, y: (dy / d) * k });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, [interactivo]);

  // Movimientos variados en reposo (cada personaje a su ritmo)
  useEffect(() => {
    if (!animado || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let t: ReturnType<typeof setTimeout>;
    let i = 0;
    const tick = () => {
      i += 1;
      setMov((prev) => (prev !== "reposo" ? "reposo" : MOVS[Math.floor(Math.random() * MOVS.length)]));
      t = setTimeout(tick, i % 2 ? 2200 + Math.random() * 1800 : 4000 + Math.random() * 4000);
    };
    t = setTimeout(tick, 2500 + Math.random() * 4000);
    return () => clearTimeout(t);
  }, [animado]);

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
    const t = setTimeout(() => setReaccion(null), 1400);
    return () => clearTimeout(t);
  }, [reaccion]);

  const base: Pose = poseProp ?? expresion ?? "idle";
  const onClick = useCallback(() => {
    if (!interactivo) return;
    setRebote((n) => n + 1);
    setReaccion(base === "feliz" ? "celebrando" : "feliz");
  }, [interactivo, base]);

  const pose = reaccion ?? base;
  const cfg = poseCfg(rig, pose);
  const movActivo = animado && mov !== "reposo" && pose !== "dormido" && pose !== "triste" ? mov : "reposo";
  const oscuro = DARK_COLORS.includes(col.primario);
  const accFill = col.primario === "yellow" || col.secundario === "yellow" ? "lime-soft" : "yellow";
  const label = `${nombre ?? rig.nombre}, asistente de ${MODULO[id]}, ${EXPRESION_LABEL[pose].toLowerCase()}`;
  const c = cfg.cuerpo ?? {};
  const cuerpoT = `translate(0 ${c.y ?? 0}) rotate(${c.rot ?? 0} ${rig.cuerpo.cx} 184) translate(${rig.cuerpo.cx} 184) scale(${c.sx ?? 1} ${c.sy ?? 1}) translate(${-rig.cuerpo.cx} -184)`;
  const ctx = { fino, mostrarProp, uid };
  const salto = pose === "feliz" || pose === "celebrando";

  return (
    <span
      ref={ref}
      role={decorativo ? undefined : "img"}
      aria-label={decorativo ? undefined : label}
      aria-hidden={decorativo || undefined}
      onClick={onClick}
      className={cn(
        "relative inline-block shrink-0 select-none align-middle",
        `asis-id-${id} asis-p-${pose}`,
        animado && "asis-animado",
        interactivo && "asis-interactivo",
        rebote > 0 && "asis-rebote asis-gesto",
        movActivo !== "reposo" && `asis-mov-${movActivo}`,
        movActivo === "gesto" && "asis-gesto",
        className,
      )}
      style={
        {
          width: size,
          height: size,
          "--a-primary": charVar(col.primario),
          "--a-primary-shade": shade(col.primario),
          "--a-secondary": charVar(col.secundario),
          "--a-secondary-shade": shade(col.secundario),
          "--a-detail": charVar(col.detalle),
          "--a-detail-shade": shade(col.detalle),
          "--a-acc": charVar(accFill),
          "--a-acc-shade": shade(accFill),
          "--blink": blink,
          "--blink-delay": blinkDelay,
        } as React.CSSProperties
      }
    >
      <svg viewBox="0 0 200 200" width={size} height={size} className="asis-svg block overflow-visible" aria-hidden>
        <defs>
          <clipPath id={`${uid}-cuerpo`}>
            <path d={bloque(rig.cuerpo)} />
          </clipPath>
        </defs>
        {/* Sombra en el piso */}
        <ellipse className="f-floor asis-piso" cx={rig.cuerpo.cx} cy="190" rx={pose === "celebrando" ? rig.cuerpo.w * 0.32 : rig.cuerpo.w * 0.42} ry="6" />
        <g className="asis-salto">
          <g className="asis-inclina">
            <g className="asis-mov">
              <g key={pose} className={salto ? "asis-entra-salto" : "asis-entra"}>
                <g className="asis-cuerpo">
                  <g transform={cuerpoT}>
                    {oscuro ? <circle className="f-halo" cx={rig.cuerpo.cx} cy={rig.cuerpo.top + rig.cuerpo.h / 2} r={rig.cuerpo.w * 0.6} /> : null}
                    {rig.atras(ctx)}
                    {/* Pies */}
                    <g data-capa="feet">
                      {rig.pies.map((p, i) => (
                        <ellipse key={i} className={rig.pie} cx={p.x} cy={p.y} rx="15" ry="7" />
                      ))}
                    </g>
                    {/* Cuerpo con sombra baja del mismo color */}
                    <g data-capa="body">
                      <path className="f-p" d={bloque(rig.cuerpo)} />
                      <g clipPath={`url(#${uid}-cuerpo)`}>
                        <ellipse className="f-ps" cx={rig.cuerpo.cx + rig.cuerpo.w * 0.2} cy={rig.cuerpo.top + rig.cuerpo.h + 8} rx={rig.cuerpo.w * 0.78} ry={rig.cuerpo.h * 0.36} />
                      </g>
                    </g>
                    {rig.frente(ctx)}
                    <g data-capa="face">
                      <Ojos rig={rig} cfg={cfg} mirada={mirada} uid={uid} oscuro={oscuro} />
                      <BocaSvg rig={rig} boca={cfg.boca} oscuro={oscuro} />
                    </g>
                    {rig.propDelante?.(ctx)}
                    <Brazos rig={rig} cfg={cfg} />
                    {accesorio !== "ninguno" ? (
                      <g data-capa={`slot-${accesorio === "gafas" ? "eyes" : accesorio === "bufanda" ? "neck" : "head"}`}>
                        <AccesorioSvg rig={rig} acc={accesorio} />
                      </g>
                    ) : null}
                  </g>
                </g>
                {fx && cfg.fx?.length ? <Efectos rig={rig} fx={cfg.fx} /> : null}
              </g>
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
}

/* ═════════ Brazos en óvalo, en el tono de sombra (como alas) ═════════ */
function Brazos({ rig, cfg }: { rig: Rig; cfg: PoseCfg }) {
  const { modo } = cfg.brazos;
  const [L, R] = rig.hombros;
  const { rx, ry } = rig.brazo;
  const brazo = (p: Punto, ang: number, k = 1) => (
    <g transform={`rotate(${ang} ${p.x} ${p.y})`}>
      <ellipse className="f-ps" cx={p.x} cy={p.y + ry * k - 5} rx={rx} ry={ry * k} />
    </g>
  );
  if (modo === "cruzados") {
    const cx = rig.cuerpo.cx;
    const y = L.y + 8;
    const w = rig.cuerpo.w * 0.66;
    return (
      <g data-capa="arms">
        <rect className="f-ps" x={cx - w / 2} y={y - rx} width={w} height={rx * 2} rx={rx} transform={`rotate(8 ${cx} ${y})`} />
        <rect className="f-ps" x={cx - w / 2} y={y - rx + 8} width={w} height={rx * 2} rx={rx} transform={`rotate(-8 ${cx} ${y + 8})`} />
      </g>
    );
  }
  let aL = 0;
  let aR = 0;
  let k = 1;
  if (modo === "colgar") {
    const a = cfg.brazos.a ?? 0;
    [aL, aR] = Array.isArray(a) ? a : [a, a];
    if (Math.max(aL, aR) > 120) k = 1.3; // brazos arriba: más largos para que se vean sobre la cabeza
  } else if (modo === "cintura") {
    aL = aR = 38;
    k = 0.78;
  } else if (modo === "juntas") {
    aL = aR = -50;
  } else if (modo === "abrazo") {
    aL = aR = -64;
  }
  return (
    <g data-capa="arms">
      {brazo(L, aL, k)}
      {brazo(R, -aR, k)}
    </g>
  );
}

/* ═════════ Ojos grandes: esclerótica blanca, pupila oscura, brillos, párpado y ceja de color ═════════ */
function Ojos({ rig, cfg, mirada, uid, oscuro }: { rig: Rig; cfg: PoseCfg; mirada: Punto; uid: string; oscuro: boolean }) {
  const o = cfg.ojos;
  const r = rig.rOjo * (o.grande ? 1.14 : 1);
  const ry = r * 1.08;
  // Ojos en arco: blancos si van sobre un cuerpo oscuro o sobre el antifaz
  const tinta = oscuro || rig.parpado === "d" ? "var(--char-white)" : "var(--char-ink)";
  const trazo = (d: string, k: number) => <path key={k} d={d} style={{ fill: "none", stroke: tinta, strokeWidth: r * 0.34, strokeLinecap: "round" }} />;

  if (o.modo === "feliz") {
    return <g>{rig.ojos.map((p, i) => trazo(`M${p.x - r * 0.75} ${p.y + 3} Q${p.x} ${p.y - r * 0.85} ${p.x + r * 0.75} ${p.y + 3}`, i))}</g>;
  }
  if (o.modo === "cerrado") {
    return <g>{rig.ojos.map((p, i) => trazo(`M${p.x - r * 0.75} ${p.y} Q${p.x} ${p.y + r * 0.6} ${p.x + r * 0.75} ${p.y}`, i))}</g>;
  }

  const [mx0, my0] = o.mirada ?? [0, 0];
  const mx = Math.max(-1, Math.min(1, mx0 + mirada.x));
  const my = Math.max(-1, Math.min(1, my0 + mirada.y));
  const parpado = rig.parpado === "d" ? "f-d" : "f-p";
  const cejaCls = rig.parpado === "d" ? "f-ds" : rig.pico ? "f-ds" : "f-ps";

  return (
    <>
      <g className="asis-ojos">
        {rig.ojos.map((p, i) => {
          const lado = i === 0 ? 1 : -1; // espejo para el ojo derecho
          const pr = r * (o.modo === "llorando" ? 0.62 : 0.55);
          const px = p.x + mx * r * 0.32;
          const py = p.y + my * r * 0.3;
          const tapa = o.tapa ?? 0;
          return (
            <g key={i}>
              <clipPath id={`${uid}-ojo${i}`}>
                <ellipse cx={p.x} cy={p.y} rx={r} ry={ry} />
              </clipPath>
              <ellipse className="f-white" cx={p.x} cy={p.y} rx={r} ry={ry} />
              <g clipPath={`url(#${uid}-ojo${i})`}>
                <g className="asis-pupilas" style={{ transform: `translate(${px - p.x}px, ${py - p.y}px)` }}>
                  <circle className="f-ink" cx={p.x} cy={p.y} r={pr} />
                  <circle className="f-white" cx={p.x + pr * 0.38} cy={p.y - pr * 0.4} r={pr * 0.34} />
                  <circle className="f-white" cx={p.x - pr * 0.35} cy={p.y + pr * 0.38} r={pr * 0.16} />
                </g>
                {o.modo === "llorando" ? <rect className="f-tear" x={p.x - r} y={p.y + ry * 0.35} width={r * 2} height={ry} opacity="0.85" /> : null}
                {tapa > 0 ? (
                  <rect
                    className={parpado}
                    x={p.x - r - 4}
                    y={p.y - ry - 4}
                    width={r * 2 + 8}
                    height={tapa * ry * 2 + 4}
                    transform={`rotate(${(o.inclina ?? 0) * lado} ${p.x} ${p.y})`}
                  />
                ) : null}
              </g>
            </g>
          );
        })}
      </g>
      <Cejas rig={rig} ceja={o.ceja ?? "ninguna"} r={r} ry={ry} cls={cejaCls} />
    </>
  );
}

function Cejas({ rig, ceja, r, ry, cls }: { rig: Rig; ceja: Ceja; r: number; ry: number; cls: string }) {
  if (ceja === "ninguna") return null;
  return (
    <g data-capa="brows">
      {rig.ojos.map((p, i) => {
        const lado = i === 0 ? 1 : -1;
        let ang = 0;
        let dy = 0;
        if (ceja === "enojo") ang = 20 * lado;
        if (ceja === "arriba") {
          ang = -18 * lado;
          dy = -4;
        }
        if (ceja === "esceptico") {
          ang = i === 0 ? 0 : 14;
          dy = i === 0 ? 2 : -4;
        }
        const y = p.y - ry - 5 + dy;
        return <rect key={i} className={cls} x={p.x - r * 0.75} y={y - 3} width={r * 1.5} height={6} rx={3} transform={`rotate(${ang} ${p.x} ${y})`} />;
      })}
    </g>
  );
}

/* ═════════ Boca (o pico) ═════════ */
function BocaSvg({ rig, boca, oscuro }: { rig: Rig; boca: Boca; oscuro: boolean }) {
  const { x, y } = rig.boca;
  if (rig.pico) {
    const abierto = boca === "abierta" || boca === "o";
    return abierto ? (
      <g data-capa="beak">
        <path className="f-yellow" d={`M${x - 12} ${y - 3} Q${x} ${y - 16} ${x + 12} ${y - 3} Z`} />
        <path className="f-charcoal" d={`M${x - 9} ${y - 2} L${x + 9} ${y - 2} L${x} ${y + 5} Z`} />
        <path className="f-yellow-shade" d={`M${x - 10} ${y + 2} Q${x} ${y + 12} ${x + 10} ${y + 2} Z`} />
      </g>
    ) : (
      <g data-capa="beak">
        <path className="f-yellow" d={`M${x - 12} ${y} Q${x} ${y - 14} ${x + 12} ${y} Z`} />
        <path className="f-yellow-shade" d={`M${x - 12} ${y} Q${x} ${y + 8} ${x + 12} ${y} Z`} />
      </g>
    );
  }
  const tinta = oscuro ? "var(--char-white)" : "var(--char-ink)";
  const linea = { fill: "none", stroke: tinta, strokeWidth: 4, strokeLinecap: "round" as const };
  switch (boca) {
    case "sonrisa":
      return <path d={`M${x - 7} ${y - 1} Q${x} ${y + 6} ${x + 7} ${y - 1}`} style={linea} />;
    case "abierta":
      return (
        <g>
          <path className="f-ink" d={`M${x - 11} ${y - 3} Q${x} ${y - 4} ${x + 11} ${y - 3} Q${x + 10} ${y + 13} ${x} ${y + 14} Q${x - 10} ${y + 13} ${x - 11} ${y - 3} Z`} />
          <ellipse className="f-ps" cx={x} cy={y + 9} rx="6" ry="3.5" />
        </g>
      );
    case "o":
      return <ellipse className="f-ink" cx={x} cy={y + 2} rx="4.5" ry="5.5" />;
    case "triste":
      return <path d={`M${x - 7} ${y + 4} Q${x} ${y - 3} ${x + 7} ${y + 4}`} style={linea} />;
    case "lado":
      return <path d={`M${x - 6} ${y} Q${x + 1} ${y + 5} ${x + 9} ${y - 3}`} style={linea} />;
    default:
      return null;
  }
}

/* ═════════ Efectos: formas planas pequeñas, sin contorno ═════════ */
const estrella = (x: number, y: number, s: number) =>
  `M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`;
const gota = (x: number, y: number, s: number) => `M${x} ${y - s * 1.4} Q${x + s} ${y - s * 0.2} ${x + s} ${y + s * 0.3} A${s} ${s} 0 0 1 ${x - s} ${y + s * 0.3} Q${x - s} ${y - s * 0.2} ${x} ${y - s * 1.4} Z`;
const zeta = (x: number, y: number, s: number) =>
  `M${x} ${y} h${s} l${-s * 0.72} ${s * 0.8} h${s * 0.72} v${s * 0.24} h${-s} l${s * 0.72} ${-s * 0.8} h${-s * 0.72} Z`;
const corazon = (x: number, y: number, s: number) =>
  `M${x} ${y + s * 0.9} C${x - s * 1.4} ${y} ${x - s * 0.8} ${y - s} ${x} ${y - s * 0.3} C${x + s * 0.8} ${y - s} ${x + s * 1.4} ${y} ${x} ${y + s * 0.9} Z`;

function Efectos({ rig, fx }: { rig: Rig; fx: Fx[] }) {
  const { cx, top, w } = rig.cuerpo;
  const [a, b] = rig.ojos;
  return (
    <g data-capa="fx" className="fx">
      {fx.includes("destellos") ? (
        <g className="fx fx-destello">
          <path className="f-lime" d={estrella(cx - w / 2 - 6, top + 6, 9)} />
          <path className="f-yellow" d={estrella(cx + w / 2 + 6, top - 4, 11)} />
          <path className="f-yellow" d={estrella(cx - w / 2 - 14, top + 56, 6)} />
          <path className="f-lime" d={estrella(cx + w / 2 + 14, top + 52, 7)} />
        </g>
      ) : null}
      {fx.includes("sudor") ? (
        <g className="fx fx-sudor">
          <path className="f-tear" d={gota(cx + w / 2 - 14, top + 14, 7)} />
        </g>
      ) : null}
      {fx.includes("lagrimas") ? (
        <g className="fx fx-lagrima">
          <path className="f-tear" d={gota(a.x - rig.rOjo * 0.6, a.y + rig.rOjo + 6, 4.5)} />
          <path className="f-tear" d={gota(b.x + rig.rOjo * 0.6, b.y + rig.rOjo + 6, 4.5)} />
        </g>
      ) : null}
      {fx.includes("vapor") ? (
        <g className="fx fx-vapor">
          <circle className="f-gray" opacity="0.45" cx={cx + 22} cy={top - 6} r="7" />
          <circle className="f-gray" opacity="0.45" cx={cx + 32} cy={top - 14} r="9" />
          <circle className="f-gray" opacity="0.45" cx={cx + 18} cy={top - 20} r="6" />
        </g>
      ) : null}
      {fx.includes("zzz") ? (
        <g className="fx fx-zzz">
          <path className="f-gray" d={zeta(cx + w / 2 - 20, top - 4, 9)} />
          <path className="f-gray" d={zeta(cx + w / 2 - 8, top - 18, 12)} />
          <path className="f-gray" d={zeta(cx + w / 2 + 6, top - 36, 15)} />
        </g>
      ) : null}
      {fx.includes("corazones") ? (
        <g className="fx fx-corazones">
          <path className="f-lime" d={corazon(cx - w / 2, top + 4, 8)} />
          <path className="f-yellow" d={corazon(cx + w / 2, top - 6, 10)} />
        </g>
      ) : null}
    </g>
  );
}

/* ═════════ Accesorios extra del editor ═════════ */
function AccesorioSvg({ rig, acc }: { rig: Rig; acc: Accesorio }) {
  const [a, b] = rig.ojos;
  const r = rig.rOjo + 5;
  if (acc === "gafas") {
    const t = { "--tc": "var(--char-charcoal)", strokeWidth: 4.5 } as React.CSSProperties;
    return (
      <g>
        <circle className="t" style={{ ...t, fill: "var(--char-white)", fillOpacity: 0.18 }} cx={a.x} cy={a.y} r={r} />
        <circle className="t" style={{ ...t, fill: "var(--char-white)", fillOpacity: 0.18 }} cx={b.x} cy={b.y} r={r} />
        <path className="t" style={t} d={`M${a.x + r} ${a.y - 2} Q${(a.x + b.x) / 2} ${a.y - 7} ${b.x - r} ${b.y - 2}`} />
      </g>
    );
  }
  if (acc === "gorro") {
    const { x, y, w } = rig.cabeza;
    const h = w * 0.55;
    const half = w / 2 - 4;
    return (
      <g>
        <path className="f-acc" d={`M${x - half} ${y + 4} C${x - half} ${y - h * 0.9} ${x + half} ${y - h * 0.9} ${x + half} ${y + 4} Z`} />
        <rect className="f-accs" x={x - half - 2} y={y - 2} width={half * 2 + 4} height={14} rx={5} />
        <circle className="f-acc" cx={x} cy={y - h * 0.68 - 4} r={7} />
      </g>
    );
  }
  if (acc === "audifonos") {
    const cx = (a.x + b.x) / 2;
    const half = rig.anchoCara;
    const top = rig.cabeza.y - 8;
    return (
      <g>
        <path className="t" style={{ "--tc": "var(--char-charcoal)", strokeWidth: 6 } as React.CSSProperties} d={`M${cx - half + 4} ${a.y} Q${cx - half} ${top} ${cx} ${top} Q${cx + half} ${top} ${cx + half - 4} ${b.y}`} />
        <rect className="f-charcoal" x={cx - half - 6} y={a.y - 13} width={15} height={26} rx={7} />
        <rect className="f-charcoal" x={cx + half - 9} y={b.y - 13} width={15} height={26} rx={7} />
      </g>
    );
  }
  const { x, y, w } = rig.cuello;
  return (
    <g>
      <rect className="f-acc" x={x - w / 2} y={y - 8} width={w} height={16} rx={8} />
      <rect className="f-accs" x={x - w / 2} y={y + 2} width={w} height={6} rx={3} />
      <path className="f-accs" d={`M${x + w / 4} ${y + 4} l10 26 l-14 2 l-6 -26 Z`} />
    </g>
  );
}

export function asistenteLabel(id: AsistenteId, nombre?: string) {
  return `${nombre ?? RIGS[id].nombre}, asistente de ${MODULO[id]}`;
}
