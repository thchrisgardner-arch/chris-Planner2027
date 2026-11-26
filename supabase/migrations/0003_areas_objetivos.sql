-- Más áreas para los objetivos anuales (vehículo, viajes, hogar, familia, negocio, mascotas, espiritualidad).
-- Solo amplía la lista permitida: los objetivos existentes no cambian.
alter table public.annual_goals drop constraint if exists annual_goals_area_check;
alter table public.annual_goals add constraint annual_goals_area_check check (
  area in (
    'finanzas','profesional','salud','personal','aprendizaje','experiencias',
    'vehiculo','viajes','hogar','familia','negocio','mascotas','espiritualidad'
  )
);
