import { describe, expect, it } from "vitest";
import { emptyDatabase, type Database, type HabitLog } from "../../types/db";
import { progresoVacio, reconciliar } from "./progreso";

const base = { user_id: "u", created_at: "2026-09-01T12:00:00Z" };
const log = (date: string): HabitLog => ({ ...base, id: `l-${date}`, created_at: `${date}T12:00:00Z`, habit_id: "h", date });
const db = (fechas: string[]): Database => ({
  ...emptyDatabase(),
  habits: [{ ...base, id: "h", name: "Entrenar", color: "#000", days: [0, 2, 4] }],
  habit_logs: fechas.map(log),
});
const HOY = "2026-11-27"; // viernes
const inicio = () => {
  const p = progresoVacio();
  return { ...p, ui: { ...p.ui, iniciado: "2026-11-01" } };
};
const bonos = (p: ReturnType<typeof progresoVacio>) => p.eventos.filter((e) => e.tipo === "semana-entreno");

describe("bono por completar la semana de entrenamiento", () => {
  it("suma +50 XP a Brote una sola vez y se revierte al desmarcar un día", () => {
    const completa = db(["2026-11-23", "2026-11-25", "2026-11-27"]);
    const a = reconciliar(inicio(), completa, HOY, "brote").next;
    expect(bonos(a)).toHaveLength(1);
    expect(bonos(a)[0]).toMatchObject({ xp: 50, asistente: "brote", refId: "se:h:2026-11-23" });
    // Volver a reconciliar no lo duplica
    expect(bonos(reconciliar(a, completa, HOY, "brote").next)).toHaveLength(1);
    // Desmarcar el viernes deja la semana incompleta: el bono se quita
    expect(bonos(reconciliar(a, db(["2026-11-23", "2026-11-25"]), HOY, "brote").next)).toHaveLength(0);
  });

  it("no premia semanas anteriores a cuando empezó el progreso", () => {
    const p = progresoVacio();
    const tarde = { ...p, ui: { ...p.ui, iniciado: "2026-11-25" } };
    const viejas = db(["2026-11-16", "2026-11-18", "2026-11-20"]);
    expect(bonos(reconciliar(tarde, viejas, HOY, "brote").next)).toHaveLength(0);
  });
});
