import { describe, expect, it } from "vitest";
import { crecimientoDeVinculo } from "./crecimiento";
import { CATALOGO_CLOSET, condicionPieza, enCloset, piezaDe, piezasNuevas, type Closet } from "./closet";

const vacio: Closet = { version: 1, piezas: {} };

describe("crecimiento por vínculo", () => {
  it("Inicial 1–3 · Crece 4–6 · Experto 7–9 · Rey 10", () => {
    expect([1, 2, 3, 4, 6, 7, 9, 10].map(crecimientoDeVinculo)).toEqual(["inicial", "inicial", "inicial", "crece", "crece", "experto", "experto", "rey"]);
  });
});

describe("clóset", () => {
  it("la racha abre las piezas en 7, 15, 30, 60 y 100 días", () => {
    const de = (dias: number) => piezasNuevas(vacio, { mejorRacha: dias, logros: {}, hoy: "2026-06-10" }).map((p) => p.acc);
    expect(de(6)).toEqual([]);
    expect(de(7)).toEqual(["gafas-sol"]);
    expect(de(15)).toEqual(["gafas-sol", "helado"]);
    expect(de(100)).toEqual(["gafas-sol", "helado", "bufanda", "audifonos", "capa"]);
  });

  it("no repite piezas ya ganadas", () => {
    const c: Closet = { version: 1, piezas: { "gafas-sol": { fecha: "2026-01-01", fuente: "racha" } } };
    expect(piezasNuevas(c, { mejorRacha: 7, logros: {}, hoy: "2026-06-10" })).toEqual([]);
  });

  it("logro y temporada", () => {
    const acc = piezasNuevas(vacio, { mejorRacha: 0, logros: { "primer-proyecto": "2026-12-02" }, hoy: "2026-12-02" }).map((p) => p.acc);
    expect(acc).toEqual(["dedo-espuma", "gorro-navidad"]);
  });

  it("las piezas de vínculo dependen de cada asistente", () => {
    expect(enCloset("chef", vacio, 2)).toBe(false);
    expect(enCloset("chef", vacio, 3)).toBe(true);
    expect(enCloset("corona", vacio, 9)).toBe(false);
    expect(enCloset("corona", vacio, 10)).toBe(true);
  });

  it("cada pieza tiene una condición legible", () => {
    for (const p of CATALOGO_CLOSET) expect(condicionPieza(p).length).toBeGreaterThan(3);
    expect(condicionPieza(piezaDe("helado")!)).toBe("Racha de 15 días");
  });
});
