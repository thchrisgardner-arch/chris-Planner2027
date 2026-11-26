import { describe, expect, it } from "vitest";
import { emptyDatabase, type Database } from "../../types/db";
import { calcularConexiones } from "./conexiones";

const HOY = "2026-11-26"; // jueves
const base = { user_id: "u", created_at: "2026-11-01T12:00:00Z" };
let n = 0;
const id = () => `id${++n}`;

function db(extra: Partial<Database>): Database {
  return { ...emptyDatabase(), ...extra };
}
const cuenta = { ...base, id: "c1", name: "Nequi", type: "billetera" as const, initial_balance: 500_000, currency: "COP" };
const tx = (p: Partial<Database["transactions"][number]>) => ({
  ...base,
  id: id(),
  type: "gasto" as const,
  description: "Gasto",
  amount: 0,
  category: "Otros",
  account_id: "c1",
  to_account_id: null,
  date: HOY,
  payment_method: null,
  status: "completado" as const,
  beneficiary: null,
  notes: null,
  ...p,
});

describe("conexiones entre módulos", () => {
  it("Tic + Centavo: mañana sale un pago y la cuenta no alcanza", () => {
    const c = calcularConexiones({ db: db({ accounts: [cuenta], transactions: [tx({ description: "Arriendo", amount: 580_000, date: "2026-11-27", status: "pendiente" })] }), hoy: HOY, tareasCompletadas: [] });
    expect(c[0].asistentes).toEqual(["tic", "centavo"]);
    expect(c[0].texto).toBe("Mañana sale arriendo y Nequi tiene $ 80.000 menos de lo necesario.");
  });

  it("Tuerca + Tic: el viernes tiene 3 tareas y 2 eventos", () => {
    const tarea = (nombre: string) => ({ ...base, id: id(), project_id: null, parent_task_id: null, name: nombre, description: null, due_date: "2026-11-27", priority: "media" as const, status: "pendiente" as const });
    const evento = () => ({ ...base, id: id(), title: "Reunión", date: "2026-11-27", start_time: "10:00", end_time: null, type: "personal" as const, notes: null });
    const c = calcularConexiones({ db: db({ tasks: [tarea("a"), tarea("b"), tarea("c")], calendar_events: [evento(), evento()] }), hoy: HOY, tareasCompletadas: [] });
    expect(c[0].id).toMatch(/^agenda-llena/);
    expect(c[0].texto).toContain("3 tareas para mañana");
  });

  it("Antojo + Centavo: el deseo alcanza si esperas al próximo sueldo", () => {
    const c = calcularConexiones({
      db: db({
        accounts: [{ ...cuenta, initial_balance: 0 }],
        transactions: [tx({ type: "ingreso", category: "Salario", amount: 3_000_000, date: "2026-11-15" }), tx({ amount: 2_900_000, date: "2026-11-20" })],
        wishlist_items: [{ ...base, id: "w1", name: "Audífonos", image_url: null, description: null, price: 400_000, category: "Tecnología", classification: "gusto", priority: "media", desired_date: null, link: null, store: null, status: "en_consideracion", savings_goal_id: null }],
      }),
      hoy: HOY,
      tareasCompletadas: [],
    });
    expect(c.map((x) => x.texto)).toContain("Si esperas al 15, compras Audífonos sin tocar el ahorro.");
  });

  it("Cima + Centavo: cuándo llega la meta y cuánto se adelanta", () => {
    const c = calcularConexiones({
      db: db({ savings_goals: [{ ...base, created_at: "2026-08-28T12:00:00Z", id: "g1", name: "Viaje", target_amount: 2_000_000, current_amount: 300_000, target_date: null, priority: "media", account_id: null, description: null }] }),
      hoy: HOY,
      tareasCompletadas: [],
    });
    expect(c[0].texto).toMatch(/^Al ritmo actual, tu meta Viaje llega en \w+\. Con \$ 50\.000 más al mes, en \w+\.$/);
  });

  it("sin datos no inventa conexiones", () => {
    expect(calcularConexiones({ db: emptyDatabase(), hoy: HOY, tareasCompletadas: [] })).toEqual([]);
  });
});
