import { describe, expect, it } from "vitest";
import { armarAvisos, horasDeRecordatorios } from "./mensajes";
import type { EstadoAvisos } from "./almacen";

const voces = {
  centavo: { nombre: "Centavo", modo: "en-el-momento" as const },
  brote: { nombre: "Brote", modo: "en-el-momento" as const },
  tic: { nombre: "Tic", modo: "en-el-momento" as const },
};
const base: EstadoAvisos = {
  version: 2,
  fecha: "2026-11-26",
  racha: 12,
  hechoHoy: false,
  habitosPendientes: 2,
  tareasPendientes: 0,
  asistente: "Centavo",
  principal: "centavo",
  voces,
  recordatorios: { habitos: 19, agenda: 8, racha: true },
  hoy: { eventos: 3, primerEvento: "10:00", pagosVencen: 1, pagosVencidos: 0, habitos: 4 },
  manana: { eventos: 0, primerEvento: null, pagosVencen: 0, pagosVencidos: 0, habitos: 4 },
};

describe("recordatorios en la voz de cada asistente", () => {
  it("Brote recuerda los hábitos a su hora", () => {
    expect(armarAvisos(base, "2026-11-26", 19)).toEqual([
      { title: "Brote", body: "Te faltan 2 hábitos. Sin afán, pero hoy.", url: "/salud?vista=habitos", tag: "lifeos-habitos" },
    ]);
  });
  it("Tic cuenta la agenda y los gastos fijos", () => {
    const [a] = armarAvisos(base, "2026-11-26", 8);
    expect(a.title).toBe("Tic");
    expect(a.body).toBe("Hoy tienes 3 eventos; el primero a las 10 a. m. 1 gasto fijo vence en estos días. Yo aviso, tú confirmas.");
  });
  it("racha en riesgo a las 8 p. m. solo si no has registrado nada", () => {
    expect(armarAvisos(base, "2026-11-26", 20)[0].body).toBe("Tu racha de 12 días está en riesgo. Un registro y listo.");
    expect(armarAvisos({ ...base, hechoHoy: true }, "2026-11-26", 20)).toEqual([]);
  });
  it("un asistente en Nunca no envía nada", () => {
    expect(armarAvisos({ ...base, voces: { ...voces, brote: { nombre: "Brote", modo: "nunca" } } }, "2026-11-26", 19)).toEqual([]);
  });
  it("Resumen diario mueve a Brote a la hora de la agenda", () => {
    const e = { ...base, voces: { ...voces, brote: { nombre: "Brote", modo: "resumen-diario" as const } } };
    expect(armarAvisos(e, "2026-11-26", 19)).toEqual([]);
    expect(armarAvisos(e, "2026-11-26", 8).map((a) => a.title)).toEqual(["Brote", "Tic"]);
    expect(horasDeRecordatorios(e)).toEqual([8, 20]);
  });
  it("con el resumen de ayer usa lo que decía de mañana", () => {
    const ayer = { ...base, fecha: "2026-11-25", hechoHoy: true };
    expect(armarAvisos(ayer, "2026-11-26", 19)[0].body).toBe("Te faltan 4 hábitos. Sin afán, pero hoy.");
    expect(armarAvisos(ayer, "2026-11-26", 20)[0].body).toContain("12 días");
  });
  it("resumen viejo (más de un día): solo nada", () => {
    expect(armarAvisos({ ...base, fecha: "2026-11-20" }, "2026-11-26", 8)).toEqual([]);
  });
  it("horas que revisa el servidor", () => expect(horasDeRecordatorios(base)).toEqual([8, 19, 20]));
});
