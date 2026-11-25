"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Select } from "@/components/ui/Field";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { addMonths, bogotaHour, formatLongDate, monthKey, monthLabel } from "@/utils/dates";
import { ActivityWidget, BalanceWidget, IncomeExpenseWidget, SavingsWidget } from "./widgets/FinanceWidgets";
import { CalendarWidget, HabitsWidget, ProjectsWidget, TasksWidget, WishlistWidget } from "./widgets/LifeWidgets";

function greeting() {
  const h = bogotaHour();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function DashboardPage() {
  const { profile } = useData();
  const today = useToday();
  const current = monthKey(today);
  const [refMonth, setRefMonth] = useState(current);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => addMonths(current, -i)), [current]);
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(today)}
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        subtitle="Este es el resumen de tu vida hoy."
      >
        <label className="sr-only" htmlFor="periodo">
          Periodo
        </label>
        <Select
          id="periodo"
          value={refMonth}
          onChange={(e) => setRefMonth(e.target.value)}
          className="h-10 w-auto min-w-[180px] bg-card text-[13.5px]"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {m === current ? `Este mes · ${monthLabel(m)}` : monthLabel(m)}
            </option>
          ))}
        </Select>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12 xl:gap-5">
        <BalanceWidget refMonth={refMonth} className="md:col-span-1 xl:col-span-4" />
        <IncomeExpenseWidget refMonth={refMonth} className="md:col-span-1 xl:col-span-5" />
        <SavingsWidget className="md:col-span-2 xl:col-span-3" />

        <ActivityWidget className="md:col-span-2 xl:col-span-8" />
        <HabitsWidget className="md:col-span-1 xl:col-span-4" />

        <TasksWidget className="md:col-span-1 xl:col-span-5" />
        <ProjectsWidget className="md:col-span-2 xl:col-span-7" />

        <CalendarWidget className="md:col-span-1 xl:col-span-5" />
        <WishlistWidget className="md:col-span-1 xl:col-span-7" />
      </div>
    </>
  );
}
