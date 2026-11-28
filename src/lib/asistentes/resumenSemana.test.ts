import { describe, expect, it } from "vitest";
import { emptyDatabase, type Database, type Transaction } from "../../types/db";
import { resumenSemanal } from "./resumenSemana";

const base = { user_id: "u", created_at: "2026-09-01T12:00:00Z" };
const gasto = (id: string, date: string, amount: number, status: Transaction["status"] = "completado"): Transaction => ({
  ...base, id, type: "gasto", description: id, amount, category: "Otros", account_id: "a", to_account_id: null, date, payment_method: null, status, beneficiary: null, notes: null,
});
const HOY = "2026-11-29"; // domingo

describe("resumen del domingo", () => {
  const db: Database = {
    ...emptyDatabase(),
    transactions: [gasto("a", "2026-11-25", 80_000), gasto("b", "2026-11-28", 20_000), gasto("c", "2026-11-18", 125_000), gasto("p", "2026-11-27", 999_000, "pendiente")],
    habits: [{ ...base, id: "h", name: "Entrenar", color: "#000", days: [0, 2, 4] }],
    habit_logs: ["2026-11-23", "2026-11-25"].map((d) => ({ ...base, id: d, habit_id: "h", date: d })),
    savings_goals: [
      { ...base, id: "s1", name: "Moto", target_amount: 8_000_000, current_amount: 2_000_000, target_date: null, priority: "media", account_id: null, description: null },
      { ...base, id: "s2", name: "Viaje", target_amount: 1_000_000, current_amount: 800_000, target_date: null, priority: "media", account_id: null, description: null },
    ],
  };
  const r = resumenSemanal(db, HOY);
  it("compara el gasto de los últimos 7 días con los 7 anteriores (sin pendientes)", () => {
    expect(r.gasto).toBe(100_000);
    expect(r.gastoAnterior).toBe(125_000);
    expect(r.variacion).toBe(-20);
  });
  it("cuenta los entrenamientos de la semana", () => {
    expect(r.entreno).toMatchObject({ hechos: 2, meta: 3 });
  });
  it("elige la meta de ahorro más cerca de cumplirse", () => {
    expect(r.meta).toEqual({ nombre: "Viaje", pct: 80, falta: 200_000 });
  });
});
