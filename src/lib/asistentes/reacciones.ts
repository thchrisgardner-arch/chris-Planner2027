/** Frases y poses de reacción inmediata a cada acción que da XP. */
import type { Tono } from "./definiciones";
import type { TipoAccion } from "./progreso";
import type { Pose } from "./tipos";

export const REACCION: Record<TipoAccion, { pose: Pose; plural: [string, string]; frase: Record<Tono, string> }> = {
  movimiento: { pose: "idle", plural: ["movimiento", "movimientos"], frase: { seco: "Anotado.", motivador: "Registrado. Bien ahí.", tranquilo: "Movimiento registrado." } },
  ingreso: { pose: "feliz", plural: ["ingreso", "ingresos"], frase: { seco: "Entró plata. Anotado.", motivador: "Ingreso registrado. Así se crece.", tranquilo: "Ingreso registrado." } },
  "mes-verde": { pose: "celebrando", plural: ["mes en verde", "meses en verde"], frase: { seco: "Mes en verde. Bien hecho.", motivador: "Cerraste el mes en verde. Enorme.", tranquilo: "Cerraste el mes con más ingresos que gastos." } },
  "mes-rojo": { pose: "triste", plural: ["mes en rojo", "meses en rojo"], frase: { seco: "Mes en rojo. Toca ajustar.", motivador: "Mes en rojo. El próximo lo volteamos.", tranquilo: "Cerraste el mes con más gastos que ingresos." } },
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
  mision: { pose: "orgulloso", plural: ["misión", "misiones"], frase: { seco: "Misión cumplida. Siguiente.", motivador: "¡Misión cumplida! Vas con todo.", tranquilo: "Completaste una misión del día." } },
  "misiones-dia": { pose: "celebrando", plural: ["bonus de misiones", "bonus de misiones"], frase: { seco: "Las tres. Nada mal.", motivador: "¡Las tres misiones listas! Día redondo.", tranquilo: "Completaste las misiones de hoy." } },
  "meta-diaria": { pose: "celebrando", plural: ["meta diaria", "metas diarias"], frase: { seco: "Meta del día. Cumplida.", motivador: "¡Meta diaria cumplida! Así se hace.", tranquilo: "Llegaste a tu meta de hoy." } },
  "hito-racha": { pose: "celebrando", plural: ["hito de racha", "hitos de racha"], frase: { seco: "Hito de racha. Sigue así.", motivador: "¡Nuevo hito de racha! Imparable.", tranquilo: "Llegaste a un hito de racha." } },
  "reparar-racha": { pose: "orgulloso", plural: ["reparación", "reparaciones"], frase: { seco: "Racha reparada. Que no se repita.", motivador: "¡Racha de vuelta! A cuidarla.", tranquilo: "Reparaste tu racha." } },
};
