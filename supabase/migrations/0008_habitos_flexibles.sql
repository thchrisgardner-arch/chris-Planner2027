-- ═══════════════════════════════════════════════════════════════
-- LIFE OS 2027 · Hábitos con frecuencia flexible («X veces por semana»)
-- Ejecutar después de 0007. Se puede ejecutar más de una vez.
--
--  - habits.weekly_target: cuántas veces por semana (1 a 7). Null = días fijos (`days`), que es
--    como quedan todos los hábitos que ya existían.
-- ═══════════════════════════════════════════════════════════════

alter table public.habits add column if not exists weekly_target smallint;
alter table public.habits drop constraint if exists habits_weekly_target_rango;
alter table public.habits add constraint habits_weekly_target_rango check (weekly_target is null or weekly_target between 1 and 7);
