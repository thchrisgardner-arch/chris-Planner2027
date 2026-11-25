/**
 * Frases por ánimo y tono. Español de Colombia, tuteo, 4 a 14 palabras, sin emojis.
 * Humor sí, culpa no: nunca humillan ni presionan con el dinero, y lo negativo trae salida.
 */
import type { Animo } from "./animo";
import type { Tono } from "./definiciones";
import type { AsistenteId } from "./tipos";

type Frases = Record<Animo, Record<Tono, string>>;

export const FRASES_ANIMO: Record<AsistenteId, Frases> = {
  centavo: {
    radiante: {
      seco: "Tres semanas registrando todo. Me tienes orgulloso. Un poco.",
      motivador: "Registras todo y gastas con cabeza. Así se hace.",
      tranquilo: "Tus finanzas van muy bien este mes.",
    },
    feliz: {
      seco: "Las cuentas cuadran. No me acostumbro, pero bien.",
      motivador: "Buen ritmo con la plata. Sigue así.",
      tranquilo: "Tus gastos van dentro de lo normal.",
    },
    tranquilo: {
      seco: "Todo en orden. Aburrido, como me gusta.",
      motivador: "Vas estable. Un registro más y mejoramos.",
      tranquilo: "Tus finanzas están estables.",
    },
    preocupado: {
      seco: "Varios días sin anotar nada. ¿Estamos bien?",
      motivador: "Anota lo de estos días y retomamos el control.",
      tranquilo: "Hace unos días no registras movimientos.",
    },
    triste: {
      seco: "Este mes se nos fue de las manos. Lo arreglamos.",
      motivador: "Mes difícil. Un registro hoy ya cambia el rumbo.",
      tranquilo: "Este mes va por encima de tu promedio.",
    },
    dormido: {
      seco: "Nada que contar. Me echo una siesta.",
      motivador: "Registra un movimiento y me despiertas.",
      tranquilo: "Aún no hay movimientos recientes.",
    },
  },
  brote: {
    radiante: {
      seco: "Racha larga y todo cumplido. Hasta yo me sorprendo.",
      motivador: "Constancia total. Eres imparable.",
      tranquilo: "Tus hábitos van excelente.",
    },
    feliz: {
      seco: "Buen paso. Despacio, pero seguro.",
      motivador: "Vas muy bien con tus hábitos. Sigue.",
      tranquilo: "Cumples la mayoría de tus hábitos.",
    },
    tranquilo: {
      seco: "Ni rápido ni lento. Como debe ser.",
      motivador: "Vas a buen ritmo. Uno más hoy.",
      tranquilo: "Tus hábitos van estables.",
    },
    preocupado: {
      seco: "Hoy quedan hábitos sueltos. Todavía hay tiempo.",
      motivador: "Te faltan algunos hoy. Vamos por ellos.",
      tranquilo: "Tienes hábitos pendientes esta semana.",
    },
    triste: {
      seco: "Se rompió la racha. Mañana arrancamos. Despacio.",
      motivador: "La racha se cayó. Hoy empieza una nueva.",
      tranquilo: "Tu racha se reinició. Puedes retomarla hoy.",
    },
    dormido: {
      seco: "Tres días sin hábitos. Yo también duermo.",
      motivador: "Marca un hábito y retomamos juntos.",
      tranquilo: "No hay hábitos marcados recientemente.",
    },
  },
  tuerca: {
    radiante: {
      seco: "Nada vencido y todo avanzando. Raro. Me gusta.",
      motivador: "Proyectos al día. Así se construye.",
      tranquilo: "Tus proyectos van al día.",
    },
    feliz: {
      seco: "La obra avanza. Sin quejas, por ahora.",
      motivador: "Buen avance en tus tareas. Sigue.",
      tranquilo: "Tus tareas avanzan bien.",
    },
    tranquilo: {
      seco: "Ni rápido ni lento. Hay que apretar tuercas.",
      motivador: "Vas estable. Una tarea más hoy.",
      tranquilo: "Tus proyectos están estables.",
    },
    preocupado: {
      seco: "Hay proyectos quietos. ¿Los partimos en tareas?",
      motivador: "Un proyecto se frenó. Una tarea lo destraba.",
      tranquilo: "Algunos proyectos no avanzan hace días.",
    },
    triste: {
      seco: "Varias tareas vencidas. Empecemos por una.",
      motivador: "Se acumularon tareas. Cierra una y arrancamos.",
      tranquilo: "Tienes varias tareas vencidas.",
    },
    dormido: {
      seco: "Nada que construir todavía.",
      motivador: "Crea un proyecto y lo levantamos juntos.",
      tranquilo: "Aún no tienes proyectos activos.",
    },
  },
  tic: {
    radiante: {
      seco: "Todo a tiempo. Así me gusta. Puntual.",
      motivador: "Agenda impecable. Vas como reloj.",
      tranquilo: "Tu agenda está al día.",
    },
    feliz: {
      seco: "Agenda en orden. Por fin.",
      motivador: "Buena organización esta semana.",
      tranquilo: "Tus compromisos van bien.",
    },
    tranquilo: {
      seco: "Agenda normal. Sin sorpresas, espero.",
      motivador: "Todo bajo control. Revisa lo de mañana.",
      tranquilo: "Tu agenda está estable.",
    },
    preocupado: {
      seco: "Hay cruces de horario. Alguien tiene que decidir.",
      motivador: "Dos compromisos chocan. Reacomodemos.",
      tranquilo: "Tienes compromisos que coinciden.",
    },
    triste: {
      seco: "Se pasaron varios vencimientos. Yo avisé.",
      motivador: "Se pasaron fechas. Ponlas al día hoy.",
      tranquilo: "Tienes vencimientos atrasados.",
    },
    dormido: {
      seco: "Agenda vacía. Sospechosamente vacía.",
      motivador: "Agrega un evento y me pongo en marcha.",
      tranquilo: "No tienes eventos próximos.",
    },
  },
  cima: {
    radiante: {
      seco: "Vas por encima del ritmo. No te confíes.",
      motivador: "Vas volando hacia tus metas 2027.",
      tranquilo: "Tus objetivos van adelantados.",
    },
    feliz: {
      seco: "Buen paso en la subida. Sigue.",
      motivador: "Tus objetivos avanzan bien. A seguir.",
      tranquilo: "Tus objetivos van al ritmo esperado.",
    },
    tranquilo: {
      seco: "Ni adelante ni atrás. Toca empujar.",
      motivador: "Vas a tiempo. Un empujón más.",
      tranquilo: "Tus objetivos están en el promedio.",
    },
    preocupado: {
      seco: "Vas algo atrás del ritmo. Toca subir.",
      motivador: "Hay tiempo para remontar. Empieza hoy.",
      tranquilo: "Tus objetivos van por debajo del ritmo.",
    },
    triste: {
      seco: "La montaña sigue ahí. Paso a paso, pero ya.",
      motivador: "Elige un objetivo y avanza un poco hoy.",
      tranquilo: "Tus objetivos necesitan avance.",
    },
    dormido: {
      seco: "Sin objetivos no hay montaña.",
      motivador: "Define una meta 2027 y subimos juntos.",
      tranquilo: "Aún no tienes objetivos para 2027.",
    },
  },
  antojo: {
    radiante: {
      seco: "Compras planeadas y todo con meta. Casi aburrido.",
      motivador: "Compras con plan. Así da gusto.",
      tranquilo: "Tus deseos tienen plan de ahorro.",
    },
    feliz: {
      seco: "Tus antojos tienen plan. Qué responsable.",
      motivador: "Buen manejo de tus deseos.",
      tranquilo: "La mayoría de tus deseos tienen meta.",
    },
    tranquilo: {
      seco: "Algunos deseos sin plan. Yo los vigilo.",
      motivador: "Dale una meta a un deseo más.",
      tranquilo: "Tu wishlist está estable.",
    },
    preocupado: {
      seco: "Muchos antojos sin plan. Tentador, pero no.",
      motivador: "Asocia tus deseos a una meta de ahorro.",
      tranquilo: "Varios deseos no tienen meta de ahorro.",
    },
    triste: {
      seco: "Compraste antes de tiempo. Pasa. La próxima, con plan.",
      motivador: "Para la próxima compra, armemos un plan.",
      tranquilo: "Algunas compras se hicieron sin la meta lista.",
    },
    dormido: {
      seco: "Nada en la mira. Qué aburrido.",
      motivador: "Guarda un deseo y lo planeamos.",
      tranquilo: "Tu wishlist está vacía.",
    },
  },
};
