/**
 * Rigs de los 6 asistentes (viewBox 0 0 200 200), estilo plano de dos tonos y sin contorno:
 * cuerpo en bloque redondeado con la cabeza integrada, sombra del mismo color en la parte baja,
 * ojos grandes y extremidades en óvalo. Cada rig define su silueta, sus anclajes (ojos, boca,
 * hombros, pies, slots de accesorios) y su pose de reposo; las 8 poses se arman en Asistente.tsx.
 * Clases de color: f-p / f-ps (primario y su sombra), f-s / f-ss, f-d / f-ds (ver asistentes.css).
 */
import type { AsistenteId } from "@/lib/asistentes/tipos";

export type Punto = { x: number; y: number };
export type Slot = { x: number; y: number; w: number };

export type BrazoModo = "colgar" | "cruzados" | "cintura" | "juntas" | "abrazo";
export type OjoModo = "abierto" | "feliz" | "cerrado" | "llorando" | "estrella" | "corazon" | "guino" | "pestanas" | "sorprendido";
export type Ceja = "ninguna" | "arriba" | "enojo" | "esceptico";
export type Boca = "cerrada" | "sonrisa" | "abierta" | "o" | "triste" | "lado" | "lengua" | "silbando" | "temblorosa" | "gritando" | "o-grande";
export type Fx =
  | "destellos"
  | "sudor"
  | "lagrimas"
  | "vapor"
  | "zzz"
  | "corazones"
  | "confeti"
  | "exclamacion"
  | "pensamiento"
  | "velocidad"
  | "corazon-grande"
  | "herramienta";

export interface PoseCfg {
  /** a = apertura en grados: 0 colgando, 150 brazos arriba; negativo hacia adentro. [izq, der] si difieren */
  brazos: { modo: BrazoModo; a?: number | [number, number] };
  ojos: { modo: OjoModo; tapa?: number; inclina?: number; ceja?: Ceja; mirada?: [number, number]; grande?: boolean };
  boca: Boca;
  cuerpo?: { x?: number; y?: number; sx?: number; sy?: number; rot?: number };
  fx?: Fx[];
}

export interface Cuerpo {
  cx: number;
  top: number;
  w: number;
  h: number;
  r: number;
}

export interface Ctx {
  /** Detalles finos (patrones): se ocultan a 48 px o menos */
  fino: boolean;
  mostrarProp: boolean;
  uid: string;
}

export interface Rig {
  nombre: string;
  cuerpo: Cuerpo;
  ojos: [Punto, Punto];
  rOjo: number;
  boca: Punto;
  hombros: [Punto, Punto];
  brazo: { rx: number; ry: number };
  pies: [Punto, Punto];
  /** Clase de color de los pies */
  pie: string;
  cabeza: Slot;
  cuello: Slot;
  anchoCara: number;
  /** El párpado usa el color del antifaz (mapache) en vez del primario */
  parpado?: "p" | "d";
  /** Pico en lugar de boca (gallo) */
  pico?: boolean;
  /** De espaldas: cuánto se corre lo de atrás para quedar centrado (el caparazón de la tortuga) */
  espaldaDx?: number;
  idle: PoseCfg;
  /** Detrás del cuerpo: cola, caparazón, orejas, cuernos, accesorio propio trasero */
  atras: (c: Ctx) => React.ReactNode;
  /** Sobre el cuerpo y debajo de la cara: panza, cachetes, antifaz, hocico, nariz, dientes */
  frente: (c: Ctx) => React.ReactNode;
  /** Accesorio propio delante (moneda, bolsa…), debajo de los brazos */
  propDelante?: (c: Ctx) => React.ReactNode;
}

/** Rectángulo de esquinas muy redondeadas: el "bloque" del cuerpo */
export function bloque({ cx, top, w, h, r }: Cuerpo) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y1 = top + h;
  return `M${x0 + r} ${top} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${top + r} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1} H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${top + r} A${r} ${r} 0 0 1 ${x0 + r} ${top} Z`;
}

/* ───────── Centavo · hámster ───────── */
const centavo: Rig = {
  nombre: "Centavo",
  cuerpo: { cx: 100, top: 56, w: 132, h: 128, r: 60 },
  ojos: [
    { x: 80, y: 96 },
    { x: 120, y: 96 },
  ],
  rOjo: 15,
  boca: { x: 100, y: 124 },
  hombros: [
    { x: 42, y: 124 },
    { x: 158, y: 124 },
  ],
  brazo: { rx: 12, ry: 22 },
  pies: [
    { x: 78, y: 186 },
    { x: 122, y: 186 },
  ],
  pie: "f-d",
  cabeza: { x: 100, y: 58, w: 96 },
  cuello: { x: 100, y: 134, w: 108 },
  anchoCara: 66,
  idle: { brazos: { modo: "abrazo" }, ojos: { modo: "abierto", tapa: 0.36, ceja: "esceptico" }, boca: "cerrada" },
  atras: () => (
    <g data-capa="ears">
      <circle className="f-p" cx="62" cy="62" r="17" />
      <circle className="f-p" cx="138" cy="62" r="17" />
      <circle className="f-ss" cx="62" cy="62" r="8" />
      <circle className="f-ss" cx="138" cy="62" r="8" />
    </g>
  ),
  frente: () => (
    <>
      <g data-capa="cheeks">
        <ellipse className="f-s" cx="56" cy="124" rx="17" ry="14" />
        <ellipse className="f-s" cx="144" cy="124" rx="17" ry="14" />
      </g>
      <g data-capa="belly">
        <ellipse className="f-s" cx="100" cy="158" rx="40" ry="24" />
      </g>
      <path className="f-ds" d="M95 112 Q100 108 105 112 Q103 117 100 118 Q97 117 95 112 Z" />
    </>
  ),
  propDelante: (c) =>
    c.mostrarProp ? (
      <g data-capa="prop" className="asis-prop">
        <circle className="f-yellow-shade" cx="100" cy="152" r="22" />
        <circle className="f-yellow" cx="98" cy="150" r="18" />
        <path className="f-yellow-shade" d="M98 139 Q99.5 148 108 150 Q99.5 152 98 161 Q96.5 152 88 150 Q96.5 148 98 139 Z" />
      </g>
    ) : null,
};

/* ───────── Brote · tortuga ───────── */
const brote: Rig = {
  nombre: "Brote",
  cuerpo: { cx: 90, top: 42, w: 106, h: 142, r: 50 },
  ojos: [
    { x: 74, y: 84 },
    { x: 106, y: 84 },
  ],
  rOjo: 14,
  boca: { x: 90, y: 108 },
  hombros: [
    { x: 39, y: 124 },
    { x: 141, y: 124 },
  ],
  brazo: { rx: 11, ry: 20 },
  pies: [
    { x: 70, y: 186 },
    { x: 110, y: 186 },
  ],
  pie: "f-sand",
  cabeza: { x: 90, y: 44, w: 84 },
  cuello: { x: 90, y: 124, w: 92 },
  anchoCara: 54,
  espaldaDx: -42,
  idle: { brazos: { modo: "colgar", a: 6 }, ojos: { modo: "abierto", tapa: 0.56 }, boca: "cerrada" },
  atras: (c) => (
    <>
      <g data-capa="details">
        <clipPath id={`${c.uid}-shell`}>
          <ellipse cx="132" cy="124" rx="54" ry="60" />
        </clipPath>
        <ellipse className="f-d" cx="132" cy="124" rx="54" ry="60" />
        <g clipPath={`url(#${c.uid}-shell)`}>
          <ellipse className="f-ds" cx="168" cy="150" rx="46" ry="72" />
          {c.fino ? (
            <>
              <path className="f-ds" d="M126 92 l12 7 v14 l-12 7 l-12 -7 v-14 Z" />
              <path className="f-ds" d="M118 130 l11 6 v13 l-11 6 l-11 -6 v-13 Z" />
            </>
          ) : null}
        </g>
      </g>
      {c.mostrarProp ? (
        <g data-capa="prop" className="asis-prop">
          <path className="t" style={{ "--tc": "var(--char-lime-shade)", strokeWidth: 5 } as React.CSSProperties} d="M150 72 Q152 58 158 48" />
          <ellipse className="f-lime" cx="146" cy="46" rx="13" ry="7" transform="rotate(-25 146 46)" />
          <ellipse className="f-lime-shade" cx="170" cy="42" rx="13" ry="7" transform="rotate(20 170 42)" />
        </g>
      ) : null}
    </>
  ),
  frente: (c) => (
    <g data-capa="belly">
      <ellipse className="f-s" cx="90" cy="146" rx="30" ry="34" />
      {c.fino ? (
        <>
          <rect className="f-ss" x="70" y="134" width="40" height="3" rx="1.5" />
          <rect className="f-ss" x="66" y="148" width="48" height="3" rx="1.5" />
          <rect className="f-ss" x="70" y="162" width="40" height="3" rx="1.5" />
        </>
      ) : null}
    </g>
  ),
};

/* ───────── Tuerca · castor ───────── */
const tuerca: Rig = {
  nombre: "Tuerca",
  cuerpo: { cx: 95, top: 54, w: 124, h: 130, r: 56 },
  ojos: [
    { x: 78, y: 96 },
    { x: 112, y: 96 },
  ],
  rOjo: 14,
  boca: { x: 95, y: 134 },
  hombros: [
    { x: 39, y: 128 },
    { x: 151, y: 128 },
  ],
  brazo: { rx: 12, ry: 21 },
  pies: [
    { x: 76, y: 186 },
    { x: 114, y: 186 },
  ],
  pie: "f-d",
  cabeza: { x: 95, y: 56, w: 96 },
  cuello: { x: 95, y: 140, w: 106 },
  anchoCara: 64,
  idle: { brazos: { modo: "cruzados" }, ojos: { modo: "abierto", tapa: 0.46, inclina: 8 }, boca: "cerrada" },
  atras: (c) => (
    <>
      <g data-capa="details">
        <clipPath id={`${c.uid}-tail`}>
          <path d="M138 152 C148 100 196 98 192 148 C190 184 152 192 140 170 Z" />
        </clipPath>
        <path className="f-d" d="M138 152 C148 100 196 98 192 148 C190 184 152 192 140 170 Z" />
        <g clipPath={`url(#${c.uid}-tail)`}>
          <ellipse className="f-ds" cx="182" cy="170" rx="34" ry="30" />
          {c.fino ? (
            <path
              className="t"
              style={{ "--tc": "var(--char-gray)", strokeWidth: 3 } as React.CSSProperties}
              d="M150 108 L196 154 M140 128 L186 174 M136 152 L168 184 M168 104 L198 134 M154 182 L196 120 M140 168 L188 104"
            />
          ) : null}
        </g>
      </g>
      {c.mostrarProp ? (
        <g data-capa="prop" className="asis-prop">
          <g transform="rotate(-36 142 48)">
            <rect className="f-yellow-soft" x="118" y="43" width="9" height="10" rx="2" />
            <rect className="f-yellow" x="126" y="43" width="30" height="10" rx="1.5" />
            <rect className="f-yellow-shade" x="126" y="49" width="30" height="4" />
            <path className="f-sand" d="M156 43 L168 48 L156 53 Z" />
            <path className="f-ink" d="M164 46.3 L168 48 L164 49.7 Z" />
          </g>
        </g>
      ) : null}
      <g data-capa="ears">
        <circle className="f-p" cx="58" cy="62" r="15" />
        <circle className="f-p" cx="132" cy="62" r="15" />
        <circle className="f-ss" cx="58" cy="62" r="7" />
        <circle className="f-ss" cx="132" cy="62" r="7" />
      </g>
    </>
  ),
  frente: () => (
    <>
      <g data-capa="belly">
        <ellipse className="f-s" cx="95" cy="158" rx="38" ry="24" />
      </g>
      <ellipse className="f-ss" cx="95" cy="120" rx="20" ry="12" />
      <ellipse className="f-charcoal" cx="95" cy="114" rx="7" ry="5" />
      <rect className="f-white" x="88" y="122" width="7" height="10" rx="2" />
      <rect className="f-white" x="96" y="122" width="7" height="10" rx="2" />
    </>
  ),
};

/* ───────── Tic · gallo ───────── */
const tic: Rig = {
  nombre: "Tic",
  cuerpo: { cx: 100, top: 60, w: 128, h: 124, r: 60 },
  ojos: [
    { x: 82, y: 98 },
    { x: 118, y: 98 },
  ],
  rOjo: 15,
  boca: { x: 100, y: 121 },
  hombros: [
    { x: 40, y: 128 },
    { x: 160, y: 128 },
  ],
  brazo: { rx: 12, ry: 21 },
  pies: [
    { x: 82, y: 187 },
    { x: 118, y: 187 },
  ],
  pie: "f-yellow",
  cabeza: { x: 100, y: 64, w: 88 },
  cuello: { x: 100, y: 140, w: 106 },
  anchoCara: 66,
  pico: true,
  idle: { brazos: { modo: "cintura" }, ojos: { modo: "abierto", tapa: 0.4, inclina: 22 }, boca: "cerrada" },
  atras: (c) => (
    <>
      {c.mostrarProp ? (
        <g data-capa="prop" className="asis-prop">
          <path className="f-charcoal" d="M42 62 L56 78 L52 58 Z" />
          <circle className="f-charcoal" cx="34" cy="46" r="22" />
          <circle className="t" style={{ "--tc": "var(--char-white)", strokeWidth: 3 } as React.CSSProperties} cx="34" cy="46" r="12" />
          <path className="t" style={{ "--tc": "var(--char-white)", strokeWidth: 3 } as React.CSSProperties} d="M34 46 L34 38 M34 46 L40 49" />
        </g>
      ) : null}
      <g data-capa="details">
        <circle className="f-d" cx="86" cy="60" r="12" />
        <circle className="f-d" cx="100" cy="50" r="14" />
        <circle className="f-ds" cx="114" cy="60" r="12" />
      </g>
    </>
  ),
  frente: () => (
    <g data-capa="belly">
      <ellipse className="f-s" cx="100" cy="160" rx="34" ry="22" />
    </g>
  ),
};

/* ───────── Cima · cabra de montaña ───────── */
const cima: Rig = {
  nombre: "Cima",
  cuerpo: { cx: 100, top: 58, w: 116, h: 128, r: 48 },
  ojos: [
    { x: 84, y: 96 },
    { x: 116, y: 96 },
  ],
  rOjo: 14,
  boca: { x: 100, y: 130 },
  hombros: [
    { x: 44, y: 130 },
    { x: 156, y: 130 },
  ],
  brazo: { rx: 11, ry: 20 },
  pies: [
    { x: 82, y: 187 },
    { x: 118, y: 187 },
  ],
  pie: "f-ds",
  cabeza: { x: 100, y: 60, w: 86 },
  cuello: { x: 100, y: 146, w: 100 },
  anchoCara: 58,
  idle: { brazos: { modo: "colgar", a: [-8, 34] }, ojos: { modo: "abierto", tapa: 0.3, inclina: 14 }, boca: "cerrada" },
  atras: (c) => (
    <>
      {c.mostrarProp ? (
        <g data-capa="prop" className="asis-prop">
          <rect className="f-sand-shade" x="160" y="90" width="6" height="98" rx="3" />
          <g className="asis-bandera">
            <path className="f-lime" d="M166 94 Q180 88 194 96 Q184 106 194 118 Q180 112 166 116 Z" />
            <path className="f-lime-shade" d="M166 106 Q180 102 190 108 Q186 112 194 118 Q180 112 166 116 Z" />
          </g>
        </g>
      ) : null}
      <g data-capa="details">
        <path className="f-ds" d="M80 68 C70 40 50 38 46 56 C56 50 66 56 72 72 Z" />
        <path className="f-ds" d="M120 68 C130 40 150 38 154 56 C144 50 134 56 128 72 Z" />
      </g>
      <g data-capa="ears-inner">
        <ellipse className="f-s" cx="50" cy="98" rx="18" ry="9" transform="rotate(26 50 98)" />
        <ellipse className="f-s" cx="150" cy="98" rx="18" ry="9" transform="rotate(-26 150 98)" />
      </g>
    </>
  ),
  frente: () => (
    <>
      <ellipse className="f-s" cx="100" cy="124" rx="25" ry="15" />
      <ellipse className="f-ds" cx="100" cy="118" rx="5.5" ry="3.5" />
      <path className="f-s" d="M91 136 L100 156 L109 136 Z" />
    </>
  ),
};

/* ───────── Antojo · mapache ───────── */
const antojo: Rig = {
  nombre: "Antojo",
  cuerpo: { cx: 95, top: 56, w: 120, h: 128, r: 54 },
  ojos: [
    { x: 78, y: 98 },
    { x: 112, y: 98 },
  ],
  rOjo: 13,
  boca: { x: 98, y: 126 },
  hombros: [
    { x: 41, y: 130 },
    { x: 149, y: 130 },
  ],
  brazo: { rx: 12, ry: 21 },
  pies: [
    { x: 81, y: 187 },
    { x: 109, y: 187 },
  ],
  pie: "f-d",
  cabeza: { x: 95, y: 58, w: 92 },
  cuello: { x: 95, y: 140, w: 102 },
  anchoCara: 62,
  parpado: "d",
  idle: { brazos: { modo: "colgar", a: [-6, -34] }, ojos: { modo: "abierto", tapa: 0.5, ceja: "esceptico", mirada: [0.9, 0] }, boca: "lado" },
  atras: (c) => (
    <>
      <g data-capa="details">
        <clipPath id={`${c.uid}-tail`}>
          <path d="M130 170 Q196 178 196 126 Q196 84 166 92 Q182 112 172 136 Q160 156 128 148 Z" />
        </clipPath>
        <path className="f-p" d="M130 170 Q196 178 196 126 Q196 84 166 92 Q182 112 172 136 Q160 156 128 148 Z" />
        <g clipPath={`url(#${c.uid}-tail)`}>
          <path className="t" style={{ "--tc": "var(--a-detail)", strokeWidth: 12 } as React.CSSProperties} d={c.fino ? "M152 180 L162 140 M176 176 L182 130 M200 142 L172 114 M198 100 L170 98" : "M162 180 L170 136 M200 142 L172 112"} />
        </g>
      </g>
      {c.mostrarProp ? (
        <g data-capa="prop" className="asis-prop">
          <path className="t" style={{ "--tc": "var(--char-cream-shade)" } as React.CSSProperties} d="M146 152 Q155 136 164 152" />
          <path className="f-cream" d="M138 152 L170 152 L174 186 L134 186 Z" />
          <path className="f-cream-shade" d="M158 152 L170 152 L174 186 L160 186 Z" />
        </g>
      ) : null}
      <g data-capa="ears">
        <path className="f-p" d="M52 76 L60 34 L90 60 Z" />
        <path className="f-p" d="M138 76 L130 34 L100 60 Z" />
        <path className="f-s" d="M60 64 L64 46 L76 58 Z" />
        <path className="f-s" d="M130 64 L126 46 L114 58 Z" />
      </g>
    </>
  ),
  frente: () => (
    <>
      <g data-capa="belly">
        <ellipse className="f-s" cx="95" cy="160" rx="34" ry="22" />
      </g>
      <path className="f-d" d="M44 102 Q54 78 95 90 Q136 78 146 102 Q142 118 118 114 Q95 108 72 114 Q48 118 44 102 Z" />
      <ellipse className="f-d" cx="95" cy="116" rx="6" ry="4.5" />
    </>
  ),
};

export const RIGS: Record<AsistenteId, Rig> = { centavo, brote, tuerca, tic, cima, antojo };
/** Compatibilidad con el nombre anterior */
export const FIGURAS = RIGS;
