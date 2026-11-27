/** Tipos base de los asistentes de LIFE for LIFE. */

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
/** Accesorios de situación: se desbloquean usando la app (vínculo o racha) */
export const ACCESORIOS_SITUACION = ["gafas-sol", "chef", "fedora", "dedo-espuma", "patines", "corona"] as const;
export type AccesorioSituacion = (typeof ACCESORIOS_SITUACION)[number];
export type Accesorio = (typeof ACCESORIOS)[number] | AccesorioSituacion;
export const TODOS_LOS_ACCESORIOS: Accesorio[] = [...ACCESORIOS, ...ACCESORIOS_SITUACION];

export const ACCESORIO_LABEL: Record<Accesorio, string> = {
  ninguno: "Ninguno",
  gafas: "Gafas",
  gorro: "Gorro",
  audifonos: "Audífonos",
  bufanda: "Bufanda",
  "gafas-sol": "Gafas de sol",
  chef: "Gorro de chef",
  fedora: "Sombrero fedora",
  "dedo-espuma": "Dedo de espuma",
  patines: "Patines",
  corona: "Corona",
};

/* ═════════ Fase 4: momentos, ángulos, ojos y bocas ═════════ */
export const MOMENTOS = [
  "base",
  "saludo",
  "feliz",
  "celebrando",
  "euforico",
  "enamorado",
  "orgulloso",
  "aprobando",
  "sorprendido",
  "pensativo",
  "senalando",
  "preocupado",
  "triste",
  "molesto",
  "dormido",
  "aburrido",
  "asomado",
  "en-racha",
  "trabajando",
  "despedida",
] as const;
export type Momento = (typeof MOMENTOS)[number];

export const MOMENTO_LABEL: Record<Momento, string> = {
  base: "Base",
  saludo: "Saludo",
  feliz: "Feliz",
  celebrando: "Celebrando",
  euforico: "Eufórico",
  enamorado: "Enamorado",
  orgulloso: "Orgulloso",
  aprobando: "Aprobando",
  sorprendido: "Sorprendido",
  pensativo: "Pensativo",
  senalando: "Señalando",
  preocupado: "Preocupado",
  triste: "Triste",
  molesto: "Molesto",
  dormido: "Dormido",
  aburrido: "Aburrido",
  asomado: "Asomado",
  "en-racha": "En racha",
  trabajando: "Trabajando",
  despedida: "Despedida",
};

export const ANGULOS = ["frente", "tres-cuartos", "tres-cuartos-espejo", "perfil", "espalda"] as const;
export type Angulo = (typeof ANGULOS)[number];
export const ANGULO_LABEL: Record<Angulo, string> = {
  frente: "Frente",
  "tres-cuartos": "Tres cuartos",
  "tres-cuartos-espejo": "Tres cuartos (espejo)",
  perfil: "Perfil",
  espalda: "Espalda",
};

export const OJOS_VARIANTES = ["normal", "feliz", "entrecerrados", "estrella", "corazon", "llorosos", "sorprendidos", "cerrados", "guino", "pestanas"] as const;
export type OjosVariante = (typeof OJOS_VARIANTES)[number];
export const BOCAS_VARIANTES = ["cerrada", "sonrisa", "abierta", "o", "lengua", "silbando", "temblorosa", "gritando"] as const;
export type BocaVariante = (typeof BOCAS_VARIANTES)[number];

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
