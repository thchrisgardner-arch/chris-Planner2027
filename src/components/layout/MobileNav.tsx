"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { Logo } from "./Logo";
import { MAIN_NAV, isActive } from "./nav";
import { SidebarContent } from "./Sidebar";
import { Avatar, NotificationsButton, QuickAdd } from "./HeaderActions";

/** Barra superior en celular (<768 px): logo, notificaciones y avatar. Sin hamburguesa: el menú está en "Más". */
export function MobileTopbar() {
  return (
    <div className="sticky top-0 z-40 flex h-16 items-center gap-2 bg-bg/90 px-4 backdrop-blur-md md:hidden">
      <Link href="/" aria-label="Ir al inicio" className="mr-auto">
        <Logo />
      </Link>
      <NotificationsButton />
      <Avatar size={40} />
    </div>
  );
}

/** Cajón lateral con la navegación completa. */
export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    onClose();
    // Cerrar al cambiar de ruta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className={cn("fixed inset-0 z-[70] md:hidden", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={cn("absolute inset-0 bg-black/40 transition-opacity duration-250", open ? "opacity-100" : "opacity-0")}
      />
      <aside
        className={cn(
          "absolute inset-y-0 left-0 flex w-[min(300px,86vw)] flex-col rounded-r-[28px] bg-bg px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5 transition-transform duration-250 ease-(--ease-os)",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-7 flex items-center justify-between px-1.5">
          <Logo />
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="focus-ring grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-card text-fg hover:bg-elev"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <SidebarContent onNavigate={onClose} />
        </div>
      </aside>
    </div>
  );
}

/** Navegación inferior en celular: píldora flotante + botón "+" negro. */
export function BottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const items = MAIN_NAV.slice(0, 4);
  return (
    <nav
      aria-label="Navegación rápida"
      className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2.5 px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 md:hidden"
    >
      <div className="flex h-[60px] min-w-0 flex-1 items-center justify-between rounded-full border border-line bg-card/95 p-1.5 backdrop-blur-md">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              className={cn(
                "flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-full transition-all duration-250 ease-(--ease-os)",
                active ? "bg-elev px-2.5 text-fg" : "w-[38px] text-fg",
              )}
            >
              <Icon size={22} />
              {active ? <span className="text-[13px] font-medium">{item.short ?? item.label}</span> : null}
            </Link>
          );
        })}
        <button onClick={onMore} aria-label="Más secciones" className="grid h-12 w-[38px] shrink-0 cursor-pointer place-items-center rounded-full text-fg">
          <Menu size={22} />
        </button>
      </div>
      <QuickAdd fab />
    </nav>
  );
}
