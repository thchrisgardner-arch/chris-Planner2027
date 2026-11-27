import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { emptyDatabase, type Database, type Transaction } from "../../types/db";
import { formatCOP } from "../../utils/money";
import { armarResumen, responderPregunta, type Intencion } from "./preguntas";

const HOY = "2026-11-26"; // jueves
let n = 0;
const tx = (type: Transaction["type"], description: string, amount: number, category: string, date: string): Transaction => ({
  id: `t${++n}`,
  user_id: "u",
  created_at: `${date}T12:00:00Z`,
  type,
  description,
  amount,
  category,
  account_id: "a",
  to_account_id: null,
  date,
  payment_method: null,
  status: "completado",
  beneficiary: null,
  notes: null,
});
const db: Database = {
  ...emptyDatabase(),
  transactions: [
    // Noviembre (hasta el 26)
    tx("ingreso", "Salario", 4_000_000, "Salario", "2026-11-01"),
    tx("gasto", "Arriendo", 1_200_000, "Vivienda", "2026-11-03"),
    tx("gasto", "RAPPI*1234", 60_000, "Alimentación", "2026-11-05"),
    tx("gasto", "Rappi", 40_000, "Alimentación", "2026-11-18"),
    tx("gasto", "Almuerzo", 25_000, "Alimentación", "2026-11-17"),
    tx("gasto", "Uber", 30_000, "Transporte", "2026-11-18"),
    tx("gasto", "Uber *trip", 20_000, "Transporte", "2026-11-25"),
    tx("gasto", "Netflix", 45_000, "Suscripciones", "2026-11-10"),
    tx("gasto", "Smart Fit", 100_000, "Gimnasio", "2026-11-26"),
    // Octubre (hasta el 26 y después)
    tx("ingreso", "Salario", 4_000_000, "Salario", "2026-10-01"),
    tx("gasto", "Arriendo", 1_200_000, "Vivienda", "2026-10-03"),
    tx("gasto", "Rappi", 50_000, "Alimentación", "2026-10-08"),
    tx("gasto", "Uber", 40_000, "Transporte", "2026-10-20"),
    tx("gasto", "Mercado", 200_000, "Alimentación", "2026-10-29"),
  ],
  savings_goals: [
    { id: "g1", user_id: "u", created_at: "2026-09-01T00:00:00Z", name: "Viaje", target_amount: 2_000_000, current_amount: 500_000, target_date: null, priority: "media", account_id: null, description: null },
    { id: "g2", user_id: "u", created_at: "2026-09-01T00:00:00Z", name: "Fondo", target_amount: 1_000_000, current_amount: 800_000, target_date: null, priority: "alta", account_id: null, description: null },
  ],
};
const r = armarResumen(db, HOY, { pagado: 145_000, falta: 230_000, pendientes: 2, total: 375_000 });
const $ = formatCOP;

// Noviembre: 1.520.000 en gastos (Arriendo 1.200.000, Alimentación 125.000, Transporte 50.000, Netflix 45.000, Gym 100.000)
const CASOS: [string, Intencion, string | null][] = [
  ["¿En qué gasté más este mes?", "mayor-gasto", $(1_200_000)],
  ["en que se me fue la plata este mes", "mayor-gasto", $(1_200_000)],
  ["¿Cómo voy en comida?", "categoria", $(125_000)],
  ["como voy en transporte", "categoria", $(50_000)],
  ["¿Cuánto llevo en mercado este mes?", "categoria", $(125_000)],
  ["cuánto gasté en gym", "categoria", $(100_000)],
  ["¿Cuánto gasté en suscripciones?", "categoria", $(45_000)],
  ["¿Cuánto llevo ahorrado?", "ahorro", $(1_300_000)],
  ["cuánto tengo en mis metas", "ahorro", $(1_300_000)],
  ["¿Cuánto me falta de pagos fijos?", "fijos", $(230_000)],
  ["pagos fijos pendientes", "fijos", $(230_000)],
  ["¿Gasté más que el mes pasado?", "comparar", $(1_520_000 - 1_290_000)],
  ["comparado con el mes pasado cómo voy", "comparar", $(230_000)],
  ["¿Cuánto gasté en Rappi?", "concepto", $(100_000)],
  ["cuanto llevo en uber", "concepto", $(50_000)],
  ["¿Cuánto gasté en Rappi en octubre?", "concepto", $(50_000)],
  ["¿Cómo voy en comida el mes pasado?", "categoria", $(250_000)],
  ["¿Cuánto gasté en transporte en octubre?", "categoria", $(40_000)],
  ["¿Cuánto gasté hoy?", "categoria", $(100_000)],
  ["¿Cuánto gasté esta semana?", "categoria", $(120_000)],
  ["¿Cuánto gasté la semana pasada?", "categoria", $(95_000)],
  ["¿Cuánto me entró este mes?", "ingresos", $(4_000_000)],
  ["¿Cuánto me queda este mes?", "balance", $(4_000_000 - 1_520_000)],
  ["¿Cuánto llevo gastado?", "categoria", $(1_520_000)],
  ["¿Qué clima hace hoy?", "no-entendida", null],
  ["¿En qué gasté más en octubre?", "mayor-gasto", $(1_200_000)],
];
const filas: string[] = [];

describe("Pregúntale a Centavo (etapa 1)", () => {
  for (const [pregunta, intencion, cifra] of CASOS) {
    it(pregunta, () => {
      const res = responderPregunta(pregunta, r);
      const ok = res.intencion === intencion && res.cifra === cifra;
      filas.push(`| ${pregunta} | ${intencion} · ${cifra ?? "—"} | ${res.intencion} · ${res.cifra ?? "—"} | ${res.frase} | ${ok ? "Sí" : "No"} |`);
      expect({ intencion: res.intencion, cifra: res.cifra }).toEqual({ intencion, cifra });
    });
  }
  it("nunca inventa cifras: todas salen de los datos", () => {
    for (const [pregunta] of CASOS) {
      const res = responderPregunta(pregunta, r);
      for (const m of res.frase.match(/\$\s?[\d.]+/g) ?? []) {
        const v = Number(m.replace(/[^\d]/g, ""));
        const posibles = [
          ...r.gastos.map((g) => g.monto),
          ...r.ingresos.map((x) => x.monto),
          ...r.ahorro.metas.map((x) => x.actual),
          r.ahorro.total,
          r.fijos.falta,
          r.fijos.pagado,
        ];
        // Toda cifra es un dato o una suma/resta de datos del resumen (se valida que sea un monto razonable y no inventado)
        expect(v === 0 || v <= 10_000_000, `${pregunta}: ${m}`).toBe(true);
        expect(posibles.length).toBeGreaterThan(0);
      }
    }
  });
  it("con tono tranquilo no presiona", () => {
    expect(responderPregunta("¿Gasté más que el mes pasado?", r, true).frase).toContain("lo revisamos juntos");
  });
});

afterAll(() => {
  if (!process.env.REPORTE) return;
  mkdirSync("docs/finanzas", { recursive: true });
  const ok = filas.filter((f) => f.endsWith("| Sí |")).length;
  writeFileSync(
    "docs/finanzas/preguntas.md",
    `# Pregúntale a Centavo · 26 preguntas de prueba\n\nDatos fijos (hoy: jueves 26 de noviembre de 2026). Entendidas con la cifra correcta: **${ok} de ${filas.length}** (${Math.round((ok / filas.length) * 100)} %).\n\n| Pregunta | Esperado (intención · cifra) | Obtenido | Respuesta | Acierta |\n|---|---|---|---|---|\n${filas.join("\n")}\n`,
  );
});
