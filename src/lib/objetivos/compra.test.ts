import { describe, expect, it } from "vitest";
import { avanceDeCompra, resumenCompra } from "./compra";

const HOY = "2026-11-27";

describe("objetivo de compra de contado (ej. un Mazda)", () => {
  // Precio $95 M; empezó con $20 M y ahorra $1,5 M al mes desde julio; hoy lleva $26 M
  const meta = {
    target_amount: 95_000_000,
    current_amount: 26_000_000,
    target_date: null,
    plan: { frecuencia: "mensual" as const, monto: 1_500_000, inicio: "2026-07-27", base: 20_000_000 },
  };
  const r = resumenCompra(meta, HOY);

  it("precio, ahorrado, lo que falta y el %", () => {
    expect(r).toMatchObject({ precio: 95_000_000, ahorrado: 26_000_000, falta: 69_000_000, pct: 27 });
  });
  it("cuotas: 4 ya ahorradas desde que empezó el plan y 46 por delante", () => {
    expect(r.cuota).toMatchObject({ monto: 1_500_000, frecuencia: "mensual", cada: "cada mes" });
    expect(r.cuotasPagadas).toBe(4);
    expect(r.cuotasRestantes).toBe(46);
  });
  it("fecha estimada y ritmo contra el plan", () => {
    expect(r.llega).toBe("2030-08-27"); // 46 cuotas mensuales, la primera hoy 27 de noviembre de 2026
    // Hasta ayer vencieron 4 cuotas (jul–oct): 20 M + 4 × 1,5 M = 26 M, justo lo ahorrado (la de hoy aún no está atrasada)
    expect(r.ritmo).toBe("Vas al día.");
    const atrasado = resumenCompra({ ...meta, current_amount: 24_500_000 }, HOY);
    expect(atrasado.ritmo).toBe("Te falta 1 aporte para ir al día.");
  });
  it("sin cuota: solo precio, ahorrado y %", () => {
    const s = resumenCompra({ ...meta, plan: null }, HOY);
    expect(s.cuota).toBeNull();
    expect(s.cuotasRestantes).toBe(0);
    expect(s.pct).toBe(27);
  });
  it("comprado: 100 % y sin cuotas por delante", () => {
    const s = resumenCompra({ ...meta, current_amount: 95_000_000 }, HOY);
    expect(s.pct).toBe(100);
    expect(s.cuotasRestantes).toBe(0);
    expect(s.ritmo).toBeNull();
  });
});

describe("el % del objetivo sigue a su meta", () => {
  const meta = { target_amount: 95_000_000, current_amount: 26_000_000 };
  it("actualiza el progreso y pasa de «no iniciado» a «en progreso»", () => {
    expect(avanceDeCompra({ progress: 0, status: "no_iniciado" }, meta)).toEqual({ progress: 27, status: "en_progreso" });
  });
  it("si ya está al día, no cambia nada", () => {
    expect(avanceDeCompra({ progress: 27, status: "en_progreso" }, meta)).toBeNull();
  });
  it("al completar el ahorro queda logrado; un pausado sigue pausado mientras no llegue", () => {
    expect(avanceDeCompra({ progress: 90, status: "en_progreso" }, { ...meta, current_amount: 95_000_000 })).toEqual({ progress: 100, status: "logrado" });
    expect(avanceDeCompra({ progress: 10, status: "pausado" }, meta)).toEqual({ progress: 27, status: "pausado" });
  });
});

describe("plan recién creado", () => {
  it("la primera cuota vence hoy: todavía va al día", () => {
    const r = resumenCompra({ target_amount: 95_000_000, current_amount: 26_000_000, target_date: null, plan: { frecuencia: "mensual", monto: 1_500_000, inicio: HOY, base: 26_000_000 } }, HOY);
    expect(r.ritmo).toBe("Vas al día.");
    expect(r.cuotasPagadas).toBe(0);
  });
});

describe("pagar la cuota de hoy", () => {
  it("con la cuota de hoy pagada va al día, no «adelantado»", () => {
    const plan = { frecuencia: "mensual" as const, monto: 1_500_000, inicio: HOY, base: 26_000_000 };
    expect(resumenCompra({ target_amount: 95_000_000, current_amount: 27_500_000, target_date: null, plan }, HOY).ritmo).toBe("Vas al día.");
    expect(resumenCompra({ target_amount: 95_000_000, current_amount: 29_000_000, target_date: null, plan }, HOY).ritmo).toBe("Vas $ 1.500.000 adelantado.");
  });
});
