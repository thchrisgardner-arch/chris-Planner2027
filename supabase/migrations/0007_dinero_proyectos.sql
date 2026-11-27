-- ═══════════════════════════════════════════════════════════════
-- LIFE OS 2027 · Dinero del proyecto (presupuesto, gastos e ingresos por proyecto)
-- Ejecutar después de 0006. Se puede ejecutar más de una vez.
--
--  - transactions.project_id: el movimiento (el MISMO de Finanzas) es de un proyecto. Si se borra el
--    proyecto, el movimiento queda en Finanzas sin proyecto: nunca se borra.
--  - projects.money: presupuesto informativo ({ monto, periodo: total | mensual }), si genera
--    ingresos, porcentajes de aviso y la meta de ahorro vinculada. No separa ni bloquea dinero.
--  - El presupuesto estimado de siempre (projects.budget) pasa a money.presupuesto (total).
-- ═══════════════════════════════════════════════════════════════

alter table public.transactions add column if not exists project_id uuid references public.projects (id) on delete set null;
create index if not exists transactions_project_idx on public.transactions (project_id) where project_id is not null;

alter table public.projects add column if not exists money jsonb;
alter table public.projects drop constraint if exists projects_money_objeto;
alter table public.projects add constraint projects_money_objeto check (
  money is null or (
    jsonb_typeof(money) = 'object'
    and (money -> 'presupuesto' is null or jsonb_typeof(money -> 'presupuesto') = 'null' or (
      jsonb_typeof(money -> 'presupuesto') = 'object'
      and jsonb_typeof(money -> 'presupuesto' -> 'monto') = 'number'
      and (money -> 'presupuesto' ->> 'monto')::numeric >= 0
      and money -> 'presupuesto' ->> 'periodo' in ('total', 'mensual')
    ))
    and (money -> 'alertas' is null or jsonb_typeof(money -> 'alertas') = 'array')
  )
);

-- Migración de datos: el presupuesto estimado pasa a money (solo donde aún no hay money)
update public.projects
   set money = jsonb_build_object(
     'presupuesto', jsonb_build_object('monto', budget, 'periodo', 'total'),
     'generaIngresos', false,
     'alertas', jsonb_build_array(80, 100)
   )
 where money is null and budget is not null and budget > 0;

-- El proyecto de un movimiento también debe ser del mismo usuario
create or replace function public.assert_same_owner()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'transactions' then
    if not exists (select 1 from public.accounts where id = new.account_id and user_id = new.user_id)
       or (new.to_account_id is not null and not exists (select 1 from public.accounts where id = new.to_account_id and user_id = new.user_id)) then
      raise exception 'La cuenta no pertenece al usuario';
    end if;
    if new.project_id is not null and not exists (select 1 from public.projects where id = new.project_id and user_id = new.user_id) then
      raise exception 'El proyecto no pertenece al usuario';
    end if;
  elsif tg_table_name = 'tasks' and new.project_id is not null then
    if not exists (select 1 from public.projects where id = new.project_id and user_id = new.user_id) then
      raise exception 'El proyecto no pertenece al usuario';
    end if;
  elsif tg_table_name = 'habit_logs' then
    if not exists (select 1 from public.habits where id = new.habit_id and user_id = new.user_id) then
      raise exception 'El hábito no pertenece al usuario';
    end if;
  elsif tg_table_name = 'calendar_events' and new.project_id is not null then
    if not exists (select 1 from public.projects where id = new.project_id and user_id = new.user_id) then
      raise exception 'El proyecto no pertenece al usuario';
    end if;
  end if;
  return new;
end $$;
