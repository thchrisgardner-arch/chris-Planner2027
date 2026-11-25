import { cn } from "@/utils/cn";
import { Isotipo } from "./Isotipo";

/** Isotipo de LIFE for LIFE: el rostro de Centavo. */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return <Isotipo size={size} className={cn("shrink-0", className)} />;
}

/** Logotipo: isotipo + "Life for Life" en caligrafía de trazo continuo (Sacramento, estilo "hello") */
export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark size={34} />
      {!collapsed ? (
        <p aria-label="LIFE for LIFE" className="whitespace-nowrap pt-1 text-[22px] leading-none md:text-[25px]" style={{ fontFamily: "var(--font-caligrafia), cursive" }}>
          Life for Life
        </p>
      ) : null}
    </div>
  );
}
