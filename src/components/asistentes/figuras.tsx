/**
 * Siluetas de los 6 asistentes en SVG (viewBox 0 0 200 200).
 * Capas con nombre (data-capa): body · belly/cheeks/ears-inner · details · prop.
 * La cara y los accesorios se dibujan aparte (Asistente.tsx) usando los anclajes de cada figura.
 * Clases: .o = contorno · .f-p primario · .f-s secundario · .f-d detalle (ver asistentes.css).
 */
import type { AsistenteId } from "@/lib/asistentes/tipos";

export type Punto = { x: number; y: number };
export type Slot = { x: number; y: number; w: number };
export type Ceja = "serio" | "gruñon" | "fruncido" | "decidido" | "picaro" | "ninguna";
export type OjoBase = "punto" | "calma" | "picaro";
export type BocaBase = "plana" | "mini" | "frown" | "sonrisa-lado" | "ninguna";

export interface Ctx {
  /** Detalles finos (patrones, líneas internas): se ocultan a 48 px */
  fino: boolean;
  mostrarProp: boolean;
  uid: string;
}

export interface Figura {
  nombre: string;
  ojos: [Punto, Punto];
  boca: Punto;
  cabeza: Slot;
  cuello: Slot;
  ceja: Ceja;
  ojo: OjoBase;
  bocaBase: BocaBase;
  /** Ojos sobre una zona oscura fija (antifaz): se dibujan con esclerótica blanca */
  ojosBlancos?: boolean;
  /** Radio de la "cabeza" para gafas y audífonos */
  anchoCara: number;
  render: (c: Ctx) => React.ReactNode;
}

/* ───────── Centavo · hámster ───────── */
const centavo: Figura = {
  nombre: "Centavo",
  ojos: [
    { x: 80, y: 92 },
    { x: 120, y: 92 },
  ],
  boca: { x: 100, y: 110 },
  cabeza: { x: 100, y: 52, w: 84 },
  cuello: { x: 100, y: 128, w: 96 },
  ceja: "serio",
  ojo: "punto",
  bocaBase: "plana",
  anchoCara: 70,
  render: (c) => (
    <>
      <g data-capa="details">
        <ellipse className="o f-d" cx="74" cy="186" rx="15" ry="7" />
        <ellipse className="o f-d" cx="126" cy="186" rx="15" ry="7" />
      </g>
      <g data-capa="ears">
        <circle className="o f-p" cx="58" cy="58" r="15" />
        <circle className="o f-p" cx="142" cy="58" r="15" />
      </g>
      <g data-capa="ears-inner">
        <circle className="f-s" cx="58" cy="58" r="7" />
        <circle className="f-s" cx="142" cy="58" r="7" />
      </g>
      <g data-capa="body">
        <ellipse className="o f-p" cx="100" cy="118" rx="70" ry="69" />
        <path className="o-fino" d="M92 52 q4 -10 8 0 q4 -10 8 0" />
      </g>
      <g data-capa="cheeks">
        <ellipse className="o f-s" cx="45" cy="110" rx="21" ry="23" />
        <ellipse className="o f-s" cx="155" cy="110" rx="21" ry="23" />
      </g>
      <g data-capa="belly">
        <ellipse className="f-s" cx="100" cy="152" rx="40" ry="31" />
      </g>
      {c.mostrarProp ? (
        <g data-capa="prop" className="asis-prop">
          <circle className="o f-yellow" cx="100" cy="146" r="26" />
          <circle className="o-fino" cx="100" cy="146" r="18" />
          <path className="o-fino" d="M100 134 Q102 144 112 146 Q102 148 100 158 Q98 148 88 146 Q98 144 100 134Z" />
        </g>
      ) : null}
      <g data-capa="body-front">
        <ellipse className="o f-p" cx="75" cy="140" rx="11" ry="9" />
        <ellipse className="o f-p" cx="125" cy="140" rx="11" ry="9" />
      </g>
    </>
  ),
};

/* ───────── Brote · tortuga ───────── */
const brote: Figura = {
  nombre: "Brote",
  ojos: [
    { x: 72, y: 66 },
    { x: 104, y: 66 },
  ],
  boca: { x: 88, y: 84 },
  cabeza: { x: 88, y: 28, w: 76 },
  cuello: { x: 90, y: 102, w: 72 },
  ceja: "ninguna",
  ojo: "calma",
  bocaBase: "mini",
  anchoCara: 46,
  render: (c) => (
    <>
      {c.mostrarProp ? (
        <g data-capa="prop" className="asis-prop">
          <path className="o f-none" d="M150 66 Q151 50 157 38" />
          <path className="o f-lime" d="M156 40 Q140 22 128 34 Q141 46 156 40Z" />
          <path className="o f-lime" d="M158 38 Q172 18 186 30 Q173 44 158 38Z" />
        </g>
      ) : null}
      <g data-capa="details">
        <clipPath id={`${c.uid}-shell`}>
          <ellipse cx="124" cy="118" rx="58" ry="64" />
        </clipPath>
        <ellipse className="f-d" cx="124" cy="118" rx="58" ry="64" />
        {c.fino ? (
          <g clipPath={`url(#${c.uid}-shell)`}>
            <path
              className="o-fino"
              d="M110 92 L138 92 L150 112 L138 132 L110 132 L100 112Z M110 92 L102 56 M138 92 L148 56 M150 112 L186 112 M138 132 L148 178 M110 132 L102 178"
            />
          </g>
        ) : null}
        <ellipse className="o f-none" cx="124" cy="118" rx="58" ry="64" />
      </g>
      <g data-capa="body">
        <ellipse className="o f-p" cx="70" cy="184" rx="16" ry="8" />
        <ellipse className="o f-p" cx="112" cy="184" rx="16" ry="8" />
        <ellipse className="o f-p" cx="90" cy="128" rx="42" ry="54" />
      </g>
      <g data-capa="belly">
        <ellipse className="o f-s" cx="90" cy="138" rx="29" ry="40" />
        {c.fino ? <path className="o-fino" d="M64 122 Q90 128 116 122 M62 142 Q90 148 118 142 M66 162 Q90 168 114 162" /> : null}
      </g>
      <g data-capa="body-front">
        <ellipse className="o f-p" cx="52" cy="126" rx="11" ry="22" transform="rotate(14 52 126)" />
        <ellipse className="o f-p" cx="128" cy="124" rx="11" ry="21" transform="rotate(-14 128 124)" />
        <ellipse className="o f-p" cx="88" cy="64" rx="46" ry="40" />
      </g>
    </>
  ),
};

/* ───────── Tuerca · castor ───────── */
const tuerca: Figura = {
  nombre: "Tuerca",
  ojos: [
    { x: 74, y: 90 },
    { x: 110, y: 90 },
  ],
  boca: { x: 92, y: 102 },
  cabeza: { x: 92, y: 54, w: 84 },
  cuello: { x: 92, y: 124, w: 92 },
  ceja: "gruñon",
  ojo: "punto",
  bocaBase: "ninguna",
  anchoCara: 62,
  render: (c) => (
    <>
      <g data-capa="details">
        <clipPath id={`${c.uid}-tail`}>
          <path d="M126 150 Q148 92 178 96 Q198 104 188 150 Q176 190 140 180 Z" />
        </clipPath>
        <path className="f-d" d="M126 150 Q148 92 178 96 Q198 104 188 150 Q176 190 140 180 Z" />
        {c.fino ? (
          <g clipPath={`url(#${c.uid}-tail)`} style={{ stroke: "var(--char-gray)", strokeWidth: 3, fill: "none" }}>
            <path d="M140 100 L196 156 M128 120 L188 180 M120 144 L160 184 M160 92 L200 132 M150 180 L196 112 M136 170 L190 96 M126 150 L172 92" />
          </g>
        ) : null}
        <path className="o f-none" d="M126 150 Q148 92 178 96 Q198 104 188 150 Q176 190 140 180 Z" />
        <ellipse className="o f-d" cx="70" cy="186" rx="16" ry="7" />
        <ellipse className="o f-d" cx="114" cy="186" rx="16" ry="7" />
      </g>
      {c.mostrarProp ? (
        <g data-capa="prop" className="asis-prop">
          <g transform="rotate(-38 140 44)">
            <rect className="o f-yellow-soft" x="116" y="39" width="9" height="10" rx="2" />
            <rect className="o f-yellow" x="124" y="39" width="30" height="10" rx="1.5" />
            <path className="o f-sand" d="M154 39 L166 44 L154 49Z" />
            <path className="f-ink" d="M162 42.4 L166 44 L162 45.6Z" />
          </g>
        </g>
      ) : null}
      <g data-capa="ears">
        <circle className="o f-p" cx="52" cy="58" r="13" />
        <circle className="o f-p" cx="132" cy="58" r="13" />
        <circle className="f-s" cx="52" cy="58" r="6" />
        <circle className="f-s" cx="132" cy="58" r="6" />
      </g>
      <g data-capa="body">
        <ellipse className="o f-p" cx="92" cy="120" rx="62" ry="67" />
      </g>
      <g data-capa="belly">
        <ellipse className="f-s" cx="92" cy="146" rx="36" ry="32" />
      </g>
      <g data-capa="body-front">
        <path className="o f-p" d="M52 148 Q92 164 132 148 Q138 162 126 168 Q92 180 58 168 Q46 162 52 148Z" />
        {c.fino ? <path className="o-fino" d="M92 160 Q95 166 92 172" /> : null}
        <path className="o f-white" d="M84 106 h8 v11 a2 2 0 0 1 -2 2 h-4 a2 2 0 0 1 -2 -2Z M92 106 h8 v11 a2 2 0 0 1 -2 2 h-4 a2 2 0 0 1 -2 -2Z" />
        <ellipse className="f-ink" cx="92" cy="101" rx="5" ry="3.5" />
      </g>
    </>
  ),
};

/* ───────── Tic · gallo ───────── */
const tic: Figura = {
  nombre: "Tic",
  ojos: [
    { x: 84, y: 96 },
    { x: 116, y: 96 },
  ],
  boca: { x: 100, y: 112 },
  cabeza: { x: 100, y: 66, w: 78 },
  cuello: { x: 100, y: 132, w: 96 },
  ceja: "fruncido",
  ojo: "punto",
  bocaBase: "ninguna",
  anchoCara: 64,
  render: (c) => (
    <>
      {c.mostrarProp ? (
        <g data-capa="prop" className="asis-prop">
          <path className="f-ink" d="M42 60 L56 76 L52 58Z" />
          <circle className="f-ink" cx="34" cy="44" r="22" />
          <circle cx="34" cy="44" r="12" style={{ fill: "none", stroke: "var(--char-white)", strokeWidth: "calc(var(--sw) * 0.62)" }} />
          <path d="M34 44 L34 36 M34 44 L40 47" style={{ fill: "none", stroke: "var(--char-white)", strokeWidth: "calc(var(--sw) * 0.62)", strokeLinecap: "round" }} />
        </g>
      ) : null}
      <g data-capa="details">
        <path className="o f-d" d="M72 70 C60 50 80 38 88 52 C88 32 114 30 113 50 C122 36 144 44 130 70 Z" />
        <ellipse className="o f-yellow" cx="84" cy="188" rx="11" ry="5.5" />
        <ellipse className="o f-yellow" cx="116" cy="188" rx="11" ry="5.5" />
      </g>
      <g data-capa="body">
        <ellipse className="o f-p" cx="100" cy="124" rx="64" ry="62" />
      </g>
      <g data-capa="belly">
        <ellipse className="f-s" cx="100" cy="158" rx="26" ry="19" />
      </g>
      <g data-capa="body-front">
        <path className="o f-p" d="M42 118 Q22 140 46 154 Q58 144 54 128 Z" />
        <path className="o f-p" d="M158 118 Q178 140 154 154 Q142 144 146 128 Z" />
        <path className="o f-yellow" d="M89 110 Q100 101 111 110 Q100 121 89 110Z" />
      </g>
    </>
  ),
};

/* ───────── Cima · cabra de montaña ───────── */
const cima: Figura = {
  nombre: "Cima",
  ojos: [
    { x: 84, y: 82 },
    { x: 116, y: 82 },
  ],
  boca: { x: 100, y: 99 },
  cabeza: { x: 100, y: 48, w: 78 },
  cuello: { x: 100, y: 120, w: 76 },
  ceja: "decidido",
  ojo: "punto",
  bocaBase: "frown",
  anchoCara: 50,
  render: (c) => (
    <>
      {c.mostrarProp ? (
        <g data-capa="prop" className="asis-prop">
          <rect className="o f-sand" x="146" y="92" width="8" height="96" rx="4" />
          <path className="o f-lime asis-bandera" d="M154 96 Q170 90 186 98 Q176 108 186 120 Q170 114 154 118 Z" />
        </g>
      ) : null}
      <g data-capa="body">
        <rect className="o f-p" x="74" y="156" width="20" height="30" rx="6" />
        <rect className="o f-p" x="106" y="156" width="20" height="30" rx="6" />
        <path className="o f-ink" d="M74 180 h20 v6 a4 4 0 0 1 -4 4 h-12 a4 4 0 0 1 -4 -4Z M106 180 h20 v6 a4 4 0 0 1 -4 4 h-12 a4 4 0 0 1 -4 -4Z" />
        <path className="o f-p" d="M66 112 Q50 174 88 174 L112 174 Q150 174 134 112 Z" />
      </g>
      <g data-capa="details">
        <path className="o f-d" d="M80 54 C70 30 50 28 44 46 C55 40 66 46 70 60 Z" />
        <path className="o f-d" d="M120 54 C130 30 150 28 156 46 C145 40 134 46 130 60 Z" />
      </g>
      <g data-capa="ears-inner">
        <ellipse className="o f-s" cx="48" cy="84" rx="20" ry="10" transform="rotate(24 48 84)" />
        <ellipse className="o f-s" cx="152" cy="84" rx="20" ry="10" transform="rotate(-24 152 84)" />
      </g>
      <g data-capa="body-front">
        <ellipse className="o f-p" cx="100" cy="84" rx="46" ry="38" />
        <path className="o f-p" d="M86 114 L91 132 L96 120 L100 136 L104 120 L109 132 L114 114" />
        <path className="o f-p" d="M64 128 Q44 140 60 156 Q68 148 66 136" />
        <circle className="o f-p" cx="146" cy="140" r="9" />
      </g>
    </>
  ),
};

/* ───────── Antojo · mapache ───────── */
const antojo: Figura = {
  nombre: "Antojo",
  ojos: [
    { x: 74, y: 90 },
    { x: 110, y: 90 },
  ],
  boca: { x: 96, y: 112 },
  cabeza: { x: 92, y: 56, w: 82 },
  cuello: { x: 92, y: 128, w: 88 },
  ceja: "picaro",
  ojo: "picaro",
  bocaBase: "sonrisa-lado",
  ojosBlancos: true,
  anchoCara: 58,
  render: (c) => (
    <>
      <g data-capa="details">
        <clipPath id={`${c.uid}-tail`}>
          <path d="M124 162 Q192 172 194 122 Q196 80 164 90 Q178 110 168 132 Q156 152 122 142 Z" />
        </clipPath>
        <path className="f-p" d="M124 162 Q192 172 194 122 Q196 80 164 90 Q178 110 168 132 Q156 152 122 142 Z" />
        <g clipPath={`url(#${c.uid}-tail)`} style={{ stroke: "var(--a-detail)", strokeWidth: 12, fill: "none" }}>
          <path d={c.fino ? "M150 172 L160 136 M174 168 L178 126 M200 140 L170 112 M196 100 L168 98" : "M160 172 L168 132 M200 140 L172 110"} />
        </g>
        <path className="o f-none" d="M124 162 Q192 172 194 122 Q196 80 164 90 Q178 110 168 132 Q156 152 122 142 Z" />
        <ellipse className="o f-d" cx="72" cy="186" rx="15" ry="7" />
        <ellipse className="o f-d" cx="112" cy="186" rx="15" ry="7" />
      </g>
      <g data-capa="ears">
        <path className="o f-p" d="M48 70 L56 30 L84 54 Z" />
        <path className="o f-p" d="M136 70 L128 30 L100 54 Z" />
        <path className="f-s" d="M56 60 L60 42 L72 54 Z" />
        <path className="f-s" d="M128 60 L124 42 L112 54 Z" />
      </g>
      <g data-capa="body">
        <ellipse className="o f-p" cx="92" cy="122" rx="58" ry="65" />
      </g>
      <g data-capa="belly">
        <ellipse className="f-s" cx="92" cy="150" rx="33" ry="29" />
      </g>
      <g data-capa="details">
        <path className="f-d" d="M48 92 Q58 72 92 84 Q126 72 136 92 Q132 108 112 104 Q92 98 72 104 Q52 108 48 92Z" />
        <ellipse className="f-ink" cx="92" cy="100" rx="5" ry="3.5" />
      </g>
      {c.mostrarProp ? (
        <g data-capa="prop" className="asis-prop">
          <path className="o f-none" d="M142 150 Q151 132 160 150" />
          <path className="o f-cream" d="M136 150 L166 150 L171 186 L131 186 Z" />
        </g>
      ) : null}
      <g data-capa="body-front">
        <circle className="o f-p" cx="146" cy="152" r="9" />
      </g>
    </>
  ),
};

export const FIGURAS: Record<AsistenteId, Figura> = { centavo, brote, tuerca, tic, cima, antojo };
