"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useData } from "@/lib/store/DataProvider";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/misc";
import { Sidebar } from "./Sidebar";
import { BottomNav, MobileDrawer, MobileTopbar } from "./MobileNav";
import { WelcomeModal } from "./WelcomeModal";

const SIDEBAR_KEY = "lifeos:ui:sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, error, reload, profile } = useData();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    // Preferencia guardada del sidebar
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);

  useEffect(() => {
    if (status === "auth_required") router.replace("/login");
  }, [status, router]);

  const toggle = () =>
    setCollapsed((c) => {
      localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1");
      return !c;
    });
  const closeDrawer = useCallback(() => setDrawer(false), []);

  return (
    <div className="flex min-h-dvh">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopbar onMenu={() => setDrawer(true)} />
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12 lg:px-8 lg:pt-8 xl:px-10">
          {status === "ready" ? (
            children
          ) : status === "error" ? (
            <div className="card mx-auto mt-16 max-w-md p-8 text-center">
              <p className="text-[17px] font-medium">No se pudieron cargar tus datos</p>
              <p className="mt-2 text-[13px] text-muted">{error}</p>
              <Button className="mt-5" onClick={() => reload()}>
                <RefreshCw size={18} /> Reintentar
              </Button>
            </div>
          ) : (
            <ShellSkeleton />
          )}
        </main>
      </div>
      <MobileDrawer open={drawer} onClose={closeDrawer} />
      <BottomNav onMore={() => setDrawer(true)} />
      {status === "ready" && profile && !profile.full_name ? <WelcomeModal /> : null}
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="mt-3 h-4 w-52" />
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        {["xl:col-span-4", "xl:col-span-5", "xl:col-span-3", "xl:col-span-8", "xl:col-span-4"].map((span, i) => (
          <div key={i} className={`card h-[220px] p-6 ${span}`}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-6 h-10 w-48" />
            <Skeleton className="mt-8 h-16 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
