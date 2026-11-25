/**
 * Fichas de los 6 asistentes: quiénes son, qué observan y cómo hablan.
 * Las plantillas cambian por tono (seco · motivador · tranquilo), no solo por personaje.
 * Reglas de escritura: español de Colombia, tuteo, 4 a 14 palabras, dato concreto cuando lo hay,
 * nunca culpabilizar, sin emojis.
 */
import type { AsistenteId, CharColor, Colores } from "./tipos";

export type Tono = "seco" | "motivador" | "tranquilo";
export type Avisos = "nunca" | "resumen-diario" | "en-el-momento";

export const TONOS: { value: Tono; label: string; descripcion: string }[] = [
  { value: "seco", label: "Seco", descripcion: "Frases cortas y humor irónico suave." },
  { value: "motivador", label: "Motivador", descripcion: "Positivo y con energía, sin cursilería." },
  { value: "tranquilo", label: "Tranquilo", descripcion: "Neutro, informativo y amable." },
];

export const AVISOS: { value: Avisos; label: string }[] = [
  { value: "nunca", label: "Nunca" },
  { value: "resumen-diario", label: "Resumen diario" },
  { value: "en-el-momento", label: "En el momento" },
];

/** Datos que puede usar una plantilla */
export type Datos = Record<string, string | number>;
type Plantilla = Record<Tono, (d: Datos) => string>;

export interface Ficha {
  id: AsistenteId;
  nombre: string;
  animal: string;
  modulo: string;
  href: string;
  funcion: string;
  rasgos: string[];
  observa: string[];
  prop: string;
  combinaciones: Colores[];
  /** Frase del estado vacío del módulo */
  vacio: Record<Tono, string>;
  plantillas: Record<string, Plantilla>;
}

const c = (primario: CharColor, secundario: CharColor, detalle: CharColor): Colores => ({ primario, secundario, detalle });

export const FICHAS: Record<AsistenteId, Ficha> = {
  centavo: {
    id: "centavo",
    nombre: "Centavo",
    animal: "Hámster",
    modulo: "Finanzas",
    href: "/finanzas",
    funcion: "Gastos fuera de lo normal, pagos próximos, resumen del mes y ritmo de ahorro.",
    rasgos: ["Acaparador", "Cauteloso", "Humor seco con la plata"],
    observa: ["Movimientos", "Cuentas", "Objetivos de ahorro"],
    prop: "la moneda",
    combinaciones: [c("yellow", "yellow-soft", "sand"), c("sand", "cream", "charcoal"), c("lime-soft", "white", "lime"), c("gray-light", "white", "charcoal")],
    vacio: {
      seco: "Aún no hay plata que contar.",
      motivador: "Registra tu primer movimiento y arrancamos.",
      tranquilo: "Cuando registres movimientos, te cuento cómo vas.",
    },
    plantillas: {
      sinDatos: {
        seco: () => "Nada que contar todavía. Sospechoso.",
        motivador: () => "Registra un movimiento y empezamos a cuidar la plata.",
        tranquilo: () => "Aún no hay movimientos este mes.",
      },
      categoriaSube: {
        seco: (d) => `Llevas ${d.pct}% más en ${d.cat} que en ${d.mes}.`,
        motivador: (d) => `${d.cat} subió ${d.pct}% frente a ${d.mes}. Ajustemos.`,
        tranquilo: (d) => `${d.cat} va ${d.pct}% por encima de ${d.mes}.`,
      },
      gastoAlto: {
        seco: (d) => `Otro gasto de ${d.monto}. Lo anoto. No lo apruebo.`,
        motivador: (d) => `Gasto de ${d.monto} hoy. Que valga la pena.`,
        tranquilo: (d) => `Hoy registraste un gasto de ${d.monto}.`,
      },
      balanceNegativo: {
        seco: (d) => `Este mes salen ${d.dif} más de lo que entra.`,
        motivador: (d) => `Faltan ${d.dif} para equilibrar el mes. Se puede.`,
        tranquilo: (d) => `Los gastos superan los ingresos por ${d.dif}.`,
      },
      ahorroCerca: {
        seco: (d) => `${d.meta} va en ${d.pct}%. Casi me da gusto.`,
        motivador: (d) => `${d.meta} va en ${d.pct}%. Ya casi la tienes.`,
        tranquilo: (d) => `${d.meta} va en ${d.pct}% de la meta.`,
      },
      resumen: {
        seco: (d) => `Van ${d.gastos} gastados este mes. Lo tengo anotado.`,
        motivador: (d) => `Llevas ${d.gastos} en gastos este mes. Buen control.`,
        tranquilo: (d) => `Este mes llevas ${d.gastos} en gastos.`,
      },
    },
  },
  brote: {
    id: "brote",
    nombre: "Brote",
    animal: "Tortuga",
    modulo: "Hábitos",
    href: "/salud",
    funcion: "Hábitos del día, rachas y aviso cuando una racha está por romperse.",
    rasgos: ["Calmado", "Paciente", "De pocas palabras"],
    observa: ["Hábitos", "Registros diarios"],
    prop: "el brote",
    combinaciones: [c("lime-soft", "cream", "lime"), c("sand", "cream", "lime"), c("gray-light", "white", "charcoal"), c("yellow-soft", "cream", "sand")],
    vacio: {
      seco: "Ningún hábito. Mucha calma, poco avance.",
      motivador: "Crea un hábito pequeño. Lo demás llega.",
      tranquilo: "Crea tu primer hábito cuando quieras.",
    },
    plantillas: {
      sinDatos: {
        seco: () => "Sin hábitos. Yo espero, soy tortuga.",
        motivador: () => "Un hábito pequeño hoy cambia el año.",
        tranquilo: () => "Aún no tienes hábitos creados.",
      },
      rachaRiesgo: {
        seco: (d) => `${d.racha} días de racha en ${d.habito}. Hoy falta.`,
        motivador: (d) => `No sueltes ${d.habito}: llevas ${d.racha} días.`,
        tranquilo: (d) => `${d.habito} lleva ${d.racha} días y hoy falta marcarlo.`,
      },
      pendientes: {
        seco: (d) => `Despacio también se llega. Te faltan ${d.n} hoy.`,
        motivador: (d) => `Te faltan ${d.n} hábitos hoy. Vamos por ellos.`,
        tranquilo: (d) => `Hoy quedan ${d.n} hábitos por marcar.`,
      },
      todoListo: {
        seco: () => "Hoy cumpliste todo. Ni yo lo esperaba.",
        motivador: () => "Todos los hábitos de hoy listos. Así es.",
        tranquilo: () => "Completaste los hábitos de hoy.",
      },
      racha: {
        seco: (d) => `${d.racha} días seguidos. No lo arruines.`,
        motivador: (d) => `${d.racha} días seguidos con ${d.habito}. Imparable.`,
        tranquilo: (d) => `Llevas ${d.racha} días seguidos con ${d.habito}.`,
      },
      descanso: {
        seco: () => "Hoy no toca nada. Descansa, yo vigilo.",
        motivador: () => "Día libre de hábitos. Recarga energía.",
        tranquilo: () => "Hoy no tienes hábitos programados.",
      },
    },
  },
  tuerca: {
    id: "tuerca",
    nombre: "Tuerca",
    animal: "Castor",
    modulo: "Proyectos",
    href: "/proyectos",
    funcion: "Siguiente tarea, proyectos estancados y dividir metas en tareas.",
    rasgos: ["Práctico", "Constructor", "Algo gruñón"],
    observa: ["Proyectos", "Tareas", "Fechas de entrega"],
    prop: "el lápiz",
    combinaciones: [c("sand", "cream", "charcoal"), c("yellow", "yellow-soft", "charcoal"), c("gray-light", "white", "sand"), c("cream", "white", "lime")],
    vacio: {
      seco: "Nada que construir todavía.",
      motivador: "Arma tu primer proyecto. Yo traigo el lápiz.",
      tranquilo: "Crea un proyecto y lo dividimos en tareas.",
    },
    plantillas: {
      sinDatos: {
        seco: () => "Nada que construir todavía.",
        motivador: () => "Crea un proyecto y lo levantamos juntos.",
        tranquilo: () => "Aún no tienes proyectos.",
      },
      vencida: {
        seco: (d) => `${d.tarea} venció ${d.cuando}. Sigue ahí.`,
        motivador: (d) => `${d.tarea} venció ${d.cuando}. Cerrémosla hoy.`,
        tranquilo: (d) => `${d.tarea} tenía fecha ${d.cuando}.`,
      },
      estancado: {
        seco: (d) => `${d.proyecto} lleva ${d.dias} días quieto. ¿Lo partimos?`,
        motivador: (d) => `${d.proyecto} espera hace ${d.dias} días. Una tarea y arranca.`,
        tranquilo: (d) => `${d.proyecto} no avanza hace ${d.dias} días.`,
      },
      sinTareas: {
        seco: (d) => `${d.proyecto} no tiene tareas. Así no se construye.`,
        motivador: (d) => `Dale tareas a ${d.proyecto} y empieza a avanzar.`,
        tranquilo: (d) => `${d.proyecto} todavía no tiene tareas.`,
      },
      siguiente: {
        seco: (d) => `Lo siguiente: ${d.tarea}. Sin rodeos.`,
        motivador: (d) => `Siguiente paso: ${d.tarea}. Tú puedes.`,
        tranquilo: (d) => `Tu siguiente tarea es ${d.tarea}.`,
      },
      todoListo: {
        seco: () => "Cero tareas pendientes. Raro, pero bien.",
        motivador: () => "Todo al día. Buen trabajo.",
        tranquilo: () => "No tienes tareas pendientes.",
      },
    },
  },
  tic: {
    id: "tic",
    nombre: "Tic",
    animal: "Gallo",
    modulo: "Calendario",
    href: "/calendario",
    funcion: "Agenda del día, vencimientos y choques de horario.",
    rasgos: ["Puntual", "Mandón", "Intenso"],
    observa: ["Eventos", "Tareas con fecha"],
    prop: "el reloj",
    combinaciones: [c("charcoal", "white", "lime"), c("yellow", "white", "charcoal"), c("cream", "white", "lime"), c("gray-light", "white", "yellow")],
    vacio: {
      seco: "Agenda vacía. Sospechosamente vacía.",
      motivador: "Agenda libre. Llénala con algo bueno.",
      tranquilo: "No tienes eventos por ahora.",
    },
    plantillas: {
      sinDatos: {
        seco: () => "Agenda vacía. Sospechosamente vacía.",
        motivador: () => "Agenda libre. Planea algo que valga la pena.",
        tranquilo: () => "No tienes eventos próximos.",
      },
      ahora: {
        seco: (d) => `A las ${d.hora} tienes ${d.evento}. Son las ${d.ahora}. Solo digo.`,
        motivador: (d) => `${d.evento} a las ${d.hora}. Llegas a tiempo.`,
        tranquilo: (d) => `${d.evento} empieza a las ${d.hora}.`,
      },
      choque: {
        seco: (d) => `${d.a} y ${d.b} se cruzan hoy. Elige.`,
        motivador: (d) => `${d.a} y ${d.b} chocan hoy. Reacomodemos.`,
        tranquilo: (d) => `${d.a} y ${d.b} coinciden en horario hoy.`,
      },
      manana: {
        seco: (d) => `Mañana vence ${d.que}. Avisado quedas.`,
        motivador: (d) => `Mañana vence ${d.que}. Adelántate hoy.`,
        tranquilo: (d) => `Mañana vence ${d.que}.`,
      },
      hoy: {
        seco: (d) => `Hoy tienes ${d.n}. El primero a las ${d.hora}.`,
        motivador: (d) => `${d.n} hoy. Arrancas a las ${d.hora}.`,
        tranquilo: (d) => `Hoy tienes ${d.n}, desde las ${d.hora}.`,
      },
      libre: {
        seco: () => "Hoy no hay nada. Disfrútalo mientras dura.",
        motivador: () => "Día libre en la agenda. Aprovéchalo.",
        tranquilo: () => "Hoy no tienes compromisos.",
      },
    },
  },
  cima: {
    id: "cima",
    nombre: "Cima",
    animal: "Cabra de montaña",
    modulo: "Objetivos",
    href: "/objetivos",
    funcion: "Avance de los objetivos 2027 y revisión mensual.",
    rasgos: ["Terca", "Determinada", "Motivadora exigente"],
    observa: ["Objetivos anuales", "Avance por área"],
    prop: "la bandera",
    combinaciones: [c("cream", "white", "sand"), c("gray-light", "white", "charcoal"), c("sand", "cream", "charcoal"), c("white", "cream", "lime")],
    vacio: {
      seco: "Sin objetivos no hay montaña.",
      motivador: "Define una meta para 2027. Yo subo contigo.",
      tranquilo: "Crea tus objetivos para 2027.",
    },
    plantillas: {
      sinDatos: {
        seco: () => "Sin objetivos no hay montaña que subir.",
        motivador: () => "Ponle cumbre a tu 2027. Define un objetivo.",
        tranquilo: () => "Aún no tienes objetivos para 2027.",
      },
      logrado: {
        seco: (d) => `${d.meta} logrado. Ahora la siguiente.`,
        motivador: (d) => `Lograste ${d.meta}. Esa es la actitud.`,
        tranquilo: (d) => `Completaste ${d.meta}.`,
      },
      atrasado: {
        seco: (d) => `Vas en ${d.pct}% de tu meta anual. Es ${d.mes}. Toca subir.`,
        motivador: (d) => `${d.pct}% en ${d.mes}. Hay tiempo para remontar.`,
        tranquilo: (d) => `Tu avance anual es ${d.pct}% en ${d.mes}.`,
      },
      adelantado: {
        seco: (d) => `${d.pct}% en ${d.mes}. No te confíes.`,
        motivador: (d) => `${d.pct}% y apenas es ${d.mes}. Vas volando.`,
        tranquilo: (d) => `Vas en ${d.pct}%, por encima del ritmo.`,
      },
      enRitmo: {
        seco: (d) => `${d.pct}% en ${d.mes}. Justo a tiempo.`,
        motivador: (d) => `${d.pct}% en ${d.mes}. Ritmo perfecto, sigue.`,
        tranquilo: (d) => `Vas en ${d.pct}%, al ritmo esperado.`,
      },
    },
  },
  antojo: {
    id: "antojo",
    nombre: "Antojo",
    animal: "Mapache",
    modulo: "Wishlist",
    href: "/wishlist",
    funcion: "Cuándo se puede comprar algo de la wishlist sin tocar el ahorro.",
    rasgos: ["Pícaro", "Tentador", "Honesto"],
    observa: ["Wishlist", "Dinero disponible", "Ahorro"],
    prop: "la bolsa",
    combinaciones: [c("gray-light", "white", "ink"), c("sand", "cream", "charcoal"), c("cream", "white", "charcoal"), c("yellow-soft", "white", "ink")],
    vacio: {
      seco: "Nada en la mira. Qué aburrido.",
      motivador: "Guarda eso que quieres. Planeamos la compra.",
      tranquilo: "Agrega deseos y te digo cuándo comprarlos.",
    },
    plantillas: {
      sinDatos: {
        seco: () => "Nada en la mira. Qué aburrido.",
        motivador: () => "Guarda lo que te antoja y lo planeamos.",
        tranquilo: () => "Tu wishlist está vacía.",
      },
      alcanza: {
        seco: (d) => `${d.deseo} cabe sin tocar tu ahorro. Yo solo digo.`,
        motivador: (d) => `${d.deseo} ya cabe sin tocar el ahorro.`,
        tranquilo: (d) => `Puedes comprar ${d.deseo} sin usar tu ahorro.`,
      },
      esperar: {
        seco: (d) => `${d.deseo} sigue ahí. Faltan ${d.falta} para no tocar el ahorro.`,
        motivador: (d) => `Te faltan ${d.falta} para ${d.deseo}. Ya casi.`,
        tranquilo: (d) => `Para ${d.deseo} sin tocar el ahorro faltan ${d.falta}.`,
      },
      ahorrando: {
        seco: (d) => `${d.deseo} va en ${d.pct}%. Paciencia, no es lo mío.`,
        motivador: (d) => `${d.deseo} va en ${d.pct}%. Sigue así.`,
        tranquilo: (d) => `${d.deseo} lleva ${d.pct}% ahorrado.`,
      },
    },
  },
};
