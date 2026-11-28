/**
 * Semana de entrenamiento: qué días estaban planeados, cuáles se hicieron y el resumen en una línea
 * ("2 de 3 esta semana · te falta el viernes"). Funciones puras sobre el hábito «Entrenar».
 */
import type { Habit, HabitLog } from "../../types/db";
import { addDays, parseISO, startOfWeek } from "../../utils/dates";
import { esFlexible } from "../../modules/habits/selectors";

const NOMBRES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const DIAS_LARGOS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export interface DiaSemana {
  fecha: string;
  /** 0 = lunes … 6 = domingo */
  dia: number;
  planeado: boolean;
  hecho: boolean;
  futuro: boolean;
  hoy: boolean;
}

export function diasDeSemana(habit: Habit, logs: HabitLog[], lunes: string, hoy: string): DiaSemana[] {
  const hechos = new Set(logs.filter((l) => l.habit_id === habit.id).map((l) => l.date));
  // En «X veces por semana» no hay días planeados: los días sugeridos se muestran igual
  return Array.from({ length: 7 }, (_, dia) => {
    const fecha = addDays(lunes, dia);
    return { fecha, dia, planeado: habit.days.includes(dia), hecho: hechos.has(fecha), futuro: fecha > hoy, hoy: fecha === hoy };
  });
}

const listaY = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : (xs[0] ?? ""));

/** "3 de 3 esta semana" · "2 de 3 esta semana · te falta el viernes" · "4 de 3 esta semana · uno extra" */
export function resumenSemana(habit: Habit, dias: DiaSemana[], hoy: string): string {
  const actual = dias.some((d) => d.hoy) || dias[0].fecha === startOfWeek(hoy);
  const cual = actual ? "esta semana" : "esa semana";
  const hechos = dias.filter((d) => d.hecho).length;
  if (esFlexible(habit)) {
    const meta = habit.weekly_target!;
    const base = `${hechos} de ${meta} ${cual}`;
    if (hechos > meta) return `${base} · ${hechos - meta === 1 ? "uno extra" : `${hechos - meta} extra`}`;
    const quedan = dias.filter((d) => d.futuro || (d.hoy && !d.hecho)).length;
    const faltan = meta - hechos;
    if (!actual || faltan <= 0 || quedan === 0) return base;
    return `${base} · ${faltan === 1 ? "te falta 1 más" : `te faltan ${faltan} más`}`;
  }
  const meta = dias.filter((d) => d.planeado).length;
  const base = `${hechos} de ${meta} ${cual}`;
  // Un entrenamiento extra cuenta igual: con la cantidad planeada, la semana ya está cumplida
  if (hechos > meta) return `${base} · ${hechos - meta === 1 ? "uno extra" : `${hechos - meta} extra`}`;
  if (hechos === meta) return base;
  const pendientes = actual ? dias.filter((d) => d.planeado && !d.hecho && (d.futuro || d.hoy)).map((d) => `el ${NOMBRES[d.dia]}`) : [];
  if (pendientes.length) return `${base} · ${pendientes.length === 1 ? "te falta" : "te faltan"} ${listaY(pendientes)}`;
  return base;
}

/**
 * Semana cumplida: en «X veces por semana», llegar a X; con días fijos, tantos entrenamientos como días
 * planeados (un día extra cuenta igual, como en `resumenSemana`). Da el bono de XP de la semana.
 */
export function semanaCompleta(habit: Habit, dias: DiaSemana[]): boolean {
  const hechos = dias.filter((d) => d.hecho).length;
  const meta = esFlexible(habit) ? habit.weekly_target! : dias.filter((d) => d.planeado).length;
  return meta > 0 && hechos >= meta;
}

/** Hitos de la racha de semanas completas (logros de Brote) */
export const HITOS_SEMANAS_GYM = [4, 8, 12] as const;

/**
 * Racha de semanas de entrenamiento completas seguidas.
 *  - actual: hasta la semana pasada (o incluida la actual si ya está completa). La semana en curso
 *    no rompe la racha mientras no termine.
 *  - mejor: la racha más larga desde la primera semana con un entrenamiento marcado.
 */
export function rachaSemanasEntreno(habit: Habit, logs: HabitLog[], hoy: string): { actual: number; mejor: number } {
  const propios = logs.filter((l) => l.habit_id === habit.id);
  if (!propios.length) return { actual: 0, mejor: 0 };
  const completa = (lunes: string) => semanaCompleta(habit, diasDeSemana(habit, propios, lunes, hoy));
  const esta = startOfWeek(hoy);
  // actual
  let actual = 0;
  let lunes = completa(esta) ? esta : addDays(esta, -7);
  while (completa(lunes)) {
    actual++;
    lunes = addDays(lunes, -7);
  }
  // mejor: recorre desde la primera semana con registro
  const primera = startOfWeek(propios.reduce((m, l) => (l.date < m ? l.date : m), propios[0].date));
  let mejor = 0;
  let seguidas = 0;
  for (let l = primera; l <= esta; l = addDays(l, 7)) {
    if (completa(l)) mejor = Math.max(mejor, ++seguidas);
    else if (l !== esta) seguidas = 0; // la semana en curso sin completar no corta
  }
  return { actual, mejor: Math.max(mejor, actual) };
}

/** Estado de un día en la lista de la rutina */
export type EstadoDia = "realizado" | "no-realizado" | "pendiente" | "proximo" | "descanso";
export function estadoDia(d: DiaSemana): EstadoDia {
  if (d.hecho) return "realizado";
  if (!d.planeado) return "descanso";
  if (d.futuro) return "proximo";
  return d.hoy ? "pendiente" : "no-realizado";
}

/**
 * Cómo reacciona la mascota a la semana de entrenamiento (solo la semana actual):
 *  - semana cumplida → celebra;
 *  - días planeados que ya pasaron sin marcar → preocupada (1) o triste (2 o más), y dice si aún
 *    alcanza a cumplir la semana con los días que quedan;
 *  - si no, nada (no molesta cuando vas al día).
 * Devuelve la clave de la frase (plantillas de Brote) y sus datos.
 */
export type ReaccionEntreno = { clave: "gymSemana" | "gymFalta" | "gymFaltas"; expresion: "celebrando" | "preocupado" | "triste"; datos: Record<string, string | number> };
export function reaccionEntreno(habit: Habit, dias: DiaSemana[]): ReaccionEntreno | null {
  if (semanaCompleta(habit, dias)) return { clave: "gymSemana", expresion: "celebrando", datos: { xp: XP_SEMANA_ENTRENO } };
  const hechos = dias.filter((d) => d.hecho).length;
  // Días que aún se pueden entrenar esta semana (hoy sin marcar y los que vienen)
  const quedan = dias.filter((d) => d.futuro || (d.hoy && !d.hecho)).length;
  if (esFlexible(habit)) {
    // Sin días fijos solo se «falta» cuando ya no alcanzan los días que quedan
    const faltan = habit.weekly_target! - hechos;
    if (faltan > quedan) return { clave: "gymFaltas", expresion: "triste", datos: { n: faltan - quedan, alcanza: "no" } };
    return null;
  }
  const perdidos = dias.filter((d) => d.planeado && !d.hecho && !d.futuro && !d.hoy);
  if (!perdidos.length) return null;
  const meta = dias.filter((d) => d.planeado).length;
  const alcanza = hechos + quedan >= meta ? "si" : "no";
  if (perdidos.length === 1) return { clave: "gymFalta", expresion: "preocupado", datos: { dia: NOMBRES[perdidos[0].dia], n: 1, alcanza } };
  return { clave: "gymFaltas", expresion: "triste", datos: { n: perdidos.length, alcanza } };
}

/** XP del bono por completar la semana de entrenamiento (ver TABLA_XP «semana-entreno») */
export const XP_SEMANA_ENTRENO = 50;

/** "Martes 24, planeado, realizado" */
export function etiquetaDia(d: DiaSemana): string {
  const partes = [`${DIAS_LARGOS[d.dia]} ${parseISO(d.fecha).getUTCDate()}`];
  if (d.hoy) partes.push("hoy");
  partes.push(d.planeado ? "planeado" : "no planeado");
  partes.push(d.hecho ? "realizado" : d.futuro ? "todavía no" : "sin realizar");
  return partes.join(", ");
}
