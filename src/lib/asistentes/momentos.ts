/**
 * Mapa de momentos (Fase 4): qué momento muestra cada asistente según el evento, su ánimo y el lugar
 * de la app. Solo datos: el dibujo de cada momento vive en components/asistentes/momentos.ts.
 */
import type { Animo } from "./animo";
import type { TipoAccion } from "./progreso";
import type { Expresion, Momento } from "./tipos";

/** Evento de XP → momento con el que reacciona el asistente */
export const MOMENTO_DE_EVENTO: Record<TipoAccion, Momento> = {
  movimiento: "aprobando",
  ingreso: "feliz",
  "mes-verde": "euforico",
  "mes-rojo": "triste",
  habito: "aprobando",
  "dia-perfecto": "celebrando",
  tarea: "aprobando",
  "tarea-a-tiempo": "orgulloso",
  proyecto: "celebrando",
  "aporte-ahorro": "feliz",
  "meta-ahorro": "euforico",
  "avance-objetivo": "orgulloso",
  objetivo: "celebrando",
  "compra-planificada": "enamorado",
  "revision-semanal": "orgulloso",
  mision: "aprobando",
  "misiones-dia": "celebrando",
  "meta-diaria": "feliz",
  "hito-racha": "en-racha",
  "reparar-racha": "feliz",
  enfoque: "trabajando",
  "semana-entreno": "celebrando",
};

/** Ánimo del asistente (salud de su módulo) → momento en reposo */
export const MOMENTO_DE_ANIMO: Record<Animo, Momento> = {
  radiante: "feliz",
  feliz: "base",
  tranquilo: "pensativo",
  preocupado: "preocupado",
  triste: "triste",
  dormido: "aburrido",
};

/** Expresión de siempre → momento equivalente (para pasar las pantallas viejas al sistema nuevo) */
export const MOMENTO_DE_EXPRESION: Record<Expresion, Momento> = {
  idle: "base",
  feliz: "feliz",
  celebrando: "celebrando",
  orgulloso: "orgulloso",
  preocupado: "preocupado",
  triste: "triste",
  molesto: "molesto",
  dormido: "dormido",
};

/** Lugar de la app → momento */
export const MOMENTO_DE_LUGAR = {
  "estado-vacio": "asomado",
  "enfoque-trabajo": "trabajando",
  "enfoque-listo": "aprobando",
  captura: "aprobando",
  "subir-nivel": "euforico",
  conexion: "feliz",
  despedida: "despedida",
  saludo: "saludo",
  coronacion: "rey-coronacion",
} as const satisfies Record<string, Momento>;
