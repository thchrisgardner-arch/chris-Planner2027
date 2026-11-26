import { describe, expect, it } from "vitest";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../../modules/finance/constants";
import { construirFilas, leerCSV, parsearFecha, parsearMonto, separarEncabezados, sugerirPlantilla } from "./extracto";

describe("montos de extractos", () => {
  it.each([
    ["-25.000,00", -25000],
    ["1.234.567,89", 1234568],
    ["$ 80.000", 80000],
    ["(45,900.50)", -45901],
    ["-25,000.00", -25000],
    ["3200000", 3200000],
    ["12.500", 12500],
    ["1,250", 1250],
    ["25.000 DB", -25000],
    ["25.000 CR", 25000],
    ["", null],
    ["N/A", null],
  ])("%s → %s", (txt, esperado) => expect(parsearMonto(txt)).toBe(esperado));
  it("números de Excel", () => expect(parsearMonto(-15000)).toBe(-15000));
});

describe("fechas de extractos", () => {
  it.each([
    ["2026/11/20", "2026-11-20"],
    ["2026-11-20", "2026-11-20"],
    ["20/11/2026", "2026-11-20"],
    ["05/11/2026", "2026-11-05"],
    ["11/25/2026", "2026-11-25"],
    ["20261120", "2026-11-20"],
    ["20-nov-2026", "2026-11-20"],
    ["3 dic. 26", "2026-12-03"],
    ["texto", null],
  ])("%s → %s", (txt, esperado) => expect(parsearFecha(txt)).toBe(esperado));
  it("serie de Excel", () => expect(parsearFecha(46346)).toBe("2026-11-20"));
  it("Date de Excel", () => expect(parsearFecha(new Date(Date.UTC(2026, 10, 20)))).toBe("2026-11-20"));
});

const CSV = `Banco de prueba;;;
Extracto de cuenta de ahorros;;;
FECHA;DESCRIPCIÓN;SUCURSAL;VALOR
2026/11/20;"COMPRA EN EXITO CALLE 80";BOGOTA;-125.300,00
2026/11/21;PAGO NOMINA EMPRESA SAS;;3.200.000,00
2026/11/21;UBER *TRIP;;-18.400,00
2026/11/22;UBER *TRIP;;-18.400,00
2026/11/23;TRANSFERENCIA NEQUI;;-50.000,00
`;

describe("CSV completo", () => {
  const hoja = separarEncabezados(leerCSV(CSV));
  const sug = sugerirPlantilla(hoja);
  it("encuentra los encabezados después de las líneas de título", () => {
    expect(hoja.encabezados[0]).toBe("FECHA");
    expect(hoja.datos).toHaveLength(5);
  });
  it("sugiere las columnas", () => {
    expect(sug).toMatchObject({ fecha: 0, descripcion: 1, monto: 3, debito: null, credito: null });
  });
  it("arma las filas, categoriza y marca duplicados", () => {
    const filas = construirFilas(hoja, {
      plantilla: sug,
      existentes: [{ date: "2026-11-23", amount: 50000, type: "gasto", description: "Transferencia a Nequi" }],
      categoriasGasto: EXPENSE_CATEGORIES,
      categoriasIngreso: INCOME_CATEGORIES,
      aprendidas: {},
    });
    expect(filas.map((f) => [f.tipo, f.monto, f.categoria])).toEqual([
      ["gasto", 125300, "Alimentación"],
      ["ingreso", 3200000, "Salario"],
      ["gasto", 18400, "Transporte"],
      ["gasto", 18400, "Transporte"],
      ["gasto", 50000, "Otros"],
    ]);
    // El último ya existe (misma fecha, valor y descripción parecida); los dos Uber son de días distintos
    expect(filas.map((f) => f.duplicado)).toEqual([false, false, false, false, true]);
    expect(filas.filter((f) => f.incluir)).toHaveLength(4);
  });
  it("débito y crédito en columnas separadas", () => {
    const h = separarEncabezados(leerCSV("Fecha,Concepto,Débito,Crédito\n20/11/2026,Netflix,44900,\n21/11/2026,Abono cliente,,1500000\n"));
    const p = sugerirPlantilla(h);
    expect(p).toMatchObject({ monto: null, debito: 2, credito: 3 });
    const filas = construirFilas(h, { plantilla: p, existentes: [], categoriasGasto: EXPENSE_CATEGORIES, categoriasIngreso: INCOME_CATEGORIES, aprendidas: {} });
    expect(filas.map((f) => [f.tipo, f.monto, f.categoria])).toEqual([
      ["gasto", 44900, "Suscripciones"],
      ["ingreso", 1500000, "Freelance"],
    ]);
  });
  it("200 movimientos en menos de 200 ms", () => {
    const lineas = Array.from({ length: 200 }, (_, i) => `2026/11/${String((i % 28) + 1).padStart(2, "0")};COMPRA ${i} RAPPI;;-${(i + 1) * 1000},00`);
    const t0 = performance.now();
    const h = separarEncabezados(leerCSV(`FECHA;DESCRIPCION;X;VALOR\n${lineas.join("\n")}`));
    const filas = construirFilas(h, { plantilla: sugerirPlantilla(h), existentes: [], categoriasGasto: EXPENSE_CATEGORIES, categoriasIngreso: INCOME_CATEGORIES, aprendidas: {} });
    expect(filas).toHaveLength(200);
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
