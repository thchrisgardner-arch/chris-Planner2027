-- ═══════════════════════════════════════════════════════════════
-- LIFE OS 2027 · Metas de ahorro con plan de aporte
-- Ejecutar después de 0009. Se puede ejecutar más de una vez.
--
--  - savings_goals.plan: { frecuencia: diaria|semanal|quincenal|mensual, monto, inicio, base }.
--    Null = sin plan (así quedan todas las metas que ya existían).
--  - savings_goals.image: imagen propia de la meta («archivo:<id>» o una URL).
-- ═══════════════════════════════════════════════════════════════

alter table public.savings_goals add column if not exists plan jsonb;
alter table public.savings_goals drop constraint if exists savings_goals_plan_objeto;
alter table public.savings_goals add constraint savings_goals_plan_objeto check (
  plan is null or (
    jsonb_typeof(plan) = 'object'
    and plan ->> 'frecuencia' in ('diaria', 'semanal', 'quincenal', 'mensual')
    and jsonb_typeof(plan -> 'monto') = 'number'
    and (plan ->> 'monto')::numeric > 0
  )
);

alter table public.savings_goals add column if not exists image text;
alter table public.savings_goals drop constraint if exists savings_goals_image_largo;
alter table public.savings_goals add constraint savings_goals_image_largo check (image is null or char_length(image) <= 2048);
