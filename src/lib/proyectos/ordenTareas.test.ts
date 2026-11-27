import { describe, expect, it } from "vitest";
import type { Task } from "../../types/db";
import { hermanasDe, migrarOrden, mover, moverA, ordenarTareas } from "./ordenTareas";

let n = 0;
const t = (name: string, extra: Partial<Task> = {}): Task => ({
  id: name,
  user_id: "u",
  created_at: `2026-11-${String(10 + ++n).padStart(2, "0")}T12:00:00Z`,
  project_id: "p",
  parent_task_id: null,
  name,
  description: null,
  due_date: null,
  priority: "media",
  status: "pendiente",
  ...extra,
});
const aplicar = (ts: Task[], cambios: { id: string; sort_order: number }[]) => ts.map((x) => ({ ...x, sort_order: cambios.find((c) => c.id === x.id)?.sort_order ?? x.sort_order }));
const nombres = (ts: Task[]) => ordenarTareas(ts).map((x) => x.name);

describe("orden de tareas", () => {
  const base = [t("a"), t("b"), t("c"), t("d")];
  const conOrden = aplicar(base, migrarOrden(base));

  it("la migración conserva el orden que se veía", () => {
    expect(nombres(conOrden)).toEqual(["a", "b", "c", "d"]);
    expect(migrarOrden(conOrden)).toEqual([]);
  });
  it("arrastrar a otra posición", () => {
    expect(nombres(aplicar(conOrden, mover(conOrden, "d", "b")))).toEqual(["a", "d", "b", "c"]);
    expect(nombres(aplicar(conOrden, mover(conOrden, "a", null)))).toEqual(["b", "c", "d", "a"]);
  });
  it("mover arriba, abajo, al principio y al final", () => {
    expect(nombres(aplicar(conOrden, moverA(conOrden, "c", "arriba")))).toEqual(["a", "c", "b", "d"]);
    expect(nombres(aplicar(conOrden, moverA(conOrden, "b", "abajo")))).toEqual(["a", "c", "b", "d"]);
    expect(nombres(aplicar(conOrden, moverA(conOrden, "d", "principio")))).toEqual(["d", "a", "b", "c"]);
    expect(nombres(aplicar(conOrden, moverA(conOrden, "a", "final")))).toEqual(["b", "c", "d", "a"]);
    expect(moverA(conOrden, "a", "arriba")).toEqual([]);
    expect(moverA(conOrden, "d", "abajo")).toEqual([]);
  });
  it("solo cambia lo necesario", () => {
    expect(mover(conOrden, "b", "c")).toEqual([]);
  });
  it("las nuevas (sin orden) van al final", () => {
    const conNueva = [...conOrden, t("e")];
    expect(nombres(conNueva)).toEqual(["a", "b", "c", "d", "e"]);
  });
  it("por fecha y por prioridad sin tocar el manual", () => {
    const ts = aplicar(
      [t("x", { due_date: "2026-12-05", priority: "baja" }), t("y", { priority: "alta" }), t("z", { due_date: "2026-12-01" })],
      [
        { id: "x", sort_order: 1 },
        { id: "y", sort_order: 2 },
        { id: "z", sort_order: 3 },
      ],
    );
    expect(ordenarTareas(ts, "fecha").map((x) => x.name)).toEqual(["z", "x", "y"]);
    expect(ordenarTareas(ts, "prioridad").map((x) => x.name)).toEqual(["y", "z", "x"]);
    expect(ordenarTareas(ts).map((x) => x.name)).toEqual(["x", "y", "z"]);
  });
  it("hermanas: mismo proyecto y misma tarea madre", () => {
    const ts = [t("p1"), t("p2"), t("sub", { parent_task_id: "p1" }), t("otra", { project_id: "q" })];
    expect(hermanasDe(ts, ts[0]).map((x) => x.name)).toEqual(["p1", "p2"]);
    expect(hermanasDe(ts, ts[2]).map((x) => x.name)).toEqual(["sub"]);
  });
});
