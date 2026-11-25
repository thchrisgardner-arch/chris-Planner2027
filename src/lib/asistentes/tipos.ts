/** Tipos base de los asistentes de LIFE OS. */

export const ASISTENTE_IDS = ["centavo", "brote", "tuerca", "tic", "cima", "antojo"] as const;
export type AsistenteId = (typeof ASISTENTE_IDS)[number];

/** Colores disponibles para los personajes (tokens --char-*). */
export const CHAR_COLORS = [
  "lime",
  "lime-soft",
  "yellow",
  "yellow-soft",
  "cream",
  "sand",
  "white",
  "gray-light",
  "gray",
  "charcoal",
  "ink",
] as const;
export type CharColor = (typeof CHAR_COLORS)[number];

export const CHAR_COLOR_LABEL: Record<CharColor, string> = {
  lime: "Lima",
  "lime-soft": "Lima suave",
  yellow: "Amarillo",
  "yellow-soft": "Amarillo suave",
  cream: "Crema",
  sand: "Arena",
  white: "Blanco",
  "gray-light": "Gris claro",
  gray: "Gris",
  charcoal: "Carbón",
  ink: "Tinta",
};

/** Colores oscuros: sobre ellos los trazos de la cara se dibujan en blanco. */
export const DARK_COLORS: CharColor[] = ["charcoal", "ink"];

/** Poses de cuerpo completo (cada una con su cara, postura, efectos y animación). */
export const EXPRESIONES = ["idle", "feliz", "celebrando", "orgulloso", "preocupado", "triste", "molesto", "dormido"] as const;
export type Expresion = (typeof EXPRESIONES)[number];
export type Pose = Expresion;

export const EXPRESION_LABEL: Record<Expresion, string> = {
  idle: "Normal",
  feliz: "Feliz",
  celebrando: "Celebrando",
  orgulloso: "Orgulloso",
  preocupado: "Preocupado",
  triste: "Triste",
  molesto: "Molesto",
  dormido: "Dormido",
};

/** Valores guardados con la versión anterior (5 expresiones) */
export const EXPRESION_LEGADA: Record<string, Expresion> = { neutral: "idle", contento: "feliz", alerta: "preocupado" };

export const ACCESORIOS = ["ninguno", "gafas", "gorro", "audifonos", "bufanda"] as const;
export type Accesorio = (typeof ACCESORIOS)[number];

export const ACCESORIO_LABEL: Record<Accesorio, string> = {
  ninguno: "Ninguno",
  gafas: "Gafas",
  gorro: "Gorro",
  audifonos: "Audífonos",
  bufanda: "Bufanda",
};

export type Colores = { primario: CharColor; secundario: CharColor; detalle: CharColor };

export const charVar = (c: CharColor) => `var(--char-${c})`;

/** Colores por defecto de cada personaje (primario / secundario / detalle). */
export const COLORES_POR_DEFECTO: Record<AsistenteId, Colores> = {
  centavo: { primario: "yellow", secundario: "yellow-soft", detalle: "sand" },
  brote: { primario: "lime-soft", secundario: "cream", detalle: "lime" },
  tuerca: { primario: "sand", secundario: "cream", detalle: "charcoal" },
  tic: { primario: "charcoal", secundario: "white", detalle: "lime" },
  cima: { primario: "cream", secundario: "white", detalle: "sand" },
  antojo: { primario: "gray-light", secundario: "white", detalle: "ink" },
};
