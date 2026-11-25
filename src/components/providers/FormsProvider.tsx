"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AccountForm, SavingsDepositForm, SavingsGoalForm, TransactionForm } from "@/modules/finance/forms";
import { ProjectForm, TaskForm } from "@/modules/projects/forms";
import { HabitForm } from "@/modules/habits/forms";
import { EventForm, GoalForm, WishlistForm } from "@/modules/other/forms";
import type {
  Account,
  AnnualGoal,
  CalendarEvent,
  Habit,
  Project,
  SavingsGoal,
  Task,
  Transaction,
  WishlistItem,
} from "@/types/db";

export type FormRequest =
  | { kind: "transaction"; record?: Transaction; defaults?: Partial<Transaction> }
  | { kind: "account"; record?: Account }
  | { kind: "savings"; record?: SavingsGoal }
  | { kind: "deposit"; record: SavingsGoal }
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

  return (
    <FormsContext.Provider value={open}>
      {children}
      {req?.kind === "transaction" && <TransactionForm key={key} {...common} record={req.record} defaults={req.defaults} />}
      {req?.kind === "account" && <AccountForm key={key} {...common} record={req.record} />}
      {req?.kind === "savings" && <SavingsGoalForm key={key} {...common} record={req.record} />}
      {req?.kind === "deposit" && <SavingsDepositForm key={key} {...common} record={req.record} />}
      {req?.kind === "project" && <ProjectForm key={key} {...common} record={req.record} />}
      {req?.kind === "task" && <TaskForm key={key} {...common} record={req.record} defaults={req.defaults} />}
      {req?.kind === "habit" && <HabitForm key={key} {...common} record={req.record} />}
      {req?.kind === "wish" && <WishlistForm key={key} {...common} record={req.record} />}
      {req?.kind === "goal" && <GoalForm key={key} {...common} record={req.record} />}
      {req?.kind === "event" && <EventForm key={key} {...common} record={req.record} defaults={req.defaults} />}
    </FormsContext.Provider>
  );
}

export function useForms() {
  const ctx = useContext(FormsContext);
  if (!ctx) throw new Error("useForms debe usarse dentro de <FormsProvider>");
  return ctx;
}
