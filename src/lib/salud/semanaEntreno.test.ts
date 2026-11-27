import { describe, expect, it } from "vitest";
import type { Habit, HabitLog } from "../../types/db";
import { completion, isScheduled, streak } from "../../modules/habits/selectors";
import { diasDeSemana, etiquetaDia, resumenSemana } from "./semanaEntreno";

const HOY = "2026-11-26"; // jueves
const LUNES = "2026-11-23";
const entrenar: Habit = { id: "h", user_id: "u", created_at: "2026-09-01T12:00:00Z", name: "Entrenar", color: "#000", days: [0, 2, 4] };
const flexible: Habit = { ...entrenar, id: "f", days: [0, 1, 2, 3, 4, 5, 6], weekly_target: 3 };
const log = (habit: string, date: string): HabitLog => ({ id: `${habit}-${date}`, user_id: "u", created_at: `${date}T12:00:00Z`, habit_id: habit, date });

describe("semana de entrenamiento", () => {
  it("resumen con lo que falta, extras y semanas pasadas", () => {
    const dosDeTres = diasDeSemana(entrenar, [log("h", "2026-11-23"), log("h", "2026-11-25")], LUNES, HOY);
    expect(resumenSemana(entrenar, dosDeTres, HOY)).toBe("2 de 3 esta semana · te falta el viernes");
    const completa = diasDeSemana(entrenar, ["2026-11-23", "2026-11-25", "2026-11-26"].map((d) => log("h", d)), LUNES, HOY);
    // Lunes, miércoles y un jueves extra: con 3 la semana ya está cumplida
    expect(resumenSemana(entrenar, completa, HOY)).toBe("3 de 3 esta semana");
    const pasada = diasDeSemana(entrenar, [log("h", "2026-11-16")], "2026-11-16", HOY);
    expect(resumenSemana(entrenar, pasada, HOY)).toBe("1 de 3 esa semana");
    const conExtra = diasDeSemana(entrenar, ["2026-11-16", "2026-11-18", "2026-11-20", "2026-11-22"].map((d) => log("h", d)), "2026-11-16", HOY);
    expect(resumenSemana(entrenar, conExtra, HOY)).toBe("4 de 3 esa semana · uno extra");
  });
  it("etiqueta accesible de cada día", () => {
    const [lunes, , , jueves, viernes] = diasDeSemana(entrenar, [log("h", "2026-11-23")], LUNES, HOY);
    expect(etiquetaDia(lunes)).toBe("Lunes 23, planeado, realizado");
    expect(etiquetaDia(jueves)).toBe("Jueves 26, hoy, no planeado, sin realizar");
    expect(etiquetaDia(viernes)).toBe("Viernes 27, planeado, todavía no");
  });
  it("veces por semana: lo que falta", () => {
    const dias = diasDeSemana(flexible, [log("f", "2026-11-24")], LUNES, HOY);
    expect(resumenSemana(flexible, dias, HOY)).toBe("1 de 3 esta semana · te faltan 2 más");
  });
});

describe("frecuencia flexible sin romper lo de siempre", () => {
  // Copia del cálculo anterior (días fijos) para comparar con el nuevo
  const rachaVieja = (h: Habit, logs: HabitLog[], today: string) => {
    const done = new Set(logs.filter((l) => l.habit_id === h.id).map((l) => l.date));
    const dia = (iso: string) => (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
    let day = done.has(today) ? today : new Date(Date.parse(`${today}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
    let n = 0;
    for (let i = 0; i < 400; i++) {
      if (h.days.includes(dia(day))) {
        if (!done.has(day)) break;
        n++;
      }
      day = new Date(Date.parse(`${day}T12:00:00Z`) - 864e5).toISOString().slice(0, 10);
    }
    return n;
  };
  it("los hábitos de días fijos dan exactamente lo mismo que antes", () => {
    let semilla = 7;
    const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
    for (let caso = 0; caso < 40; caso++) {
      const logs: HabitLog[] = [];
      for (let i = 0; i < 90; i++) {
        const d = new Date(Date.parse(`${HOY}T12:00:00Z`) - i * 864e5).toISOString().slice(0, 10);
        if (azar() < 0.75) logs.push(log("h", d));
      }
      expect(streak(entrenar, logs, HOY)).toBe(rachaVieja(entrenar, logs, HOY));
    }
  });
  it("veces por semana: la semana se cumple al llegar a la cantidad, sin importar el día", () => {
    // Semana pasada: martes, sábado y domingo (3 de 3); esta semana: lunes
    const logs = ["2026-11-17", "2026-11-21", "2026-11-22", "2026-11-23"].map((d) => log("f", d));
    expect(streak(flexible, logs, HOY)).toBe(4);
    expect(completion(flexible, logs, "2026-11-16", "2026-11-22")).toEqual({ scheduled: 3, completed: 3, pct: 100 });
    // Semana en curso: no resta mientras no termine
    expect(completion(flexible, logs, LUNES, HOY).pct).toBe(100);
    // Con la semana cumplida, los demás días ya no quedan pendientes
    const cumplida = ["2026-11-23", "2026-11-24", "2026-11-25"].map((d) => log("f", d));
    expect(isScheduled(flexible, HOY, cumplida)).toBe(false);
    expect(isScheduled(flexible, HOY, cumplida.slice(0, 2))).toBe(true);
  });
  it("una semana incompleta corta la racha", () => {
    const logs = ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-17", "2026-11-23"].map((d) => log("f", d));
    expect(streak(flexible, logs, HOY)).toBe(1);
  });
});
