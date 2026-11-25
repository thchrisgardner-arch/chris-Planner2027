/**
 * Rutina semanal recomendada (lunes a domingo) a partir de los días de tu hábito de entrenar,
 * el lugar (gimnasio o casa), tu nivel y tu objetivo. Lógica pura, sin React.
 */
import type { Habit } from "@/types/db";
import type { Lugar, Nivel, Objetivo } from "./perfil";

/** Hábitos que cuentan como "entrenar" */
const PALABRAS = /entren|gym|gimnas|ejercicio|pesas|crossfit|workout|deporte|fitness|cardio|correr|running/i;
export const habitoDeEntreno = (habits: Habit[]) => habits.find((h) => PALABRAS.test(h.name)) ?? null;

type Grupo = "pecho" | "espalda" | "hombro" | "brazos" | "pierna" | "core";

const EJERCICIOS: Record<Lugar, Record<Grupo, string[]>> = {
  gym: {
    pecho: ["Press de banca", "Press inclinado con mancuernas", "Aperturas en máquina"],
    espalda: ["Jalón al pecho", "Remo con barra", "Remo en polea baja"],
    hombro: ["Press militar con mancuernas", "Elevaciones laterales", "Face pull"],
    brazos: ["Curl con barra", "Extensión de tríceps en polea"],
    pierna: ["Sentadilla con barra", "Prensa de piernas", "Peso muerto rumano", "Extensión de cuádriceps", "Curl femoral", "Elevación de talones"],
    core: ["Plancha", "Elevación de piernas colgado", "Rueda abdominal"],
  },
  casa: {
    pecho: ["Flexiones", "Flexiones inclinadas en silla", "Flexiones con pausa"],
    espalda: ["Remo con mochila", "Superman", "Remo invertido bajo una mesa"],
    hombro: ["Flexiones pica (pike)", "Elevaciones laterales con botellas", "Y-T-W en el piso"],
    brazos: ["Curl con mochila", "Fondos en silla"],
    pierna: ["Sentadilla", "Zancadas", "Puente de glúteo", "Sentadilla búlgara en silla", "Elevación de talones", "Peso muerto a una pierna"],
    core: ["Plancha", "Crunch bicicleta", "Dead bug"],
  },
};

type Sesion = "full-a" | "full-b" | "full-c" | "empuje" | "tiron" | "pierna-a" | "pierna-b" | "torso-a" | "torso-b" | "movilidad";

const SESIONES: Record<Sesion, { nombre: string; enfoque: string; ejercicios: [Grupo, number][] }> = {
  "full-a": { nombre: "Cuerpo completo A", enfoque: "Todo el cuerpo", ejercicios: [["pierna", 0], ["pecho", 0], ["espalda", 0], ["hombro", 0], ["core", 0]] },
  "full-b": { nombre: "Cuerpo completo B", enfoque: "Todo el cuerpo", ejercicios: [["pierna", 2], ["pecho", 1], ["espalda", 1], ["hombro", 1], ["core", 1]] },
  "full-c": { nombre: "Cuerpo completo C", enfoque: "Todo el cuerpo", ejercicios: [["pierna", 1], ["pecho", 2], ["espalda", 2], ["brazos", 0], ["core", 2]] },
  empuje: { nombre: "Empuje", enfoque: "Pecho, hombro y tríceps", ejercicios: [["pecho", 0], ["pecho", 1], ["hombro", 0], ["hombro", 1], ["brazos", 1]] },
  tiron: { nombre: "Tirón", enfoque: "Espalda y bíceps", ejercicios: [["espalda", 0], ["espalda", 1], ["espalda", 2], ["hombro", 2], ["brazos", 0]] },
  "pierna-a": { nombre: "Pierna", enfoque: "Cuádriceps y glúteo", ejercicios: [["pierna", 0], ["pierna", 1], ["pierna", 3], ["pierna", 5], ["core", 0]] },
  "pierna-b": { nombre: "Pierna", enfoque: "Femoral y glúteo", ejercicios: [["pierna", 2], ["pierna", 4], ["pierna", 1], ["pierna", 5], ["core", 1]] },
  "torso-a": { nombre: "Torso", enfoque: "Pecho, espalda y hombro", ejercicios: [["pecho", 0], ["espalda", 1], ["hombro", 0], ["espalda", 0], ["brazos", 1]] },
  "torso-b": { nombre: "Torso", enfoque: "Espalda, pecho y brazos", ejercicios: [["espalda", 0], ["pecho", 1], ["hombro", 1], ["espalda", 2], ["brazos", 0]] },
  movilidad: { nombre: "Movilidad y cardio suave", enfoque: "Recuperación activa", ejercicios: [] },
};

/** Reparto según cuántos días entrenas */
function reparto(n: number, nivel: Nivel): Sesion[] {
  switch (n) {
    case 1:
      return ["full-a"];
    case 2:
      return ["full-a", "full-b"];
    case 3:
      return nivel === "principiante" ? ["full-a", "full-b", "full-c"] : ["empuje", "tiron", "pierna-a"];
    case 4:
      return ["torso-a", "pierna-a", "torso-b", "pierna-b"];
    case 5:
      return ["empuje", "tiron", "pierna-a", "torso-b", "pierna-b"];
    case 6:
      return ["empuje", "tiron", "pierna-a", "empuje", "tiron", "pierna-b"];
    default:
      return ["empuje", "tiron", "pierna-a", "empuje", "tiron", "pierna-b", "movilidad"];
  }
}

export interface Ejercicio {
  nombre: string;
  series: number;
  reps: string;
}
export interface DiaRutina {
  dia: number; // 0 = lunes … 6 = domingo
  entrena: boolean;
  titulo: string;
  enfoque: string;
  ejercicios: Ejercicio[];
  extra: string | null;
  minutos: number;
}

export function rutinaSemanal(dias: number[], lugar: Lugar, nivel: Nivel, objetivo: Objetivo): DiaRutina[] {
  const ordenados = [...new Set(dias)].filter((d) => d >= 0 && d <= 6).sort();
  const sesiones = reparto(ordenados.length, nivel);
  const series = nivel === "principiante" ? 3 : nivel === "intermedio" ? 3 : 4;
  const reps = objetivo === "ganar" ? "8–12" : objetivo === "perder" ? "12–15" : "10–12";
  const descanso = objetivo === "ganar" ? "90 s" : objetivo === "perder" ? "45–60 s" : "60–90 s";

  return Array.from({ length: 7 }, (_, dia) => {
    const k = ordenados.indexOf(dia);
    if (k === -1) {
      return {
        dia,
        entrena: false,
        titulo: "Descanso",
        enfoque: objetivo === "perder" ? "Descanso activo" : "Recuperación",
        ejercicios: [],
        extra: objetivo === "perder" ? "Caminata de 30–45 minutos a paso rápido." : "Estiramientos suaves 10 minutos y dormir bien.",
        minutos: objetivo === "perder" ? 40 : 10,
      };
    }
    const s = SESIONES[sesiones[k]];
    if (sesiones[k] === "movilidad") {
      return { dia, entrena: true, titulo: s.nombre, enfoque: s.enfoque, ejercicios: [], extra: "20 minutos de cardio suave y 15 de movilidad (cadera, hombros, espalda).", minutos: 35 };
    }
    const ejercicios = s.ejercicios.map(([g, i]) => {
      const lista = EJERCICIOS[lugar][g];
      const nombre = lista[i % lista.length];
      const esCore = g === "core";
      return { nombre, series, reps: esCore ? (nombre === "Plancha" ? "30–45 s" : "12–15") : reps };
    });
    const extra =
      objetivo === "perder"
        ? `Termina con 15–20 minutos de cardio (bici, elíptica o caminata en inclinación). Descanso entre series: ${descanso}.`
        : `Descanso entre series: ${descanso}. Sube el peso cuando completes todas las repeticiones con buena técnica.`;
    const minutos = ejercicios.length * series * 2 + (objetivo === "perder" ? 20 : 10);
    return { dia, entrena: true, titulo: s.nombre, enfoque: s.enfoque, ejercicios, extra, minutos };
  });
}
