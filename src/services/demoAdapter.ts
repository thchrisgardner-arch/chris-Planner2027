/**
 * MODO DEMO (?demo=1): datos de ejemplo SOLO en memoria.
 * Nunca lee ni escribe localStorage, así que los datos reales de la persona quedan intactos.
 * Recargar la página reinicia los ejemplos. Se sale con ?demo=0.
 */
import { CASCADES, type BaseRow, type Database, type NewRow, type Profile, type Row, type TableName } from "@/types/db";
import { TIMEZONE, addDays, addMonths, monthKey, todayISO } from "@/utils/dates";
import type { DataAdapter } from "./types";

const USER = "demo-user";
let seq = 0;
const id = () => `demo-${++seq}`;
const now = () => new Date().toISOString();
const base = () => ({ id: id(), user_id: USER, created_at: now() });

/** Generador pseudoaleatorio determinista: los ejemplos son iguales en cada carga. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function seed(): { db: Database; profile: Profile } {
  const r = rng(2027);
  const today = todayISO();
  const cur = monthKey(today);

  const bancolombia = { ...base(), name: "Bancolombia", type: "banco" as const, initial_balance: 3_200_000, currency: "COP" };
  const nequi = { ...base(), name: "Nequi", type: "billetera" as const, initial_balance: 450_000, currency: "COP" };
  const nu = { ...base(), name: "Nu", type: "tarjeta_credito" as const, initial_balance: -380_000, currency: "COP" };

  const tx: Database["transactions"] = [];
  const t = (type: "ingreso" | "gasto", description: string, amount: number, category: string, date: string, account = bancolombia.id, method: string | null = null, beneficiary: "para_mi" | "otras_personas" | "compartido" | null = "para_mi") =>
    tx.push({
      ...base(),
      type,
      description,
      amount,
      category,
      account_id: account,
      to_account_id: null,
      date,
      payment_method: method,
      status: "completado",
      beneficiary: type === "gasto" ? beneficiary : null,
      notes: null,
    });

  for (let m = -5; m <= 0; m++) {
    const key = addMonths(cur, m);
    const d = (day: number) => {
      const iso = `${key}-${String(day).padStart(2, "0")}`;
      return iso > today ? null : iso;
    };
    const add = (day: number, fn: (iso: string) => void) => {
      const iso = d(day);
      if (iso) fn(iso);
    };
    add(1, (iso) => t("ingreso", "Salario", 4_800_000, "Salario", iso, bancolombia.id, "Transferencia"));
    add(2, (iso) =>
      tx.push({ ...base(), type: "transferencia", description: "Paso a Nequi", amount: 700_000, category: null, account_id: bancolombia.id, to_account_id: nequi.id, date: iso, payment_method: "Transferencia", status: "completado", beneficiary: null, notes: null }),
    );
    add(10, (iso) =>
      tx.push({ ...base(), type: "transferencia", description: "Pago tarjeta Nu", amount: 250_000, category: null, account_id: bancolombia.id, to_account_id: nu.id, date: iso, payment_method: "Transferencia", status: "completado", beneficiary: null, notes: null }),
    );
    add(3, (iso) => t("gasto", "Arriendo", 1_400_000, "Vivienda", iso, bancolombia.id, "Transferencia"));
    add(5, (iso) => t("gasto", "Netflix", 38_900, "Suscripciones", iso, nu.id, "Tarjeta de crédito"));
    add(6, (iso) => t("gasto", "Spotify", 26_900, "Suscripciones", iso, nu.id, "Tarjeta de crédito"));
    add(8, (iso) => t("gasto", "Tienda D1", 120_000 + Math.round(r() * 80_000), "Alimentación", iso, nequi.id, "Nequi"));
    add(12, (iso) => t("gasto", "Smart Fit", 99_900, "Gimnasio", iso, bancolombia.id, "Débito"));
    add(15, (iso) => t("gasto", "Servicios EPM", 210_000 + Math.round(r() * 40_000), "Servicios", iso, bancolombia.id, "PSE"));
    add(17, (iso) => t("gasto", "Mercado Olímpica", 180_000 + Math.round(r() * 60_000), "Alimentación", iso, nequi.id, "Nequi", "compartido"));
    add(19, (iso) => t("gasto", "Uber", 25_000 + Math.round(r() * 20_000), "Transporte", iso, nu.id, "Tarjeta de crédito"));
    add(21, (iso) => t("gasto", "Mercado para mamá", 150_000, "Familia", iso, nequi.id, "Nequi", "otras_personas"));
    add(23, (iso) => t("gasto", "Baloto", 10_000, "Apuestas", iso, nequi.id, "Nequi"));
    if (m % 2 === 0) add(25, (iso) => t("ingreso", "Proyecto de diseño web", 1_200_000 + Math.round(r() * 900_000), "Diseño y proyectos", iso, bancolombia.id, "Transferencia"));
    if (m === -2) add(27, (iso) => t("gasto", "Audífonos AirPods", 569_000, "Tecnología", iso, nu.id, "Tarjeta de crédito"));
  }

  const fondo = { ...base(), name: "Fondo de emergencia", target_amount: 6_000_000, current_amount: 3_900_000, target_date: addMonths(cur, 7) + "-30", priority: "alta" as const, account_id: bancolombia.id, description: null };
  const viaje = { ...base(), name: "Viaje a Cartagena", target_amount: 2_500_000, current_amount: 1_100_000, target_date: addMonths(cur, 4) + "-15", priority: "media" as const, account_id: nequi.id, description: null };
  const monitor = { ...base(), name: "Monitor nuevo", target_amount: 729_900, current_amount: 540_000, target_date: null, priority: "baja" as const, account_id: null, description: null };

  const p1 = { ...base(), name: "Portafolio 2027", description: "Rediseño del portafolio personal", category: "Diseño", color: "#c9b8ff", priority: "alta" as const, start_date: addDays(today, -20), due_date: addDays(today, 18), budget: null, status: "en_proceso" as const };
  const p2 = { ...base(), name: "Mudanza", description: null, category: "Personal", color: "#bcdcff", priority: "media" as const, start_date: null, due_date: addDays(today, 40), budget: 2_000_000, status: "en_proceso" as const };
  const p3 = { ...base(), name: "Curso de inglés", description: null, category: "Aprendizaje", color: "#b9f0cc", priority: "baja" as const, start_date: null, due_date: null, budget: null, status: "ideas" as const };
  const task = (name: string, project: string | null, due: string | null, status: "pendiente" | "en_proceso" | "completada", priority: "baja" | "media" | "alta") => ({
    ...base(),
    project_id: project,
    parent_task_id: null,
    name,
    description: null,
    due_date: due,
    priority,
    status,
  });

  const habits = [
    { ...base(), name: "Entrenar", color: "#5ce65c", days: [0, 1, 2, 3, 4] },
    { ...base(), name: "Tomar 2 L de agua", color: "#bcdcff", days: [0, 1, 2, 3, 4, 5, 6] },
    { ...base(), name: "Leer 20 minutos", color: "#c9b8ff", days: [0, 1, 2, 3, 4, 5, 6] },
    { ...base(), name: "Dormir antes de las 11", color: "#ffd1b3", days: [0, 1, 2, 3, 4, 5, 6] },
  ];
  const logs: Database["habit_logs"] = [];
  for (let i = 1; i <= 45; i++) {
    const day = addDays(today, -i);
    habits.forEach((h, k) => {
      if (r() < [0.72, 0.85, 0.6, 0.55][k]) logs.push({ ...base(), habit_id: h.id, date: day });
    });
  }
  logs.push({ ...base(), habit_id: habits[1].id, date: today });

  const credito = { ...base(), creditor: "Bancolombia", type: "credito_libre" as const, total_amount: 12_000_000, pending_amount: 7_420_000, installment_amount: 520_000, installments: 36, installments_paid: 14, interest_rate: 1.6, payment_day: 15, due_date: null, overdue_amount: 0, overdue_days: 0, status: "activa" as const, notes: "Crédito para la remodelación" };
  const tarjetaNu = { ...base(), creditor: "Nu", type: "tarjeta_credito" as const, total_amount: 2_400_000, pending_amount: 1_830_000, installment_amount: 310_000, installments: null, installments_paid: 0, interest_rate: 2.1, payment_day: Number(addDays(today, 2).slice(8, 10)), due_date: null, overdue_amount: 0, overdue_days: 0, status: "activa" as const, notes: null };
  const cmr = { ...base(), creditor: "Falabella CMR", type: "tarjeta_credito" as const, total_amount: 900_000, pending_amount: 640_000, installment_amount: 180_000, installments: 6, installments_paid: 2, interest_rate: 2.3, payment_day: 5, due_date: null, overdue_amount: 180_000, overdue_days: 21, status: "en_mora" as const, notes: "Se pasó la cuota de noviembre" };
  const prestamo = { ...base(), creditor: "Préstamo de Kevin", type: "personal" as const, total_amount: 1_500_000, pending_amount: 600_000, installment_amount: 300_000, installments: 5, installments_paid: 3, interest_rate: null, payment_day: 30, due_date: null, overdue_amount: 0, overdue_days: 0, status: "activa" as const, notes: null };
  const pagos = [
    { ...base(), debt_id: credito.id, amount: 520_000, date: addDays(today, -40), transaction_id: null, notes: null },
    { ...base(), debt_id: credito.id, amount: 520_000, date: addDays(today, -10), transaction_id: null, notes: null },
    { ...base(), debt_id: prestamo.id, amount: 300_000, date: addDays(today, -26), transaction_id: null, notes: null },
    { ...base(), debt_id: cmr.id, amount: 180_000, date: addDays(today, -50), transaction_id: null, notes: null },
  ];

  const db: Database = {
    accounts: [bancolombia, nequi, nu],
    debts: [credito, tarjetaNu, cmr, prestamo],
    debt_payments: pagos,
    transactions: tx,
    transaction_categories: [],
    savings_goals: [fondo, viaje, monitor],
    projects: [p1, p2, p3],
    tasks: [
      task("Seleccionar casos de estudio", p1.id, today, "pendiente", "alta"),
      task("Diseñar la página de inicio", p1.id, addDays(today, 3), "en_proceso", "media"),
      task("Definir paleta y tipografía", p1.id, addDays(today, -4), "completada", "baja"),
      task("Cotizar trasteo", p2.id, addDays(today, 2), "pendiente", "media"),
      task("Renovar SOAT", null, addDays(today, 5), "pendiente", "alta"),
    ],
    habits,
    habit_logs: logs,
    wishlist_items: [
      { ...base(), name: "Monitor LG UltraGear 27″", image_url: "https://media.falabella.com/falabellaCO/153991323_01/public", description: null, price: 729_900, category: "Tecnología", classification: "inversion", priority: "alta", desired_date: null, link: "https://www.falabella.com.co/falabella-co/product/153991322/monitor-gamer-lg-27g244a-ultragear-g4-fhd-27-240hz-1ms/153991323", store: "falabella", status: "ahorrando", savings_goal_id: monitor.id },
      { ...base(), name: "Lámpara de mesa FADO", image_url: "https://www.ikea.com/co/es/images/products/fado-lampara-de-mesa-blanco__0606976_pe682645_s5.jpg", description: null, price: 69_990, category: "Hogar", classification: "gusto", priority: "media", desired_date: null, link: "https://www.ikea.com/co/es/p/fado-lampara-de-mesa-blanco-20537316/", store: "ikea", status: "listo", savings_goal_id: null },
      { ...base(), name: "Viaje a Cartagena", image_url: null, description: null, price: 2_500_000, category: "Viajes", classification: "experiencia", priority: "media", desired_date: viaje.target_date, link: null, store: null, status: "ahorrando", savings_goal_id: viaje.id },
    ],
    annual_goals: [
      { ...base(), title: "Ahorrar 6 millones de emergencia", description: null, area: "finanzas", target_date: "2027-12-31", priority: "alta", progress: 65, status: "en_progreso" },
      { ...base(), title: "Correr una media maratón", description: null, area: "salud", target_date: "2027-09-30", priority: "media", progress: 30, status: "en_progreso" },
      { ...base(), title: "Lanzar mi portafolio", description: null, area: "profesional", target_date: "2027-03-31", priority: "alta", progress: 45, status: "en_progreso" },
      { ...base(), title: "Leer 12 libros", description: null, area: "aprendizaje", target_date: "2027-12-31", priority: "baja", progress: 0, status: "no_iniciado" },
    ],
    calendar_events: [
      { ...base(), title: "Pierna en el gym", date: today, start_time: "07:00", end_time: "08:00", type: "entrenamiento", notes: null },
      { ...base(), title: "Reunión con cliente", date: today, start_time: "10:30", end_time: "11:30", type: "personal", notes: null },
      { ...base(), title: "Pago tarjeta Nu", date: addDays(today, 2), start_time: "09:00", end_time: "09:30", type: "pago", notes: null },
      { ...base(), title: "Cardio", date: addDays(today, 1), start_time: "18:00", end_time: "19:00", type: "entrenamiento", notes: null },
      { ...base(), title: "Vence SOAT", date: addDays(today, 5), start_time: null, end_time: null, type: "vencimiento", notes: null },
    ],
  };
  return { db, profile: { id: USER, full_name: "Alex Demo", email: "demo@lifeos.app", currency: "COP", timezone: TIMEZONE } };
}

let state: { db: Database; profile: Profile } | null = null;
let variant: "completo" | "vacio" = "completo";
/** ?demo=vacio muestra la app sin datos (para revisar los estados vacíos). */
export function setDemoVariant(v: "completo" | "vacio") {
  if (v !== variant) state = null;
  variant = v;
}
function emptySeed(): { db: Database; profile: Profile } {
  const s = seed();
  const db = Object.fromEntries(Object.keys(s.db).map((k) => [k, []])) as unknown as Database;
  return { db, profile: s.profile };
}
const get = () => (state ??= variant === "vacio" ? emptySeed() : seed());

export const demoAdapter: DataAdapter = {
  mode: "demo",

  async loadAll() {
    return structuredClone(get().db);
  },
  async loadProfile() {
    return { ...get().profile };
  },
  async saveProfile(patch) {
    get().profile = { ...get().profile, ...patch, id: USER };
    return { ...get().profile };
  },
  async insert<T extends TableName>(table: T, data: NewRow<T>) {
    const row = { ...data, ...base() } as Row<T>;
    (get().db[table] as Row<T>[]).push(row);
    return row;
  },
  async update<T extends TableName>(table: T, rowId: string, patch: Partial<NewRow<T>>) {
    const rows = get().db[table] as (Row<T> & BaseRow)[];
    const i = rows.findIndex((x) => x.id === rowId);
    if (i < 0) throw new Error("El registro ya no existe.");
    rows[i] = { ...rows[i], ...patch };
    return rows[i];
  },
  async remove(table, rowId) {
    const db = get().db as unknown as Record<TableName, (BaseRow & Record<string, unknown>)[]>;
    const drop = (t: TableName, idv: string) => {
      db[t] = db[t].filter((x) => x.id !== idv);
      for (const rule of CASCADES[t] ?? []) {
        if (rule.action === "delete") db[rule.table].filter((x) => x[rule.field] === idv).forEach((x) => drop(rule.table, x.id));
        else db[rule.table] = db[rule.table].map((x) => (x[rule.field] === idv ? { ...x, [rule.field]: null } : x));
      }
    };
    drop(table, rowId);
  },
  async clearAll() {
    state = null;
  },
};

