import { describe, expect, it } from "vitest";
import type { Transaction } from "../../types/db";
import {
  avisadosVigentes,
  cambioDinero,
  dineroDe,
  filasCierre,
  gastosPorCategoria,
  lineaPresupuesto,
  migrarDineroProyecto,
  proyeccion,
  resumenDinero,
  textoAviso,
  umbralPorAvisar,
  valorPorHora,
} from "./dinero";
import { formatCOP } from "../../utils/money";

/** Montos con el formato real de la app ("$100.000" con su espacio) */
const c = (txt: string) => txt.replace(/\$([\d.]+\d)/g, (_, v: string) => formatCOP(Number(v.replace(/\./g, ""))));

const HOY = "2026-11-27";
let n = 0;
const tx = (type: Transaction["type"], amount: number, date: string, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${++n}`,
  user_id: "u",
  created_at: `${date}T12:00:00Z`,
  type,
  description: "x",
  amount,
  category: "Tecnología",
  account_id: "a1",
  to_account_id: null,
  date,
  payment_method: null,
  status: "completado",
  beneficiary: null,
  notes: null,
  project_id: "monni",
  ...extra,
});
const monni = { id: "monni", name: "Monni", budget: 500_000, due_date: null as string | null, money: { presupuesto: { monto: 500_000, periodo: "total" as const }, generaIngresos: true, alertas: [80, 100] } };

describe("modelo y migración", () => {
  it("sin money, el presupuesto estimado de siempre cuenta como total", () => {
    expect(dineroDe({ budget: 2_000_000 }).presupuesto).toEqual({ monto: 2_000_000, periodo: "total" });
    expect(dineroDe({ budget: null }).presupuesto).toBeNull();
    expect(dineroDe({ budget: null }).alertas).toEqual([80, 100]);
    expect(dineroDe({ budget: null }).generaIngresos).toBe(false);
  });
  it("la migración pasa budget a money una sola vez", () => {
    expect(migrarDineroProyecto({ budget: 2_000_000 })).toEqual({ money: { presupuesto: { monto: 2_000_000, periodo: "total" }, generaIngresos: false, alertas: [80, 100] } });
    expect(migrarDineroProyecto({ budget: 2_000_000, money: { generaIngresos: true } })).toBeNull();
    expect(migrarDineroProyecto({ budget: null })).toBeNull();
    expect(migrarDineroProyecto({ budget: 0 })).toBeNull();
  });
  it("guardar el dinero también actualiza el presupuesto estimado (budget)", () => {
    const c = cambioDinero(dineroDe(monni), { presupuesto: { monto: 800_000, periodo: "mensual" } });
    expect(c.budget).toBe(800_000);
    expect(c.money.presupuesto).toEqual({ monto: 800_000, periodo: "mensual" });
    expect(cambioDinero(dineroDe(monni), { presupuesto: null }).budget).toBeNull();
  });
});

describe("resumen", () => {
  const txs = [
    tx("gasto", 200_000, "2026-11-02"),
    tx("gasto", 120_000, "2026-11-20"),
    tx("ingreso", 900_000, "2026-11-21"),
    tx("gasto", 50_000, "2026-11-25", { status: "pendiente" }),
    tx("gasto", 999_999, "2026-11-25", { project_id: null }),
    tx("transferencia", 70_000, "2026-11-25", { to_account_id: "a2" }),
  ];
  it("suma solo lo completado del proyecto y sin transferencias", () => {
    const r = resumenDinero(monni, txs, HOY);
    expect(r.gastado).toBe(320_000);
    expect(r.ingresos).toBe(900_000);
    expect(r.balance).toBe(580_000);
    expect(r.disponible).toBe(180_000);
    expect(Math.round(r.pct!)).toBe(64);
    expect(lineaPresupuesto(r)).toBe(c("$320.000 de $500.000 · 64 %"));
  });
  it("un presupuesto mensual mira solo el mes elegido", () => {
    const mensual = { ...monni, money: { ...monni.money, presupuesto: { monto: 300_000, periodo: "mensual" as const } } };
    const otros = [...txs, tx("gasto", 80_000, "2026-10-10")];
    expect(resumenDinero(mensual, otros, HOY).gastado).toBe(320_000);
    expect(resumenDinero(mensual, otros, HOY, "2026-10").gastado).toBe(80_000);
    expect(resumenDinero(mensual, otros, HOY, "2026-10").clave).toBe("2026-10");
  });
  it("gastos por categoría", () => {
    expect(gastosPorCategoria([tx("gasto", 10, HOY), tx("gasto", 30, HOY, { category: "Diseño" }), tx("gasto", 5, HOY)])).toEqual([
      { name: "Diseño", value: 30 },
      { name: "Tecnología", value: 15 },
    ]);
  });
});

describe("proyección", () => {
  it("sin 3 gastos o sin 14 días de datos no se muestra", () => {
    expect(proyeccion(monni, [tx("gasto", 100_000, "2026-11-01"), tx("gasto", 100_000, "2026-11-10")], HOY)).toBeNull();
    expect(proyeccion(monni, [tx("gasto", 50_000, "2026-11-20"), tx("gasto", 50_000, "2026-11-22"), tx("gasto", 50_000, "2026-11-25")], HOY)).toBeNull();
  });
  it("al ritmo actual dice cuándo llega al 100 %", () => {
    // 300.000 en 27 días ≈ 11.111/día; faltan 200.000 → 18 días
    const p = proyeccion(monni, [tx("gasto", 100_000, "2026-11-01"), tx("gasto", 100_000, "2026-11-10"), tx("gasto", 100_000, "2026-11-20")], HOY);
    expect(p?.tipo).toBe("llega");
    expect(p?.texto).toBe("Al ritmo actual llegas al 100 % el 15 de diciembre.");
  });
  it("con entrega antes de llegar al 100 %: vas bien", () => {
    const p = proyeccion({ ...monni, due_date: "2026-12-04" }, [tx("gasto", 100_000, "2026-11-01"), tx("gasto", 100_000, "2026-11-10"), tx("gasto", 100_000, "2026-11-20")], HOY);
    expect(p).toEqual({ tipo: "bien", pctFinal: 76, texto: "Vas bien: terminarías en 76 %." });
  });
  it("si ya se pasó no hay proyección (lo dice el aviso)", () => {
    expect(proyeccion(monni, [tx("gasto", 200_000, "2026-11-01"), tx("gasto", 200_000, "2026-11-10"), tx("gasto", 200_000, "2026-11-20")], HOY)).toBeNull();
  });
});

describe("avisos", () => {
  it("sale una vez por cruce: el más alto alcanzado y no avisado", () => {
    expect(umbralPorAvisar(79, [80, 100], [])).toBeNull();
    expect(umbralPorAvisar(81, [80, 100], [])).toBe(80);
    expect(umbralPorAvisar(85, [80, 100], [80])).toBeNull();
    expect(umbralPorAvisar(104, [80, 100], [80])).toBe(100);
    expect(umbralPorAvisar(130, [80, 100], [])).toBe(100);
    expect(umbralPorAvisar(130, [80, 100], [80, 100])).toBeNull();
  });
  it("si baja del umbral, un nuevo cruce vuelve a avisar", () => {
    expect(avisadosVigentes(70, [80, 100])).toEqual([]);
    expect(avisadosVigentes(90, [80, 100])).toEqual([80]);
  });
  it("textos sin culpa, con tono tranquilo en un día difícil", () => {
    const r80 = resumenDinero(monni, [tx("gasto", 400_000, "2026-11-20")], HOY);
    expect(textoAviso("Monni", 80, r80, false)).toEqual({ pose: "pensativo", pasado: false, texto: c("Monni va en 80 % del presupuesto. Quedan $100.000 para lo que falta.") });
    const r100 = resumenDinero(monni, [tx("gasto", 540_000, "2026-11-20")], HOY);
    expect(textoAviso("Monni", 100, r100, false).texto).toBe(c("Nos pasamos $40.000 en Monni. ¿Ajustamos el presupuesto o recortamos algo?"));
    expect(textoAviso("Monni", 100, r100, true).texto).toBe(c("Monni pasó el presupuesto por $40.000. Cuando quieras lo revisamos con calma."));
    for (const t of [textoAviso("Monni", 80, r80, false), textoAviso("Monni", 100, r100, false)]) expect(t.texto).not.toMatch(/deberías|mal|error|culpa/i);
  });
});

describe("valor por hora y cierre", () => {
  it("solo con 5 horas o más", () => {
    expect(valorPorHora(450_000, 4.9)).toBeNull();
    expect(valorPorHora(450_000, 10)).toBe(45_000);
  });
  it("filas del cierre", () => {
    const filas = filasCierre(monni, [tx("gasto", 320_000, "2026-11-20"), tx("ingreso", 900_000, "2026-11-21")], HOY, 12);
    expect(filas.map((f) => f.label)).toEqual(["Presupuesto", "Gastado", "Ingresos", "Balance", "Horas de enfoque", "Valor por hora"]);
    expect(filas.find((f) => f.label === "Valor por hora")?.valor).toBe(c("$48.333"));
  });
});
