-- ═══════════════════════════════════════════════════════════════
-- LIFE OS 2027 · Fase 6.1 · Base para la sincronización entre dispositivos
-- Ejecutar en Supabase → SQL Editor (o `supabase db push`) después de 0001–0003.
-- Se puede ejecutar más de una vez sin romper nada.
--
-- Qué agrega (no cambia ni borra datos existentes):
--  1. En las 21 tablas personales y en profiles:
--       updated_at  hora del último cambio, puesta SIEMPRE por el servidor (no por el reloj del celular)
--       deleted_at  borrado suave: el borrado viaja a los otros dispositivos; se purga a los 30 días
--       client_id   qué dispositivo hizo el cambio (para no traer de vuelta lo que uno mismo subió)
--     + índice (user_id, updated_at) para pedir "lo que cambió desde la última vez".
--  2. Tabla user_state: una fila por cada almacén que hoy vive solo en el navegador
--     (asistentes, progreso, clóset…), con la misma regla «solo el dueño».
--  3. sync_purgar(): borra de verdad lo que lleva más de N días en la papelera (solo lo propio).
--
-- Nota para el motor (Fase 6.2): al pedir cambios, restar unos segundos a la última marca
-- (updated_at puede quedar levemente desordenado entre transacciones simultáneas) y descartar
-- duplicados por id + updated_at. Mientras el motor no exista, nadie marca deleted_at y la app
-- se comporta exactamente igual que antes.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Marca de tiempo del servidor ────────────────────────────
create or replace function public.sync_tocar()
returns trigger language plpgsql as $$
begin
  -- Ignora cualquier valor que mande el cliente: la hora la pone el servidor
  new.updated_at := clock_timestamp();
  return new;
end $$;

do $$
declare
  t text;
  dueno text;
begin
  foreach t in array array[
    'profiles',
    'accounts','transactions','transaction_categories','budgets','savings_goals','debts','debt_payments',
    'projects','tasks','habits','habit_logs','workouts','workout_exercises','meal_plans','meals',
    'shopping_lists','wishlist_items','annual_goals','goal_milestones','calendar_events','notifications'
  ] loop
    -- profiles usa id como dueño; el resto, user_id
    dueno := case when t = 'profiles' then 'id' else 'user_id' end;

    execute format('alter table public.%I add column if not exists updated_at timestamptz', t);
    -- Las filas que ya existían toman su fecha de creación como último cambio
    execute format('update public.%I set updated_at = created_at where updated_at is null', t);
    execute format('alter table public.%I alter column updated_at set default now()', t);
    execute format('alter table public.%I alter column updated_at set not null', t);

    execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
    execute format('alter table public.%I add column if not exists client_id text', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_client_id_largo');
    execute format('alter table public.%I add constraint %I check (client_id is null or char_length(client_id) <= 64)', t, t || '_client_id_largo');

    execute format('create index if not exists %I on public.%I (%I, updated_at)', t || '_sync_idx', t, dueno);

    execute format('drop trigger if exists %I on public.%I', t || '_sync_tocar', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.sync_tocar()', t || '_sync_tocar', t);
  end loop;
end $$;

-- ── 2. Almacenes locales (un documento por clave) ──────────────
create table if not exists public.user_state (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Solo las claves conocidas (sin el prefijo "lifeos:" del navegador)
  clave text not null check (clave in (
    'asistentes','progreso','closet','pagos-fijos','enfoque','animo-usuario','animo-historial',
    'conexiones','salud','espacio','captura','tutorial','onboarding'
  )),
  version integer not null default 1 check (version > 0),
  data jsonb not null default '{}'::jsonb,
  client_id text check (client_id is null or char_length(client_id) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, clave),
  -- Tope de 1 MB por documento: protege la cuota del plan gratuito
  constraint user_state_tamano check (pg_column_size(data) <= 1048576)
);

create index if not exists user_state_sync_idx on public.user_state (user_id, updated_at);

alter table public.user_state enable row level security;
drop policy if exists "solo el dueño" on public.user_state;
create policy "solo el dueño" on public.user_state
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Sin sesión no se ve ni se toca nada
revoke all on public.user_state from anon;

drop trigger if exists user_state_sync_tocar on public.user_state;
create trigger user_state_sync_tocar before insert or update on public.user_state
  for each row execute function public.sync_tocar();

-- ── 3. Vaciar la papelera (solo lo propio) ─────────────────────
-- Corre con los permisos de quien la llama: la RLS limita el borrado a sus propias filas.
create or replace function public.sync_purgar(dias integer default 30)
returns integer language plpgsql security invoker set search_path = public as $$
declare
  t text;
  n integer;
  total integer := 0;
begin
  if dias < 1 then
    raise exception 'dias debe ser 1 o más';
  end if;
  foreach t in array array[
    -- hijos antes que padres
    'debt_payments','habit_logs','workout_exercises','meals','shopping_lists','goal_milestones',
    'transactions','tasks','wishlist_items','budgets','savings_goals','debts','transaction_categories',
    'projects','habits','workouts','meal_plans','annual_goals','calendar_events','notifications',
    'accounts','user_state'
  ] loop
    execute format('delete from public.%I where deleted_at < now() - make_interval(days => $1)', t) using dias;
    get diagnostics n = row_count;
    total := total + n;
  end loop;
  return total;
end $$;

revoke execute on function public.sync_purgar(integer) from public, anon;
grant execute on function public.sync_purgar(integer) to authenticated;
