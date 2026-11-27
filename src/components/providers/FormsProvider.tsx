"use client";

import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useRef, useState } from "react";
import { cuandoLibre } from "@/utils/cuandoLibre";

// Los formularios se descargan al abrirse (o en segundo plano, con el navegador libre): no pesan en
// la primera pantalla.
const cargarFinanzas = () => import("@/modules/finance/forms");
const cargarDeudas = () => import("@/modules/finance/debtForms");
const cargarProyectos = () => import("@/modules/projects/forms");
const cargarHabitos = () => import("@/modules/habits/forms");
const cargarOtros = () => import("@/modules/other/forms");
const TransactionForm = lazy(() => cargarFinanzas().then((m) => ({ default: m.TransactionForm })));
const AccountForm = lazy(() => cargarFinanzas().then((m) => ({ default: m.AccountForm })));
const SavingsGoalForm = lazy(() => cargarFinanzas().then((m) => ({ default: m.SavingsGoalForm })));
const SavingsDepositForm = lazy(() => cargarFinanzas().then((m) => ({ default: m.SavingsDepositForm })));
const DebtForm = lazy(() => cargarDeudas().then((m) => ({ default: m.DebtForm })));
const DebtPaymentForm = lazy(() => cargarDeudas().then((m) => ({ default: m.DebtPaymentForm })));
const ProjectForm = lazy(() => cargarProyectos().then((m) => ({ default: m.ProjectForm })));
const TaskForm = lazy(() => cargarProyectos().then((m) => ({ default: m.TaskForm })));
const HabitForm = lazy(() => cargarHabitos().then((m) => ({ default: m.HabitForm })));
const EventForm = lazy(() => cargarOtros().then((m) => ({ default: m.EventForm })));
const GoalForm = lazy(() => cargarOtros().then((m) => ({ default: m.GoalForm })));
const WishlistForm = lazy(() => cargarOtros().then((m) => ({ default: m.WishlistForm })));
import type {
  Account,
  AnnualGoal,
  CalendarEvent,
  Debt,
  Habit,
  Project,
  SavingsGoal,
  Task,
  Transaction,
  WishlistItem,
} from "@/types/db";

export type FormRequest =
  | { kind: "transaction"; record?: Transaction; defaults?: Partial<Transaction> }
  /** onCreated: se llama con la cuenta nueva (p. ej. para volver al movimiento con ella elegida). */
  | { kind: "account"; record?: Account; onCreated?: (account: Account) => void }
  | { kind: "savings"; record?: SavingsGoal }
  | { kind: "deposit"; record: SavingsGoal }
  | { kind: "debt"; record?: Debt }
  | { kind: "debt-payment"; record: Debt }
  | { kind: "project"; record?: Project }
  | { kind: "task"; record?: Task; defaults?: Partial<Task> }
  | { kind: "habit"; record?: Habit }
  | { kind: "wish"; record?: WishlistItem }
  | { kind: "goal"; record?: AnnualGoal }
  | { kind: "event"; record?: CalendarEvent; defaults?: Partial<CalendarEvent> };

const FormsContext = createContext<((req: FormRequest) => void) | null>(null);

/** Un solo lugar abre cualquier formulario: así no se duplican modales por pantalla. */
export function FormsProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<FormRequest | null>(null);
  const counter = useRef(0);
  const [key, setKey] = useState(0);

  const open = useCallback((r: FormRequest) => {
    counter.current += 1;
    setKey(counter.current);
    setReq(r);
  }, []);
  const close = useCallback(() => setReq(null), []);

  const common = { open: true, onClose: close };

  // Con el navegador libre se precargan los formularios más usados (abrirlos es instantáneo)
  useEffect(
    () =>
      cuandoLibre(() => {
        void cargarFinanzas();
        void cargarProyectos();
        void cargarHabitos();
        void cargarOtros();
      }, 4000),
    [],
  );

  return (
    <FormsContext.Provider value={open}>
      {children}
      <Suspense fallback={null}>
      {req?.kind === "transaction" && <TransactionForm key={key} {...common} record={req.record} defaults={req.defaults} />}
      {req?.kind === "account" && <AccountForm key={key} {...common} record={req.record} onCreated={req.onCreated} />}
      {req?.kind === "savings" && <SavingsGoalForm key={key} {...common} record={req.record} />}
      {req?.kind === "deposit" && <SavingsDepositForm key={key} {...common} record={req.record} />}
      {req?.kind === "debt" && <DebtForm key={key} {...common} record={req.record} />}
      {req?.kind === "debt-payment" && <DebtPaymentForm key={key} {...common} record={req.record} />}
      {req?.kind === "project" && <ProjectForm key={key} {...common} record={req.record} />}
      {req?.kind === "task" && <TaskForm key={key} {...common} record={req.record} defaults={req.defaults} />}
      {req?.kind === "habit" && <HabitForm key={key} {...common} record={req.record} />}
      {req?.kind === "wish" && <WishlistForm key={key} {...common} record={req.record} />}
      {req?.kind === "goal" && <GoalForm key={key} {...common} record={req.record} />}
      {req?.kind === "event" && <EventForm key={key} {...common} record={req.record} defaults={req.defaults} />}
      </Suspense>
    </FormsContext.Provider>
  );
}

export function useForms() {
  const ctx = useContext(FormsContext);
  if (!ctx) throw new Error("useForms debe usarse dentro de <FormsProvider>");
  return ctx;
}
