"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  BadgeCheck,
  Bell,
  Database as DataIcon,
  LogOut,
  Settings,
  CalendarPlus,
  FolderPlus,
  Gift,
  ListTodo,
  Plus,
  Repeat,
  Target,
  Wallet,
  PiggyBank,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { useForms } from "@/components/providers/FormsProvider";
import { useData } from "@/lib/store/DataProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/utils/cn";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { LOCAL_LOGIN_ENABLED } from "@/services/localAuth";
import { StorageChip } from "./Sidebar";

export function initials(name: string | null | undefined) {
  if (!name) return "·";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Avatar con iniciales dentro de un anillo de colores pastel. */
export function RingAvatar({ size = 40 }: { size?: number }) {
  const { profile } = useData();
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full p-[2px]"
      style={{
        width: size,
        height: size,
        background: "conic-gradient(from 200deg, #ffb3c7, #ffe69a, #b9f0cc, #bcdcff, #c9b8ff, #ffb3c7)",
      }}
      aria-hidden
    >
      <span className="grid h-full w-full place-items-center rounded-full bg-card p-[2px]">
        <span
          className="grid h-full w-full place-items-center rounded-full bg-gradient-to-br from-elev to-line font-semibold text-fg"
          style={{ fontSize: Math.max(11, size * 0.32) }}
        >
          {initials(profile?.full_name)}
        </span>
      </span>
    </span>
  );
}

/** Menú de perfil (avatar del encabezado). */
export function Avatar({ size = 40 }: { size?: number }) {
  const { profile, mode, signOut } = useData();
  const { confirm, toast } = useFeedback();
  const canSignOut = !(mode === "local" && !LOCAL_LOGIN_ENABLED);
  return (
    <Popover
      className="w-[300px] p-2"
      trigger={({ toggle, open }) => (
        <button onClick={toggle} aria-label="Menú de perfil" aria-expanded={open} className="focus-ring cursor-pointer rounded-full transition-transform hover:scale-[1.04]">
          <RingAvatar size={size} />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="mb-1.5 flex items-center gap-3 rounded-[18px] border border-line p-3.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold tracking-[-0.01em]">{profile?.full_name || "Tu perfil"}</span>
              <span className="block truncate text-[12.5px] text-muted">{profile?.email || (mode === "local" ? "Sin cuenta en la nube" : "")}</span>
            </span>
            <RingAvatar size={44} />
          </div>
          <MenuLink href="/configuracion#perfil" icon={<BadgeCheck size={20} />} onClick={close}>
            Perfil
          </MenuLink>
          <MenuLink href="/configuracion" icon={<Settings size={20} />} onClick={close}>
            Configuración
          </MenuLink>
          <MenuLink href="/configuracion#datos" icon={<DataIcon size={20} />} onClick={close} right={<StorageChip />}>
            Mis datos
          </MenuLink>
          {canSignOut ? (
            <>
              <div className="-mx-2 my-1.5 h-px bg-line" />
              <MenuItem
                icon={<LogOut size={20} />}
                onClick={async () => {
                  close();
                  if (await confirm({ title: "¿Cerrar sesión?", confirmLabel: "Cerrar sesión" })) {
                    await signOut();
                    toast("Sesión cerrada.");
                  }
                }}
              >
                Cerrar sesión
              </MenuItem>
            </>
          ) : null}
        </div>
      )}
    </Popover>
  );
}

function MenuLink({
  href,
  icon,
  children,
  onClick,
  right,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  right?: React.ReactNode;
}) {
  return (
    <Link href={href} onClick={onClick} className="focus-ring flex h-11 items-center gap-3 rounded-[14px] px-3 text-[14.5px] text-fg transition-colors hover:bg-elev">
      <span className="text-fg">{icon}</span>
      <span className="flex-1">{children}</span>
      {right}
    </Link>
  );
}

export function NotificationsButton() {
  const items = useNotifications();
  return (
    <Popover
      className="w-[min(340px,calc(100vw-32px))]"
      trigger={({ toggle, open }) => (
        <Button size="icon" variant="secondary" onClick={toggle} aria-label="Notificaciones" aria-expanded={open} className="relative">
          <Bell size={20} />
          {items.length ? (
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-warn ring-2 ring-elev" aria-hidden />
          ) : null}
        </Button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between px-2.5 pb-2 pt-1.5">
            <p className="text-[13.5px] font-semibold">Notificaciones</p>
            <span className="text-[11.5px] text-dim">{items.length ? `${items.length} activas` : ""}</span>
          </div>
          {items.length === 0 ? (
            <p className="px-2.5 pb-3 text-[12.5px] leading-relaxed text-muted">
              Todo al día. Aquí verás tareas vencidas, eventos de hoy, pagos próximos y hábitos pendientes.
            </p>
          ) : (
            <ul className="max-h-[340px] overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={close}
                    className="flex gap-3 rounded-[10px] px-2.5 py-2 transition-colors hover:bg-elev"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        n.tone === "warn" ? "bg-warn" : n.tone === "info" ? "bg-info" : "bg-brand",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px]">{n.title}</span>
                      <span className="block truncate text-[12px] text-muted">{n.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}

export function QuickAdd({ compact, fab }: { compact?: boolean; fab?: boolean }) {
  const open = useForms();
  return (
    <Popover
      side={fab ? "top" : "bottom"}
      trigger={({ toggle, open: isOpen }) =>
        fab ? (
          <button
            onClick={toggle}
            aria-label="Crear nuevo"
            aria-expanded={isOpen}
            className={cn(
              "focus-ring grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-full bg-fg text-on-fg transition-transform duration-200 active:scale-95",
              isOpen && "rotate-45",
            )}
          >
            <Plus size={26} />
          </button>
        ) : compact ? (
          <Button size="icon" variant="primary" onClick={toggle} aria-label="Crear nuevo" aria-expanded={isOpen}>
            <Plus size={21} />
          </Button>
        ) : (
          <Button variant="primary" onClick={toggle} aria-expanded={isOpen}>
            <Plus size={19} /> Nuevo
          </Button>
        )
      }
    >
      {(close) => {
        const go = (fn: () => void) => () => {
          close();
          fn();
        };
        return (
          <div>
            <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-dim">Finanzas</p>
            <MenuItem icon={<ArrowLeftRight size={18} />} onClick={go(() => open({ kind: "transaction" }))}>
              Movimiento
            </MenuItem>
            <MenuItem icon={<Wallet size={18} />} onClick={go(() => open({ kind: "account" }))}>
              Cuenta
            </MenuItem>
            <MenuItem icon={<PiggyBank size={18} />} onClick={go(() => open({ kind: "savings" }))}>
              Objetivo de ahorro
            </MenuItem>
            <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-dim">Organización</p>
            <MenuItem icon={<ListTodo size={18} />} onClick={go(() => open({ kind: "task" }))}>
              Tarea
            </MenuItem>
            <MenuItem icon={<FolderPlus size={18} />} onClick={go(() => open({ kind: "project" }))}>
              Proyecto
            </MenuItem>
            <MenuItem icon={<Repeat size={18} />} onClick={go(() => open({ kind: "habit" }))}>
              Hábito
            </MenuItem>
            <MenuItem icon={<CalendarPlus size={18} />} onClick={go(() => open({ kind: "event" }))}>
              Evento
            </MenuItem>
            <MenuItem icon={<Gift size={18} />} onClick={go(() => open({ kind: "wish" }))}>
              Deseo en wishlist
            </MenuItem>
            <MenuItem icon={<Target size={18} />} onClick={go(() => open({ kind: "goal" }))}>
              Objetivo 2027
            </MenuItem>
          </div>
        );
      }}
    </Popover>
  );
}
