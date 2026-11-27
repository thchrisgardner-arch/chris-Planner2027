-- ═══════════════════════════════════════════════════════════════
-- LIFE OS 2027 · Fase 6.5 · Archivos del espacio de proyectos (audios e imágenes)
-- Ejecutar después de 0004. Se puede ejecutar más de una vez.
--
-- Bucket privado `archivos`: cada usuario solo ve y toca su carpeta (`<uid>/<id del archivo>`).
-- Tope de 10 MB por archivo. La app solo sube archivos si la persona activa
-- «Incluir audios e imágenes de tus proyectos» en la sincronización.
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit)
values ('archivos', 'archivos', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

drop policy if exists "archivos: ver los propios" on storage.objects;
create policy "archivos: ver los propios" on storage.objects
  for select to authenticated
  using (bucket_id = 'archivos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "archivos: subir a su carpeta" on storage.objects;
create policy "archivos: subir a su carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'archivos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "archivos: reemplazar los propios" on storage.objects;
create policy "archivos: reemplazar los propios" on storage.objects
  for update to authenticated
  using (bucket_id = 'archivos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'archivos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "archivos: borrar los propios" on storage.objects;
create policy "archivos: borrar los propios" on storage.objects
  for delete to authenticated
  using (bucket_id = 'archivos' and (storage.foldername(name))[1] = auth.uid()::text);
