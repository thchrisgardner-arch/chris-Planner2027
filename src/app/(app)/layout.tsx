import { AppShell } from "@/components/layout/AppShell";

// El contenido depende de datos privados que se cargan en el navegador (local o Supabase),
// por eso no se valida la navegación instantánea con prerender.
export const instant = false;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
