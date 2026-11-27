-- ═══════════════════════════════════════════════════════════════
-- LIFE OS 2027 · Orden manual de las tareas
-- Ejecutar después de 0008. Se puede ejecutar más de una vez.
--
--  - tasks.sort_order: orden entre hermanas (mismo usuario, proyecto y tarea madre).
--  - Las tareas que ya existían se numeran en el orden en que se veían (creación).
-- ═══════════════════════════════════════════════════════════════

alter table public.tasks add column if not exists sort_order double precision;

with numeradas as (
  select id, row_number() over (partition by user_id, project_id, parent_task_id order by created_at, id) * 1024 as orden
  from public.tasks
  where sort_order is null
)
update public.tasks t
   set sort_order = n.orden
  from numeradas n
 where t.id = n.id and t.sort_order is null;

create index if not exists tasks_orden_idx on public.tasks (user_id, project_id, parent_task_id, sort_order);
