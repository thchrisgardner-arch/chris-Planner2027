import { describe, expect, it } from "vitest";
import { formatCOP } from "../../utils/money";
import { aporteNecesario, aportesPendientes, fechaEstimada, fechasAporte, recalcularPlan, ritmo, textoPlan, type PlanAporte } from "./planAporte";

const HOY = "2026-11-27";
const c = (txt: string) => txt.replace(/\$([\d.]+\d)/g, (_, v: string) => formatCOP(Number(v.replace(/\./g, ""))));

describe("fechas de aporte", () => {
  it("diaria, semanal, quincenal y mensual", () => {
    expect(fechasAporte({ frecuencia: "diaria", inicio: "2026-11-25" }, "2026-11-25", HOY)).toEqual(["2026-11-25", "2026-11-26", "2026-11-27"]);
    expect(fechasAporte({ frecuencia: "semanal", inicio: "2026-11-02" }, "2026-11-01", HOY)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23"]);
    expect(fechasAporte({ frecuencia: "quincenal", inicio: "2026-10-20" }, "2026-10-01", "2026-12-31")).toEqual(["2026-10-31", "2026-11-15", "2026-11-30", "2026-12-15", "2026-12-31"]);
    expect(fechasAporte({ frecuencia: "mensual", inicio: "2026-01-31" }, "2026-01-01", "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
});

describe("plan con fecha y sin fecha", () => {
  const meta = { target_amount: 1_000_000, current_amount: 150_000, target_date: "2027-06-15" };
  it("con fecha calcula el aporte de cada quincena", () => {
    // Del 30 nov al 15 jun hay 14 quincenas: 850.000 / 14 ≈ 60.715 → 61.000
    const n = aporteNecesario(meta, { frecuencia: "quincenal", inicio: HOY }, HOY);
    expect(n).toBe(61_000);
    expect(textoPlan(meta, { frecuencia: "quincenal", inicio: HOY, monto: 61_000, base: 150_000 }, HOY)).toBe(c("Ahorra $61.000 cada quincena para llegar el 15 de junio de 2027."));
  });
  it("sin fecha calcula cuándo se llega", () => {
    const plan: PlanAporte = { frecuencia: "mensual", inicio: "2026-12-01", monto: 100_000, base: 150_000 };
    // 850.000 / 100.000 = 9 aportes: dic … ago
    expect(fechaEstimada({ ...meta, target_date: null }, plan, HOY)).toBe("2027-08-01");
    expect(textoPlan({ ...meta, target_date: null }, plan, HOY)).toBe(c("Con $100.000 cada mes llegas el 1 de agosto de 2027."));
  });
});

describe("pendientes y ritmo", () => {
  const plan: PlanAporte = { frecuencia: "semanal", inicio: "2026-11-02", monto: 50_000, base: 100_000 };
  it("pendientes: los que ya llegaron y no se confirmaron ni saltaron", () => {
    expect(aportesPendientes(plan, { "2026-11-02": { estado: "ahorrado", monto: 50_000 }, "2026-11-09": { estado: "saltado", monto: 0 } }, HOY)).toEqual(["2026-11-16", "2026-11-23"]);
  });
  it("ritmo sin culpa", () => {
    // 4 aportes vencidos: lo esperado es 100.000 + 200.000 = 300.000
    expect(ritmo({ current_amount: 340_000, target_amount: 1_000_000 }, plan, HOY).texto).toBe(c("Vas $40.000 adelantado."));
    expect(ritmo({ current_amount: 200_000, target_amount: 1_000_000 }, plan, HOY).texto).toBe("Te faltan 2 aportes para ir al día.");
    expect(ritmo({ current_amount: 300_000, target_amount: 1_000_000 }, plan, HOY).texto).toBe("Vas al día.");
    expect(ritmo({ current_amount: 1_000_000, target_amount: 1_000_000 }, plan, HOY).texto).toBe("Meta cumplida.");
  });
  it("aportar de más en una meta con fecha recalcula los siguientes aportes", () => {
    const meta = { target_amount: 1_000_000, current_amount: 500_000, target_date: "2027-01-31" };
    const p: PlanAporte = { frecuencia: "quincenal", inicio: "2026-11-15", monto: 100_000, base: 300_000 };
    const r = recalcularPlan(meta, p, 200_000, HOY);
    // Quedan 30 nov, 15 dic, 31 dic, 15 ene y 31 ene: 500.000 / 5 = 100.000
    expect(r.monto).toBe(100_000);
    expect(r.base).toBe(500_000);
    expect(recalcularPlan(meta, p, 100_000, HOY)).toBe(p);
  });
});

describe("texto del plan cuando la cuota no alcanza la fecha", () => {
  it("dice cuándo se llega de verdad y cuánto haría falta", () => {
    const meta = { target_amount: 60_000_000, current_amount: 4_000_000, target_date: "2026-12-24" };
    const plan: PlanAporte = { frecuencia: "mensual", monto: 500_000, inicio: "2026-11-27", base: 4_000_000 };
    const t = textoPlan(meta, plan, "2026-11-28").replace(/ /g, " ");
    expect(t).toMatch(/^Con \$ ?500\.000 cada mes llegas el \d+ de \w+ de 20\d\d\. Para el 24 de diciembre necesitas \$ ?56\.000\.000 cada mes\.$/);
  });
});
