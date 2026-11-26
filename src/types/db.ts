/** Tipos de las entidades de LIFE for LIFE. Coinciden con supabase/migrations/0001_life_os.sql */

export type ID = string;

export interface BaseRow {
  id: ID;
  user_id: string;
  created_at: string;
}

export type Priority = "baja" | "media" | "alta";

/* ── Finanzas ── */
export type AccountType = "banco" | "efectivo" | "billetera" | "ahorros" | "tarjeta_credito";

export interface Account extends BaseRow {
  name: string;
  type: AccountType;
  initial_balance: number;
  currency: string;
}

export type TxType = "ingreso" | "gasto" | "transferencia";
export type TxStatus = "completado" | "pendiente";
export type Beneficiary = "para_mi" | "otras_personas" | "compartido";

export interface Transaction extends BaseRow {
  type: TxType;
  description: string;
  amount: number;
  category: string | null;
  account_id: ID;
  /** Solo en transferencias: cuenta destino */
  to_account_id: ID | null;
  date: string;
  payment_method: string | null;
  status: TxStatus;
  beneficiary: Beneficiary | null;
  notes: string | null;
}

export interface TransactionCategory extends BaseRow {
  name: string;
  kind: "ingreso" | "gasto";
}

export interface SavingsGoal extends BaseRow {
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  priority: Priority;
  account_id: ID | null;
  description: string | null;
}

/* ── Deudas ── */
export type DebtType = "tarjeta_credito" | "credito_libre" | "hipotecario" | "vehiculo" | "libranza" | "educativo" | "personal" | "otro";
export type DebtStatus = "activa" | "pagada" | "en_mora";

export interface Debt extends BaseRow {
  /** Entidad o persona a la que se le debe */
  creditor: string;
  type: DebtType;
  /** Monto original prestado */
  total_amount: number;
  /** Saldo pendiente hoy */
  pending_amount: number;
  /** Valor de la cuota mensual */
  installment_amount: number | null;
  /** Número total de cuotas (null si no aplica, p. ej. tarjeta) */
  installments: number | null;
  installments_paid: number;
  /** Tasa de interés en % (mensual vencida o efectiva anual, según la anote la persona) */
  interest_rate: number | null;
  /** Día del mes en que se paga la cuota (1 a 31) */
  payment_day: number | null;
  /** Fecha final o próxima fecha límite (opcional) */
  due_date: string | null;
  /** Valor vencido sin pagar */
  overdue_amount: number;
  overdue_days: number;
  status: DebtStatus;
  notes: string | null;
}

export interface DebtPayment extends BaseRow {
  debt_id: ID;
  amount: number;
  date: string;
  /** Movimiento de gasto creado junto con el pago (opcional) */
  transaction_id: ID | null;
  notes: string | null;
}

/* ── Proyectos ── */
export type ProjectStatus = "ideas" | "pendiente" | "en_proceso" | "en_pausa" | "completado";

export interface Project extends BaseRow {
  name: string;
  description: string | null;
  category: string | null;
  color: string;
  priority: Priority;
  start_date: string | null;
  due_date: string | null;
  budget: number | null;
  status: ProjectStatus;
}

export type TaskStatus = "pendiente" | "en_proceso" | "completada";

export interface Task extends BaseRow {
  project_id: ID | null;
  parent_task_id: ID | null;
  name: string;
  description: string | null;
  due_date: string | null;
  priority: Priority;
  status: TaskStatus;
}

/* ── Hábitos ── */
export interface Habit extends BaseRow {
  name: string;
  color: string;
  /** Días programados, 0 = lunes … 6 = domingo */
  days: number[];
}

export interface HabitLog extends BaseRow {
  habit_id: ID;
  date: string;
}

/* ── Wishlist ── */
export type WishStatus = "en_consideracion" | "ahorrando" | "listo" | "comprado" | "descartado";
export type WishClassification = "necesidad" | "gusto" | "inversion" | "experiencia";

export interface WishlistItem extends BaseRow {
  name: string;
  image_url: string | null;
  description: string | null;
  price: number;
  category: string;
  classification: WishClassification;
  priority: Priority;
  desired_date: string | null;
  link: string | null;
  /** Tienda (id del catálogo en modules/other/stores.ts) */
  store: string | null;
  status: WishStatus;
  savings_goal_id: ID | null;
}

/* ── Objetivos ── */
export type GoalArea = "finanzas" | "profesional" | "salud" | "personal" | "aprendizaje" | "experiencias";
export type GoalStatus = "no_iniciado" | "en_progreso" | "logrado" | "pausado";

export interface AnnualGoal extends BaseRow {
  title: string;
  description: string | null;
  area: GoalArea;
  target_date: string | null;
  priority: Priority;
  progress: number;
  status: GoalStatus;
}

/* ── Calendario ── */
export type EventType = "personal" | "entrenamiento" | "pago" | "vencimiento" | "otro";

export interface CalendarEvent extends BaseRow {
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  type: EventType;
  notes: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  currency: string;
  timezone: string;
  /** Foto de perfil: imagen subida (data URL, 256 px) o `asistente:<id>` para el rostro de una mascota */
  avatar_url?: string | null;
}

export interface Tables {
  accounts: Account;
  transactions: Transaction;
  transaction_categories: TransactionCategory;
  savings_goals: SavingsGoal;
  debts: Debt;
  debt_payments: DebtPayment;
  projects: Project;
  tasks: Task;
  habits: Habit;
  habit_logs: HabitLog;
  wishlist_items: WishlistItem;
  annual_goals: AnnualGoal;
  calendar_events: CalendarEvent;
}

export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T];
export type NewRow<T extends TableName> = Omit<Tables[T], keyof BaseRow>;
export type Database = { [K in TableName]: Tables[K][] };

export const TABLES: TableName[] = [
  "accounts",
  "transactions",
  "transaction_categories",
  "savings_goals",
  "debts",
  "debt_payments",
  "projects",
  "tasks",
  "habits",
  "habit_logs",
  "wishlist_items",
  "annual_goals",
  "calendar_events",
];

export function emptyDatabase(): Database {
  return Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as Database;
}

/** Relaciones que se borran o se desvinculan al eliminar un registro padre. */
export const CASCADES: Partial<
  Record<TableName, { table: TableName; field: string; action: "delete" | "nullify" }[]>
> = {
  accounts: [
    { table: "transactions", field: "account_id", action: "delete" },
    { table: "transactions", field: "to_account_id", action: "delete" },
    { table: "savings_goals", field: "account_id", action: "nullify" },
  ],
  projects: [{ table: "tasks", field: "project_id", action: "delete" }],
  tasks: [{ table: "tasks", field: "parent_task_id", action: "delete" }],
  habits: [{ table: "habit_logs", field: "habit_id", action: "delete" }],
  savings_goals: [{ table: "wishlist_items", field: "savings_goal_id", action: "nullify" }],
  debts: [{ table: "debt_payments", field: "debt_id", action: "delete" }],
  transactions: [{ table: "debt_payments", field: "transaction_id", action: "nullify" }],
};
