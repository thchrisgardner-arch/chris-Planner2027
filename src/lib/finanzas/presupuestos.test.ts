import { describe, expect, it } from "vitest";
import type { Transaction } from "../../types/db";
import { estadoPresupuestos, presupuestoEnRiesgo } from "./presupuestos";

let n = 0;
const g = (category: string, date: string, amount: number, status: Transaction["status"] = "completado"): Transaction => ({
  id: `t${n++}`, user_id: "u", created_at: `${date}T12:00:00Z`, type: "gasto", description: "x", amount, category, account_id: "a", to_account_id: null, date, payment_method: null, status, beneficiary: null, notes: null,
});
const HOY = "2026-11-19"; // quedan 12 días de noviembre contando hoy

describe("presupuestos por categoría", () => {
  const transactions = [
    g("Alimentación", "2026-11-02", 400_000),
    g("Alimentación", "2026-11-15", 280_000),
    g("Alimentación", "2026-10-30", 500_000), // otro mes
    g("Alimentación", "2026-11-18", 90_000, "pendiente"), // pendiente: no cuenta
    g("Transporte", "2026-11-10", 260_000),
    g("Ocio", "2026-11-05", 50_000),
  ];
  const lista = estadoPresupuestos({ transactions }, { Alimentación: 800_000, Transporte: 250_000, Ocio: 300_000 }, HOY);

  it("cuenta solo los gastos completados del mes de cada categoría", () => {
    const comida = lista.find((p) => p.categoria === "Alimentación")!;
    expect(comida).toMatchObject({ gastado: 680_000, pct: 85, nivel: "cerca", restante: 120_000, diasRestantes: 12 });
    expect(comida.porDia).toBe(10_000);
  });
  it("marca pasado al llegar al 100 % y ordena por % usado", () => {
    expect(lista.map((p) => [p.categoria, p.nivel])).toEqual([
      ["Transporte", "pasado"],
      ["Alimentación", "cerca"],
      ["Ocio", "ok"],
    ]);
    expect(lista[0].porDia).toBe(0);
  });
  it("el que más necesita atención es el pasado; sin riesgo, ninguno", () => {
    expect(presupuestoEnRiesgo(lista)?.categoria).toBe("Transporte");
    expect(presupuestoEnRiesgo(lista.filter((p) => p.nivel === "ok"))).toBeNull();
  });
});
