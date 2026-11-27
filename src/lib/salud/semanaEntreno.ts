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

/** "Martes 24, planeado, realizado" */
export function etiquetaDia(d: DiaSemana): string {
  const partes = [`${DIAS_LARGOS[d.dia]} ${parseISO(d.fecha).getUTCDate()}`];
  if (d.hoy) partes.push("hoy");
  partes.push(d.planeado ? "planeado" : "no planeado");
  partes.push(d.hecho ? "realizado" : d.futuro ? "todavía no" : "sin realizar");
  return partes.join(", ");
}
