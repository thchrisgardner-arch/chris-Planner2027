"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { LogOut, PanelLeftClose, PanelLeftOpen, Database as DataIcon, Settings } from "lucide-react";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { LOCAL_LOGIN_ENABLED } from "@/services/localAuth";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { isScheduled, logFor } from "@/modules/habits/selectors";
import { cn } from "@/utils/cn";
import { Logo } from "./Logo";
import { RingAvatar } from "./HeaderActions";
import { MAIN_NAV, isActive, type NavItem } from "./nav";

/* ───────── Contadores reales para las insignias del menú ───────── */
function useNavCounts(): Record<string, number> {
  const { db } = useData();
  const today = useToday();
  return useMemo((): Record<string, number> => {
    if (!today) return {};
    return {
      "/proyectos": db.tasks.filter((t) => t.status !== "completada" && t.due_date && t.due_date <= today).length,
      "/salud": db.habits.filter((h) => isScheduled(h, today) && !logFor(db.habit_logs, h.id, today)).length,
      "/calendario": db.calendar_events.filter((e) => e.date === today).length,
    };
  }, [db, today]);
}

const badgeHint: Record<string, string> = {
  "/proyectos": "tareas para hoy o vencidas",
  "/salud": "hábitos pendientes hoy",
  "/calendario": "eventos hoy",
};

function NavLink({
  item,
  collapsed,
  onNavigate,
  count,
}: {
  item: NavItem;
  collapsed?: boolean;
  onNavigate?: () => void;
  count?: number;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-ring group relative flex h-11 items-center gap-3 rounded-[14px] px-3 text-[14.5px] transition-colors duration-200",
        active ? "bg-elev font-medium text-fg" : "text-fg hover:bg-bg-2 hover:text-fg",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon size={21} className="shrink-0" />
      {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
      {count ? (
        <span
          title={`${count} ${badgeHint[item.href] ?? ""}`}
          className={cn(
            "num grid min-w-6 place-items-center rounded-full bg-card px-1.5 text-[11.5px] font-medium text-fg ring-1 ring-line",
            collapsed && "absolute right-1.5 top-1 h-4 min-w-4 px-1 text-[9.5px]",
            !collapsed && "h-6",
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}

/** Insignia del modo de almacenamiento (como la etiqueta "PRO" de la referencia). */
export function StorageChip() {
  const { mode } = useData();
  const label = mode === "demo" ? "Demo" : mode === "local" ? "Local" : "Sincronizado";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-[11.5px] font-medium",
        mode === "supabase" ? "bg-brand text-[#0a0a0a]" : mode === "demo" ? "bg-warn-fill text-[#0a0a0a]" : "bg-elev text-fg",
      )}
    >
      {label}
    </span>
  );
}

export function SignOutButton({ collapsed }: { collapsed?: boolean }) {
  const { signOut, mode } = useData();
  const { confirm, toast } = useFeedback();
  // Sin login local activo no hay sesión que cerrar
  if (mode === "local" && !LOCAL_LOGIN_ENABLED) return null;
  return (
    <button
      title="Cerrar sesión"
      onClick={async () => {
        if (await confirm({ title: "¿Cerrar sesión?", confirmLabel: "Cerrar sesión" })) {
          await signOut();
          toast("Sesión cerrada.");
        }
      }}
      className={cn(
        "focus-ring flex h-11 w-full cursor-pointer items-center gap-3 rounded-[14px] px-3 text-[14.5px] text-fg transition-colors hover:bg-bg-2 hover:text-fg",
        collapsed && "justify-center px-0",
      )}
    >
      <LogOut size={21} className="shrink-0" />
      {!collapsed ? <span>Cerrar sesión</span> : null}
    </button>
  );
}

/** Tarjeta de usuario en la parte alta del panel. */
function UserCard({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { profile, mode } = useData();
  if (collapsed) {
    return (
      <Link href="/configuracion#perfil" onClick={onNavigate} aria-label="Tu perfil" className="mx-auto mb-3 block">
        <RingAvatar size={42} />
      </Link>
    );
  }
  return (
    <Link
      href="/configuracion#perfil"
      onClick={onNavigate}
      className="focus-ring mb-3 flex items-center gap-3 rounded-[20px] border border-line p-3.5 transition-colors hover:bg-bg-2"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium tracking-[-0.01em]">{profile?.full_name || "Tu perfil"}</span>
        <span className="block truncate text-[12.5px] text-muted">
          {profile?.email || (mode === "local" ? "Sin cuenta en la nube" : "")}
        </span>
      </span>
      <RingAvatar size={46} />
    </Link>
  );
}

export function SidebarContent({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const counts = useNavCounts();
  const pathname = usePathname();
  const settingsActive = isActive(pathname, "/configuracion");
  return (
    <>
      <UserCard collapsed={collapsed} onNavigate={onNavigate} />
      <nav className="flex flex-col gap-0.5" aria-label="Principal">
        {MAIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} count={counts[item.href]} />
        ))}
      </nav>
      <div className="mt-auto pt-4">
        <div className="-mx-3 mb-3 h-px bg-line" />
        <Link
          href="/configuracion"
          onClick={onNavigate}
          title={collapsed ? "Configuración" : undefined}
          aria-current={settingsActive ? "page" : undefined}
          className={cn(
            "focus-ring flex h-11 items-center gap-3 rounded-[14px] px-3 text-[14.5px] transition-colors",
            settingsActive ? "bg-elev font-medium text-fg" : "text-fg hover:bg-bg-2 hover:text-fg",
            collapsed && "justify-center px-0",
          )}
        >
          <Settings size={21} className="shrink-0" />
          {!collapsed ? <span className="flex-1">Configuración</span> : null}
        </Link>
        <Link
          href="/configuracion#datos"
          onClick={onNavigate}
          title={collapsed ? "Mis datos" : undefined}
          className={cn(
            "focus-ring flex h-11 items-center gap-3 rounded-[14px] px-3 text-[14.5px] text-fg transition-colors hover:bg-bg-2 hover:text-fg",
            collapsed && "justify-center px-0",
          )}
        >
          <DataIcon size={21} className="shrink-0" />
          {!collapsed ? (
            <>
              <span className="flex-1">Mis datos</span>
              <StorageChip />
            </>
          ) : null}
        </Link>
        <SignOutButton collapsed={collapsed} />
      </div>
    </>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 p-3 transition-[width] duration-250 ease-(--ease-os) lg:block",
        collapsed ? "w-[96px]" : "w-[288px]",
      )}
    >
      <div className="card flex h-full flex-col overflow-hidden px-3 pb-3 pt-4">
        <div className={cn("mb-4 flex items-center justify-between px-2", collapsed && "flex-col gap-3 px-0")}>
          <Link href="/" aria-label="LIFE OS, ir al dashboard" className="focus-ring rounded-[10px]">
            <Logo collapsed={collapsed} />
          </Link>
          <button
            onClick={onToggle}
            aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
            className="focus-ring grid h-8 w-8 cursor-pointer place-items-center rounded-[10px] text-dim transition-colors hover:bg-bg-2 hover:text-fg"
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto">
          <SidebarContent collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}
