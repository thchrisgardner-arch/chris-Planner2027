import { Suspense } from "react";
import { FinancePage } from "@/modules/finance/FinancePage";

// Contenido que depende de datos del navegador: sin validación de navegación instantánea
export const instant = false;

export default function Page() {
  return (
    <Suspense>
      <FinancePage />
    </Suspense>
  );
}
