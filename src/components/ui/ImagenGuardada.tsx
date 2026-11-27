"use client";

/**
 * Imágenes que pueden estar guardadas en este dispositivo (IndexedDB, «archivo:<id>») o ser un
 * enlace normal. Las pegadas o subidas se comprimen en el navegador antes de guardarse.
 */
import { comprimir } from "@/lib/proyectos/imagenes";
import { guardarArchivo } from "@/lib/proyectos/espacio";
import { useArchivoUrl } from "@/modules/proyectos/Imagenes";

export const PREFIJO_ARCHIVO = "archivo:";

/** URL que se puede mostrar para un valor «archivo:<id>» o un enlace */
export function useImagenGuardada(valor: string | null | undefined): string | null {
  const id = valor?.startsWith(PREFIJO_ARCHIVO) ? valor.slice(PREFIJO_ARCHIVO.length) : null;
  const local = useArchivoUrl(id);
  return id ? local : (valor ?? null);
}

export function ImagenGuardada({ src, ...props }: Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string | null | undefined }) {
  const url = useImagenGuardada(src);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img src={url} {...props} />;
}

/** Comprime y guarda una imagen pegada o subida; devuelve el valor «archivo:<id>» */
export async function guardarImagenLocal(file: File, prefijo = "img"): Promise<string> {
  const { blob } = await comprimir(file);
  const id = `${prefijo}-${Date.now().toString(36)}`;
  await guardarArchivo(id, blob);
  return `${PREFIJO_ARCHIVO}${id}`;
}

/** Lee una imagen del portapapeles (botón «Pegar»; Ctrl+V usa el evento paste) */
export async function imagenDelPortapapeles(): Promise<File | null> {
  for (const item of await navigator.clipboard.read()) {
    const tipo = item.types.find((t) => t.startsWith("image/"));
    if (tipo) return new File([await item.getType(tipo)], "pegada", { type: tipo });
  }
  return null;
}
