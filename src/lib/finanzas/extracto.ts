/**
 * Lectura de extractos bancarios (CSV o Excel) en el navegador: nada se sube a ningún servidor.
 * Columnas, fechas y montos se leen con las convenciones de los bancos colombianos
 * (día/mes/año, "1.234.567,89", gastos negativos o en columna de débito).
 */
import { normalizar } from "@/lib/captura/interpretar";
import { CLAVES_GASTO, CLAVES_INGRESO, categoriaPorClaves } from "@/lib/captura/categorias";
import type { PlantillaBanco } from "@/lib/captura/aprendizaje";
import type { Transaction } from "@/types/db";

export type Celda = string | number | boolean | Date | null;

/* ═════════ Archivo ═════════ */

/** UTF-8 si es válido; si no, Windows-1252 (así exportan varios bancos) */
export function decodificar(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

/** CSV con comillas; detecta el separador (; , tabulación o |) */
export function leerCSV(texto: string): string[][] {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  const contar = (sep: string) => lineas.reduce((n, l) => n + (l.split(sep).length - 1), 0);
  const sep = [";", ",", "\t", "|"].sort((a, b) => contar(b) - contar(a))[0];
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') comillas = false;
      else celda += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) {
      fila.push(celda.trim());
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda.trim());
      if (fila.some((x) => x !== "")) filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  fila.push(celda.trim());
  if (fila.some((x) => x !== "")) filas.push(fila);
  return filas;
}

/* ═════════ Valores ═════════ */

const MESES: Record<string, number> = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, jan: 1, apr: 4, aug: 8, dec: 12 };
const pad = (n: number) => String(n).padStart(2, "0");
const valida = (a: number, m: number, d: number) => {
  if (m < 1 || m > 12 || d < 1 || d > 31 || a < 1990 || a > 2100) return null;
  return `${a}-${pad(m)}-${pad(d)}`;
};

/** Fecha de un extracto → YYYY-MM-DD (o null). Día/mes antes que mes/día, como en Colombia. */
export function parsearFecha(v: Celda): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === "number") {
    // Serie de Excel (días desde 1899-12-30) o AAAAMMDD
    if (v > 19000101 && v < 21001231) return parsearFecha(String(v));
    if (v > 20000 && v < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
      return parsearFecha(d);
    }
    return null;
  }
  const s = String(v).trim().toLowerCase();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return valida(+m[1], +m[2], +m[3]);
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return valida(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
  if (m) {
    let a = +m[3];
    if (a < 100) a += 2000;
    const x = +m[1];
    const y = +m[2];
    return x > 12 ? valida(a, y, x) : y > 12 ? valida(a, x, y) : valida(a, y, x);
  }
  m = /^(\d{1,2})[\s-/]*([a-z]{3})[a-z.]*[\s-/]*(\d{2,4})/.exec(normalizar(s));
  if (m && MESES[m[2]]) return valida(+m[3] < 100 ? 2000 + +m[3] : +m[3], MESES[m[2]], +m[1]);
  return null;
}

/** Monto de un extracto → pesos enteros con signo (o null) */
export function parsearMonto(v: Celda): number | null {
  if (v == null || v === "" || typeof v === "boolean" || v instanceof Date) return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.sign(v) * Math.round(Math.abs(v)) : null;
  let s = v.trim();
  if (!/\d/.test(s)) return null;
  let negativo = /^\(.*\)$/.test(s) || /-/.test(s) || /\b(db|debito|cargo)\b/i.test(s);
  if (/\b(cr|credito|abono)\b/i.test(s)) negativo = false;
  s = s.replace(/[^\d.,]/g, "");
  const puntos = (s.match(/\./g) ?? []).length;
  const comas = (s.match(/,/g) ?? []).length;
  let n: number;
  if (puntos && comas) {
    const dec = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
    const mil = dec === "." ? "," : ".";
    n = Number(s.split(mil).join("").replace(dec, "."));
  } else if (puntos + comas === 0) n = Number(s);
  else {
    const sep = puntos ? "." : ",";
    const partes = s.split(sep);
    const ultima = partes[partes.length - 1];
    n = partes.length > 2 || ultima.length === 3 ? Number(partes.join("")) : Number(`${partes.slice(0, -1).join("")}.${ultima}`);
  }
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return negativo ? -r : r;
}

/* ═════════ Columnas ═════════ */

export interface Hoja {
  encabezados: string[];
  datos: Celda[][];
}

/** Busca la fila de encabezados (los bancos suelen poner unas líneas de título antes) */
export function separarEncabezados(filas: Celda[][]): Hoja {
  const limite = Math.min(filas.length, 25);
  for (let i = 0; i < limite; i++) {
    const textos = filas[i].map((c) => normalizar(String(c ?? "")));
    if (textos.some((t) => /\bfecha\b|\bdate\b/.test(t)) && textos.filter(Boolean).length >= 2) {
      return { encabezados: filas[i].map((c, k) => String(c ?? "").trim() || `Columna ${k + 1}`), datos: filas.slice(i + 1) };
    }
  }
  const ancho = Math.max(0, ...filas.map((f) => f.length));
  return { encabezados: Array.from({ length: ancho }, (_, k) => `Columna ${k + 1}`), datos: filas };
}

export function sugerirPlantilla(hoja: Hoja): Omit<PlantillaBanco, "nombre" | "cuentaId"> {
  const n = hoja.encabezados.map((e) => normalizar(e));
  const buscar = (re: RegExp, excepto: number[] = []) => n.findIndex((h, i) => re.test(h) && !excepto.includes(i));
  const muestra = hoja.datos.slice(0, 30);
  const porContenido = (prueba: (c: Celda) => boolean, excepto: number[]) => {
    let mejor = -1;
    let max = 0;
    for (let k = 0; k < hoja.encabezados.length; k++) {
      if (excepto.includes(k)) continue;
      const ok = muestra.filter((f) => prueba(f[k] ?? null)).length;
      if (ok > max) {
        max = ok;
        mejor = k;
      }
    }
    return mejor;
  };
  let fecha = buscar(/fecha|date/);
  if (fecha < 0) fecha = porContenido((c) => parsearFecha(c) !== null, []);
  let debito = buscar(/debito|cargo|retiro|egreso|salida|debe\b/, [fecha]);
  let credito = buscar(/credito|abono|deposito|entrada|haber\b/, [fecha, debito]);
  let monto = buscar(/valor|monto|importe|amount|transaccion\s*\$|^\$$/, [fecha, debito, credito]);
  if (debito >= 0 && credito >= 0) monto = -1;
  else {
    debito = -1;
    credito = -1;
    if (monto < 0) monto = porContenido((c) => parsearMonto(c) !== null && parsearFecha(c) === null, [fecha]);
  }
  let descripcion = buscar(/descrip|concepto|detalle|referencia|movimiento|transacc|comercio|establecimiento|narrativ/, [fecha, monto, debito, credito]);
  if (descripcion < 0) descripcion = porContenido((c) => typeof c === "string" && /[a-z]{3}/i.test(c) && parsearFecha(c) === null && parsearMonto(c) === null, [fecha, monto, debito, credito]);
  return {
    fecha: Math.max(0, fecha),
    descripcion: Math.max(0, descripcion),
    monto: monto >= 0 ? monto : null,
    debito: debito >= 0 ? debito : null,
    credito: credito >= 0 ? credito : null,
    invertirSigno: false,
    encabezados: hoja.encabezados,
  };
}

/* ═════════ Filas ═════════ */

export interface FilaExtracto {
  i: number;
  fecha: string | null;
  descripcion: string;
  monto: number;
  tipo: "gasto" | "ingreso";
  categoria: string;
  duplicado: boolean;
  error: string | null;
  incluir: boolean;
}

const palabras = (s: string) => new Set(normalizar(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3));
/** Parecido de dos descripciones (0 a 1) */
export function parecido(a: string, b: string) {
  const A = palabras(a);
  const B = palabras(b);
  if (!A.size || !B.size) return normalizar(a).trim() === normalizar(b).trim() ? 1 : 0;
  let comun = 0;
  for (const w of A) if (B.has(w)) comun++;
  return comun / Math.min(A.size, B.size);
}

export interface OpcionesFilas {
  plantilla: Omit<PlantillaBanco, "nombre" | "cuentaId" | "encabezados">;
  existentes: Pick<Transaction, "date" | "amount" | "type" | "description">[];
  categoriasGasto: string[];
  categoriasIngreso: string[];
  aprendidas: Record<string, string>;
}

export function construirFilas(hoja: Hoja, o: OpcionesFilas): FilaExtracto[] {
  const { plantilla: p } = o;
  const vistos: FilaExtracto[] = [];
  return hoja.datos.map((f, i) => {
    const fecha = parsearFecha(f[p.fecha] ?? null);
    const descripcion = String(f[p.descripcion] ?? "").replace(/\s+/g, " ").trim();
    let valor: number | null = null;
    if (p.monto !== null) {
      const v = parsearMonto(f[p.monto] ?? null);
      valor = v === null ? null : p.invertirSigno ? -v : v;
    } else {
      const d = parsearMonto(f[p.debito ?? -1] ?? null);
      const c = parsearMonto(f[p.credito ?? -1] ?? null);
      if (d) valor = -Math.abs(d);
      else if (c) valor = Math.abs(c);
    }
    const tipo: "gasto" | "ingreso" = (valor ?? 0) < 0 ? "gasto" : "ingreso";
    const monto = Math.abs(valor ?? 0);
    const nd = normalizar(descripcion);
    const lista = tipo === "gasto" ? o.categoriasGasto : o.categoriasIngreso;
    const aprendida = nd
      .split(/[^a-z0-9]+/)
      .map((w) => o.aprendidas[w])
      .find((c) => c && lista.includes(c));
    const categoria =
      aprendida ??
      categoriaPorClaves(nd, tipo === "gasto" ? CLAVES_GASTO : CLAVES_INGRESO, lista) ??
      (tipo === "gasto" ? (lista.includes("Otros") ? "Otros" : lista[lista.length - 1]) : lista.includes("Otros ingresos") ? "Otros ingresos" : lista[lista.length - 1]);
    const error = !fecha ? "Fecha no válida" : !monto ? "Sin valor" : null;
    const parecida = (x: { date: string; amount: number; type: string; description: string }) =>
      x.date === fecha && Math.abs(x.amount) === monto && x.type === tipo && parecido(x.description, descripcion) >= 0.5;
    const duplicado = !error && (o.existentes.some(parecida) || vistos.some((v) => v.fecha === fecha && v.monto === monto && v.descripcion === descripcion));
    const fila: FilaExtracto = { i, fecha, descripcion: descripcion || categoria, monto, tipo, categoria, duplicado, error, incluir: !error && !duplicado };
    vistos.push(fila);
    return fila;
  });
}
