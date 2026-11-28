import { describe, expect, it } from "vitest";
import type { Transaction } from "../../types/db";
import { cobrosRepetidos } from "./cobrosRepetidos";

let n = 0;
const g = (description: string, date: string, amount: number): Transaction => ({
  id: `t${n++}`, user_id: "u", created_at: `${date}T12:00:00Z`, type: "gasto", description, amount, category: "Suscripciones", account_id: "a", to_account_id: null, date, payment_method: null, status: "completado", beneficiary: null, notes: null,
});
const HOY = "2026-11-27";

describe("cobros que se repiten cada mes", () => {
  const txs = [
    // Netflix: mismo monto cada mes, con referencias distintas
    g("NETFLIX.COM 8812", "2026-09-12", 44_900), g("NETFLIX.COM 9921", "2026-10-12", 44_900), g("Netflix", "2026-11-12", 44_900),
    // Gimnasio: sube un poco (dentro del 15 %)
    g("Gimnasio Smart Fit", "2026-10-05", 89_900), g("Gimnasio Smart Fit", "2026-11-04", 95_000),
    // Rappi: muchas veces al mes, no es mensual
    g("RAPPI*1", "2026-11-01", 30_000), g("RAPPI*2", "2026-11-03", 45_000), g("RAPPI*3", "2026-11-20", 25_000),
    // Spotify: dejó de cobrar hace meses
    g("Spotify", "2026-06-10", 16_900), g("Spotify", "2026-07-10", 16_900),
    // Arriendo: monto muy distinto entre meses
    g("Mercado grande", "2026-10-02", 400_000), g("Mercado grande", "2026-11-01", 150_000),
  ];
  const r = cobrosRepetidos(txs, HOY);

  it("encuentra los cobros mensuales activos con monto parecido", () => {
    // De mayor a menor costo al año: el gimnasio (~$92.450 al mes) y Netflix ($44.900)
    expect(r.map((c) => c.nombre)).toEqual(["Smart fit", "Netflix"]);
  });
  it("calcula lo que cuestan al año y el día de cobro", () => {
    const netflix = r.find((c) => c.clave === "netflix")!;
    expect(netflix).toMatchObject({ monto: 44_900, veces: 3, alAnio: 538_800, dia: 12, ultimo: "2026-11-12" });
  });
  it("no incluye lo que ya es gasto fijo o se marcó como «no es fijo»", () => {
    expect(cobrosRepetidos(txs, HOY, new Set(["netflix"])).map((c) => c.clave)).not.toContain("netflix");
  });
});
