import { Avatar, NotificationsButton, QuickAdd } from "./HeaderActions";

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:mb-8 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2 text-[13px] text-muted">{eyebrow}</div> : null}
        <h1 className="text-[28px] font-medium leading-[1.1] tracking-[-0.025em] md:text-[34px]">{title}</h1>
        {subtitle ? <p className="mt-2 text-[14.5px] text-muted">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <div className="hidden lg:block">
          <QuickAdd />
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          <NotificationsButton />
          <Avatar />
        </div>
      </div>
    </header>
  );
}
