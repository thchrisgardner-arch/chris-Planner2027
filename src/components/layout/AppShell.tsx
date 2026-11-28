"use client";

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, X } from "lucide-react";
import Link from "@/components/Enlace";
import { useData } from "@/lib/store/DataProvider";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/misc";
import { Sidebar } from "./Sidebar";
import { BottomNav, MobileDrawer, MobileTopbar } from "./MobileNav";
import { GlobalSearch } from "./GlobalSearch";
import { Avatar, NotificationsButton } from "./HeaderActions";
import { GamificacionProvider } from "@/modules/asistentes/Gamificacion";
import { CapaReacciones, PildorasProgreso, ReaccionNegativa } from "@/modules/asistentes/Protagonismo";
import { CapturaRapida } from "@/modules/captura/CapturaRapida";
import { GenerarPagosFijos } from "@/modules/finance/GenerarPagosFijos";
import { Diferido } from "@/components/Diferido";
import { isOnboardingDone } from "@/lib/onboarding";

// Ventanas que se abren encima de la página (celebraciones, racha del día, tutorial, ánimo,
// bienvenida): se descargan aparte y no compiten con la primera vista
const CapaCelebraciones = lazy(() => import("@/modules/asistentes/Celebraciones").then((m) => ({ default: m.CapaCelebraciones })));
const SaludoDiario = lazy(() => import("@/modules/asistentes/SaludoDiario").then((m) => ({ default: m.SaludoDiario })));
const Tutorial = lazy(() => import("@/modules/tutorial/Tutorial").then((m) => ({ default: m.Tutorial })));
const ChequeoAnimo = lazy(() => import("@/modules/asistentes/ChequeoAnimo").then((m) => ({ default: m.ChequeoAnimo })));
const WelcomeModal = lazy(() => import("./WelcomeModal").then((m) => ({ default: m.WelcomeModal })));
import { PrecargarRutas } from "@/components/PrecargarRutas";

// Piezas que no se ven en la primera pantalla: su código se descarga con el navegador libre
const Sincronizador = lazy(() => import("@/modules/sync/Sincronizador").then((m) => ({ default: m.Sincronizador })));
const SincronizarAvisos = lazy(() => import("@/modules/avisos/AvisosCelular").then((m) => ({ default: m.SincronizarAvisos })));
const PWA = lazy(() => import("@/modules/pwa/AppInstalable").then((m) => ({ default: m.PWA })));
const ModoEnfoque = lazy(() => import("@/modules/enfoque/ModoEnfoque").then((m) => ({ default: m.ModoEnfoque })));
const MigracionReuniones = lazy(() => import("@/modules/proyectos/MigracionReuniones").then((m) => ({ default: m.MigracionReuniones })));
const AvisosDinero = lazy(() => import("@/modules/proyectos/AvisosDinero").then((m) => ({ default: m.AvisosDinero })));
const MigracionOrden = lazy(() => import("@/modules/proyectos/OrdenTareas").then((m) => ({ default: m.MigracionOrden })));
const SincronizarObjetivosCompra = lazy(() => import("@/modules/other/ObjetivosCompra").then((m) => ({ default: m.SincronizarObjetivosCompra })));
const PanelDemo = lazy(() => import("@/modules/asistentes/PanelDemo").then((m) => ({ default: m.PanelDemo })));

const RAIL_KEY = "lifeos:ui:rail-expanded";

/**
 * Estructura de la app:
 *  ≥1024 px  contenedor blanco redondeado (32 px) sobre el lienzo, con riel de íconos.
 *  768–1023  riel de íconos sin contenedor exterior.
 *  <768      barra superior + barra inferior flotante con botón "+".
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, error, reload, profile, mode } = useData();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [onboarded, setOnboarded] = useState(true);

  useEffect(() => {
    // Preferencias guardadas en este navegador
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpanded(localStorage.getItem(RAIL_KEY) === "1");
    setOnboarded(isOnboardingDone());
  }, []);

  useEffect(() => {
    if (status === "auth_required") router.replace("/login");
  }, [status, router]);

  const toggle = () =>
    setExpanded((e) => {
      localStorage.setItem(RAIL_KEY, e ? "0" : "1");
      return !e;
    });
  const closeDrawer = useCallback(() => setDrawer(false), []);
  const bienvenida = status === "ready" && !!profile && !profile.full_name && !onboarded;

  return (
    <GamificacionProvider>
    <div className="min-h-dvh bg-bg lg:bg-canvas lg:p-4">
      <div className="flex min-h-dvh bg-bg lg:min-h-[calc(100dvh-32px)] lg:rounded-[32px]">
        <Sidebar expanded={expanded} onToggle={toggle} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopbar />
          {/* Encabezado (≥768 px): buscador, notificaciones y avatar */}
          {/* Fijo arriba con fondo sólido; en ≥1024 una franja del lienzo tapa el margen superior al hacer scroll */}
          <div className="sticky top-0 z-40 hidden md:block lg:-mt-4 lg:bg-canvas lg:pt-4">
            <div className="flex items-center gap-3 bg-bg px-6 pb-2 pt-5 lg:rounded-t-[32px] lg:px-8">
              <GlobalSearch className="w-full max-w-[360px]" />
              <div className="ml-auto flex items-center gap-2">
                {status === "ready" ? <PildorasProgreso /> : null}
                <div className="hidden lg:block">
                  <NotificationsButton pill />
                </div>
                <div className="lg:hidden">
                  <NotificationsButton />
                </div>
                <Avatar size={44} />
              </div>
            </div>
          </div>
          {mode === "demo" ? (
            <div className="mx-4 mt-3 flex items-center gap-3 rounded-full bg-warn-fill px-4 py-2 text-[13px] text-[#0a0a0a] md:mx-6 lg:mx-8">
              <span className="font-medium">Modo demo</span>
              <span className="hidden truncate sm:inline">Datos de ejemplo; nada de esto se guarda y tus datos reales no se tocan.</span>
              <Link href="/?demo=0" className="ml-auto flex shrink-0 items-center gap-1 font-medium underline-offset-4 hover:underline" onClick={() => setTimeout(() => window.location.reload(), 50)}>
                Salir <X size={14} />
              </Link>
            </div>
          ) : null}
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-32 pt-5 sm:px-6 md:pb-12 md:pt-4 lg:px-8">
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
      </div>
      <MobileDrawer open={drawer} onClose={closeDrawer} />
      <BottomNav onMore={() => setDrawer(true)} />
      {status === "ready" ? (
        <>
          <CapaReacciones />
          <ReaccionNegativa />
          <GenerarPagosFijos />
          <CapturaRapida />
          <PrecargarRutas />
          <Diferido espera={400}>
            <CapaCelebraciones />
            {bienvenida ? null : <SaludoDiario />}
            {bienvenida ? null : <Tutorial />}
            {bienvenida ? null : <ChequeoAnimo />}
          </Diferido>
          <Diferido>
            <MigracionReuniones />
            <AvisosDinero />
            <MigracionOrden />
            <SincronizarObjetivosCompra />
            <SincronizarAvisos />
            <Sincronizador />
            <PWA />
            <ModoEnfoque />
            {mode === "demo" ? <PanelDemo /> : null}
          </Diferido>
        </>
      ) : null}
      {bienvenida ? (
        <Suspense fallback={null}>
          <WelcomeModal onDone={() => setOnboarded(true)} />
        </Suspense>
      ) : null}
    </div>
    </GamificacionProvider>
  );
}

function ShellSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-12 w-80" />
      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12">
        {["xl:col-span-4", "xl:col-span-4", "xl:col-span-4", "xl:col-span-7", "xl:col-span-5"].map((span, i) => (
          <div key={i} className={`card h-[200px] p-6 ${span}`}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-10 h-12 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}
