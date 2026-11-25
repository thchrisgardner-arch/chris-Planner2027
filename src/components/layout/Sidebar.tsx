"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { LogOut, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { LOCAL_LOGIN_ENABLED } from "@/services/localAuth";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { isScheduled, logFor } from "@/modules/habits/selectors";
import { cn } from "@/utils/cn";
import { LogoMark, Logo } from "./Logo";
import { MAIN_NAV, isActive, type NavItem } from "./nav";

/* ───────── Contadores reales para las insignias ───────── */
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

/** Etiqueta del modo de datos */
export function StorageChip() {
  const { mode } = useData();
  const label = mode === "demo" ? "Demo" : mode === "local" ? "Modo local" : "Sincronizado";
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

/** Ítem del riel: círculo negro con ícono blanco cuando está activo. */
function RailItem({
  item,
  expanded,
  count,
  onNavigate,
}: {
  item: NavItem;
  expanded: boolean;
  count?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const label = count ? `${item.label}: ${count} ${badgeHint[item.href] ?? ""}` : item.label;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-label={expanded ? undefined : label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-ring group relative flex items-center gap-3 rounded-full transition-colors duration-200",
        expanded ? "h-11 pr-3" : "h-11 w-11 justify-center",
        expanded && (active ? "bg-fg text-on-fg" : "text-fg hover:bg-card"),
      )}
    >
      <span
        className={cn(
          "relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors duration-200",
          !expanded && (active ? "bg-fg text-on-fg" : "text-fg group-hover:bg-card"),
        )}
      >
        <Icon size={20} />
        {count ? (
          <span className="num absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10.5px] font-medium text-[#0a0a0a]">
            {count}
          </span>
        ) : null}
      </span>
      {expanded ? <span className="truncate text-[14.5px]">{item.label}</span> : null}
      {!expanded ? (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-full bg-fg px-3 py-1.5 text-[12.5px] font-medium text-on-fg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          {item.label}
        </span>
      ) : null}
    </Link>
  );
}

export function SignOutButton({ expanded }: { expanded?: boolean }) {
  const { signOut, mode } = useData();
  const { confirm, toast } = useFeedback();
  if (mode !== "supabase" && !(mode === "local" && LOCAL_LOGIN_ENABLED)) return null;
  return (
    <button
      type="button"
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      onClick={async () => {
        if (await confirm({ title: "¿Cerrar sesión?", confirmLabel: "Cerrar sesión" })) {
          await signOut();
          toast("Sesión cerrada.");
        }
      }}
      className={cn(
        "focus-ring flex h-11 cursor-pointer items-center gap-3 rounded-full text-fg transition-colors hover:bg-card",
        expanded ? "px-3" : "w-11 justify-center",
      )}
    >
      <LogOut size={20} />
      {expanded ? <span className="text-[14.5px]">Cerrar sesión</span> : null}
    </button>
  );
}

/** Contenido del menú (riel o cajón móvil). */
export function SidebarContent({ expanded = true, onNavigate }: { expanded?: boolean; onNavigate?: () => void }) {
  const counts = useNavCounts();
  const settings: NavItem = { href: "/configuracion", label: "Configuración", icon: Settings };
  return (
    <>
      <nav className={cn("flex flex-col gap-1.5", !expanded && "items-center")} aria-label="Principal">
        {MAIN_NAV.map((item) => (
          <RailItem key={item.href} item={item} expanded={expanded} count={counts[item.href]} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className={cn("mt-auto flex flex-col gap-1.5 pt-6", !expanded && "items-center")}>
        {expanded ? (
          <div className="mb-1 px-1.5">
            <StorageChip />
          </div>
        ) : null}
        <RailItem item={settings} expanded={expanded} onNavigate={onNavigate} />
        <SignOutButton expanded={expanded} />
      </div>
    </>
  );
}

/** Riel lateral (≥768 px). Se puede expandir para ver etiquetas; la preferencia se guarda. */
export function Sidebar({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col py-5 transition-[width] duration-250 ease-(--ease-os) md:flex lg:top-4 lg:h-[calc(100dvh-32px)]",
        expanded ? "w-[232px] px-4" : "w-[84px] items-center px-0",
      )}
    >
      <div className={cn("mb-8 flex items-center", expanded ? "justify-between px-1.5" : "flex-col gap-4")}>
        <Link href="/" aria-label="LIFE OS, ir al inicio" className="focus-ring rounded-[12px]">
          {expanded ? <Logo /> : <LogoMark size={40} />}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-label={expanded ? "Contraer menú" : "Expandir menú"}
          title={expanded ? "Contraer menú" : "Expandir menú"}
          className="focus-ring grid h-9 w-9 cursor-pointer place-items-center rounded-full text-fg transition-colors hover:bg-card"
        >
          {expanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>
      <div className={cn("flex flex-1 flex-col", !expanded && "items-center")}>
        <SidebarContent expanded={expanded} />
      </div>
    </aside>
  );
}
