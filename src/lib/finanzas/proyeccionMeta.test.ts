import { describe, expect, it } from "vitest";
import { mesTexto, proyeccionMeta } from "./proyeccionMeta";

const HOY = "2026-11-27";
// Creada hace ~4 meses (120 días) con $1.200.000 ahorrados: ritmo de $300.000 al mes
const meta = { target_amount: 3_000_000, current_amount: 1_200_000, target_date: null as string | null, created_at: "2026-07-30T12:00:00Z" };

describe("proyección de una meta sin plan", () => {
  it("al ritmo real: faltan 1.800.000 a 300.000 al mes → 6 meses", () => {
    const p = proyeccionMeta(meta, HOY)!;
    expect(Math.round(p.ritmo)).toBe(300_000);
    expect(p.llega).toBe("2027-05");
    expect(mesTexto(p.llega!)).toBe("mayo de 2027");
  });
  it("con un extra llega antes", () => {
    const p = proyeccionMeta(meta, HOY)!;
    expect(p.extra).toBe(150_000);
    expect(p.llegaConExtra! < p.llega!).toBe(true);
  });
  it("con fecha límite: cuánto se necesita al mes y si llega a tiempo", () => {
    const p = proyeccionMeta({ ...meta, target_date: "2027-03-15" }, HOY)!;
    expect(p.necesarioAlMes).toBe(450_000); // 1.800.000 en 4 meses
    expect(p.aTiempo).toBe(false);
    expect(proyeccionMeta({ ...meta, target_date: "2027-12-01" }, HOY)!.aTiempo).toBe(true);
  });
  it("sin ahorro aún: no inventa fecha", () => {
    const p = proyeccionMeta({ ...meta, current_amount: 0 }, HOY)!;
    expect(p.ritmo).toBe(0);
    expect(p.llega).toBeNull();
  });
  it("meta cumplida: nada que proyectar", () => {
    expect(proyeccionMeta({ ...meta, current_amount: 3_000_000 }, HOY)).toBeNull();
  });
});

describe("meta recién creada", () => {
  it("no adivina el ritmo con lo ahorrado antes, pero sí dice cuánto se necesita para su fecha", () => {
    const p = proyeccionMeta({ target_amount: 8_000_000, current_amount: 1_000_000, target_date: "2027-11-27", created_at: "2026-11-27T10:00:00Z" }, "2026-11-27")!;
    expect(p.reciente).toBe(true);
    expect(p.llega).toBeNull();
    expect(p.llegaConExtra).toBeNull();
    expect(p.aTiempo).toBeNull();
    expect(p.necesarioAlMes).toBe(584_000); // 7.000.000 en 12 meses
  });
});
