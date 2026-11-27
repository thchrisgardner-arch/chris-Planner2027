-- ═══════════════════════════════════════════════════════════════
-- LIFE OS 2027 · Paneles de proyectos (Fase A)
-- Ejecutar después de 0005. Se puede ejecutar más de una vez.
--
--  - calendar_events.project_id: el evento pertenece a un proyecto (si se borra el proyecto, el
--    evento queda sin proyecto; las reuniones las borra la app).
--  - calendar_events.meeting: si es una reunión, sus datos (modalidad, asistentes, agenda, notas,
--    acuerdos). La fecha y la hora siguen siendo las del evento.
--  - tasks.assignee: responsable en texto libre (p. ej. desde un acuerdo de reunión).
--  - user_state admite las claves nuevas de los paneles (documentos de notas y vistas).
-- ═══════════════════════════════════════════════════════════════

alter table public.calendar_events add column if not exists project_id uuid references public.projects (id) on delete set null;
alter table public.calendar_events add column if not exists meeting jsonb;
alter table public.calendar_events drop constraint if exists calendar_events_meeting_objeto;
alter table public.calendar_events add constraint calendar_events_meeting_objeto check (meeting is null or jsonb_typeof(meeting) = 'object');
create index if not exists calendar_events_project_idx on public.calendar_events (project_id) where project_id is not null;

alter table public.tasks add column if not exists assignee text;
alter table public.tasks drop constraint if exists tasks_assignee_largo;
alter table public.tasks add constraint tasks_assignee_largo check (assignee is null or char_length(assignee) <= 80);

-- El proyecto de un evento también debe ser del mismo usuario (como las tareas y los movimientos)
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
  elsif tg_table_name = 'calendar_events' and new.project_id is not null then
    if not exists (select 1 from public.projects where id = new.project_id and user_id = new.user_id) then
      raise exception 'El proyecto no pertenece al usuario';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists calendar_events_owner on public.calendar_events;
create trigger calendar_events_owner before insert or update on public.calendar_events
  for each row execute function public.assert_same_owner();

alter table public.user_state drop constraint if exists user_state_clave_check;
alter table public.user_state add constraint user_state_clave_check check (clave in (
  'asistentes','progreso','closet','pagos-fijos','enfoque','animo-usuario','animo-historial',
  'conexiones','salud','espacio','captura','tutorial','onboarding',
  'documentos','vistas'
));
