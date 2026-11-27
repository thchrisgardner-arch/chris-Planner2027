/**
 * Los 20 momentos de los asistentes (Fase 4). Cada momento combina ángulo + postura + ojos + boca +
 * efectos + accesorio de situación, armado sobre el rig actual de cada personaje (figuras.tsx):
 * nada se redibuja, solo se mueven, giran u ocultan las piezas que ya existen.
 * Donde un momento coincide con una pose existente (feliz, celebrando, orgulloso, preocupado,
 * triste, molesto, dormido), se reutiliza esa pose tal cual y solo se le suma el ángulo.
 */
import type { Accesorio, Angulo, BocaVariante, Momento, OjosVariante } from "@/lib/asistentes/tipos";
import type { Boca, PoseCfg, Rig } from "./figuras";

export interface MomentoCfg extends PoseCfg {
  angulo: Angulo;
  /** Accesorio de situación propio del momento (patines en "en racha") */
  accesorio?: Accesorio;
  /** Asomado: solo cabeza y manos sobre el borde de la tarjeta */
  asomado?: boolean;
  /** Movimiento propio en reposo */
  idleMov?: "respira" | "asiente" | "rebota" | "flota";
  /** Fase 5: el accesorio del momento va aunque haya otro elegido (la corona del rey) */
  forzarAccesorio?: boolean;
  /** Fase 5: su trono detrás */
  trono?: boolean;
}

const REY = { trono: true, accesorio: "corona" as const, forzarAccesorio: true, angulo: "frente" as const };

type Poses = Record<"feliz" | "celebrando" | "orgulloso" | "preocupado" | "triste" | "molesto" | "dormido", PoseCfg>;

export function momentoCfg(rig: Rig, m: Momento, poses: Poses): MomentoCfg {
  switch (m) {
    case "base":
      return { ...rig.idle, angulo: "tres-cuartos", idleMov: "respira" };
    case "saludo":
      return { brazos: { modo: "colgar", a: [4, 158] }, ojos: { modo: "guino" }, boca: "sonrisa", angulo: "tres-cuartos", idleMov: "rebota" };
    case "feliz":
      return { ...poses.feliz, angulo: "tres-cuartos", idleMov: "rebota" };
    case "celebrando":
      return { ...poses.celebrando, cuerpo: { y: -12, rot: 15 }, angulo: "frente", idleMov: "rebota" };
    case "euforico":
      return { brazos: { modo: "colgar", a: 168 }, ojos: { modo: "estrella", grande: true }, boca: "gritando", cuerpo: { y: -8, sy: 1.03 }, fx: ["destellos", "confeti"], angulo: "frente", idleMov: "rebota" };
    case "enamorado":
      return { brazos: { modo: "abrazo" }, ojos: { modo: "corazon" }, boca: "sonrisa", fx: ["corazon-grande", "corazones"], angulo: "tres-cuartos", idleMov: "flota" };
    case "orgulloso":
      return { ...poses.orgulloso, angulo: "tres-cuartos", idleMov: "respira" };
    case "aprobando":
      return { brazos: { modo: "cintura" }, ojos: { modo: "feliz" }, boca: "sonrisa", cuerpo: { rot: -4 }, angulo: "tres-cuartos", idleMov: "asiente" };
    case "sorprendido":
      return { brazos: { modo: "colgar", a: 58 }, ojos: { modo: "sorprendido", grande: true, ceja: "arriba" }, boca: "o-grande", cuerpo: { y: -3, sy: 1.04 }, fx: ["exclamacion"], angulo: "frente" };
    case "pensativo":
      return { brazos: { modo: "colgar", a: [2, -112] }, ojos: { modo: "abierto", tapa: 0.2, ceja: "esceptico", mirada: [0.7, -0.9] }, boca: "lado", fx: ["pensamiento"], angulo: "tres-cuartos", idleMov: "respira" };
    case "senalando":
      return { brazos: { modo: "colgar", a: [0, 92] }, ojos: { modo: "abierto", mirada: [1, 0] }, boca: "sonrisa", angulo: "perfil" };
    case "preocupado":
      return { ...poses.preocupado, angulo: "tres-cuartos" };
    case "triste":
      return { ...poses.triste, cuerpo: { y: 6, sy: 0.92 }, angulo: "frente" };
    case "molesto":
      // De espaldas a medias, mirando por encima del hombro
      return { ...poses.molesto, ojos: { ...poses.molesto.ojos, mirada: [-1, 0] }, cuerpo: { rot: -5 }, angulo: "tres-cuartos-espejo" };
    case "dormido":
      // Acostado de lado: girado 90° y vuelto a centrar sobre el piso
      return { ...poses.dormido, cuerpo: { rot: -90, x: rig.cuerpo.h / 2, y: -(rig.cuerpo.w / 2) + 6 }, angulo: "frente" };
    case "aburrido":
      return { brazos: { modo: "juntas" }, ojos: { modo: "abierto", tapa: 0.56, mirada: [0.95, 0.25] }, boca: "lado", cuerpo: { rot: 7, y: 2 }, angulo: "tres-cuartos" };
    case "asomado":
      return { brazos: { modo: "colgar", a: 0 }, ojos: { modo: "abierto", grande: true, mirada: [0, -0.3] }, boca: "cerrada", asomado: true, angulo: "frente" };
    case "en-racha":
      return { brazos: { modo: "colgar", a: [-30, 60] }, ojos: { modo: "abierto", tapa: 0.36, mirada: [1, 0] }, boca: "cerrada", cuerpo: { rot: 8 }, fx: ["velocidad"], accesorio: "patines", angulo: "perfil" };
    case "trabajando":
      return { brazos: { modo: "juntas" }, ojos: { modo: "abierto", tapa: 0.38, mirada: [0.2, 0.7] }, boca: "cerrada", fx: ["herramienta"], angulo: "tres-cuartos", idleMov: "respira" };
    case "despedida":
      return { brazos: { modo: "colgar", a: [0, 158] }, ojos: { modo: "cerrado" }, boca: "cerrada", cuerpo: { sx: 0.94, sy: 0.94 }, angulo: "espalda", idleMov: "rebota" };
    /* ── Fase 5: rey en su trono ── */
    case "rey-trono":
      return { brazos: { modo: "colgar", a: 24 }, ojos: { modo: "abierto", tapa: 0.34 }, boca: "sonrisa", ...REY, idleMov: "respira" };
    case "rey-saludo":
      return { brazos: { modo: "colgar", a: [4, 150] }, ojos: { modo: "feliz" }, boca: "sonrisa", ...REY, idleMov: "asiente" };
    case "rey-orgulloso":
      return { ...poses.orgulloso, ...REY, idleMov: "respira" };
    case "rey-triste":
      return { ...poses.triste, cuerpo: { y: 2, sy: 0.96 }, ...REY };
    case "rey-coronacion":
      return { ...poses.celebrando, ojos: { modo: "estrella", grande: true }, fx: ["destellos", "confeti"], ...REY, idleMov: "rebota" };
  }
}

/** Variantes de ojos del editor → configuración del rig */
export function ojosDeVariante(v: OjosVariante): PoseCfg["ojos"] {
  switch (v) {
    case "normal":
      return { modo: "abierto" };
    case "feliz":
      return { modo: "feliz" };
    case "entrecerrados":
      return { modo: "abierto", tapa: 0.5 };
    case "estrella":
      return { modo: "estrella", grande: true };
    case "corazon":
      return { modo: "corazon" };
    case "llorosos":
      return { modo: "llorando", grande: true, ceja: "arriba" };
    case "sorprendidos":
      return { modo: "sorprendido", grande: true, ceja: "arriba" };
    case "cerrados":
      return { modo: "cerrado" };
    case "guino":
      return { modo: "guino" };
    case "pestanas":
      return { modo: "pestanas" };
  }
}

export const bocaDeVariante = (v: BocaVariante): Boca => v;
