import { describe, expect, it } from "vitest";
import type { Habit, HabitLog } from "../../types/db";
import { completion, isScheduled, streak } from "../../modules/habits/selectors";
import { diasDeSemana, estadoDia, etiquetaDia, rachaSemanasEntreno, reaccionEntreno, resumenSemana, semanaCompleta } from "./semanaEntreno";

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

describe("realizado, no realizado y reacción de la mascota", () => {
  // Plan: lunes, miércoles y viernes. Hoy es jueves 26.
  const semana = (fechas: string[], habit = entrenar) => diasDeSemana(habit, fechas.map((d) => log(habit.id, d)), LUNES, HOY);

  it("estado de cada día", () => {
    const d = semana(["2026-11-23"]);
    expect(estadoDia(d[0])).toBe("realizado"); // lunes marcado
    expect(estadoDia(d[1])).toBe("descanso"); // martes no planeado
    expect(estadoDia(d[2])).toBe("no-realizado"); // miércoles pasó sin marcar
    expect(estadoDia(d[4])).toBe("proximo"); // viernes todavía no
    const hoyPlaneado = diasDeSemana({ ...entrenar, days: [3] }, [], LUNES, HOY);
    expect(estadoDia(hoyPlaneado[3])).toBe("pendiente");
  });

  it("al día: la mascota no dice nada", () => {
    expect(reaccionEntreno(entrenar, semana(["2026-11-23", "2026-11-25"]))).toBeNull();
  });

  it("faltó un día: preocupada, y aún alcanza con viernes y fin de semana", () => {
    const r = reaccionEntreno(entrenar, semana(["2026-11-23"]))!;
    expect(r.clave).toBe("gymFalta");
    expect(r.expresion).toBe("preocupado");
    expect(r.datos).toMatchObject({ dia: "miércoles", alcanza: "si" });
  });

  it("faltó dos días: triste", () => {
    const r = reaccionEntreno(entrenar, semana([]))!;
    expect(r.clave).toBe("gymFaltas");
    expect(r.expresion).toBe("triste");
    expect(r.datos.n).toBe(2);
  });

  it("semana completa: celebra (un día extra cuenta)", () => {
    const completa = diasDeSemana(entrenar, ["2026-11-23", "2026-11-24", "2026-11-25"].map((d) => log("h", d)), LUNES, HOY);
    expect(semanaCompleta(entrenar, completa)).toBe(true);
    expect(reaccionEntreno(entrenar, completa)?.clave).toBe("gymSemana");
    expect(semanaCompleta(entrenar, semana(["2026-11-23"]))).toBe(false);
  });

  it("«X veces por semana»: solo se preocupa cuando ya no alcanzan los días", () => {
    expect(reaccionEntreno(flexible, semana([], flexible))).toBeNull(); // 0 de 3, quedan jueves a domingo
    expect(semanaCompleta(flexible, semana(["2026-11-23", "2026-11-24", "2026-11-25"], flexible))).toBe(true);
  });
});

describe("racha de semanas completas", () => {
  // Plan lunes, miércoles y viernes; hoy jueves 26 de noviembre (semana del 23)
  const semanaCompletaDe = (lunes: string) => [0, 2, 4].map((d) => log("h", addDaysISO(lunes, d)));
  function addDaysISO(iso: string, n: number) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  it("cuenta las semanas pasadas completas; la semana en curso no la rompe", () => {
    const logs = [...semanaCompletaDe("2026-11-02"), ...semanaCompletaDe("2026-11-09"), ...semanaCompletaDe("2026-11-16"), log("h", "2026-11-23")];
    expect(rachaSemanasEntreno(entrenar, logs, HOY)).toEqual({ actual: 3, mejor: 3 });
  });
  it("una semana incompleta corta la racha, pero se recuerda la mejor", () => {
    const logs = [...semanaCompletaDe("2026-10-19"), ...semanaCompletaDe("2026-10-26"), log("h", "2026-11-02"), ...semanaCompletaDe("2026-11-09"), ...semanaCompletaDe("2026-11-16")];
    expect(rachaSemanasEntreno(entrenar, logs, HOY)).toEqual({ actual: 2, mejor: 2 });
    const larga = [...semanaCompletaDe("2026-10-12"), ...logs];
    expect(rachaSemanasEntreno(entrenar, larga, HOY)).toEqual({ actual: 2, mejor: 3 });
  });
  it("sin registros, sin racha", () => {
    expect(rachaSemanasEntreno(entrenar, [], HOY)).toEqual({ actual: 0, mejor: 0 });
  });
});
