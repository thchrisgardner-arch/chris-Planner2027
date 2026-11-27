/**
 * Pregúntale a Centavo, etapa 2 (PROTOTIPO): lo que se le manda a la IA.
 * Solo totales: por mes y categoría, los conceptos más grandes del mes, ingresos por mes, ahorro y
 * gastos fijos. Nunca cada movimiento suelto. Las cifras las calcula la app; la IA solo las explica.
 * Función pura.
 */
import { crearAlmacen } from "../almacenLocal";
import type { ResumenFinanciero } from "./preguntas";

export interface ResumenIA {
  hoy: string;
  meses: { mes: string; gastoTotal: number; ingresos: number; porCategoria: Record<string, number> }[];
  conceptosDelMes: { nombre: string; monto: number; veces: number }[];
  ahorro: ResumenFinanciero["ahorro"];
  gastosFijos: ResumenFinanciero["fijos"];
}

/** Los 3 últimos meses (incluido el actual), en totales */
export function resumenParaIA(r: ResumenFinanciero): ResumenIA {
  const mesActual = r.hoy.slice(0, 7);
  const claves = [0, 1, 2].map((i) => {
    const [y, m] = mesActual.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return d.toISOString().slice(0, 7);
  });
  const meses = claves.map((mes) => {
    const gastos = r.gastos.filter((g) => g.fecha.startsWith(mes));
    const porCategoria: Record<string, number> = {};
    for (const g of gastos) porCategoria[g.categoria] = (porCategoria[g.categoria] ?? 0) + g.monto;
    return {
      mes,
      gastoTotal: gastos.reduce((n, g) => n + g.monto, 0),
      ingresos: r.ingresos.filter((i) => i.fecha.startsWith(mes)).reduce((n, i) => n + i.monto, 0),
      porCategoria,
    };
  });
  const conceptos = new Map<string, { nombre: string; monto: number; veces: number }>();
  for (const g of r.gastos.filter((x) => x.fecha.startsWith(mesActual))) {
    const c = conceptos.get(g.concepto) ?? { nombre: g.nombre, monto: 0, veces: 0 };
    c.monto += g.monto;
    c.veces += g.veces;
    conceptos.set(g.concepto, c);
  }
  return {
    hoy: r.hoy,
    meses,
    conceptosDelMes: [...conceptos.values()].sort((a, b) => b.monto - a.monto).slice(0, 12),
    ahorro: r.ahorro,
    gastosFijos: r.fijos,
  };
}

/* Interruptor del prototipo: apagado por defecto, se recuerda en este dispositivo */
export const almacenCentavoIA = crearAlmacen<{ version: 1; activa: boolean }>("lifeos:centavo-ia", () => ({ version: 1, activa: false }), (c) => ({
  version: 1,
  activa: c.activa === true,
}));
