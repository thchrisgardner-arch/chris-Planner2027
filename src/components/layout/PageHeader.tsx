/**
 * Cabecera de página: título grande a la izquierda (puede ir en dos líneas)
 * y a la derecha las píldoras de contexto + un único botón primario.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  children,
}: {
  title: React.ReactNode;
  subtitle?: string;
  eyebrow?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-5 md:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2 text-[13px] text-muted">{eyebrow}</div> : null}
        <h1 className="text-[32px] font-bold leading-[1.05] tracking-[-0.03em] md:text-[44px] xl:text-[48px]">{title}</h1>
        {subtitle ? <p className="mt-3 text-[14.5px] text-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </header>
  );
}
