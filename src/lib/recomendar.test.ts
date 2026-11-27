import { describe, expect, it } from "vitest";
import { debeMostrar, type DatosRecomendar } from "./recomendar";

const HOY = "2026-11-27";
const base: DatosRecomendar = { version: 1, primerUso: "2026-11-01", ultimo: null, nunca: false, momento: HOY, negativo: null };
const ok = { diaDificil: false };

describe("cuándo aparece la invitación a recomendar", () => {
  it("con todo a favor, sí", () => expect(debeMostrar(base, HOY, ok)).toBe(true));
  it("menos de 7 días de uso (incluye el día del onboarding), no", () => {
    expect(debeMostrar({ ...base, primerUso: HOY }, HOY, ok)).toBe(false);
    expect(debeMostrar({ ...base, primerUso: "2026-11-21" }, HOY, ok)).toBe(false);
    expect(debeMostrar({ ...base, primerUso: "2026-11-20" }, HOY, ok)).toBe(true);
    // Si el progreso muestra días activos más viejos, cuentan
    expect(debeMostrar({ ...base, primerUso: HOY }, HOY, { diaDificil: false, primerDiaActivo: "2026-10-01" })).toBe(true);
  });
  it("solo justo después de un momento positivo y nunca tras uno negativo", () => {
    expect(debeMostrar({ ...base, momento: "2026-11-26" }, HOY, ok)).toBe(false);
    expect(debeMostrar({ ...base, negativo: HOY }, HOY, ok)).toBe(false);
  });
  it("con el ánimo bajo, no", () => expect(debeMostrar(base, HOY, { diaDificil: true })).toBe(false));
  it("máximo una vez cada 30 días", () => {
    expect(debeMostrar({ ...base, ultimo: "2026-11-01" }, HOY, ok)).toBe(false);
    expect(debeMostrar({ ...base, ultimo: "2026-10-28" }, HOY, ok)).toBe(true);
  });
  it("tras «No volver a mostrar», nunca más", () => expect(debeMostrar({ ...base, nunca: true }, HOY, ok)).toBe(false));
});
