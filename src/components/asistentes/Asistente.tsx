"use client";

import "./asistentes.css";
import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { cn } from "@/utils/cn";
import {
  DARK_COLORS,
  EXPRESION_LABEL,
  MOMENTO_LABEL,
  charVar,
  type Accesorio,
  type Angulo,
  type AsistenteId,
  type BocaVariante,
  type Colores,
  type Expresion,
  type Momento,
  type OjosVariante,
  type Pose,
} from "@/lib/asistentes/tipos";
import { RIGS, bloque, type Boca, type Ceja, type Fx, type PoseCfg, type Punto, type Rig } from "./figuras";
import { momentoCfg, ojosDeVariante, type MomentoCfg } from "./momentos";
import { COLORES_POR_DEFECTO } from "@/lib/asistentes/tipos";
import { nivelCrecimiento, useCrecimiento, type EtapaCrecimiento } from "@/lib/asistentes/crecimiento";
import { RasgoAtras, RasgoCabeza, RasgoFrente, alturaCorona } from "./crecimiento";
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
  /* ── Fase 4 ── */
  /** Uno de los 20 momentos (ángulo + postura + ojos + boca + efectos). Sin momento, se usa `pose`. */
  momento?: Momento;
  /** "auto" = el del momento */
  angulo?: Angulo | "auto";
  ojos?: OjosVariante | "auto";
  boca?: BocaVariante | "auto";
  /** Orienta el ángulo y la mirada hacia un elemento de la pantalla */
  mirarHacia?: RefObject<HTMLElement | null>;
  /** Cómo aparece: escala con rebote, asomándose desde abajo o cayendo desde arriba */
  entrada?: "pop" | "asomarse" | "caer";
  /* ── Fase 5 ── */
  /** Etapa de crecimiento; sin valor se toma la de la app (vínculo) y fuera de ella, "inicial" */
  crecimiento?: EtapaCrecimiento;
}

/* ═════════ Vista según el ángulo (todo sale del rig actual: se mueven u ocultan piezas) ═════════ */
interface Vista {
  espejo: boolean;
  caraDx: number;
  ojos: Punto[];
  escOjos: number[];
  boca: Punto;
  frenteDx: number;
  atrasDx: number;
  cuerpoSx: number;
  brazos: "ambos" | "uno" | "atras";
  piesDx: number;
  cara: boolean;
  atrasEncima: boolean;
}

export function vistaDe(rig: Rig, ang: Angulo): Vista {
  const W = rig.cuerpo.w;
  const cx = rig.cuerpo.cx;
  const base: Vista = { espejo: false, caraDx: 0, ojos: rig.ojos, escOjos: [1, 1], boca: rig.boca, frenteDx: 0, atrasDx: 0, cuerpoSx: 1, brazos: "ambos", piesDx: 0, cara: true, atrasEncima: false };
  if (ang === "frente") return base;
  if (ang === "tres-cuartos" || ang === "tres-cuartos-espejo") {
    const dx = W * 0.12;
    const [a, b] = rig.ojos;
    return {
      ...base,
      espejo: ang === "tres-cuartos-espejo",
      caraDx: dx,
      // El ojo lejano se achica y se acerca al cercano: el giro se lee sin redibujar
      ojos: [
        { x: a.x + dx * 1.1, y: a.y },
        { x: b.x + dx * 0.55, y: b.y },
      ],
      escOjos: [1, 0.72],
      boca: { x: rig.boca.x + dx * 1.05, y: rig.boca.y },
      frenteDx: dx * 0.85,
      atrasDx: -dx * 0.6,
      piesDx: dx * 0.3,
    };
  }
  if (ang === "perfil") {
    const [, b] = rig.ojos;
    return {
      ...base,
      caraDx: W * 0.26,
      ojos: [{ x: cx + W * 0.25, y: b.y }],
      escOjos: [0.85],
      boca: { x: cx + W * 0.37, y: rig.boca.y },
      frenteDx: W * 0.26,
      atrasDx: -W * 0.14,
      cuerpoSx: 0.9,
      brazos: "uno",
      piesDx: W * 0.06,
    };
  }
  // De espaldas: sin cara; orejas, cola y caparazón quedan encima; los brazos, detrás
  return { ...base, cara: false, brazos: "atras", atrasEncima: true };
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
  momento,
  angulo: anguloProp = "auto",
  ojos: ojosProp = "auto",
  boca: bocaProp = "auto",
  mirarHacia,
  entrada,
  crecimiento,
}: AsistenteProps) {
  const etapaApp = useCrecimiento(id);
  const etapa = nivelCrecimiento(crecimiento ?? etapaApp);
  const rig = RIGS[id];
  const col = colores ?? COLORES_POR_DEFECTO[id];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ref = useRef<HTMLSpanElement>(null);
  const [mirada, setMirada] = useState<Punto>({ x: 0, y: 0 });
  const [reaccion, setReaccion] = useState<Pose | null>(null);
  const [rebote, setRebote] = useState(0);
  const [mov, setMov] = useState<Mov>("reposo");
  // Mirada viva (momentos en tres cuartos): cada 8–12 s gira al otro lado
  const [volteado, setVolteado] = useState(false);
  // Hacia dónde está el elemento que mira (mirarHacia)
  const [haciaIzq, setHaciaIzq] = useState<boolean | null>(null);
  const fino = size > 56;

  useEffect(() => {
    if (!momento || !animado || mirarHacia || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      setVolteado((v) => !v);
      t = setTimeout(tick, 8000 + Math.random() * 4000);
    };
    t = setTimeout(tick, 8000 + Math.random() * 4000);
    return () => clearTimeout(t);
  }, [momento, animado, mirarHacia]);

  useEffect(() => {
    if (!mirarHacia) return;
    const medir = () => {
      const a = ref.current?.getBoundingClientRect();
      const b = mirarHacia.current?.getBoundingClientRect();
      if (!a || !b) return;
      setHaciaIzq(b.left + b.width / 2 < a.left + a.width / 2);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      setMirada({ x: Math.abs(dx / d) * 0.8, y: (dy / d) * 0.8 });
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [mirarHacia]);

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
  // Momento (Fase 4) o pose (antes): sin momento todo se dibuja exactamente como antes
  const mcfg: MomentoCfg | null = momento && !reaccion ? momentoCfg(rig, momento, POSES) : null;
  let cfg: PoseCfg = mcfg ?? poseCfg(rig, pose);
  if (ojosProp !== "auto") cfg = { ...cfg, ojos: ojosDeVariante(ojosProp) };
  if (bocaProp !== "auto") cfg = { ...cfg, boca: bocaProp };
  let ang: Angulo = anguloProp !== "auto" ? anguloProp : (mcfg?.angulo ?? "frente");
  if (haciaIzq !== null && (ang === "tres-cuartos" || ang === "tres-cuartos-espejo" || ang === "perfil")) {
    ang = ang === "perfil" ? "perfil" : haciaIzq ? "tres-cuartos-espejo" : "tres-cuartos";
  } else if (volteado && ang === "tres-cuartos") ang = "tres-cuartos-espejo";
  else if (volteado && ang === "tres-cuartos-espejo") ang = "tres-cuartos";
  const vista = vistaDe(rig, ang);
  // En perfil hacia la izquierda se espeja todo el personaje
  const espejo = vista.espejo || (ang === "perfil" && haciaIzq === true);
  // Los momentos de rey siempre llevan la corona; el resto solo pone su accesorio si no hay uno elegido
  const acc: Accesorio = mcfg?.accesorio && (accesorio === "ninguno" || mcfg.forzarAccesorio) ? mcfg.accesorio : accesorio;

  const movActivo = animado && !mcfg && mov !== "reposo" && pose !== "dormido" && pose !== "triste" ? mov : "reposo";
  const oscuro = DARK_COLORS.includes(col.primario);
  const accFill = col.primario === "yellow" || col.secundario === "yellow" ? "lime-soft" : "yellow";
  const label = `${nombre ?? rig.nombre}, ${mcfg ? MOMENTO_LABEL[momento!].toLowerCase() : `asistente de ${MODULO[id]}, ${EXPRESION_LABEL[pose].toLowerCase()}`}`;
  const c = cfg.cuerpo ?? {};
  const cuerpoT = `translate(${c.x ?? 0} ${c.y ?? 0}) rotate(${c.rot ?? 0} ${rig.cuerpo.cx} 184) translate(${rig.cuerpo.cx} 184) scale(${(c.sx ?? 1) * vista.cuerpoSx} ${c.sy ?? 1}) translate(${-rig.cuerpo.cx} -184)`;
  const ctx = { fino, mostrarProp: mostrarProp && momento !== "dormido", uid };
  const salto = mcfg ? !!mcfg.idleMov && ["rebota"].includes(mcfg.idleMov) : pose === "feliz" || pose === "celebrando";
  // Rig con la cara, los accesorios y los brazos ubicados según el ángulo
  const W = rig.cuerpo.w;
  const rigVista: Rig =
    ang === "frente"
      ? rig
      : {
          ...rig,
          ojos: vista.ojos as [Punto, Punto],
          boca: vista.boca,
          cabeza: { ...rig.cabeza, x: rig.cabeza.x + vista.caraDx * 0.5 },
          cuello: { ...rig.cuello, x: rig.cuello.x + vista.caraDx * 0.3 },
          hombros:
            vista.brazos === "uno"
              ? [
                  { x: rig.cuerpo.cx - W * 0.02, y: rig.hombros[0].y },
                  { x: rig.cuerpo.cx + W * 0.06, y: rig.hombros[1].y },
                ]
              : rig.hombros,
        };
  const cx = rig.cuerpo.cx;
  const figuraT = espejo ? `translate(${cx * 2} 0) scale(-1 1)` : undefined;
  const asomado = !!mcfg?.asomado;
  const slot =
    acc === "gafas" || acc === "gafas-sol" ? "eyes" : acc === "bufanda" || acc === "capa" ? "neck" : acc === "patines" ? "feet" : acc === "dedo-espuma" || acc === "helado" ? "hand" : "head";
  const cabezaLibre = acc === "ninguno" || slot !== "head";

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
        animado && mcfg?.idleMov && `asis-idle-${mcfg.idleMov}`,
        entrada && `asis-entrada-${entrada}`,
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
          {asomado ? (
            <clipPath id={`${uid}-borde`}>
              <rect x="-40" y="-60" width="280" height="210" />
            </clipPath>
          ) : null}
        </defs>
        {/* Sombra en el piso */}
        {asomado ? null : <ellipse className="f-floor asis-piso" cx={rig.cuerpo.cx} cy="190" rx={pose === "celebrando" ? rig.cuerpo.w * 0.32 : rig.cuerpo.w * 0.42} ry="6" />}
        <g clipPath={asomado ? `url(#${uid}-borde)` : undefined}>
        <g transform={asomado ? `translate(0 ${rig.cuerpo.h * 0.3})` : undefined}>
        <g className="asis-salto">
          <g className="asis-inclina">
            <g className="asis-mov">
              <g key={`${momento ?? pose}-${ang}`} className={mcfg ? "asis-entra-momento" : salto ? "asis-entra-salto" : "asis-entra"}>
                <g transform={figuraT}>
                {mcfg?.trono ? <Trono rig={rig} id={id} /> : null}
                <g className="asis-cuerpo">
                  <g transform={cuerpoT}>
                    {etapa >= 3 && !mcfg?.trono ? <circle data-capa="aura" className="f-yellow-soft" opacity="0.6" cx={rig.cuerpo.cx} cy={rig.cuerpo.top + rig.cuerpo.h / 2} r={rig.cuerpo.w * 0.66} /> : null}
                    {oscuro ? <circle className="f-halo" cx={rig.cuerpo.cx} cy={rig.cuerpo.top + rig.cuerpo.h / 2} r={rig.cuerpo.w * 0.6} /> : null}
                    {acc === "capa" ? <CapaAtras rig={rigVista} /> : null}
                    {vista.atrasEncima ? null : (
                      <g transform={vista.atrasDx ? `translate(${vista.atrasDx} 0)` : undefined}>
                        {rig.atras(ctx)}
                        <RasgoAtras id={id} n={etapa} ctx={ctx} trono={!!mcfg?.trono} />
                      </g>
                    )}
                    {vista.brazos === "atras" ? <Brazos rig={rigVista} cfg={cfg} /> : null}
                    {/* Pies */}
                    <g data-capa="feet" transform={vista.piesDx ? `translate(${vista.piesDx} 0)` : undefined}>
                      {rig.pies.map((p, i) => (
                        <ellipse key={i} className={rig.pie} cx={p.x} cy={p.y} rx="15" ry="7" />
                      ))}
                    </g>
                    {/* Cuerpo con sombra baja del mismo color */}
                    <g data-capa="body">
                      <path className="f-p" d={bloque(rig.cuerpo)} />
                      <g clipPath={`url(#${uid}-cuerpo)`}>
                        <ellipse className="f-ps" cx={rig.cuerpo.cx + rig.cuerpo.w * 0.2} cy={rig.cuerpo.top + rig.cuerpo.h + 8} rx={rig.cuerpo.w * 0.78} ry={rig.cuerpo.h * 0.36} />
                        {/* Girado: el costado lejano queda en el tono de sombra (el volumen se lee sin contorno) */}
                        {ang === "tres-cuartos" || ang === "tres-cuartos-espejo" || ang === "perfil" ? (
                          <ellipse
                            className="f-ps"
                            cx={ang === "perfil" ? rig.cuerpo.cx - rig.cuerpo.w * 0.72 : rig.cuerpo.cx + rig.cuerpo.w * 0.72}
                            cy={rig.cuerpo.top + rig.cuerpo.h * 0.55}
                            rx={rig.cuerpo.w * 0.27}
                            ry={rig.cuerpo.h * 0.78}
                          />
                        ) : null}
                      </g>
                    </g>
                    {vista.cara ? (
                      vista.frenteDx ? (
                        <g clipPath={`url(#${uid}-cuerpo)`}>
                          <g transform={`translate(${vista.frenteDx} 0)`}>
                            {rig.frente(ctx)}
                            <RasgoFrente id={id} n={etapa} />
                          </g>
                        </g>
                      ) : (
                        <>
                          {rig.frente(ctx)}
                          <g clipPath={`url(#${uid}-cuerpo)`}>
                            <RasgoFrente id={id} n={etapa} />
                          </g>
                        </>
                      )
                    ) : null}
                    {vista.cara ? (
                      <g data-capa="face">
                        <Ojos rig={rigVista} cfg={cfg} mirada={mirada} uid={uid} oscuro={oscuro} escalas={vista.escOjos} />
                        <BocaSvg rig={rigVista} boca={cfg.boca} oscuro={oscuro} />
                      </g>
                    ) : null}
                    {vista.cara ? <g transform={vista.frenteDx ? `translate(${vista.frenteDx * 0.6} 0)` : undefined}>{rig.propDelante?.(ctx)}</g> : null}
                    {vista.atrasEncima ? (
                      <g transform={rig.espaldaDx ? `translate(${rig.espaldaDx} 0)` : undefined}>
                        {rig.atras(ctx)}
                        <RasgoAtras id={id} n={etapa} ctx={ctx} trono={!!mcfg?.trono} />
                      </g>
                    ) : null}
                    {vista.brazos !== "atras" ? <Brazos rig={rigVista} cfg={cfg} uno={vista.brazos === "uno"} /> : null}
                    {acc !== "ninguno" && !(slot === "eyes" && !vista.cara) ? (
                      <g data-capa={`slot-${slot}`}>
                        <AccesorioSvg rig={rigVista} acc={acc} />
                      </g>
                    ) : null}
                    {cabezaLibre ? <RasgoCabeza id={id} n={etapa} rig={rigVista} /> : null}
                    {etapa >= 3 && cabezaLibre ? <CoronitaRey rig={rigVista} dy={alturaCorona(id, cabezaLibre)} /> : null}
                    {asomado ? <Manos rig={rig} /> : null}
                  </g>
                </g>
                {fx && cfg.fx?.length ? <Efectos rig={rigVista} fx={cfg.fx} /> : null}
                </g>
              </g>
            </g>
          </g>
        </g>
        </g>
        </g>
      </svg>
    </span>
  );
}

/* ═════════ Fase 5: crecimiento, trono y capa ═════════ */
const estrella4 = (cx: number, cy: number, k: number) =>
  `M${cx} ${cy - k} Q${cx + k * 0.22} ${cy - k * 0.22} ${cx + k} ${cy} Q${cx + k * 0.22} ${cy + k * 0.22} ${cx} ${cy + k} Q${cx - k * 0.22} ${cy + k * 0.22} ${cx - k} ${cy} Q${cx - k * 0.22} ${cy - k * 0.22} ${cx} ${cy - k} Z`;

/** Rey: corona pequeña ladeada (cuando la cabeza no lleva otro accesorio) */
function CoronitaRey({ rig, dy = 0 }: { rig: Rig; dy?: number }) {
  const { x, w } = rig.cabeza;
  const y = rig.cabeza.y + dy;
  const cx = x + w * 0.2;
  return (
    <g data-capa="corona-rey" transform={`rotate(14 ${cx} ${y})`}>
      <path className="f-yellow-shade" d={`M${cx - 12} ${y + 2} L${cx - 13} ${y - 12} L${cx - 6} ${y - 5} L${cx} ${y - 15} L${cx + 6} ${y - 5} L${cx + 13} ${y - 12} L${cx + 12} ${y + 2} Z`} />
      <path className="f-yellow" d={`M${cx - 12} ${y} L${cx - 13} ${y - 14} L${cx - 6} ${y - 7} L${cx} ${y - 17} L${cx + 6} ${y - 7} L${cx + 13} ${y - 14} L${cx + 12} ${y} Z`} />
      <circle className="f-lime" cx={cx} cy={y - 6} r="2.4" />
    </g>
  );
}

/** Capa (clóset, racha de 100): cae detrás del cuerpo desde los hombros */
function CapaAtras({ rig }: { rig: Rig }) {
  const { cx, w } = rig.cuerpo;
  const y0 = rig.hombros[0].y - 6;
  return (
    <g data-capa="capa">
      <path className="f-accs" d={`M${cx - w * 0.36} ${y0} L${cx + w * 0.36} ${y0} L${cx + w * 0.62} 182 Q${cx + w * 0.31} 176 ${cx} 182 Q${cx - w * 0.31} 176 ${cx - w * 0.62} 182 Z`} />
    </g>
  );
}

/** Trono propio de cada personaje: respaldo alto en punta, asiento con cojín y un adorno de su módulo */
const TRONOS: Record<AsistenteId, { marco: string; panel: string; cojin: string }> = {
  centavo: { marco: "f-yellow-shade", panel: "f-cream", cojin: "f-lime" },
  brote: { marco: "f-sand-shade", panel: "f-sand", cojin: "f-lime" },
  tuerca: { marco: "f-sand-shade", panel: "f-cream", cojin: "f-lime" },
  tic: { marco: "f-charcoal", panel: "f-gray", cojin: "f-lime" },
  cima: { marco: "f-gray", panel: "f-cream-shade", cojin: "f-lime" },
  antojo: { marco: "f-charcoal", panel: "f-cream", cojin: "f-lime" },
};

function Trono({ rig, id }: { rig: Rig; id: AsistenteId }) {
  const { cx, w, top } = rig.cuerpo;
  const t = TRONOS[id];
  const ancho = w * 0.7;
  const yTop = top - 26;
  return (
    <g data-capa="trono">
      <path
        className={t.marco}
        d={`M${cx - ancho} 176 L${cx - ancho} ${yTop + 14} Q${cx - ancho} ${yTop} ${cx - ancho + 14} ${yTop} L${cx - 22} ${yTop} L${cx} ${top - 62} L${cx + 22} ${yTop} L${cx + ancho - 14} ${yTop} Q${cx + ancho} ${yTop} ${cx + ancho} ${yTop + 14} L${cx + ancho} 176 Z`}
      />
      <rect className={t.panel} x={cx - ancho + 9} y={yTop + 9} width={ancho * 2 - 18} height={176 - yTop - 18} rx="12" />
      <rect className={t.marco} x={cx - w * 0.8} y="160" width={w * 1.6} height="24" rx="10" />
      <rect className={t.cojin} x={cx - w * 0.74} y="156" width={w * 1.48} height="12" rx="6" />
      <AdornoTrono id={id} x={cx} y={top - 40} />
    </g>
  );
}

function AdornoTrono({ id, x, y }: { id: AsistenteId; x: number; y: number }) {
  switch (id) {
    case "centavo":
      return (
        <g>
          <circle className="f-yellow-shade" cx={x} cy={y} r="11" />
          <circle className="f-yellow-soft" cx={x} cy={y} r="7.5" />
          <path className="f-yellow-shade" d={estrella4(x, y, 4.5)} />
        </g>
      );
    case "brote":
      return (
        <g>
          <ellipse className="f-lime" cx={x - 6} cy={y} rx="8" ry="4.5" transform={`rotate(-30 ${x - 6} ${y})`} />
          <ellipse className="f-lime-shade" cx={x + 6} cy={y} rx="8" ry="4.5" transform={`rotate(30 ${x + 6} ${y})`} />
        </g>
      );
    case "tuerca":
      return (
        <g>
          {[0, 45, 90, 135].map((a) => (
            <rect key={a} className="f-gray" x={x - 2.5} y={y - 12} width="5" height="24" rx="1.5" transform={`rotate(${a} ${x} ${y})`} />
          ))}
          <circle className="f-gray" cx={x} cy={y} r="8.5" />
          <circle className="f-cream" cx={x} cy={y} r="3.5" />
        </g>
      );
    case "tic":
      return (
        <g>
          <circle className="f-white" cx={x} cy={y} r="10.5" />
          <rect className="f-charcoal" x={x - 1.2} y={y - 7} width="2.4" height="8" rx="1.2" />
          <rect className="f-charcoal" x={x - 1.2} y={y - 1.2} width="6" height="2.4" rx="1.2" />
        </g>
      );
    case "cima":
      return (
        <g>
          <path className="f-sand-shade" d={`M${x - 12} ${y + 8} L${x} ${y - 10} L${x + 12} ${y + 8} Z`} />
          <path className="f-white" d={`M${x - 4.6} ${y - 3} L${x} ${y - 10} L${x + 4.6} ${y - 3} Z`} />
        </g>
      );
    case "antojo":
      return (
        <g>
          <rect className="f-lime" x={x - 9} y={y - 7} width="18" height="15" rx="3" />
          <rect className="f-yellow" x={x - 1.8} y={y - 7} width="3.6" height="15" />
          <rect className="f-yellow" x={x - 9} y={y - 1.5} width="18" height="3.6" />
        </g>
      );
  }
}

/* ═════════ Brazos en óvalo, en el tono de sombra (como alas) ═════════ */
/** Manos sobre el borde de la tarjeta (momento "asomado") */
function Manos({ rig }: { rig: Rig }) {
  const y = 150 - rig.cuerpo.h * 0.3 - 2;
  const { cx, w } = rig.cuerpo;
  return (
    <g data-capa="hands">
      <ellipse className="f-ps" cx={cx - w * 0.26} cy={y} rx={rig.brazo.rx} ry={rig.brazo.rx * 0.8} />
      <ellipse className="f-ps" cx={cx + w * 0.26} cy={y} rx={rig.brazo.rx} ry={rig.brazo.rx * 0.8} />
    </g>
  );
}

function Brazos({ rig, cfg, uno }: { rig: Rig; cfg: PoseCfg; uno?: boolean }) {
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
      {uno ? null : brazo(L, aL, k)}
      {brazo(R, -aR, k)}
    </g>
  );
}

/* ═════════ Ojos grandes: esclerótica blanca, pupila oscura, brillos, párpado y ceja de color ═════════ */
function Ojos({ rig, cfg, mirada, uid, oscuro, escalas }: { rig: Rig; cfg: PoseCfg; mirada: Punto; uid: string; oscuro: boolean; escalas?: number[] }) {
  const o = cfg.ojos;
  const r = rig.rOjo * (o.grande ? 1.14 : 1);
  const ry = r * 1.08;
  // Ojos en arco: blancos si van sobre un cuerpo oscuro o sobre el antifaz
  const tinta = oscuro || rig.parpado === "d" ? "var(--char-white)" : "var(--char-ink)";
  const trazo = (d: string, k: number) => <path key={k} d={d} style={{ fill: "none", stroke: tinta, strokeWidth: r * 0.34, strokeLinecap: "round" }} />;
  // En tres cuartos el ojo lejano se angosta (escala horizontal alrededor de su centro)
  const esc = (p: Punto, i: number) => {
    const e = escalas?.[i] ?? 1;
    return e === 1 ? undefined : `translate(${p.x} ${p.y}) scale(${e} 1) translate(${-p.x} ${-p.y})`;
  };
  const arcoFeliz = (p: Punto) => `M${p.x - r * 0.75} ${p.y + 3} Q${p.x} ${p.y - r * 0.85} ${p.x + r * 0.75} ${p.y + 3}`;

  if (o.modo === "feliz") {
    return <g>{rig.ojos.map((p, i) => <g key={i} transform={esc(p, i)}>{trazo(arcoFeliz(p), i)}</g>)}</g>;
  }
  if (o.modo === "cerrado") {
    return <g>{rig.ojos.map((p, i) => <g key={i} transform={esc(p, i)}>{trazo(`M${p.x - r * 0.75} ${p.y} Q${p.x} ${p.y + r * 0.6} ${p.x + r * 0.75} ${p.y}`, i)}</g>)}</g>;
  }
  // Ojos de estrella (eufórico) y de corazón (enamorado): la forma ocupa todo el ojo
  if (o.modo === "estrella" || o.modo === "corazon") {
    return (
      <g data-capa="eyes-special">
        {rig.ojos.map((p, i) => (
          <g key={i} transform={esc(p, i)}>
            {/* El blanco del ojo de siempre, para que la forma se lea sobre cualquier color de cuerpo */}
            <ellipse className="f-white" cx={p.x} cy={p.y} rx={r} ry={ry} />
            {o.modo === "estrella" ? (
              <>
                <path className="f-yellow-shade" d={estrella(p.x, p.y + 1.5, r * 0.92)} />
                <path className="f-yellow" d={estrella(p.x, p.y, r * 0.86)} />
                <circle className="f-white" cx={p.x + r * 0.28} cy={p.y - r * 0.3} r={r * 0.18} />
              </>
            ) : (
              <>
                <path className="f-lime-shade" d={corazon(p.x, p.y + 1.5, r * 0.78)} />
                <path className="f-lime" d={corazon(p.x, p.y, r * 0.74)} />
                <circle className="f-white" cx={p.x - r * 0.3} cy={p.y - r * 0.25} r={r * 0.17} />
              </>
            )}
          </g>
        ))}
      </g>
    );
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
          // Guiño: el ojo derecho se cierra en arco
          if (o.modo === "guino" && i === 1) return <g key={i} transform={esc(p, i)}>{trazo(arcoFeliz(p), i)}</g>;
          const pr = r * (o.modo === "llorando" ? 0.62 : o.modo === "sorprendido" ? 0.3 : 0.55);
          const px = p.x + mx * r * 0.32;
          const py = p.y + my * r * 0.3;
          const tapa = o.tapa ?? 0;
          return (
            <g key={i} transform={esc(p, i)}>
              {o.modo === "pestanas" ? (
                <path
                  d={`M${p.x - r * 0.7 * lado} ${p.y - ry * 0.85} l${-5 * lado} -6 M${p.x - r * 0.95 * lado} ${p.y - ry * 0.45} l${-7 * lado} -3 M${p.x - r * 0.25 * lado} ${p.y - ry * 1.02} l${-3 * lado} -7`}
                  style={{ fill: "none", stroke: tinta, strokeWidth: 2.6, strokeLinecap: "round" }}
                />
              ) : null}
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
    const abierto = boca === "abierta" || boca === "o" || boca === "o-grande" || boca === "gritando" || boca === "lengua";
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
  const linea = { fill: "none", stroke: tinta, strokeWidth: 4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (boca) {
    case "lengua":
      return (
        <g>
          <path d={`M${x - 8} ${y - 1} Q${x} ${y + 6} ${x + 8} ${y - 1}`} style={linea} />
          <path className="f-ps" d={`M${x - 4} ${y + 3} L${x + 4} ${y + 3} L${x + 4} ${y + 8} A4 4 0 0 1 ${x - 4} ${y + 8} Z`} />
        </g>
      );
    case "silbando":
      return <ellipse className="f-ink" cx={x + 5} cy={y + 1} rx="3.2" ry="3.6" />;
    case "temblorosa":
      return <path d={`M${x - 9} ${y + 2} l3 -3 l3 3 l3 -3 l3 3 l3 -3`} style={{ ...linea, strokeWidth: 3.4 }} />;
    case "gritando":
      return (
        <g>
          <path className="f-ink" d={`M${x - 15} ${y - 5} Q${x} ${y - 7} ${x + 15} ${y - 5} Q${x + 14} ${y + 19} ${x} ${y + 20} Q${x - 14} ${y + 19} ${x - 15} ${y - 5} Z`} />
          <rect className="f-white" x={x - 9} y={y - 5} width="18" height="4" rx="2" />
          <ellipse className="f-ps" cx={x} cy={y + 13} rx="8" ry="4.5" />
        </g>
      );
    case "o-grande":
      return <ellipse className="f-ink" cx={x} cy={y + 4} rx="7" ry="9" />;
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

/** Herramienta de cada asistente (momento "trabajando"), en la mano cercana */
function Herramienta({ rig }: { rig: Rig }) {
  const { cx, top, w, h } = rig.cuerpo;
  const x = cx + w * 0.16;
  const y = top + h * 0.62;
  switch (rig.nombre) {
    case "Centavo": // calculadora
      return (
        <g>
          <rect className="f-charcoal" x={x - 13} y={y - 16} width="26" height="32" rx="5" />
          <rect className="f-lime-soft" x={x - 9} y={y - 12} width="18" height="7" rx="2" style={{ fill: "var(--char-lime-soft)" }} />
          {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} className="f-gray" x={x - 9 + c * 6.5} y={y - 1 + r * 5.5} width="4.5" height="3.6" rx="1" />))}
        </g>
      );
    case "Tuerca": // martillo
      return (
        <g transform={`rotate(-30 ${x} ${y})`}>
          <rect className="f-sand-shade" x={x - 3} y={y - 10} width="6" height="34" rx="3" />
          <rect className="f-charcoal" x={x - 13} y={y - 18} width="26" height="11" rx="3" />
        </g>
      );
    case "Tic": // reloj de arena
      return (
        <g>
          <rect className="f-sand-shade" x={x - 12} y={y - 18} width="24" height="5" rx="2" />
          <rect className="f-sand-shade" x={x - 12} y={y + 13} width="24" height="5" rx="2" />
          <path className="f-white" d={`M${x - 9} ${y - 13} L${x + 9} ${y - 13} L${x + 1.5} ${y} L${x + 9} ${y + 13} L${x - 9} ${y + 13} L${x - 1.5} ${y} Z`} />
          <path className="f-yellow" d={`M${x - 5} ${y + 13} L${x + 5} ${y + 13} L${x} ${y + 6} Z`} />
        </g>
      );
    case "Cima": // mapa doblado
      return (
        <g>
          <path className="f-cream" d={`M${x - 18} ${y - 12} l12 -4 l12 4 l12 -4 v26 l-12 4 l-12 -4 l-12 4 Z`} />
          <path className="f-cream-shade" d={`M${x - 6} ${y - 16} l12 4 v26 l-12 -4 Z`} />
          <path className="t" style={{ "--tc": "var(--char-lime)", strokeWidth: 2.5 } as React.CSSProperties} d={`M${x - 14} ${y + 4} q8 -10 16 -2 t14 -6`} />
        </g>
      );
    case "Brote": // regadera
      return (
        <g>
          <rect className="f-lime" x={x - 12} y={y - 8} width="22" height="20" rx="5" />
          <path className="f-lime-shade" d={`M${x + 8} ${y - 2} L${x + 24} ${y - 12} L${x + 26} ${y - 8} L${x + 10} ${y + 4} Z`} />
          <path className="t" style={{ "--tc": "var(--char-lime-shade)", strokeWidth: 3 } as React.CSSProperties} d={`M${x - 10} ${y - 8} Q${x - 1} ${y - 20} ${x + 8} ${y - 8}`} />
        </g>
      );
    default: // Antojo: lista de deseos en una tablilla
      return (
        <g>
          <rect className="f-sand-shade" x={x - 13} y={y - 17} width="26" height="34" rx="4" />
          <rect className="f-white" x={x - 10} y={y - 12} width="20" height="26" rx="2" />
          <rect className="f-charcoal" x={x - 5} y={y - 20} width="10" height="6" rx="2" />
          {[0, 1, 2].map((r) => (
            <rect key={r} className="f-gray" x={x - 7} y={y - 7 + r * 7} width="14" height="2.6" rx="1.3" />
          ))}
        </g>
      );
  }
}

function Efectos({ rig, fx }: { rig: Rig; fx: Fx[] }) {
  const { cx, top, w, h } = rig.cuerpo;
  const a = rig.ojos[0];
  const b = rig.ojos[1] ?? rig.ojos[0];
  return (
    <g data-capa="fx" className="fx">
      {fx.includes("confeti") ? (
        <g className="fx fx-confeti">
          {[
            [-0.62, -0.1, "f-lime", 20],
            [-0.46, -0.32, "f-yellow", -30],
            [-0.2, -0.46, "f-charcoal", 45],
            [0.18, -0.5, "f-lime", -15],
            [0.44, -0.36, "f-yellow", 35],
            [0.64, -0.12, "f-charcoal", -40],
            [-0.7, 0.2, "f-yellow", 60],
            [0.72, 0.18, "f-lime", 10],
          ].map(([kx, ky, cls, rot], i) => (
            <rect key={i} className={cls as string} x={cx + w * (kx as number) - 3} y={top + h * (ky as number) - 6} width="6" height="11" rx="2" transform={`rotate(${rot} ${cx + w * (kx as number)} ${top + h * (ky as number)})`} />
          ))}
        </g>
      ) : null}
      {fx.includes("exclamacion") ? (
        <g className="fx fx-exclamacion">
          <rect className="f-yellow" x={cx + w / 2 + 2} y={top - 26} width="9" height="24" rx="4.5" />
          <circle className="f-yellow" cx={cx + w / 2 + 6.5} cy={top + 6} r="5" />
        </g>
      ) : null}
      {fx.includes("pensamiento") ? (
        <g className="fx fx-pensamiento" style={{ fill: "var(--char-gray-light)" }}>
          <circle cx={cx + w / 2 - 6} cy={top - 4} r="4" />
          <circle cx={cx + w / 2 + 4} cy={top - 16} r="6" />
          <ellipse cx={cx + w / 2 + 22} cy={top - 38} rx="22" ry="15" />
          <circle cx={cx + w / 2 + 8} cy={top - 44} r="11" />
          <circle cx={cx + w / 2 + 34} cy={top - 46} r="12" />
        </g>
      ) : null}
      {fx.includes("velocidad") ? (
        <g className="fx fx-velocidad">
          {[0.28, 0.46, 0.64].map((k, i) => (
            <rect key={i} className="f-gray" opacity="0.5" x={cx - w / 2 - 34 + i * 6} y={top + h * k} width={26 - i * 4} height="5" rx="2.5" />
          ))}
        </g>
      ) : null}
      {fx.includes("corazon-grande") ? (
        <g className="fx fx-corazon-grande">
          <path className="f-lime-shade" d={corazon(cx, top + h * 0.72 + 2, 24)} />
          <path className="f-lime" d={corazon(cx, top + h * 0.72, 23)} />
        </g>
      ) : null}
      {fx.includes("herramienta") ? <Herramienta rig={rig} /> : null}
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
  const a = rig.ojos[0];
  const b = rig.ojos[1] ?? rig.ojos[0];
  const r = rig.rOjo + 5;
  /* ── Accesorios de situación ── */
  if (acc === "gafas-sol") {
    const t = { "--tc": "var(--char-charcoal)", strokeWidth: 4 } as React.CSSProperties;
    return (
      <g>
        <ellipse className="f-charcoal" cx={a.x} cy={a.y} rx={r} ry={r * 0.82} />
        {b !== a ? <ellipse className="f-charcoal" cx={b.x} cy={b.y} rx={r} ry={r * 0.82} /> : null}
        <rect className="f-white" opacity="0.35" x={a.x - r * 0.55} y={a.y - r * 0.5} width={r * 0.5} height={r * 0.22} rx={r * 0.11} transform={`rotate(-20 ${a.x} ${a.y})`} />
        {b !== a ? <path className="t" style={t} d={`M${a.x + r} ${a.y - 2} Q${(a.x + b.x) / 2} ${a.y - 6} ${b.x - r} ${b.y - 2}`} /> : null}
      </g>
    );
  }
  if (acc === "chef" || acc === "fedora" || acc === "corona") {
    const { x, y, w } = rig.cabeza;
    const half = w / 2 - 6;
    if (acc === "chef")
      return (
        <g>
          <circle className="f-white" cx={x - half * 0.55} cy={y - 26} r={half * 0.5} />
          <circle className="f-white" cx={x + half * 0.55} cy={y - 26} r={half * 0.5} />
          <circle className="f-white" cx={x} cy={y - 36} r={half * 0.6} />
          <rect className="f-white" x={x - half * 0.8} y={y - 26} width={half * 1.6} height={26} rx={4} />
          <rect style={{ fill: "var(--char-white-shade)" }} x={x - half * 0.85} y={y - 4} width={half * 1.7} height={10} rx={4} />
        </g>
      );
    if (acc === "fedora")
      return (
        <g>
          <ellipse className="f-charcoal" cx={x} cy={y + 2} rx={half + 10} ry={7} />
          <path className="f-charcoal" d={`M${x - half * 0.7} ${y + 1} Q${x - half * 0.75} ${y - 30} ${x} ${y - 26} Q${x + half * 0.75} ${y - 30} ${x + half * 0.7} ${y + 1} Z`} />
          <rect className="f-lime" x={x - half * 0.72} y={y - 8} width={half * 1.44} height={6} rx={2} />
        </g>
      );
    return (
      <g>
        <path className="f-yellow-shade" d={`M${x - half * 0.75} ${y + 2} L${x - half * 0.8} ${y - 20} L${x - half * 0.35} ${y - 8} L${x} ${y - 26} L${x + half * 0.35} ${y - 8} L${x + half * 0.8} ${y - 20} L${x + half * 0.75} ${y + 2} Z`} />
        <path className="f-yellow" d={`M${x - half * 0.75} ${y} L${x - half * 0.8} ${y - 22} L${x - half * 0.35} ${y - 10} L${x} ${y - 28} L${x + half * 0.35} ${y - 10} L${x + half * 0.8} ${y - 22} L${x + half * 0.75} ${y} Z`} />
        <circle className="f-lime" cx={x} cy={y - 8} r={3.5} />
      </g>
    );
  }
  if (acc === "helado") {
    const [, R] = rig.hombros;
    const x = R.x + 8;
    const y = R.y + 2;
    return (
      <g transform={`rotate(10 ${x} ${y})`}>
        <path className="f-sand-shade" d={`M${x - 8} ${y - 4} L${x + 8} ${y - 4} L${x} ${y + 20} Z`} />
        <circle className="f-white" cx={x - 4} cy={y - 9} r="7" />
        <circle className="f-lime" cx={x + 4} cy={y - 10} r="7" />
        <circle className="f-yellow" cx={x} cy={y - 17} r="6.5" />
      </g>
    );
  }
  if (acc === "capa") {
    const { x, y } = rig.cuello;
    return (
      <g>
        <circle className="f-acc" cx={x - 9} cy={y - 2} r="5" />
        <circle className="f-acc" cx={x + 9} cy={y - 2} r="5" />
      </g>
    );
  }
  if (acc === "gorro-navidad") {
    const { x, y, w } = rig.cabeza;
    const half = w / 2 - 4;
    return (
      <g>
        <path className="f-lime" d={`M${x - half} ${y + 2} Q${x - half * 0.4} ${y - w * 0.62} ${x + half * 0.9} ${y - w * 0.42} Q${x + half * 0.5} ${y - w * 0.2} ${x + half} ${y + 2} Z`} />
        <rect className="f-white" x={x - half - 3} y={y - 4} width={half * 2 + 6} height={13} rx={6.5} />
        <circle className="f-white" cx={x + half * 0.92} cy={y - w * 0.42} r={7} />
      </g>
    );
  }
  if (acc === "dedo-espuma") {
    const [, R] = rig.hombros;
    const x = R.x + 6;
    const y = R.y - 6;
    return (
      <g transform={`rotate(14 ${x} ${y})`}>
        <rect className="f-lime" x={x - 12} y={y - 6} width="24" height="30" rx="8" />
        <rect className="f-lime" x={x - 5} y={y - 32} width="11" height="30" rx="5.5" />
        <rect className="f-lime-shade" x={x - 12} y={y + 14} width="24" height="10" rx="5" />
      </g>
    );
  }
  if (acc === "patines") {
    return (
      <g>
        {rig.pies.map((p, i) => (
          <g key={i}>
            <rect className="f-charcoal" x={p.x - 17} y={p.y + 3} width="34" height="6" rx="3" />
            <circle className="f-lime" cx={p.x - 10} cy={p.y + 12} r="4" />
            <circle className="f-lime" cx={p.x + 10} cy={p.y + 12} r="4" />
          </g>
        ))}
      </g>
    );
  }
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
