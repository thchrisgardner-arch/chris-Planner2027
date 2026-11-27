/**
 * Captura rápida: convierte una frase en español de Colombia en una propuesta de registro
 * ("almuerzo 25 mil nequi" → gasto de $25.000 en Alimentación, cuenta Nequi, hoy).
 *
 * Parser local por reglas, sin IA. La entrada pública es `interpretarCaptura(texto, contexto)`,
 * asíncrona a propósito: más adelante puede llamar a la API de Claude sin cambiar a quien la usa.
 *
 * Cómo funciona: cada extractor (recurrencia, días, hora, fecha, monto, cuenta) busca su patrón
 * sobre el texto normalizado y "tapa" lo que reconoce; lo que queda sin tapar es la descripción.
 */
import { addDays, addMonths, daysInMonth, endOfMonth, monthKey, weekdayMon } from "../../utils/dates";
import { CLAVES_DESEO, CLAVES_GASTO, CLAVES_INGRESO, categoriaPorClaves } from "./categorias";

export type TipoCaptura = "gasto" | "ingreso" | "pago-fijo" | "habito" | "evento" | "tarea" | "deseo";

export const TIPO_CAPTURA_LABEL: Record<TipoCaptura, string> = {
  gasto: "Gasto",
  ingreso: "Ingreso",
  "pago-fijo": "Gasto fijo",
  habito: "Hábito",
  evento: "Evento",
  tarea: "Tarea",
  deseo: "Deseo",
};

export interface ContextoCaptura {
  /** Hoy en Bogotá (YYYY-MM-DD) */
  hoy: string;
  cuentas?: { id: string; name: string; type?: string }[];
  proyectos?: { id: string; name: string }[];
  categoriasGasto?: string[];
  categoriasIngreso?: string[];
  /** Palabra (normalizada) → categoría que la persona eligió antes */
  aprendidas?: Record<string, string>;
  /** Cuenta que se usa si la frase no nombra ninguna */
  cuentaPorDefecto?: string | null;
  /** Palabra (normalizada) → proyecto al que la persona ya asignó dos veces esa descripción */
  proyectosAprendidos?: Record<string, string>;
}

export interface Propuesta {
  tipo: TipoCaptura;
  texto: string;
  descripcion: string;
  monto: number | null;
  fecha: string | null;
  hora: string | null;
  categoria: string | null;
  cuentaId: string | null;
  /** Cuenta nombrada en la frase que todavía no existe (p. ej. "Nequi") */
  cuentaMencionada: string | null;
  /** Hábitos: días programados, 0 = lunes … 6 = domingo */
  dias: number[] | null;
  /** Pagos fijos: día del mes en que se paga */
  diaDelMes: number | null;
  /** Tareas, gastos e ingresos: proyecto nombrado en la frase ("para Monni", "#monni") */
  proyectoId: string | null;
  /** Gastos e ingresos sin proyecto en la frase: el que se aprendió para esa descripción (solo se sugiere) */
  proyectoSugerido: string | null;
}

/* ═════════ Texto ═════════ */

/** Minúsculas y sin tildes, conservando la longitud (cada carácter se cambia por uno). */
export function normalizar(s: string): string {
  return s
    .split("")
    .map((c) => {
      const base = c.normalize("NFD")[0] ?? c;
      const min = base.toLowerCase();
      return min.length === 1 ? min : base;
    })
    .join("");
}

class Texto {
  readonly orig: string;
  readonly n: string;
  private tapado: boolean[];
  constructor(s: string) {
    this.orig = s;
    this.n = normalizar(s);
    this.tapado = new Array(s.length).fill(false);
  }
  vista() {
    let out = "";
    for (let i = 0; i < this.n.length; i++) out += this.tapado[i] ? " " : this.n[i];
    return out;
  }
  tapar(desde: number, hasta: number) {
    for (let i = desde; i < hasta && i < this.tapado.length; i++) this.tapado[i] = true;
  }
  /** Recorre las coincidencias de `re` (con bandera g) y tapa las que `fn` no rechace. */
  buscar(re: RegExp, fn: (m: RegExpExecArray) => boolean | void = () => true) {
    const v = this.vista();
    re.lastIndex = 0;
    const encontrados: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(v))) {
      encontrados.push(m);
      if (m[0].length === 0) re.lastIndex++;
    }
    for (const x of encontrados) if (fn(x) !== false) this.tapar(x.index, x.index + x[0].length);
    return encontrados.length > 0;
  }
  resto() {
    let out = "";
    for (let i = 0; i < this.orig.length; i++) out += this.tapado[i] ? " " : this.orig[i];
    return out;
  }
}

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const DIA_RE = "(lunes|martes|miercoles|jueves|viernes|sabados?|domingos?)";
/** "lunes" → 0 · "sabados" → 5 */
const diaIdx = (s: string) => DIAS.findIndex((d) => s === d || s === `${d}s`);
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const NUM_PALABRA: Record<string, number> = {
  un: 1, una: 1, uno: 1, medio: 0.5, media: 0.5, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50,
  sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300,
  cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900,
};
const PALABRAS_NUM = Object.keys(NUM_PALABRA).join("|");
const MULT: Record<string, number> = {
  mil: 1e3, k: 1e3, luca: 1e3, lucas: 1e3, barra: 1e3, barras: 1e3,
  millon: 1e6, millones: 1e6, mill: 1e6, palo: 1e6, palos: 1e6,
};
const SUF = "millones|millon|mill|palos|palo|mil|lucas|luca|barras|barra|k";

const CONECTORES = new Set([
  "de", "del", "en", "con", "para", "por", "el", "la", "los", "las", "a", "al", "y", "e", "desde", "un", "una",
  "unos", "unas", "mi", "mis", "que", "o", "lo", "me", "se",
]);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const capital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const pad = (n: number) => String(n).padStart(2, "0");

/* ═════════ Montos ═════════ */

/** "1.200.000" → 1200000 · "3,2" (con sufijo) → 3.2 · "25.000" → 25000 */
function numeroDe(raw: string, conSufijo: boolean): number {
  const s = raw.replace(/'/g, ".");
  const partes = s.split(/[.,]/);
  if (partes.length === 1) return Number(s);
  const ultima = partes[partes.length - 1];
  if (partes.length === 2 && (ultima.length !== 3 || conSufijo)) return Number(`${partes[0]}.${ultima}`);
  if (ultima.length !== 3) return Number(`${partes.slice(0, -1).join("")}.${ultima}`);
  return Number(partes.join(""));
}

interface Candidato {
  valor: number;
  desde: number;
  hasta: number;
}

/** "1 millón 200" / "dos millones quinientos mil" / "millón y medio": lo que sigue a los millones */
function complementoMillones(v: string, desde: number, mult: number): { extra: number; largo: number } {
  const resto = v.slice(desde);
  const medio = /^\s+y\s+medio\b/.exec(resto);
  if (medio) return { extra: 0.5 * mult, largo: medio[0].length };
  const m = new RegExp(`^\\s+(?:y\\s+)?(\\d{1,3}|${PALABRAS_NUM})(?:\\s+mil)?\\b(?!\\s*(?:${SUF}|pm|am|:))`).exec(resto);
  if (!m) return { extra: 0, largo: 0 };
  const n = /^\d/.test(m[1]) ? Number(m[1]) : NUM_PALABRA[m[1]];
  return { extra: n * 1000, largo: m[0].length };
}

function buscarMonto(t: Texto): Candidato | null {
  const v = t.vista();
  const cands: Candidato[] = [];
  // Con cifras: "$25.000", "25 mil", "25k", "1,2 millones", "1.200.000", "25000 pesos"
  const reNum = new RegExp(`(\\$\\s*)?\\b(\\d+(?:['.,]\\d+)*)(?:\\s*(${SUF})\\b)?(?:\\s+(?:de\\s+)?pesos\\b)?`, "g");
  let m: RegExpExecArray | null;
  while ((m = reNum.exec(v))) {
    const [todo, dolar, cifra, suf] = m;
    const pesos = /pesos/.test(todo);
    let valor = numeroDe(cifra, !!suf) * (suf ? MULT[suf] : 1);
    let hasta = m.index + todo.length;
    const pareceAnio = !dolar && !suf && !pesos && /^\d{4}$/.test(cifra) && valor >= 1900 && valor <= 2100;
    if (!(dolar || suf || pesos || (valor >= 1000 && !pareceAnio))) continue;
    if (suf && MULT[suf] === 1e6) {
      const c = complementoMillones(v, hasta, 1e6);
      valor += c.extra;
      hasta += c.largo;
    }
    cands.push({ valor: Math.round(valor), desde: m.index, hasta });
  }
  // Con palabras: "una luca", "medio millón", "dos palos", "mil pesos"
  const rePal = new RegExp(`\\b(${PALABRAS_NUM})\\s+(millones|millon|palos|palo|mil|lucas|luca|barras|barra)\\b`, "g");
  while ((m = rePal.exec(v))) {
    const mult = MULT[m[2]];
    let valor = NUM_PALABRA[m[1]] * mult;
    let hasta = m.index + m[0].length;
    if (mult === 1e6) {
      const c = complementoMillones(v, hasta, 1e6);
      valor += c.extra;
      hasta += c.largo;
    }
    cands.push({ valor: Math.round(valor), desde: m.index, hasta });
  }
  const reSolo = /\b(?:mil\s+pesos|luca)\b/g;
  while ((m = reSolo.exec(v))) {
    if (cands.some((c) => m!.index >= c.desde && m!.index < c.hasta)) continue;
    cands.push({ valor: 1000, desde: m.index, hasta: m.index + m[0].length });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => a.desde - b.desde);
  return cands[0];
}

/* ═════════ Fechas y horas ═════════ */

type Spec =
  | { k: "rel"; d: number }
  | { k: "sem"; dia: number; dir: "auto" | "futuro" | "pasado" }
  | { k: "mes"; dia: number }
  | { k: "abs"; dia: number; mes: number; anio: number | null }
  | { k: "fin" }
  | { k: "mesSig" };

function resolver(spec: Spec | null, hoy: string, pasado: boolean): string | null {
  if (!spec) return null;
  switch (spec.k) {
    case "rel":
      return addDays(hoy, spec.d);
    case "fin":
      return endOfMonth(monthKey(hoy));
    case "mesSig": {
      const k = addMonths(monthKey(hoy), 1);
      return `${k}-${pad(Math.min(Number(hoy.slice(8)), daysInMonth(k)))}`;
    }
    case "sem": {
      const hoyD = weekdayMon(hoy);
      const usarPasado = spec.dir === "pasado" || (spec.dir === "auto" && pasado);
      if (usarPasado) {
        let atras = (hoyD - spec.dia + 7) % 7;
        if (atras === 0 && spec.dir === "pasado") atras = 7;
        return addDays(hoy, -atras);
      }
      let adelante = (spec.dia - hoyD + 7) % 7;
      if (adelante === 0 && spec.dir === "futuro") adelante = 7;
      return addDays(hoy, adelante);
    }
    case "mes": {
      let k = monthKey(hoy);
      const en = (key: string) => `${key}-${pad(Math.min(spec.dia, daysInMonth(key)))}`;
      let iso = en(k);
      if (pasado && iso > hoy) iso = en((k = addMonths(k, -1)));
      if (!pasado && iso < hoy) iso = en(addMonths(k, 1));
      return iso;
    }
    case "abs": {
      let anio = spec.anio ?? Number(hoy.slice(0, 4));
      const en = (a: number) => {
        const key = `${a}-${pad(spec.mes)}`;
        return `${key}-${pad(Math.min(spec.dia, daysInMonth(key)))}`;
      };
      let iso = en(anio);
      if (spec.anio === null && !pasado && iso < hoy) iso = en(++anio);
      if (spec.anio === null && pasado && iso > hoy) iso = en(--anio);
      return iso;
    }
  }
}

/* ═════════ Tipo ═════════ */

const RE_DESEO = /\b(?:quiero|quisiera|me\s+gustaria|me\s+encantaria|deseo|me\s+quiero\s+comprar|antojo|wishlist|sonando\s+con)\b/;
const RE_INGRESO =
  /\b(?:me\s+(?:pagaron|consignaron|transfirieron|giraron|llego|entro|entraron|devolvieron)|recibi|cobre|ingreso|gane|vendi|salario|sueldo|nomina|quincena|prima|reembolso)\b/;
const RE_GASTO = /\b(?:pague|gaste|compre|gasto|pagamos|compramos|me\s+gaste|costo|valio)\b/;
const RE_EVENTO =
  /\b(?:reunion|cita|cumpleanos|cumple|evento|llamada|videollamada|meet|zoom|entrevista|boda|matrimonio|fiesta|concierto|partido|vuelo|clase|turno|consulta|visita|junta|comite)\b/;
const RE_HABITO = /\bhabito\b/;

/* ═════════ Interpretar ═════════ */

export function interpretarLocal(texto: string, ctx: ContextoCaptura): Propuesta {
  const t = new Texto(texto.trim());
  const n0 = t.n;
  const hoy = ctx.hoy;

  // 1) Recurrencia mensual: "el 5 de cada mes", "cada 15", "mensual"
  let diaDelMes: number | null = null;
  let mensual = false;
  t.buscar(/\b(?:el\s+|los\s+)?(?:dia\s+)?(\d{1,2})\s+de\s+cada\s+mes\b/g, (m) => {
    diaDelMes = Number(m[1]);
    mensual = true;
  });
  t.buscar(/\b(?:cada|todos\s+los)\s+(\d{1,2})\b(?!\s*(?:mil|k|dias?|semanas?|meses|horas?|lucas?|[.,]\d))/g, (m) => {
    diaDelMes = Number(m[1]);
    mensual = true;
  });
  t.buscar(/\b(?:cada\s+mes|mensual(?:mente)?|todos\s+los\s+meses|al\s+mes|por\s+mes|mes\s+a\s+mes)\b/g, () => {
    mensual = true;
  });

  // 2) Días de la semana de un hábito: "lunes miércoles viernes", "de lunes a viernes", "todos los días"
  let dias: number[] | null = null;
  const sumar = (ds: number[]) => (dias = [...new Set([...(dias ?? []), ...ds])].sort((a, b) => a - b));
  t.buscar(/\b(?:todos\s+los\s+dias|cada\s+dia|diario|diariamente|a\s+diario)\b/g, () => {
    sumar([0, 1, 2, 3, 4, 5, 6]);
  });
  t.buscar(/\bentre\s+semana\b/g, () => {
    sumar([0, 1, 2, 3, 4]);
  });
  t.buscar(/\b(?:los\s+)?fines?\s+de\s+semana\b/g, () => {
    sumar([5, 6]);
  });
  t.buscar(new RegExp(`\\b(?:de\\s+|los\\s+)?${DIA_RE}\\s+a\\s+${DIA_RE}\\b`, "g"), (m) => {
    const a = diaIdx(m[1]);
    const b = diaIdx(m[2]);
    const r: number[] = [];
    for (let i = a; ; i = (i + 1) % 7) {
      r.push(i);
      if (i === b || r.length > 7) break;
    }
    sumar(r);
  });
  {
    const reDia = new RegExp(`\\b(?:los\\s+|el\\s+|y\\s+|e\\s+)?${DIA_RE}\\b`, "g");
    const hallados: number[] = [];
    const v = t.vista();
    let m: RegExpExecArray | null;
    while ((m = reDia.exec(v))) hallados.push(diaIdx(m[1]));
    if (hallados.length >= 2 || (hallados.length >= 1 && dias)) {
      sumar(hallados);
      t.buscar(reDia);
    }
  }

  // 3) Hora: "3pm", "3:30 p. m.", "15:00", "a las 3", "8 de la noche", "mediodía"
  let hora: string | null = null;
  const fijarHora = (h: number, min: number, franja?: string) => {
    let hh = h;
    if (franja) {
      if (/^p/.test(franja) || franja === "tarde" || franja === "noche") {
        if (hh < 12) hh += 12;
      } else if ((/^a/.test(franja) || franja === "manana") && hh === 12) hh = 0;
    }
    if (hh > 23 || min > 59) return false;
    hora = `${pad(hh)}:${pad(min)}`;
  };
  t.buscar(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z])/g, (m) => {
    if (hora) return false;
    return fijarHora(Number(m[1]), Number(m[2] ?? 0), m[3]);
  });
  t.buscar(/\b(?:a\s+las|a\s+la|alas|tipo)\s+(\d{1,2})(?::(\d{2}))?(?:\s+(?:de\s+la\s+)?(manana|tarde|noche))?/g, (m) => {
    if (hora) return false;
    const h = Number(m[1]);
    return fijarHora(h, Number(m[2] ?? 0), m[3] ?? (h >= 1 && h <= 6 ? "tarde" : undefined));
  });
  t.buscar(/\b(\d{1,2}):(\d{2})\b/g, (m) => {
    if (hora) return false;
    return fijarHora(Number(m[1]), Number(m[2]));
  });
  t.buscar(/\b(\d{1,2})\s+de\s+la\s+(manana|tarde|noche)\b/g, (m) => {
    if (hora) return false;
    return fijarHora(Number(m[1]), 0, m[2]);
  });
  t.buscar(/\b(?:al\s+)?mediodia\b/g, () => {
    if (hora) return false;
    hora = "12:00";
  });
  // Franjas sin hora ("en la mañana"): se tapan para que "mañana" no se lea como el día siguiente
  t.buscar(/\b(?:en|por|de)\s+la\s+(?:manana|tarde|noche)\b/g);

  // 4) Fecha
  let spec: Spec | null = null;
  const fijar = (s: Spec) => {
    if (spec) return false;
    spec = s;
  };
  t.buscar(/\b(?:para\s+)?pasado\s+manana\b/g, () => fijar({ k: "rel", d: 2 }));
  t.buscar(/\b(?:para\s+)?manana\b/g, () => fijar({ k: "rel", d: 1 }));
  t.buscar(/\b(?:para\s+)?hoy\b/g, () => fijar({ k: "rel", d: 0 }));
  t.buscar(/\b(?:antier|anteayer|antes\s+de\s+ayer)\b/g, () => fijar({ k: "rel", d: -2 }));
  t.buscar(/\bayer\b/g, () => fijar({ k: "rel", d: -1 }));
  t.buscar(new RegExp(`\\b(?:para\\s+)?(?:dentro\\s+de|en)\\s+(\\d{1,2}|${PALABRAS_NUM})\\s+(dias?|semanas?|mes(?:es)?)\\b`, "g"), (m) => {
    const k = /^\d/.test(m[1]) ? Number(m[1]) : NUM_PALABRA[m[1]];
    const d = /^sem/.test(m[2]) ? k * 7 : /^mes/.test(m[2]) ? k * 30 : k;
    return fijar({ k: "rel", d });
  });
  t.buscar(/\b(?:para\s+)?(?:la\s+)?(?:proxima\s+semana|semana\s+que\s+viene)\b/g, () => fijar({ k: "rel", d: 7 }));
  t.buscar(/\b(?:para\s+)?(?:el\s+)?(?:proximo\s+mes|mes\s+que\s+viene)\b/g, () => fijar({ k: "mesSig" }));
  t.buscar(/\b(?:para\s+)?(?:a\s+)?fin(?:al)?\s+de(?:l)?\s+mes\b/g, () => fijar({ k: "fin" }));
  t.buscar(new RegExp(`\\b(?:para\\s+)?(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${MESES.join("|")})(?:\\s+(?:de\\s+|del\\s+)?(\\d{4}))?\\b`, "g"), (m) =>
    fijar({ k: "abs", dia: Number(m[1]), mes: MESES.indexOf(m[2]) + 1, anio: m[3] ? Number(m[3]) : null }),
  );
  t.buscar(/\b(?:para\s+)?(?:el\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g, (m) => {
    const mes = Number(m[2]);
    if (mes < 1 || mes > 12) return false;
    const anio = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
    return fijar({ k: "abs", dia: Number(m[1]), mes, anio });
  });
  if (!dias) {
    t.buscar(new RegExp(`\\b(?:para\\s+)?(?:el\\s+|este\\s+|el\\s+proximo\\s+|proximo\\s+)?${DIA_RE}(?:\\s+(que\\s+viene|pasado))?\\b`, "g"), (m) => {
      const proximo = /proximo/.test(m[0]) || m[2] === "que viene";
      return fijar({ k: "sem", dia: diaIdx(m[1]), dir: m[2] === "pasado" ? "pasado" : proximo ? "futuro" : "auto" });
    });
  }
  t.buscar(/\b(?:para\s+)?el\s+(?:dia\s+)?(\d{1,2})\b(?!\s*(?:mil|k|lucas?|luca|millon(?:es)?|palos?|barras?|pesos|[.,:'\/]\d|a\.?m|p\.?m|am|pm))/g, (m) => {
    const d = Number(m[1]);
    if (d < 1 || d > 31) return false;
    return fijar({ k: "mes", dia: d });
  });

  // 5) Monto
  const monto = buscarMonto(t);
  if (monto) {
    t.tapar(monto.desde, monto.hasta);
    // "de 400 mil", "por 25 mil": la preposición que queda sola antes del monto
    const antes = t.vista().slice(0, monto.desde);
    const prep = /\b(?:de|por|en|a|como)\s*$/.exec(antes);
    if (prep) t.tapar(prep.index, monto.desde);
  }

  // 6) Cuenta
  let cuentaId: string | null = null;
  let cuentaMencionada: string | null = null;
  const GENERICAS = new Set(["cuenta", "banco", "tarjeta", "ahorros", "ahorro", "corriente", "credito", "debito", "mi", "la", "el", "de"]);
  const pref = "(?:(?:con|en|por|desde|de|a|al|del)\\s+)?(?:(?:la|el|mi)\\s+)?(?:tarjeta\\s+|cuenta\\s+)?";
  {
    const v = t.vista();
    let mejor: { id: string; desde: number; hasta: number; largo: number } | null = null;
    for (const c of ctx.cuentas ?? []) {
      const nombre = normalizar(c.name).trim();
      const primera = nombre.split(/\s+/)[0];
      const alias = [nombre, ...(primera.length >= 3 && !GENERICAS.has(primera) ? [primera] : [])];
      for (const a of alias) {
        const m = new RegExp(`\\b${pref}${esc(a)}\\b`).exec(v);
        if (m && (!mejor || a.length > mejor.largo)) mejor = { id: c.id, desde: m.index, hasta: m.index + m[0].length, largo: a.length };
      }
    }
    if (mejor) {
      cuentaId = mejor.id;
      t.tapar(mejor.desde, mejor.hasta);
    } else {
      t.buscar(/\b(?:(?:con|en|por|desde|de|a)\s+)?(nequi|daviplata|movii|efectivo|cash|bancolombia|davivienda|lulo|rappipay|dale|nu\s*bank)\b/g, (m) => {
        if (cuentaMencionada) return false;
        const nombre = m[1] === "cash" ? "efectivo" : m[1];
        const tipo = nombre === "efectivo" ? "efectivo" : null;
        const existente = tipo ? (ctx.cuentas ?? []).find((c) => c.type === tipo) : undefined;
        if (existente) cuentaId = existente.id;
        else cuentaMencionada = nombre === "daviplata" ? "DaviPlata" : capital(nombre);
      });
      if (!cuentaId) {
        t.buscar(/\b(?:(?:con|en|por)\s+)?(?:la\s+)?(?:tarjeta\s+de\s+credito|tarjeta|tc)\b/g, () => {
          const tc = (ctx.cuentas ?? []).find((c) => c.type === "tarjeta_credito");
          if (!tc) return false;
          cuentaId = tc.id;
        });
      }
    }
  }

  // 7) Tipo
  let tipo: TipoCaptura;
  const hayMonto = !!monto;
  if (RE_DESEO.test(n0)) tipo = "deseo";
  else if (mensual) tipo = "pago-fijo";
  else if (dias && !hayMonto) tipo = "habito";
  else if (RE_HABITO.test(n0) && !hayMonto) tipo = "habito";
  else if (hayMonto || RE_INGRESO.test(n0) || RE_GASTO.test(n0)) tipo = RE_INGRESO.test(n0) && !RE_GASTO.test(n0) ? "ingreso" : "gasto";
  else if (RE_EVENTO.test(n0) || hora) tipo = "evento";
  else tipo = "tarea";

  // 7b) Proyecto de un gasto o ingreso: "para Monni", "de Monni", "del proyecto Monni", "#monni".
  //     Se quita de la descripción ("hosting 80 mil para Monni" → "Hosting").
  let proyectoMov: string | null = null;
  if (tipo === "gasto" || tipo === "ingreso" || tipo === "pago-fijo") {
    const v = t.vista();
    const prefijo = "(?:(?:para|de|del|en|a|al|por)\\s+(?:el\\s+|la\\s+|mi\\s+)?(?:proyecto\\s+)?)";
    let mejor: { id: string; desde: number; hasta: number; largo: number } | null = null;
    for (const pr of ctx.proyectos ?? []) {
      const np = normalizar(pr.name).trim().replace(/\s+/g, " ");
      if (!np) continue;
      const primera = np.split(" ")[0];
      const formas: { re: RegExp; largo: number }[] = [
        { re: new RegExp(`(?:^|\\s)#(?:${esc(np.replace(/\s+/g, ""))}|${esc(primera)})(?![a-z0-9])`), largo: np.length + 1 },
        { re: new RegExp(`\\b${prefijo}?${esc(np)}\\b`), largo: np.length },
      ];
      // La primera palabra sola ("para el portafolio") solo con preposición, para no confundirla con lo comprado
      if (primera !== np && primera.length >= 4 && !CONECTORES.has(primera)) formas.push({ re: new RegExp(`\\b${prefijo}${esc(primera)}\\b`), largo: primera.length });
      for (const f of formas) {
        const m = f.re.exec(v);
        if (m && (!mejor || f.largo > mejor.largo)) mejor = { id: pr.id, desde: m.index, hasta: m.index + m[0].length, largo: f.largo };
      }
    }
    if (mejor) {
      proyectoMov = mejor.id;
      t.tapar(mejor.desde, mejor.hasta);
    }
  }

  // 8) Palabras de intención que no van en la descripción
  t.buscar(/\b(?:tengo\s+que|hay\s+que|recordar(?:me)?|recuerdame|no\s+olvidar|no\s+olvides|anotar|anota|registrar|registra)\b/g);
  if (tipo === "gasto" || tipo === "pago-fijo") t.buscar(/\b(?:me\s+gaste|pague|gaste|compre|pagamos|compramos|gasto(?:\s+de|\s+en)?|costo|valio|pago\s+fijo)\b/g);
  if (tipo === "ingreso")
    t.buscar(/\b(?:me\s+(?:pagaron|consignaron|transfirieron|giraron|llego|entro|entraron|devolvieron)|recibi|cobre|ingreso(?:\s+de|\s+por)?|gane)\b/g);
  if (tipo === "deseo")
    t.buscar(/\b(?:me\s+quiero\s+comprar|quiero\s+comprar(?:me)?|quiero|quisiera|me\s+gustaria(?:\s+comprar(?:me)?|\s+tener)?|me\s+encantaria(?:\s+tener)?|deseo|antojo(?:\s+de)?|sonando\s+con|para\s+la\s+wishlist|wishlist)\b/g);
  if (tipo === "habito") t.buscar(/\b(?:nuevo\s+)?habito(?:\s+de)?\b/g);

  // 9) Fecha final según el tipo (en movimientos "el lunes" es el que pasó; en lo demás, el que viene)
  const pasado = tipo === "gasto" || tipo === "ingreso";
  let fecha = resolver(spec, hoy, pasado);
  if (!fecha && (pasado || tipo === "evento")) fecha = hoy;
  if (tipo === "pago-fijo") {
    const s = spec as Spec | null;
    if (diaDelMes === null && s?.k === "mes") diaDelMes = s.dia;
    if (diaDelMes === null && s?.k === "abs") diaDelMes = s.dia;
    if (diaDelMes === null) diaDelMes = Number(hoy.slice(8));
    fecha = resolver({ k: "mes", dia: diaDelMes }, hoy, false);
  }

  // 10) Descripción
  let palabras = t
    .resto()
    .replace(/[,;:!?¡¿]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const esConector = (w: string) => CONECTORES.has(normalizar(w).replace(/[.]+$/, ""));
  while (palabras.length && esConector(palabras[0])) palabras.shift();
  while (palabras.length && esConector(palabras[palabras.length - 1])) palabras.pop();
  palabras = palabras.map((w) => w.replace(/^[.\-–]+|[.\-–]+$/g, "")).filter(Boolean);
  let descripcion = capital(palabras.join(" "));
  const nDesc = normalizar(descripcion);

  // 11) Categoría
  let categoria: string | null = null;
  const disponiblesG = ctx.categoriasGasto;
  const disponiblesI = ctx.categoriasIngreso;
  const aprendida = (lista?: string[]) => {
    for (const w of nDesc.split(/\s+/)) {
      const c = ctx.aprendidas?.[w];
      if (c && (!lista || lista.includes(c))) return c;
    }
    return null;
  };
  if (tipo === "gasto" || tipo === "pago-fijo") {
    categoria =
      aprendida(disponiblesG) ??
      categoriaPorClaves(nDesc, CLAVES_GASTO, disponiblesG) ??
      categoriaPorClaves(n0, CLAVES_GASTO, disponiblesG) ??
      (!disponiblesG || disponiblesG.includes("Otros") ? "Otros" : disponiblesG[disponiblesG.length - 1] ?? null);
  } else if (tipo === "ingreso") {
    categoria =
      aprendida(disponiblesI) ??
      categoriaPorClaves(n0, CLAVES_INGRESO, disponiblesI) ??
      (!disponiblesI || disponiblesI.includes("Otros ingresos") ? "Otros ingresos" : disponiblesI[disponiblesI.length - 1] ?? null);
  } else if (tipo === "deseo") {
    categoria = categoriaPorClaves(nDesc, CLAVES_DESEO) ?? "Otros";
  } else if (tipo === "evento") {
    categoria = /\b(?:gym|gimnasio|entreno|entrenamiento|correr|futbol|partido|clase\s+de|yoga|crossfit|spinning)\b/.test(n0)
      ? "entrenamiento"
      : /\b(?:vence|vencimiento|renovar)\b/.test(n0)
        ? "vencimiento"
        : /\b(?:pago|pagar)\b/.test(n0)
          ? "pago"
          : "personal";
  }
  if (!descripcion) {
    if (tipo === "ingreso") descripcion = categoria && categoria !== "Otros ingresos" ? categoria : "Pago recibido";
    else if (tipo === "gasto" || tipo === "pago-fijo") descripcion = categoria && categoria !== "Otros" ? categoria : "Gasto";
  }

  // 12) Proyecto de una tarea (el nombre se queda en la descripción: "Terminar landing de Monni")
  let proyectoId: string | null = tipo === "gasto" || tipo === "ingreso" ? proyectoMov : null;
  if (tipo === "tarea") {
    for (const p of ctx.proyectos ?? []) {
      const np = normalizar(p.name).trim();
      if (np && new RegExp(`\\b${esc(np)}\\b`).test(n0)) {
        proyectoId = p.id;
        break;
      }
    }
  }

  // 13) Sin proyecto en la frase: el aprendido para esa descripción se sugiere (nunca se asigna solo)
  let proyectoSugerido: string | null = null;
  if (!proyectoId && !proyectoMov && (tipo === "gasto" || tipo === "ingreso")) {
    for (const w of normalizar(descripcion).split(/[^a-z0-9]+/)) {
      const id = w ? ctx.proyectosAprendidos?.[w] : undefined;
      if (id && (ctx.proyectos ?? []).some((p) => p.id === id)) {
        proyectoSugerido = id;
        break;
      }
    }
  }

  const esMov = tipo === "gasto" || tipo === "ingreso" || tipo === "pago-fijo";
  return {
    tipo,
    texto,
    descripcion,
    monto: monto && tipo !== "habito" && tipo !== "tarea" && tipo !== "evento" ? monto.valor : null,
    fecha,
    hora: tipo === "evento" ? hora : null,
    categoria,
    cuentaId: esMov ? cuentaId ?? (cuentaMencionada ? null : ctx.cuentaPorDefecto ?? null) : null,
    cuentaMencionada: esMov ? cuentaMencionada : null,
    dias: tipo === "habito" ? (dias ?? [0, 1, 2, 3, 4, 5, 6]) : null,
    diaDelMes: tipo === "pago-fijo" ? diaDelMes : null,
    proyectoId,
    proyectoSugerido,
  };
}

/**
 * Punto de entrada de la captura rápida. Hoy usa el parser local; está lista para cambiarse por
 * la API de Claude (misma firma, misma forma de respuesta).
 */
export async function interpretarCaptura(texto: string, contexto: ContextoCaptura): Promise<Propuesta> {
  return interpretarLocal(texto, contexto);
}

/** Palabra que se recuerda al corregir una categoría ("Almuerzo con Ana" → "almuerzo"). */
export function palabraClave(descripcion: string): string | null {
  const w = normalizar(descripcion)
    .split(/[^a-z0-9]+/)
    .find((x) => x.length >= 3 && !CONECTORES.has(x));
  return w ?? null;
}
