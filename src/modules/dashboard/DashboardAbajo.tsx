"use client";

/** Widgets de la parte baja del inicio: su código se descarga después de la primera vista. */
import { ActivityCard, CalendarCard, HabitsWeekCard, ProjectsCard, SavingsCard, TasksCard, WishlistCard } from "./DashboardWidgets";

export default function DashboardAbajo() {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
        <ActivityCard className="md:col-span-2 xl:col-span-7" />
        <HabitsWeekCard className="md:col-span-2 xl:col-span-5" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
        <SavingsCard className="xl:col-span-4" />
        <TasksCard className="xl:col-span-4" />
        <CalendarCard className="md:col-span-2 xl:col-span-4" />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <ProjectsCard className="xl:col-span-7" />
        <WishlistCard className="xl:col-span-5" />
      </div>
    </>
  );
}
