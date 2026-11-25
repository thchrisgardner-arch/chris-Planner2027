import { cn } from "@/utils/cn";
import { Isotipo } from "./Isotipo";

/** Isotipo de LIFE for LIFE: el rostro de Centavo. */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return <Isotipo size={size} className={cn("shrink-0", className)} />;
}

/** Logotipo: isotipo + "LIFE for LIFE"; solo "for" va en caligrafía (Sacramento, estilo "hello") */
export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark size={34} />
      {!collapsed ? (
        <p aria-label="LIFE for LIFE" className="flex items-baseline gap-1 whitespace-nowrap text-[13.5px] font-bold leading-none tracking-[0.04em] md:text-[15px]">
          <span>LIFE</span>
          <span className="text-[21px] font-normal tracking-normal md:text-[24px]" style={{ fontFamily: "var(--font-caligrafia), cursive" }}>
            for
          </span>
          <span>LIFE</span>
        </p>
      ) : null}
    </div>
  );
}
