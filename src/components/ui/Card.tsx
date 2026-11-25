import { cn } from "@/utils/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card animate-in p-[22px] sm:p-6", className)} {...props} />;
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-line bg-card text-fg">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-[17px] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
          {subtitle ? <p className="mt-0.5 truncate text-[12.5px] text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1.5">{action}</div> : null}
    </div>
  );
}
