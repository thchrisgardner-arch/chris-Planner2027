import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import type { Transaction } from "../../types/db";
import { agruparConceptos, claveFinal, comparacion, normalizarConcepto, rangos, totalGastos } from "./conceptos";

const VARIANTES: [string, string][] = [
  ["RAPPI*1234", "rappi"],
  ["Rappi", "rappi"],
  ["rappi colombia sas", "rappi"],
  ["UBER *TRIP 8H2K", "uber"],
  ["Uber", "uber"],
  ["Almacenes Éxito Calle 80", "exito"],
  ["EXITO", "exito"],
  ["Almuerzo", "almuerzo"],
  ["almuerzo  oficina", "almuerzo oficina"],
  ["Almuerzo oficina 12/11", "almuerzo oficina"],
  ["Compra datafono Panadería La 80", "panaderia la"],
  ["PAGO PSE CLARO 3001234567", "claro"],
  ["Café", "cafe"],
  ["cafe", "cafe"],
  ["Netflix.com", "netflix"],
  ["Mercado Olímpica", "olimpica"],
];
const filas: string[] = [];

describe("normalización de conceptos", () => {
  for (const [texto, esperado] of VARIANTES) {
    it(`${texto} → ${esperado}`, () => {
      const obtenido = normalizarConcepto(texto);
      filas.push(`| ${texto} | ${obtenido} | ${obtenido === esperado ? "Sí" : `No (esperado ${esperado})`} |`);
      expect(obtenido).toBe(esperado);
    });
  }
});

let n = 0;
const g = (description: string, amount: number, date = "2026-11-10", extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`,
  user_id: "u",
  created_at: `${date}T12:00:00Z`,
  type: "gasto",
  description,
  amount,
  category: "Alimentación",
  account_id: "a",
  to_account_id: null,
  date,
  payment_method: null,
  status: "completado",
  beneficiary: null,
  notes: null,
  ...extra,
});

describe("agrupación, uniones y comparación", () => {
  const txs = [
    g("RAPPI*1234", 40_000),
    g("Rappi", 60_000),
    g("rappi colombia", 20_000),
    g("Almuerzo", 25_000),
    g("almuerzo oficina", 30_000),
    g("Uber", 18_000, "2026-11-12", { category: "Transporte" }),
    g("Pendiente", 99_000, "2026-11-12", { status: "pendiente" }),
    g("Sueldo", 3_000_000, "2026-11-01", { type: "ingreso" }),
    g("Rappi", 50_000, "2026-10-08"),
  ];
  it("agrupa variantes del mismo comercio y cuadra con el total", () => {
    const c = agruparConceptos(txs, "2026-11-01", "2026-11-27");
    expect(c[0]).toMatchObject({ clave: "rappi", nombre: "Rappi", total: 120_000, veces: 3 });
    expect(c.reduce((s, x) => s + x.total, 0)).toBe(totalGastos(txs, "2026-11-01", "2026-11-27"));
    expect(totalGastos(txs, "2026-11-01", "2026-11-27")).toBe(193_000);
  });
  it("filtra por categoría", () => {
    expect(agruparConceptos(txs, "2026-11-01", "2026-11-27", {}, "Transporte").map((x) => x.nombre)).toEqual(["Uber"]);
  });
  it("une conceptos a mano y se puede deshacer", () => {
    const unidos = agruparConceptos(txs, "2026-11-01", "2026-11-27", { "almuerzo oficina": "almuerzo" });
    expect(unidos.find((x) => x.clave === "almuerzo")).toMatchObject({ total: 55_000, veces: 2, unidos: ["almuerzo oficina"] });
    expect(agruparConceptos(txs, "2026-11-01", "2026-11-27").find((x) => x.clave === "almuerzo")?.total).toBe(25_000);
    expect(claveFinal("a", { a: "b", b: "a" })).toBe("a");
  });
  it("compara con el periodo anterior", () => {
    const r = rangos("mes", "2026-11-27");
    expect(r.actual).toMatchObject({ desde: "2026-11-01", hasta: "2026-11-27", nombre: "noviembre" });
    expect(r.anterior).toMatchObject({ desde: "2026-10-01", hasta: "2026-10-27", nombre: "octubre" });
    expect(comparacion(70_000, 50_000, "octubre")).toBe("+40 % que octubre");
    expect(comparacion(40_000, 50_000, "octubre")).toBe("−20 % que octubre");
    expect(comparacion(10_000, 0, "octubre")).toBe("Nuevo frente a octubre");
    expect(rangos("trimestre", "2026-11-27").actual.desde).toBe("2026-09-01");
    expect(rangos("trimestre", "2026-11-27").anterior).toMatchObject({ desde: "2026-06-01", hasta: "2026-08-31" });
  });
});

afterAll(() => {
  if (!process.env.REPORTE) return;
  mkdirSync("docs/finanzas", { recursive: true });
  writeFileSync("docs/finanzas/conceptos.md", `# Normalización de conceptos\n\nTexto original del movimiento y el concepto con el que se agrupa.\n\n| Texto original | Concepto agrupado | Acierta |\n|---|---|---|\n${filas.join("\n")}\n`);
});
