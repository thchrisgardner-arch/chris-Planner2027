import { describe, expect, it } from "vitest";
import { aTexto, celdaTexto, fechaCorta, nombreArchivo, type Documento } from "./documento";
import { documentoDatos, documentoMovimientos } from "./datos";
import { emptyDatabase, type Database } from "../../types/db";

const base = { user_id: "u", created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-01T10:00:00Z" };

describe("celdas y nombres", () => {
  it("formatea dinero, fechas y números", () => {
    expect(fechaCorta("2026-11-27")).toBe("27/11/2026");
    expect(celdaTexto("2026-01-05", "fecha")).toBe("05/01/2026");
    expect(celdaTexto(1250000, "dinero")).toMatch(/1\.250\.000/);
    expect(celdaTexto(null)).toBe("");
  });
  it("arma nombres de archivo sin tildes", () => {
    expect(nombreArchivo("Mis datos de María")).toBe("mis-datos-de-maria");
  });
});

describe("texto plano", () => {
  const doc: Documento = {
    titulo: "Prueba",
    subtitulo: "Sub",
    secciones: [
      { titulo: "Cuentas", columnas: [{ titulo: "Cuenta" }, { titulo: "Saldo", tipo: "dinero" }], filas: [["Ahorros", 1500000], ["Nequi", 20000]] },
      { titulo: "Vacía", columnas: [{ titulo: "X" }], filas: [] },
    ],
  };
  const txt = aTexto(doc);
  it("trae título, secciones con conteo y filas alineadas", () => {
    expect(txt.startsWith("Prueba\nSub\n")).toBe(true);
    expect(txt).toContain("Cuentas (2)");
    expect(txt).toContain("Ahorros");
    expect(txt).toContain("Vacía (0)\n=========\nSin registros.");
    // Montos alineados a la derecha: ambas filas terminan en la misma columna
    const filas = txt.split("\n").filter((l) => l.startsWith("Ahorros") || l.startsWith("Nequi"));
    expect(filas[0].length).toBe(filas[1].length);
  });
});

describe("datos de la app", () => {
  const db: Database = {
    ...emptyDatabase(),
    accounts: [{ ...base, id: "a1", name: "Bancolombia", type: "ahorros" as never, initial_balance: 100000, currency: "COP" }],
    transactions: [
      { ...base, id: "t1", type: "gasto", description: "Mercado", amount: 50000, category: "Alimentación", account_id: "a1", to_account_id: null, date: "2026-11-10", payment_method: null, status: "completado", beneficiary: null, notes: null },
      { ...base, id: "t2", type: "ingreso", description: "Sueldo", amount: 3000000, category: "Salario", account_id: "a1", to_account_id: null, date: "2026-11-20", payment_method: null, status: "completado", beneficiary: null, notes: null },
    ],
    habits: [{ ...base, id: "h1", name: "Leer", color: "#000", days: [0, 2, 4] }],
    habit_logs: [{ ...base, id: "l1", habit_id: "h1", date: "2026-11-10" }],
  };
  it("una sección por tipo, con los movimientos más recientes primero", () => {
    const doc = documentoDatos(db, { id: "u", full_name: "Ana", email: null, currency: "COP", timezone: "America/Bogota" }, "2026-11-27");
    expect(doc.titulo).toBe("Datos de Ana");
    expect(doc.secciones.map((s) => s.titulo)).toEqual(["Movimientos", "Cuentas", "Metas de ahorro", "Deudas", "Pagos de deudas", "Proyectos", "Tareas", "Hábitos", "Wishlist", "Objetivos", "Calendario"]);
    const mov = doc.secciones[0];
    expect(mov.filas[0][2]).toBe("Sueldo");
    expect(mov.filas[0][1]).toBe("Ingreso");
    expect(mov.filas[0][4]).toBe("Bancolombia");
    const habitos = doc.secciones.find((s) => s.titulo === "Hábitos")!;
    expect(habitos.filas[0]).toEqual(["Leer", "Lun, Mié, Vie", 1]);
  });
  it("Movimientos de Finanzas lleva los filtros en el subtítulo", () => {
    const doc = documentoMovimientos(db.transactions, db, "2026-11-27", "gastos");
    expect(doc.subtitulo).toContain("gastos");
    expect(doc.secciones[0].filas).toHaveLength(2);
  });
});
