import { cn } from "@/utils/cn";
import { Isotipo } from "./Isotipo";

/** Isotipo de Poku Poku: el rostro de Centavo. */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return <Isotipo size={size} className={cn("shrink-0", className)} />;
}

/** Logotipo: isotipo + "Poku Poku" */
export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark size={34} />
      {!collapsed ? <p className="whitespace-nowrap text-[15px] font-bold leading-none tracking-[0.02em] md:text-[17px]">Poku Poku</p> : null}
    </div>
  );
}
