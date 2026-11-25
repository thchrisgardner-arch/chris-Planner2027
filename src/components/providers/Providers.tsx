"use client";

import { LucideProvider } from "lucide-react";
import { DataProvider } from "@/lib/store/DataProvider";
import { FeedbackProvider } from "./FeedbackProvider";
import { FormsProvider } from "./FormsProvider";
import { ThemeWatcher } from "@/lib/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // Íconos: trazo fino y minimalista en toda la app; el color lo hereda del texto (negro por defecto)
    <LucideProvider strokeWidth={1.5}>
      <ThemeWatcher />
      <DataProvider>
        <FeedbackProvider>
          <FormsProvider>{children}</FormsProvider>
        </FeedbackProvider>
      </DataProvider>
    </LucideProvider>
  );
}
