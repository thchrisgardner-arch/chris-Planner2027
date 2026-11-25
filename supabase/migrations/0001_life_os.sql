-- ═══════════════════════════════════════════════════════════════
-- LIFE OS 2027 · Esquema inicial
-- Ejecutar en Supabase → SQL Editor (o `supabase db push`).
-- Importes: numeric(14,2). Fechas de calendario: date (hora Bogotá en la app).
-- Cada tabla personal tiene user_id y políticas RLS: solo su dueño la ve.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Perfil ──────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  currency text not null default 'COP',
  timezone text not null default 'America/Bogota',
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Finanzas ────────────────────────────────────────────────────
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  type text not null check (type in ('banco','efectivo','billetera','ahorros','tarjeta_credito')),
  initial_balance numeric(14,2) not null default 0,
  currency text not null default 'COP',
  created_at timestamptz not null default now()
);

create table if not exists public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('ingreso','gasto')),
  created_at timestamptz not null default now(),
  unique (user_id, kind, name)
);

-- Una transferencia es UNA fila con cuenta origen y destino:
-- nunca se cuenta como ingreso ni como gasto.
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type text not null check (type in ('ingreso','gasto','transferencia')),
  description text not null,
  amount numeric(14,2) not null check (amount > 0),
  category text,
  account_id uuid not null references public.accounts (id) on delete cascade,
  to_account_id uuid references public.accounts (id) on delete cascade,
  date date not null,
  payment_method text,
  status text not null default 'completado' check (status in ('completado','pendiente')),
  beneficiary text check (beneficiary in ('para_mi','otras_personas','compartido')),
  notes text,
  created_at timestamptz not null default now(),
  constraint transfer_accounts check (
    (type = 'transferencia' and to_account_id is not null and to_account_id <> account_id)
    or (type <> 'transferencia' and to_account_id is null)
  )
);
create index if not exists transactions_user_date on public.transactions (user_id, date desc);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category text not null,
  month date not null, -- primer día del mes
  amount numeric(14,2) not null check (amount > 0),
  alert_80 boolean not null default true,
  alert_100 boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, category, month)
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0 check (current_amount >= 0),
  target_date date,
  priority text not null default 'media' check (priority in ('baja','media','alta')),
  account_id uuid references public.accounts (id) on delete set null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  creditor text not null,
  total_amount numeric(14,2) not null check (total_amount > 0),
  pending_amount numeric(14,2) not null check (pending_amount >= 0),
  due_date date,
  installments integer check (installments > 0),
  interest_rate numeric(6,3),
  status text not null default 'activa' check (status in ('activa','pagada','en_mora')),
  created_at timestamptz not null default now()
);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  date date not null,
  transaction_id uuid references public.transactions (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

-- ── Proyectos ───────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text,
  category text,
  color text not null default '#9b82f6',
  priority text not null default 'media' check (priority in ('baja','media','alta')),
  start_date date,
  due_date date,
  budget numeric(14,2),
  status text not null default 'pendiente' check (status in ('ideas','pendiente','en_proceso','en_pausa','completado')),
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  parent_task_id uuid references public.tasks (id) on delete cascade,
  name text not null,
  description text,
  due_date date,
  priority text not null default 'media' check (priority in ('baja','media','alta')),
  status text not null default 'pendiente' check (status in ('pendiente','en_proceso','completada')),
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_due on public.tasks (user_id, due_date);

-- ── Salud y hábitos ─────────────────────────────────────────────
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#2ee56b',
  days smallint[] not null default '{0,1,2,3,4,5,6}', -- 0 = lunes … 6 = domingo
  created_at timestamptz not null default now()
);

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  date date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  date date not null,
  muscle_group text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise text not null,
  sets smallint,
  reps smallint,
  weight_kg numeric(6,2),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  day smallint not null check (day between 0 and 6),
  slot text not null check (slot in ('desayuno','media_manana','almuerzo','merienda','cena')),
  name text not null,
  description text,
  ingredients jsonb not null default '[]'::jsonb, -- [{nombre, cantidad}]
  calories integer,
  protein_g numeric(6,1),
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  meal_plan_id uuid references public.meal_plans (id) on delete cascade,
  item text not null,
  quantity text,
  checked boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Wishlist ────────────────────────────────────────────────────
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  image_url text,
  description text,
  price numeric(14,2) not null check (price > 0),
  category text not null,
  classification text not null check (classification in ('necesidad','gusto','inversion','experiencia')),
  priority text not null default 'media' check (priority in ('baja','media','alta')),
  desired_date date,
  link text,
  store text, -- id de la tienda (catálogo en la app)
  status text not null default 'en_consideracion' check (status in ('en_consideracion','ahorrando','listo','comprado','descartado')),
  savings_goal_id uuid references public.savings_goals (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── Objetivos ───────────────────────────────────────────────────
create table if not exists public.annual_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  area text not null check (area in ('finanzas','profesional','salud','personal','aprendizaje','experiencias')),
  target_date date,
  priority text not null default 'media' check (priority in ('baja','media','alta')),
  progress smallint not null default 0 check (progress between 0 and 100),
  status text not null default 'no_iniciado' check (status in ('no_iniciado','en_progreso','logrado','pausado')),
  created_at timestamptz not null default now()
);

create table if not exists public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.annual_goals (id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Calendario y notificaciones ─────────────────────────────────
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  date date not null,
  start_time time,
  end_time time,
  type text not null default 'personal' check (type in ('personal','entrenamiento','pago','vencimiento','otro')),
  notes text,
  created_at timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time > start_time)
);
create index if not exists events_user_date on public.calendar_events (user_id, date);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ═══ Row Level Security ════════════════════════════════════════
alter table public.profiles enable row level security;
drop policy if exists "perfil propio" on public.profiles;
create policy "perfil propio" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'accounts','transactions','transaction_categories','budgets','savings_goals','debts','debt_payments',
    'projects','tasks','habits','habit_logs','workouts','workout_exercises','meal_plans','meals',
    'shopping_lists','wishlist_items','annual_goals','goal_milestones','calendar_events','notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo el dueño" on public.%I', t);
    execute format(
      'create policy "solo el dueño" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_idx', t);
  end loop;
end $$;

-- Las referencias entre tablas también deben pertenecer al mismo usuario.
create or replace function public.assert_same_owner()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'transactions' then
    if not exists (select 1 from public.accounts where id = new.account_id and user_id = new.user_id)
       or (new.to_account_id is not null and not exists (select 1 from public.accounts where id = new.to_account_id and user_id = new.user_id)) then
      raise exception 'La cuenta no pertenece al usuario';
    end if;
  elsif tg_table_name = 'tasks' and new.project_id is not null then
    if not exists (select 1 from public.projects where id = new.project_id and user_id = new.user_id) then
      raise exception 'El proyecto no pertenece al usuario';
    end if;
  elsif tg_table_name = 'habit_logs' then
    if not exists (select 1 from public.habits where id = new.habit_id and user_id = new.user_id) then
      raise exception 'El hábito no pertenece al usuario';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists transactions_owner on public.transactions;
create trigger transactions_owner before insert or update on public.transactions
  for each row execute function public.assert_same_owner();
drop trigger if exists tasks_owner on public.tasks;
create trigger tasks_owner before insert or update on public.tasks
  for each row execute function public.assert_same_owner();
drop trigger if exists habit_logs_owner on public.habit_logs;
create trigger habit_logs_owner before insert or update on public.habit_logs
  for each row execute function public.assert_same_owner();
