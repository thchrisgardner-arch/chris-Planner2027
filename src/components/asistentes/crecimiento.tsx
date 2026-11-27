/**
 * Rasgos de crecimiento propios de cada asistente (Fase 5). La etapa "inicial" es el dibujo de
 * siempre; cada etapa siguiente solo SUMA piezas encima, sin cambiar forma, tamaño ni colores base.
 *
 *   Centavo  moneda suelta → pila de monedas → alcancía (y la pila al otro lado)
 *   Brote    planta pequeña → arbolito con flor → arbolito con dos flores
 *   Tuerca   cinturón de herramientas → casco de obra → (corona sobre el casco)
 *   Tic      cresta más grande → cola corta → cola completa
 *   Cima     cuernos más largos → cuernos en espiral y bandera más grande → estrella en la bandera
 *   Antojo   más anillos en la cola → bolsa de diseñador → gafas de sol en la cabeza
 *
 * El Rey suma además su corona (CoronitaRey, en Asistente.tsx).
 * Mismo estilo que el resto: formas planas, dos tonos por color, sin contorno.
 */
import type { CSSProperties } from "react";
import type { AsistenteId } from "@/lib/asistentes/tipos";
import type { Ctx, Rig } from "./figuras";

/** 0 inicial · 1 crece · 2 experto · 3 rey */
type Nivel = number;

const linea = (tc: string, w: number): CSSProperties => ({ "--tc": tc, strokeWidth: w, strokeLinecap: "round" }) as CSSProperties;

const estrella4 = (cx: number, cy: number, k: number) =>
  `M${cx} ${cy - k} Q${cx + k * 0.22} ${cy - k * 0.22} ${cx + k} ${cy} Q${cx + k * 0.22} ${cy + k * 0.22} ${cx} ${cy + k} Q${cx - k * 0.22} ${cy + k * 0.22} ${cx - k} ${cy} Q${cx - k * 0.22} ${cy - k * 0.22} ${cx} ${cy - k} Z`;

/* ───────── Centavo ───────── */
function MonedaDePie({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g>
      <circle className="f-yellow-shade" cx={x} cy={y + 1.5} r={r} />
      <circle className="f-yellow" cx={x - 1} cy={y} r={r * 0.8} />
      <path className="f-yellow-shade" d={estrella4(x - 1, y, r * 0.46)} />
    </g>
  );
}

function PilaMonedas({ x, base, n }: { x: number; base: number; n: number }) {
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const y = base - i * 6;
        return (
          <g key={i} transform={i % 2 ? `translate(${i % 4 === 1 ? 1.5 : -1.5} 0)` : undefined}>
            <rect className="f-yellow-shade" x={x - 14} y={y - 7} width="28" height="7" rx="3.5" />
            <ellipse className="f-yellow" cx={x} cy={y - 7} rx="14" ry="3.5" />
          </g>
        );
      })}
    </g>
  );
}

function Alcancia({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect className="f-cream-shade" x={x - 13} y={y + 6} width="6" height="12" rx="3" />
      <rect className="f-cream-shade" x={x + 5} y={y + 6} width="6" height="12" rx="3" />
      <ellipse className="f-cream-shade" cx={x} cy={y} rx="19" ry="14" />
      <ellipse className="f-cream" cx={x - 2} cy={y - 3} rx="16" ry="10.5" />
      <path className="f-cream-shade" d={`M${x - 11} ${y - 12} L${x - 7} ${y - 22} L${x - 1} ${y - 13} Z`} />
      <ellipse className="f-cream-shade" cx={x - 18} cy={y - 1} rx="4.5" ry="6" />
      <circle className="f-ink" cx={x - 19} cy={y - 3} r="1.1" />
      <circle className="f-ink" cx={x - 19} cy={y + 1} r="1.1" />
      <circle className="f-ink" cx={x - 10} cy={y - 5} r="1.8" />
      <rect className="f-ink" x={x - 3} y={y - 15} width="10" height="2.6" rx="1.3" />
      <circle className="f-yellow-shade" cx={x + 2} cy={y - 21} r="5.5" />
      <circle className="f-yellow" cx={x + 1.5} cy={y - 21.5} r="4" />
    </g>
  );
}

function CentavoAtras({ n, trono }: { n: Nivel; trono: boolean }) {
  if (trono) return null; // en el trono no hay piso a los lados
  if (n === 1) return <MonedaDePie x={22} y={173} r={13} />;
  if (n === 2) return <PilaMonedas x={22} base={186} n={5} />;
  return (
    <>
      <Alcancia x={24} y={168} />
      <PilaMonedas x={180} base={186} n={3} />
    </>
  );
}

/* ───────── Brote ───────── */
function Flor({ x, y }: { x: number; y: number }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} className="f-white" cx={x + Math.cos((a * Math.PI) / 180) * 4.2} cy={y + Math.sin((a * Math.PI) / 180) * 4.2} r="3.3" />
      ))}
      <circle className="f-yellow" cx={x} cy={y} r="3" />
    </g>
  );
}

function BroteAtras({ n }: { n: Nivel }) {
  if (n === 1)
    return (
      <g>
        <path className="t" style={linea("var(--char-lime-shade)", 5)} d="M150 72 Q150 46 160 26" />
        <ellipse className="f-lime" cx="148" cy="32" rx="12" ry="6.5" transform="rotate(-30 148 32)" />
        <ellipse className="f-lime-shade" cx="172" cy="26" rx="12" ry="6.5" transform="rotate(22 172 26)" />
        <ellipse className="f-lime" cx="160" cy="20" rx="5" ry="8" />
      </g>
    );
  return (
    <g>
      <path className="f-sand-shade" d="M146 74 Q150 58 152 42 L162 42 Q160 58 160 74 Z" />
      <circle className="f-lime-shade" cx="157" cy="34" r="19" />
      <circle className="f-lime" cx="150" cy="29" r="14" />
      <circle className="f-lime" cx="166" cy="28" r="12" />
      <circle className="f-lime" cx="158" cy="20" r="11" />
      <Flor x={166} y={26} />
      {n >= 3 ? <Flor x={146} y={36} /> : null}
    </g>
  );
}

/* ───────── Tuerca ───────── */
function TuercaFrente() {
  // Cinturón de herramientas a la altura de la cadera (debajo de los brazos cruzados)
  return (
    <g>
      <rect className="f-sand-shade" x="30" y="161" width="130" height="10" />
      <rect className="f-yellow" x="88" y="159" width="14" height="14" rx="3" />
      <rect className="f-yellow-shade" x="92" y="163" width="6" height="6" rx="1.5" />
      <rect className="f-sand" x="58" y="166" width="15" height="15" rx="3" />
      <rect className="f-sand-shade" x="58" y="166" width="15" height="5" rx="2" />
      <rect className="f-charcoal" x="62" y="157" width="4" height="10" rx="2" />
      <rect className="f-charcoal" x="122" y="168" width="4" height="12" rx="2" />
      <rect className="f-gray" x="118.5" y="164" width="11" height="6" rx="2" />
    </g>
  );
}

function CascoObra({ rig }: { rig: Rig }) {
  const { x, y } = rig.cabeza;
  return (
    <g>
      <path className="f-yellow" d={`M${x - 34} ${y} Q${x - 34} ${y - 34} ${x} ${y - 34} Q${x + 34} ${y - 34} ${x + 34} ${y} Z`} />
      <path className="f-yellow-shade" d={`M${x + 8} ${y - 33} Q${x + 34} ${y - 30} ${x + 34} ${y} L${x + 18} ${y} Q${x + 20} ${y - 20} ${x + 8} ${y - 33} Z`} />
      <rect className="f-yellow-shade" x={x - 5} y={y - 34} width="10" height="34" rx="4" />
      <rect className="f-yellow-shade" x={x - 42} y={y - 4} width="84" height="8" rx="4" />
    </g>
  );
}

/* ───────── Tic ───────── */
function TicAtras({ n }: { n: Nivel }) {
  return (
    <g>
      {n >= 3 ? (
        <g>
          <path className="t" style={linea("var(--a-primary-shade)", 10)} d="M148 120 Q172 86 160 48" />
          <path className="t" style={linea("var(--a-detail)", 11)} d="M150 128 Q186 98 180 56" />
          <path className="t" style={linea("var(--a-primary)", 11)} d="M150 136 Q192 122 196 84" />
          <path className="t" style={linea("var(--a-detail-shade)", 10)} d="M150 144 Q196 144 198 110" />
        </g>
      ) : n === 2 ? (
        <g>
          <path className="t" style={linea("var(--a-detail)", 10)} d="M154 120 Q182 104 180 76" />
          <path className="t" style={linea("var(--a-primary)", 10)} d="M154 130 Q190 122 194 98" />
          <path className="t" style={linea("var(--a-detail-shade)", 9)} d="M154 140 Q192 144 198 120" />
        </g>
      ) : null}
      {/* Cresta más grande (desde Crece) */}
      <circle className="f-d" cx="80" cy="62" r="11" />
      <circle className="f-d" cx="89" cy="48" r="13" />
      <circle className="f-d" cx="103" cy="40" r="15" />
      <circle className="f-ds" cx="117" cy="49" r="12" />
      <circle className="f-ds" cx="122" cy="62" r="10" />
    </g>
  );
}

/* ───────── Cima ───────── */
const espejoX = "translate(200 0) scale(-1 1)";

function Cuerno({ n }: { n: Nivel }) {
  if (n === 1) return <path className="f-ds" d="M80 68 C66 30 34 24 30 48 C42 42 60 50 72 72 Z" />;
  return (
    <g>
      <path className="f-ds" d="M80 68 C64 26 24 22 22 50 C30 42 58 48 72 72 Z" />
      <circle className="f-ds" cx="27" cy="56" r="9" />
      <circle className="f-d" cx="28" cy="56" r="4.5" />
    </g>
  );
}

function CimaAtras({ n, ctx }: { n: Nivel; ctx: Ctx }) {
  return (
    <g>
      <Cuerno n={n} />
      <g transform={espejoX}>
        <Cuerno n={n} />
      </g>
      {n >= 2 && ctx.mostrarProp ? (
        <g>
          <rect className="f-sand-shade" x="160" y="62" width="7" height="126" rx="3.5" />
          <g className="asis-bandera">
            <path className="f-lime" d="M167 66 Q186 58 202 70 Q190 92 202 118 Q186 116 167 124 Z" />
            <path className="f-lime-shade" d="M167 96 Q186 92 196 100 Q192 110 202 118 Q186 116 167 124 Z" />
            {n >= 3 ? <path className="f-white" d={estrella4(183, 82, 7)} /> : null}
          </g>
        </g>
      ) : null}
    </g>
  );
}

/* ───────── Antojo ───────── */
function AntojoAtras({ n, ctx }: { n: Nivel; ctx: Ctx }) {
  return (
    <g>
      <g clipPath={`url(#${ctx.uid}-tail)`}>
        <path className="t" style={linea("var(--a-detail)", 9)} d="M140 186 L150 146 M188 174 L192 128 M202 118 L176 98" />
      </g>
      {n >= 2 && ctx.mostrarProp ? (
        <g>
          <path className="t" style={linea("var(--char-charcoal)", 3)} d="M145 150 Q155 130 165 150" />
          <path className="f-lime" d="M131 150 L177 150 L181 188 L127 188 Z" />
          <path className="f-lime-shade" d="M163 150 L177 150 L181 188 L165 188 Z" />
          <rect className="f-yellow" x="151" y="150" width="6" height="38" />
          <path className="f-yellow" d="M154 152 L145 145 L146 156 Z M154 152 L163 145 L162 156 Z" />
        </g>
      ) : null}
    </g>
  );
}

function GafasEnLaCabeza({ rig }: { rig: Rig }) {
  const { x, y } = rig.cabeza;
  return (
    <g>
      <rect className="f-ink" x={x - 23} y={y + 1} width="20" height="13" rx="6" />
      <rect className="f-ink" x={x + 3} y={y + 1} width="20" height="13" rx="6" />
      <rect className="f-ink" x={x - 5} y={y + 4} width="10" height="3" rx="1.5" />
      <rect className="f-white" x={x - 19} y={y + 3.5} width="6" height="2.6" rx="1.3" opacity="0.7" />
      <rect className="f-white" x={x + 7} y={y + 3.5} width="6" height="2.6" rx="1.3" opacity="0.7" />
    </g>
  );
}

/* ═════════ Puntos de entrada ═════════ */

/** Detrás del cuerpo (junto a orejas, cola y caparazón) */
export function RasgoAtras({ id, n, ctx, trono }: { id: AsistenteId; n: Nivel; ctx: Ctx; trono: boolean }) {
  if (n < 1) return null;
  let el: React.ReactNode = null;
  if (id === "centavo") el = <CentavoAtras n={n} trono={trono} />;
  else if (id === "brote") el = <BroteAtras n={n} />;
  else if (id === "tic") el = <TicAtras n={n} />;
  else if (id === "cima") el = <CimaAtras n={n} ctx={ctx} />;
  else if (id === "antojo") el = <AntojoAtras n={n} ctx={ctx} />;
  return el ? <g data-capa="crecimiento">{el}</g> : null;
}

/** Sobre el cuerpo (recortado a su silueta, como la panza) */
export function RasgoFrente({ id, n }: { id: AsistenteId; n: Nivel }) {
  if (n < 1 || id !== "tuerca") return null;
  return (
    <g data-capa="crecimiento">
      <TuercaFrente />
    </g>
  );
}

/** En la cabeza (solo si no lleva otro accesorio ahí) */
export function RasgoCabeza({ id, n, rig }: { id: AsistenteId; n: Nivel; rig: Rig }) {
  if (id === "tuerca" && n >= 2)
    return (
      <g data-capa="crecimiento">
        <CascoObra rig={rig} />
      </g>
    );
  if (id === "antojo" && n >= 3)
    return (
      <g data-capa="crecimiento">
        <GafasEnLaCabeza rig={rig} />
      </g>
    );
  return null;
}

/** Cuánto sube la corona del Rey para quedar encima de lo que ya lleva en la cabeza */
export function alturaCorona(id: AsistenteId, cabezaLibre: boolean): number {
  if (!cabezaLibre) return 0;
  if (id === "tuerca") return -30;
  if (id === "antojo") return -6;
  return 0;
}
