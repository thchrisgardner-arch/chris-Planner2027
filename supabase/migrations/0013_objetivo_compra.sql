-- ═══════════════════════════════════════════════════════════════
-- Poku Poku · Objetivos que son una compra de contado
-- Ejecutar después de 0012. Se puede ejecutar más de una vez.
--
--  - annual_goals.savings_goal_id: la meta de ahorro de la compra (precio, lo ahorrado y la cuota
--    como plan de aporte). Si se borra la meta, el objetivo queda como objetivo normal.
-- ═══════════════════════════════════════════════════════════════

alter table public.annual_goals add column if not exists savings_goal_id uuid references public.savings_goals (id) on delete set null;
create index if not exists annual_goals_savings_goal_idx on public.annual_goals (savings_goal_id);
