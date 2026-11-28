/**
 * Qué se exporta: los datos de la app como secciones legibles (columnas en español, estados y tipos con su
 * nombre). Lo usan Configuración → Tus datos (todo) y Finanzas → Movimientos (lo filtrado). Funciones puras.
 */
import type { Database, Profile, Transaction } from "../../types/db";
import { formatoPrecio } from "../monedas";
import { accountTypeLabel, debtTypeLabel } from "../../modules/finance/constants";
import { GOAL_AREAS, GOAL_STATUSES, EVENT_TYPES, WISH_CLASSIFICATIONS, wishStatusLabel } from "../../modules/other/constants";
import { PROJECT_STATUSES, TASK_STATUSES, priorityLabel } from "../../modules/projects/constants";
import { findStore } from "../../modules/other/stores";
import type { Documento, Seccion } from "./documento";
import { fechaCorta } from "./documento";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
/** "en_mora" → "En mora" */
const legible = (v: string | null | undefined) => (v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " ") : "");
const TIPO_MOV: Record<Transaction["type"], string> = { ingreso: "Ingreso", gasto: "Gasto", transferencia: "Transferencia" };
const porFechaDesc = <T extends { date: string }>(a: T, b: T) => b.date.localeCompare(a.date);

/** Movimientos (todos o los filtrados en Finanzas) */
export function seccionMovimientos(rows: Transaction[], db: Pick<Database, "accounts" | "projects">): Seccion {
  const cuenta = (id: string | null) => (id ? (db.accounts.find((a) => a.id === id)?.name ?? "") : "");
  return {
    titulo: "Movimientos",
    columnas: [
      { titulo: "Fecha", tipo: "fecha" },
      { titulo: "Tipo" },
      { titulo: "Descripción" },
      { titulo: "Categoría" },
      { titulo: "Cuenta" },
      { titulo: "Hacia" },
      { titulo: "Monto", tipo: "dinero" },
      { titulo: "Estado" },
      { titulo: "Proyecto" },
      { titulo: "Notas" },
    ],
    filas: rows.map((t) => [
      t.date,
      TIPO_MOV[t.type],
      t.description,
      t.category,
      cuenta(t.account_id),
      t.type === "transferencia" ? cuenta(t.to_account_id) : "",
      t.amount,
      legible(t.status),
      t.project_id ? (db.projects.find((p) => p.id === t.project_id)?.name ?? "") : "",
      t.notes,
    ]),
  };
}

export function documentoMovimientos(rows: Transaction[], db: Database, hoy: string, filtros?: string): Documento {
  return {
    titulo: "Movimientos",
    subtitulo: `Poku Poku · exportado el ${fechaCorta(hoy)}${filtros ? ` · ${filtros}` : ""}`,
    secciones: [seccionMovimientos(rows, db)],
  };
}

/** Todos los datos de la app, una sección por tipo */
export function documentoDatos(db: Database, profile: Profile | null, hoy: string): Documento {
  const proyecto = (id: string | null) => (id ? (db.projects.find((p) => p.id === id)?.name ?? "") : "Sin proyecto");
  const secciones: Seccion[] = [
    seccionMovimientos([...db.transactions].sort(porFechaDesc), db),
    {
      titulo: "Cuentas",
      columnas: [{ titulo: "Cuenta" }, { titulo: "Tipo" }, { titulo: "Saldo inicial", tipo: "dinero" }, { titulo: "Moneda" }],
      filas: db.accounts.map((a) => [a.name, accountTypeLabel(a.type), a.initial_balance, a.currency]),
    },
    {
      titulo: "Metas de ahorro",
      columnas: [{ titulo: "Meta" }, { titulo: "Ahorrado", tipo: "dinero" }, { titulo: "Objetivo", tipo: "dinero" }, { titulo: "Avance %", tipo: "numero" }, { titulo: "Fecha límite", tipo: "fecha" }, { titulo: "Prioridad" }],
      filas: db.savings_goals.map((g) => [g.name, g.current_amount, g.target_amount, g.target_amount ? Math.round((g.current_amount / g.target_amount) * 100) : 0, g.target_date, priorityLabel(g.priority)]),
    },
    {
      titulo: "Deudas",
      columnas: [
        { titulo: "Acreedor" },
        { titulo: "Tipo" },
        { titulo: "Monto total", tipo: "dinero" },
        { titulo: "Pendiente", tipo: "dinero" },
        { titulo: "Cuota", tipo: "dinero" },
        { titulo: "Cuotas pagadas" },
        { titulo: "Tasa %", tipo: "numero" },
        { titulo: "Estado" },
      ],
      filas: db.debts.map((d) => [d.creditor, debtTypeLabel(d.type), d.total_amount, d.pending_amount, d.installment_amount, d.installments ? `${d.installments_paid} de ${d.installments}` : String(d.installments_paid || ""), d.interest_rate, legible(d.status)]),
    },
    {
      titulo: "Pagos de deudas",
      columnas: [{ titulo: "Fecha", tipo: "fecha" }, { titulo: "Deuda" }, { titulo: "Monto", tipo: "dinero" }, { titulo: "Notas" }],
      filas: [...db.debt_payments].sort(porFechaDesc).map((p) => [p.date, db.debts.find((d) => d.id === p.debt_id)?.creditor ?? "", p.amount, p.notes]),
    },
    {
      titulo: "Proyectos",
      columnas: [{ titulo: "Proyecto" }, { titulo: "Estado" }, { titulo: "Prioridad" }, { titulo: "Categoría" }, { titulo: "Inicio", tipo: "fecha" }, { titulo: "Entrega", tipo: "fecha" }, { titulo: "Presupuesto", tipo: "dinero" }],
      filas: db.projects.map((p) => [p.name, PROJECT_STATUSES.find((s) => s.value === p.status)?.label ?? legible(p.status), priorityLabel(p.priority), p.category, p.start_date, p.due_date, p.budget]),
    },
    {
      titulo: "Tareas",
      columnas: [{ titulo: "Tarea" }, { titulo: "Proyecto" }, { titulo: "Estado" }, { titulo: "Prioridad" }, { titulo: "Fecha", tipo: "fecha" }, { titulo: "Responsable" }],
      filas: db.tasks.map((t) => [
        // Subtarea: «›» (la fuente estándar del PDF no tiene «↳»)
        t.parent_task_id ? `› ${t.name}` : t.name,
        proyecto(t.project_id),
        TASK_STATUSES.find((s) => s.value === t.status)?.label ?? legible(t.status),
        priorityLabel(t.priority),
        t.due_date,
        t.assignee,
      ]),
    },
    {
      titulo: "Hábitos",
      columnas: [{ titulo: "Hábito" }, { titulo: "Frecuencia" }, { titulo: "Veces marcado", tipo: "numero" }],
      filas: db.habits.map((h) => [
        h.name,
        h.weekly_target ? `${h.weekly_target} veces por semana` : h.days.length === 7 ? "Todos los días" : [...h.days].sort().map((d) => DIAS[d]).join(", "),
        db.habit_logs.filter((l) => l.habit_id === h.id).length,
      ]),
    },
    {
      titulo: "Wishlist",
      columnas: [{ titulo: "Producto" }, { titulo: "Precio" }, { titulo: "Categoría" }, { titulo: "Tipo" }, { titulo: "Estado" }, { titulo: "Prioridad" }, { titulo: "Tienda" }, { titulo: "Enlace" }],
      filas: db.wishlist_items.map((w) => [
        w.name,
        formatoPrecio(w),
        w.category,
        WISH_CLASSIFICATIONS.find((c) => c.value === w.classification)?.label ?? "",
        wishStatusLabel(w.status),
        priorityLabel(w.priority),
        findStore(w.store)?.name ?? "",
        w.link,
      ]),
    },
    {
      titulo: "Objetivos",
      columnas: [{ titulo: "Objetivo" }, { titulo: "Área" }, { titulo: "Estado" }, { titulo: "Progreso %", tipo: "numero" }, { titulo: "Fecha", tipo: "fecha" }, { titulo: "Prioridad" }],
      filas: db.annual_goals.map((g) => [g.title, GOAL_AREAS.find((a) => a.value === g.area)?.label ?? legible(g.area), GOAL_STATUSES.find((s) => s.value === g.status)?.label ?? legible(g.status), g.progress, g.target_date, priorityLabel(g.priority)]),
    },
    {
      titulo: "Calendario",
      columnas: [{ titulo: "Fecha", tipo: "fecha" }, { titulo: "Hora" }, { titulo: "Evento" }, { titulo: "Tipo" }, { titulo: "Notas" }],
      filas: [...db.calendar_events]
        .sort(porFechaDesc)
        .map((e) => [e.date, e.start_time ? `${e.start_time}${e.end_time ? ` – ${e.end_time}` : ""}` : "Todo el día", e.title, EVENT_TYPES.find((t) => t.value === e.type)?.label ?? legible(e.type), e.notes]),
    },
  ];
  const nombre = profile?.full_name?.trim();
  return {
    titulo: nombre ? `Datos de ${nombre}` : "Mis datos",
    subtitulo: `Poku Poku · exportado el ${fechaCorta(hoy)}`,
    secciones,
  };
}
