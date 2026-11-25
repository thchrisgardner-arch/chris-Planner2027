import { Suspense } from "react";
import { FinancePage } from "@/modules/finance/FinancePage";

export default function Page() {
  return (
    <Suspense>
      <FinancePage />
    </Suspense>
  );
}
