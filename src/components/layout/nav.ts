import {
  CalendarDays,
  FolderKanban,
  Gift,
  HeartPulse,
  LayoutDashboard,
  Settings,
  Target,
  Trophy,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short?: string;
  icon: LucideIcon;
}

export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", short: "Inicio", icon: LayoutDashboard },
  { href: "/finanzas", label: "Finanzas", icon: Wallet },
  { href: "/proyectos", label: "Proyectos", icon: FolderKanban },
  { href: "/salud", label: "Salud y hábitos", short: "Hábitos", icon: HeartPulse },
  { href: "/wishlist", label: "Wishlist", icon: Gift },
  { href: "/objetivos", label: "Objetivos", icon: Target },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/progreso", label: "Progreso", icon: Trophy },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/configuracion", label: "Configuración", icon: Settings },
  { href: "/configuracion#perfil", label: "Perfil", icon: UserRound },
];

export function isActive(pathname: string, href: string) {
  const base = href.split("#")[0];
  if (base === "/") return pathname === "/";
  return pathname === base || pathname.startsWith(base + "/");
}
