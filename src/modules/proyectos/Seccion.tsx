import type { LucideIcon } from "lucide-react";

/** Tarjeta de un panel del proyecto: ícono, título, cuenta y una acción a la derecha */
export function Seccion({
  id,
  titulo,
  icon: Icon,
  cuenta,
  accion,
  children,
}: {
  id: string;
  titulo: string;
  icon: LucideIcon;
  cuenta?: number;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="card min-w-0 scroll-mt-24 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-bg-2">
          <Icon size={16} />
        </span>
        <h2 id={`${id}-titulo`} className="text-[16px] font-bold">
          {titulo}
        </h2>
        {cuenta ? <span className="num rounded-full bg-bg-2 px-2 py-0.5 text-[12px] text-muted">{cuenta}</span> : null}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">{accion}</div>
      </div>
      {children}
    </section>
  );
}
