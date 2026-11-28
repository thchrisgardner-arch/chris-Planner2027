-- ═══════════════════════════════════════════════════════════════
-- Poku Poku · Presupuestos por categoría
-- Ejecutar después de 0011. Se puede ejecutar más de una vez.
--
--  - user_state.clave admite «presupuestos»: el tope mensual por categoría (lifeos:presupuestos)
--    se sincroniza entre dispositivos como los demás documentos.
-- ═══════════════════════════════════════════════════════════════

alter table public.user_state drop constraint if exists user_state_clave_check;
alter table public.user_state add constraint user_state_clave_check check (clave in (
  'asistentes','progreso','closet','pagos-fijos','enfoque','animo-usuario','animo-historial',
  'conexiones','salud','espacio','captura','tutorial','onboarding',
  'documentos','vistas','presupuestos'
));
