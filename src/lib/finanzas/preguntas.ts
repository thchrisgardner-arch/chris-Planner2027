/**
 * Pregúntale a Centavo, etapa 1 (Fase 5): respuestas calculadas en el dispositivo, sin IA.
 *  - `armarResumen` junta lo necesario (gastos agregados por día, categoría y concepto; ingresos;
 *    ahorro; pagos fijos). Es lo único que leería la etapa 2, y solo en forma agregada.
 *  - `responderPregunta(pregunta, resumen)` reconoce la intención por reglas (categoría, concepto,
 *    periodo) y responde con plantillas en la voz de Centavo. Nunca inventa cifras: si no entiende
 *    o no hay datos, lo dice.
 * Funciones puras.
 */
import type { Database } from "../../types/db";
import { addDays, addMonths, endOfMonth, monthKey, monthLabel, startOfWeek } from "../../utils/dates";
import { formatCOP } from "../../utils/money";
import { normalizarConcepto, claveFinal } from "./conceptos";
import { detectStoreInText } from "../../modules/other/stores";

/* ═════════ Resumen financiero (agregado) ═════════ */
export interface GastoAgregado {
  fecha: string;
  categoria: string;
  concepto: string;
  nombre: string;
  monto: number;
  veces: number;
}
export interface ResumenFinanciero {
  hoy: string;
  gastos: GastoAgregado[];
  ingresos: { fecha: string; monto: number }[];
  ahorro: { total: number; metas: { nombre: string; actual: number; objetivo: number }[] };
  fijos: { pagado: number; falta: number; pendientes: number; total: number };
}

export function armarResumen(db: Database, hoy: string, fijos: ResumenFinanciero["fijos"], uniones: Record<string, string> = {}): ResumenFinanciero {
  const mapa = new Map<string, GastoAgregado>();
  const ingresos = new Map<string, number>();
  for (const t of db.transactions) {
    if (t.status !== "completado" || t.date > hoy) continue;
    if (t.type === "ingreso") ingresos.set(t.date, (ingresos.get(t.date) ?? 0) + Math.round(t.amount));
    if (t.type !== "gasto") continue;
    const concepto = claveFinal(normalizarConcepto(t.description), uniones);
    const categoria = t.category ?? "Sin categoría";
    const k = `${t.date}|${categoria}|${concepto}`;
    const g = mapa.get(k) ?? { fecha: t.date, categoria, concepto, nombre: detectStoreInText(concepto)?.name ?? concepto.charAt(0).toUpperCase() + concepto.slice(1), monto: 0, veces: 0 };
    g.monto += Math.round(t.amount);
    g.veces += 1;
    mapa.set(k, g);
  }
  return {
    hoy,
    gastos: [...mapa.values()],
    ingresos: [...ingresos.entries()].map(([fecha, monto]) => ({ fecha, monto })),
    ahorro: { total: db.savings_goals.reduce((n, g) => n + g.current_amount, 0), metas: db.savings_goals.map((g) => ({ nombre: g.name, actual: g.current_amount, objetivo: g.target_amount })) },
    fijos,
  };
}

/* ═════════ Lectura de la pregunta ═════════ */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

interface Periodo {
  desde: string;
  hasta: string;
  /** "este mes", "en octubre", "la semana pasada" */
  nombre: string;
  /** El periodo anterior del mismo largo (para comparar) */
  anterior?: { desde: string; hasta: string; nombre: string };
}

function periodoDe(q: string, hoy: string): Periodo {
  const mes = monthKey(hoy);
  const nombreMes = (k: string) => monthLabel(k).split(" ")[0].toLowerCase();
  const mesAnterior = (k: string, hastaDia?: number) => {
    const a = addMonths(k, -1);
    const fin = hastaDia ? `${a}-${String(Math.min(hastaDia, Number(endOfMonth(a).slice(8)))).padStart(2, "0")}` : endOfMonth(a);
    return { desde: `${a}-01`, hasta: fin, nombre: nombreMes(a) };
  };
  if (/\b(hoy)\b/.test(q)) return { desde: hoy, hasta: hoy, nombre: "hoy", anterior: { desde: addDays(hoy, -1), hasta: addDays(hoy, -1), nombre: "ayer" } };
  if (/\bayer\b/.test(q)) return { desde: addDays(hoy, -1), hasta: addDays(hoy, -1), nombre: "ayer" };
  if (/\bsemana pasada\b/.test(q)) {
    const ini = addDays(startOfWeek(hoy), -7);
    return { desde: ini, hasta: addDays(ini, 6), nombre: "la semana pasada", anterior: { desde: addDays(ini, -7), hasta: addDays(ini, -1), nombre: "la semana anterior" } };
  }
  if (/\b(esta semana|en la semana)\b/.test(q)) {
    const ini = startOfWeek(hoy);
    return { desde: ini, hasta: hoy, nombre: "esta semana", anterior: { desde: addDays(ini, -7), hasta: addDays(hoy, -7), nombre: "la semana pasada" } };
  }
  if (/\bmes pasado\b/.test(q)) {
    const a = mesAnterior(mes);
    return { desde: a.desde, hasta: a.hasta, nombre: `en ${a.nombre}`, anterior: mesAnterior(addMonths(mes, -1)) };
  }
  if (/\b(este ano|en el ano|en lo que va del ano)\b/.test(q)) return { desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy, nombre: "este año" };
  const m = MESES.findIndex((x) => new RegExp(`\\b${x}\\b`).test(q));
  if (m >= 0) {
    let anio = Number(hoy.slice(0, 4));
    if (m + 1 > Number(hoy.slice(5, 7))) anio -= 1; // "en diciembre" (en noviembre) es el del año pasado
    const k = `${anio}-${String(m + 1).padStart(2, "0")}`;
    const fin = k === mes ? hoy : endOfMonth(k);
    return { desde: `${k}-01`, hasta: fin, nombre: `en ${MESES[m]}`, anterior: mesAnterior(k) };
  }
  return { desde: `${mes}-01`, hasta: hoy, nombre: "este mes", anterior: mesAnterior(mes, Number(hoy.slice(8))) };
}

/** Palabras con las que la gente nombra cada categoría */
const SINONIMOS: [RegExp, string][] = [
  [/\b(comida|alimentacion|mercado|almuerzos?|restaurantes?|domicilios?)\b/, "Alimentación"],
  [/\b(transporte|taxis?|buses?|gasolina|parqueaderos?|transmilenio)\b/, "Transporte"],
  [/\b(vivienda|arriendo|casa)\b/, "Vivienda"],
  [/\b(servicios|luz|agua|internet|gas)\b/, "Servicios"],
  [/\b(salud|medicinas?|medico|droguerias?)\b/, "Salud"],
  [/\b(gimnasio|gym)\b/, "Gimnasio"],
  [/\b(entretenimiento|salidas?|cine|planes)\b/, "Entretenimiento"],
  [/\b(ropa|compras personales|compras)\b/, "Compras personales"],
  [/\b(tecnologia|celular|computador)\b/, "Tecnología"],
  [/\b(suscripciones|streaming)\b/, "Suscripciones"],
  [/\b(familia|mama|papa|hijos?)\b/, "Familia"],
  [/\b(deudas|cuotas?|creditos?)\b/, "Deudas"],
  [/\b(apuestas|baloto|loteria)\b/, "Apuestas"],
  [/\b(educacion|estudios?|cursos?)\b/, "Educación"],
  [/\b(mascotas?|perro|gato)\b/, "Mascotas"],
];

export type Intencion = "mayor-gasto" | "categoria" | "concepto" | "ahorro" | "fijos" | "comparar" | "ingresos" | "balance" | "no-entendida";

export interface Respuesta {
  intencion: Intencion;
  /** La cifra principal ya formateada (o null si no hay) */
  cifra: string | null;
  /** Frase corta en la voz de Centavo */
  frase: string;
  enlace: { label: string; href: string } | null;
}

export const SUGERENCIAS = [
  "¿En qué gasté más este mes?",
  "¿Cómo voy en comida?",
  "¿Cuánto llevo ahorrado?",
  "¿Cuánto me falta de pagos fijos?",
  "¿Gasté más que el mes pasado?",
  "¿Cuánto gasté en Rappi?",
];

const sumar = (gs: GastoAgregado[]) => gs.reduce((n, g) => n + g.monto, 0);
const enRango = (gs: GastoAgregado[], p: { desde: string; hasta: string }) => gs.filter((g) => g.fecha >= p.desde && g.fecha <= p.hasta);
const pctDe = (a: number, b: number) => Math.round(((a - b) / b) * 100);

function variacion(actual: number, anterior: number, nombre: string, tranquilo: boolean): string {
  if (anterior <= 0) return "";
  const p = pctDe(actual, anterior);
  if (Math.abs(p) < 3) return ` Casi igual que ${nombre}.`;
  if (p > 0) return tranquilo ? ` Un ${p} % más que ${nombre}; nada que no se pueda acomodar.` : ` Es un ${p} % más que ${nombre}.`;
  return ` Un ${Math.abs(p)} % menos que ${nombre}. Bien ahí.`;
}

/**
 * Responde una pregunta con los datos del resumen. `tranquilo`: tono suave (chequeo de ánimo bajo).
 * Preparada para la etapa 2: misma firma, el resumen ya viene agregado.
 */
export function responderPregunta(pregunta: string, r: ResumenFinanciero, tranquilo = false): Respuesta {
  const q = norm(pregunta);
  // "¿Gasté más que el mes pasado?": el periodo es este mes y se compara con el anterior
  const comparando = /\b(mas que|menos que|comparad\w*|comparar|vs|frente a)\b/.test(q);
  const p = periodoDe(comparando ? q.replace(/\b(que|con|a|vs|frente a) (el |la )?(mes pasado|semana pasada)\b/, " ") : q, r.hoy);
  const gastosP = enRango(r.gastos, p);
  const totalP = sumar(gastosP);
  const sinDatos = (que: string): Respuesta => ({ intencion: "no-entendida", cifra: null, frase: `No tengo ${que} ${p.nombre} para responder eso.`, enlace: { label: "Ver movimientos", href: "/finanzas?tab=movimientos" } });

  // Ahorro
  if (/\b(ahorr\w*|metas?)\b/.test(q) && !/\bgast/.test(q)) {
    if (!r.ahorro.metas.length) return { intencion: "ahorro", cifra: formatCOP(0), frase: "Todavía no tienes metas de ahorro. Crea una y te ayudo a llegar.", enlace: { label: "Ver ahorros", href: "/finanzas?tab=ahorros" } };
    const mejor = [...r.ahorro.metas].sort((a, b) => b.actual / b.objetivo - a.actual / a.objetivo)[0];
    return {
      intencion: "ahorro",
      cifra: formatCOP(r.ahorro.total),
      frase: `Llevas ${formatCOP(r.ahorro.total)} en ${r.ahorro.metas.length === 1 ? "tu meta" : `tus ${r.ahorro.metas.length} metas`}. La más adelantada es ${mejor.nombre}, al ${Math.round((mejor.actual / mejor.objetivo) * 100)} %.`,
      enlace: { label: "Ver ahorros", href: "/finanzas?tab=ahorros" },
    };
  }

  // Pagos fijos
  if (/\b(pagos? fijos?|fijos|recibos)\b/.test(q)) {
    if (!r.fijos.total) return { intencion: "fijos", cifra: formatCOP(0), frase: "No tienes pagos fijos registrados.", enlace: { label: "Ver pagos fijos", href: "/finanzas?tab=fijos" } };
    return {
      intencion: "fijos",
      cifra: formatCOP(r.fijos.falta),
      frase: r.fijos.falta ? `Te faltan ${formatCOP(r.fijos.falta)} de pagos fijos este mes (${r.fijos.pendientes} ${r.fijos.pendientes === 1 ? "pendiente" : "pendientes"}). Ya pagaste ${formatCOP(r.fijos.pagado)}.` : `Ya pagaste todos los fijos del mes: ${formatCOP(r.fijos.pagado)}.`,
      enlace: { label: "Ver pagos fijos", href: "/finanzas?tab=fijos" },
    };
  }

  // Ingresos y balance
  const ingresosP = r.ingresos.filter((x) => x.fecha >= p.desde && x.fecha <= p.hasta).reduce((n, x) => n + x.monto, 0);
  if (/\b(balance|me queda|quedo|ahorre este)\b/.test(q)) {
    const b = ingresosP - totalP;
    return {
      intencion: "balance",
      cifra: formatCOP(b),
      frase: b >= 0 ? `${cap(p.nombre)} entraron ${formatCOP(ingresosP)} y salieron ${formatCOP(totalP)}: vas ${formatCOP(b)} en verde.` : `${cap(p.nombre)} salieron ${formatCOP(-b)} más de lo que entró. ${tranquilo ? "Lo vemos con calma." : "Toca ajustar un poco."}`,
      enlace: { label: "Ver resumen", href: "/finanzas" },
    };
  }
  if (/\b(ingresos?|me entro|entraron|me pagaron|gane)\b/.test(q)) {
    return { intencion: "ingresos", cifra: formatCOP(ingresosP), frase: ingresosP ? `${cap(p.nombre)} te entraron ${formatCOP(ingresosP)}.` : `${cap(p.nombre)} no hay ingresos registrados.`, enlace: { label: "Ver movimientos", href: "/finanzas?tab=movimientos" } };
  }

  // Comparar con el periodo anterior
  if (comparando && p.anterior) {
    const antes = sumar(enRango(r.gastos, p.anterior));
    if (!totalP && !antes) return sinDatos("gastos");
    const d = totalP - antes;
    return {
      intencion: "comparar",
      cifra: formatCOP(Math.abs(d)),
      frase:
        antes === 0
          ? `${cap(p.nombre)} llevas ${formatCOP(totalP)} y ${p.anterior.nombre} no hubo gastos para comparar.`
          : d > 0
            ? `Sí: ${p.nombre} llevas ${formatCOP(totalP)}, ${formatCOP(d)} más que ${p.anterior.nombre} a esta altura (${pctDe(totalP, antes)} %).${tranquilo ? " Nada grave; lo revisamos juntos." : ""}`
            : `No: ${p.nombre} llevas ${formatCOP(totalP)}, ${formatCOP(-d)} menos que ${p.anterior.nombre} a esta altura. Bien ahí.`,
      enlace: { label: "Ver resumen", href: "/finanzas" },
    };
  }

  // ¿En qué gasté más?
  if (/\b(en que (gaste|se me fue|se fue)|mayor gasto|gaste mas|mas gaste|lo que mas)\b/.test(q)) {
    if (!gastosP.length) return sinDatos("gastos");
    const porConcepto = new Map<string, { nombre: string; monto: number }>();
    for (const g of gastosP) porConcepto.set(g.concepto, { nombre: g.nombre, monto: (porConcepto.get(g.concepto)?.monto ?? 0) + g.monto });
    const top = [...porConcepto.values()].sort((a, b) => b.monto - a.monto)[0];
    const porCat = new Map<string, number>();
    for (const g of gastosP) porCat.set(g.categoria, (porCat.get(g.categoria) ?? 0) + g.monto);
    const cat = [...porCat.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      intencion: "mayor-gasto",
      cifra: formatCOP(top.monto),
      frase: `${cap(p.nombre)} lo que más se llevó fue ${top.nombre}: ${formatCOP(top.monto)} (${Math.round((top.monto / totalP) * 100)} % de tus gastos). Por categoría, ${cat[0]} con ${formatCOP(cat[1])}.`,
      enlace: { label: "Ver en qué se va", href: "/finanzas" },
    };
  }

  // Una categoría: "¿cómo voy en comida?"
  const sin = SINONIMOS.find(([re]) => re.test(q));
  const categorias = new Set(r.gastos.map((g) => g.categoria));
  const directa = [...categorias].find((c) => q.includes(norm(c)));
  const categoria = directa ?? sin?.[1];
  // Un concepto: "¿cuánto gasté en Rappi?" (si el texto nombra un concepto que existe)
  const conceptos = new Map(r.gastos.map((g) => [g.concepto, g.nombre]));
  const concepto = [...conceptos.keys()].filter((k) => k.length >= 3 && new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(q)).sort((a, b) => b.length - a.length)[0];
  const preguntaGasto = /\b(gast\w*|como voy|cuanto (llevo|va)|se me va|se va)\b/.test(q);

  // Si la palabra es también un sinónimo de categoría ("mercado"), manda la categoría; un comercio (Rappi, Uber) manda el concepto
  const usarConcepto = !!concepto && (!sin || !sin[0].test(concepto) || !!detectStoreInText(concepto));
  if (usarConcepto && (preguntaGasto || !categoria)) {
    const gs = gastosP.filter((g) => g.concepto === concepto);
    const total = sumar(gs);
    const veces = gs.reduce((n, g) => n + g.veces, 0);
    const antes = p.anterior ? sumar(enRango(r.gastos, p.anterior).filter((g) => g.concepto === concepto)) : 0;
    return {
      intencion: "concepto",
      cifra: formatCOP(total),
      frase: total ? `${cap(p.nombre)} llevas ${formatCOP(total)} en ${conceptos.get(concepto)} (${veces} ${veces === 1 ? "vez" : "veces"}).${p.anterior ? variacion(total, antes, p.anterior.nombre, tranquilo) : ""}` : `${cap(p.nombre)} no hay gastos en ${conceptos.get(concepto)}.`,
      enlace: { label: "Ver en qué se va", href: "/finanzas" },
    };
  }
  if (categoria && (preguntaGasto || /\b(en|de)\b/.test(q))) {
    const gs = gastosP.filter((g) => g.categoria === categoria);
    const total = sumar(gs);
    const antes = p.anterior ? sumar(enRango(r.gastos, p.anterior).filter((g) => g.categoria === categoria)) : 0;
    return {
      intencion: "categoria",
      cifra: formatCOP(total),
      frase: total
        ? `${cap(p.nombre)} llevas ${formatCOP(total)} en ${categoria.toLowerCase()}, el ${Math.round((total / totalP) * 100)} % de tus gastos.${p.anterior ? variacion(total, antes, p.anterior.nombre, tranquilo) : ""}`
        : `${cap(p.nombre)} no hay gastos en ${categoria.toLowerCase()}.`,
      enlace: { label: `Ver gastos de ${categoria}`, href: "/finanzas?tab=movimientos" },
    };
  }
  // "¿Cuánto gasté este mes?"
  if (/\b(cuanto (he )?gaste|cuanto llevo gastado|gastos)\b/.test(q)) {
    return { intencion: "categoria", cifra: formatCOP(totalP), frase: `${cap(p.nombre)} llevas ${formatCOP(totalP)} en gastos.${p.anterior ? variacion(totalP, sumar(enRango(r.gastos, p.anterior)), p.anterior.nombre, tranquilo) : ""}`, enlace: { label: "Ver movimientos", href: "/finanzas?tab=movimientos" } };
  }

  return { intencion: "no-entendida", cifra: null, frase: "Esa no me la sé todavía. Prueba con alguna de estas:", enlace: null };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
