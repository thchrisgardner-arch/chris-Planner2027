import { describe, expect, it } from "vitest";
import type { Project, Transaction } from "../../types/db";
import { revisarAvisos, type DatosDinero } from "./avisosDinero";

const vacio = (): DatosDinero => ({ version: 1, migracion: 1, iniciado: true, avisados: {}, ultimo: {} });
const proyecto: Project = {
  id: "monni",
  user_id: "u",
  created_at: "2026-11-01T00:00:00Z",
  name: "Monni",
  description: null,
  category: null,
  color: "#000",
  priority: "media",
  start_date: null,
  due_date: null,
  budget: 500_000,
  status: "en_proceso",
  money: { presupuesto: { monto: 500_000, periodo: "total" }, generaIngresos: false, alertas: [80, 100] },
};
const gasto = (amount: number, date = "2026-11-20", id = String(amount)): Transaction => ({
  id,
  user_id: "u",
  created_at: `${date}T12:00:00Z`,
  type: "gasto",
  description: "x",
  amount,
  category: null,
  account_id: "a",
  to_account_id: null,
  date,
  payment_method: null,
  status: "completado",
  beneficiary: null,
  notes: null,
  project_id: "monni",
});

describe("avisos de dinero", () => {
  it("al cruzar el 80 % avisa una vez", () => {
    const a = revisarAvisos(vacio(), [proyecto], [gasto(400_000)], "2026-11-27", false);
    expect(a.aviso?.umbral).toBe(80);
    const b = revisarAvisos(a.datos, [proyecto], [gasto(400_000)], "2026-11-27", false);
    expect(b.aviso).toBeNull();
    const c = revisarAvisos(b.datos, [proyecto], [gasto(400_000)], "2026-11-28", false);
    expect(c.aviso).toBeNull();
  });
  it("el mismo día no repite aunque cruce el 100 %: sale al día siguiente", () => {
    const a = revisarAvisos(vacio(), [proyecto], [gasto(400_000)], "2026-11-27", false);
    const b = revisarAvisos(a.datos, [proyecto], [gasto(400_000), gasto(140_000, "2026-11-27", "b")], "2026-11-27", false);
    expect(b.aviso).toBeNull();
    const c = revisarAvisos(b.datos, [proyecto], [gasto(400_000), gasto(140_000, "2026-11-27", "b")], "2026-11-28", false);
    expect(c.aviso?.umbral).toBe(100);
    expect(c.aviso?.pose).toBe("preocupado");
  });
  it("si cruza 80 y 100 de una vez, sale solo el de 100", () => {
    const a = revisarAvisos(vacio(), [proyecto], [gasto(600_000)], "2026-11-27", false);
    expect(a.aviso?.umbral).toBe(100);
    expect(a.datos.avisados.monni.umbrales).toEqual([80, 100]);
    expect(revisarAvisos(a.datos, [proyecto], [gasto(600_000)], "2026-11-29", false).aviso).toBeNull();
  });
  it("la primera vez no avisa lo que ya estaba cruzado", () => {
    const a = revisarAvisos({ ...vacio(), iniciado: false }, [proyecto], [gasto(450_000)], "2026-11-27", false);
    expect(a.aviso).toBeNull();
    expect(a.datos.iniciado).toBe(true);
    expect(a.datos.avisados.monni.umbrales).toEqual([80]);
  });
  it("si baja del umbral y vuelve a cruzar, avisa otra vez", () => {
    const a = revisarAvisos(vacio(), [proyecto], [gasto(400_000)], "2026-11-27", false);
    const b = revisarAvisos(a.datos, [{ ...proyecto, money: { presupuesto: { monto: 800_000, periodo: "total" }, alertas: [80, 100] } }], [gasto(400_000)], "2026-11-28", false);
    expect(b.datos.avisados.monni.umbrales).toEqual([]);
    const c = revisarAvisos(b.datos, [proyecto], [gasto(400_000)], "2026-11-29", false);
    expect(c.aviso?.umbral).toBe(80);
  });
  it("proyectos terminados o sin presupuesto no avisan", () => {
    expect(revisarAvisos(vacio(), [{ ...proyecto, status: "completado" }], [gasto(600_000)], "2026-11-27", false).aviso).toBeNull();
    expect(revisarAvisos(vacio(), [{ ...proyecto, budget: null, money: { generaIngresos: true } }], [gasto(600_000)], "2026-11-27", false).aviso).toBeNull();
  });
  it("un presupuesto mensual vuelve a avisar en el mes siguiente", () => {
    const mensual = { ...proyecto, money: { presupuesto: { monto: 500_000, periodo: "mensual" as const }, alertas: [80, 100] } };
    const a = revisarAvisos(vacio(), [mensual], [gasto(400_000, "2026-11-20")], "2026-11-27", false);
    expect(a.aviso?.umbral).toBe(80);
    const b = revisarAvisos(a.datos, [mensual], [gasto(400_000, "2026-11-20"), gasto(420_000, "2026-12-10", "d")], "2026-12-11", false);
    expect(b.aviso?.umbral).toBe(80);
  });
});
