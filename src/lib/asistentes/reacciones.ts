/** Frases y poses de reacción inmediata a cada acción que da XP. */
import type { Tono } from "./definiciones";
import type { TipoAccion } from "./progreso";
import type { Pose } from "./tipos";

export const REACCION: Record<TipoAccion, { pose: Pose; plural: [string, string]; frase: Record<Tono, string> }> = {
  movimiento: { pose: "idle", plural: ["movimiento", "movimientos"], frase: { seco: "Anotado.", motivador: "Registrado. Bien ahí.", tranquilo: "Movimiento registrado." } },
  habito: { pose: "feliz", plural: ["hábito", "hábitos"], frase: { seco: "Uno menos.", motivador: "Otro hábito cumplido. Sigue.", tranquilo: "Hábito cumplido." } },
  "dia-perfecto": { pose: "celebrando", plural: ["día perfecto", "días perfectos"], frase: { seco: "Día perfecto. Ni yo lo esperaba.", motivador: "Día perfecto. Así se hace.", tranquilo: "Completaste todos los hábitos de hoy." } },
  tarea: { pose: "orgulloso", plural: ["tarea", "tareas"], frase: { seco: "Así se construye.", motivador: "Tarea lista. Vas con todo.", tranquilo: "Tarea completada." } },
  "tarea-a-tiempo": { pose: "orgulloso", plural: ["tarea a tiempo", "tareas a tiempo"], frase: { seco: "A tiempo. Como debe ser.", motivador: "Justo a tiempo. Excelente.", tranquilo: "Completaste la tarea antes de su fecha." } },
  proyecto: { pose: "celebrando", plural: ["proyecto", "proyectos"], frase: { seco: "Obra terminada. Me quito el lápiz.", motivador: "Proyecto terminado. Gran trabajo.", tranquilo: "Terminaste un proyecto." } },
  "aporte-ahorro": { pose: "celebrando", plural: ["aporte", "aportes"], frase: { seco: "Un aporte más. Me gusta.", motivador: "Aporte hecho. Tu meta se acerca.", tranquilo: "Registraste un aporte a tu meta." } },
  "meta-ahorro": { pose: "celebrando", plural: ["meta", "metas"], frase: { seco: "Meta cumplida. Ahora sí, orgulloso.", motivador: "Meta de ahorro cumplida. Increíble.", tranquilo: "Completaste una meta de ahorro." } },
  "avance-objetivo": { pose: "orgulloso", plural: ["avance", "avances"], frase: { seco: "Un paso más arriba.", motivador: "Avance registrado. A seguir subiendo.", tranquilo: "Registraste avance en un objetivo." } },
  objetivo: { pose: "celebrando", plural: ["objetivo", "objetivos"], frase: { seco: "Cumbre alcanzada. Siguiente montaña.", motivador: "Objetivo 2027 cumplido. Enorme.", tranquilo: "Completaste un objetivo 2027." } },
  "compra-planificada": { pose: "celebrando", plural: ["compra", "compras"], frase: { seco: "Compra con plan. Así sí.", motivador: "Compraste sin tocar el ahorro. Bien.", tranquilo: "Compra hecha con la meta lista." } },
  "revision-semanal": { pose: "orgulloso", plural: ["revisión", "revisiones"], frase: { seco: "Revisión lista. Buena semana.", motivador: "Semana revisada. A por la siguiente.", tranquilo: "Completaste la revisión semanal." } },
};
