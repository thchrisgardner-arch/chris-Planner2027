/**
 * Fase 6.5 (opcional, apagado por defecto): audios e imágenes del espacio de proyectos en el
 * bucket privado `archivos` de Supabase Storage, en la carpeta del usuario (`<uid>/<id>`).
 * Se suben los que faltan (hasta 10 MB cada uno), se bajan los que este dispositivo no tiene y se
 * quitan de la nube los que ya no usa ninguna nota. Corre después de traer los documentos, así el
 * espacio de proyectos ya está al día.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { guardarArchivo, leerArchivo, leerEspacio } from "@/lib/proyectos/espacio";
import { BUCKET } from "./supabase";

export const MAX_ARCHIVO = 10 * 1024 * 1024;

export async function sincronizarArchivos(sb: SupabaseClient, uid: string, subidosAntes: string[]): Promise<{ subidos: string[]; grandes: number }> {
  const e = leerEspacio();
  const ids = new Set([...e.voz, ...e.imagenes].map((x) => x.id));
  const subidos = new Set(subidosAntes);
  let grandes = 0;
  const carpeta = sb.storage.from(BUCKET);

  for (const id of ids) {
    const blob = await leerArchivo(id);
    if (blob) {
      if (subidos.has(id)) continue;
      if (blob.size > MAX_ARCHIVO) {
        grandes += 1;
        continue;
      }
      const { error } = await carpeta.upload(`${uid}/${id}`, blob, { upsert: true, contentType: blob.type || "application/octet-stream" });
      if (error) throw new Error(error.message);
      subidos.add(id);
    } else {
      // Lo grabaron en otro dispositivo
      const { data, error } = await carpeta.download(`${uid}/${id}`);
      if (!error && data) {
        await guardarArchivo(id, data);
        subidos.add(id);
      }
    }
  }
  // Ya no los usa ninguna nota: fuera de la nube
  const sobran = [...subidos].filter((id) => !ids.has(id));
  if (sobran.length) {
    const { error } = await carpeta.remove(sobran.map((id) => `${uid}/${id}`));
    if (!error) for (const id of sobran) subidos.delete(id);
  }
  return { subidos: [...subidos], grandes };
}
