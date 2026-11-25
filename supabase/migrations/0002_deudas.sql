-- LIFE OS 2027 · Deudas: campos para cuotas, día de pago y mora
alter table public.debts add column if not exists type text not null default 'otro'
  check (type in ('tarjeta_credito','credito_libre','hipotecario','vehiculo','libranza','educativo','personal','otro'));
alter table public.debts add column if not exists installment_amount numeric(14,2) check (installment_amount >= 0);
alter table public.debts add column if not exists installments_paid integer not null default 0 check (installments_paid >= 0);
alter table public.debts add column if not exists payment_day integer check (payment_day between 1 and 31);
alter table public.debts add column if not exists overdue_amount numeric(14,2) not null default 0 check (overdue_amount >= 0);
alter table public.debts add column if not exists overdue_days integer not null default 0 check (overdue_days >= 0);
alter table public.debts add column if not exists notes text;
