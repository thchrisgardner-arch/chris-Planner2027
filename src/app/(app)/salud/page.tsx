import { Suspense } from "react";
import { HabitsPage } from "@/modules/habits/HabitsPage";

// Contenido que depende de datos del navegador: sin validación de navegación instantánea
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <HabitsPage />
    </Suspense>
  );
}
