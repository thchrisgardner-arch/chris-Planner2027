/**
 * Imágenes de proyectos (Paneles, Fase C): compresión en el navegador antes de guardar en IndexedDB.
 *  - Lado mayor hasta 2.000 px.
 *  - WebP al 82 % si el navegador sabe crearlo; si no, JPEG al 82 %.
 *  - Si comprimir no ahorra (p. ej. una foto ya liviana), se guarda el archivo original.
 * Nada sale del dispositivo: el archivo se procesa en un <canvas> local.
 */

export const LADO_MAXIMO = 2000;
const CALIDAD = 0.82;

export function medidasReducidas(ancho: number, alto: number, max = LADO_MAXIMO): { ancho: number; alto: number } {
  const escala = Math.min(1, max / Math.max(ancho, alto));
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}

/** 1536 → «1,5 KB»; 2_400_000 → «2,3 MB» */
export function formatoBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toLocaleString("es-CO", { maximumFractionDigits: kb < 10 ? 1 : 0 })} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB`;
  return `${(mb / 1024).toLocaleString("es-CO", { maximumFractionDigits: 1 })} GB`;
}

/** ¿Vale la pena guardar la versión comprimida? (si no, se guarda el original) */
export const conviene = (comprimida: number, original: number, redimensionada: boolean) => redimensionada || comprimida < original * 0.95;

export async function comprimir(file: File): Promise<{ blob: Blob; ancho: number; alto: number; original: number }> {
  const bmp = await createImageBitmap(file);
  const { ancho, alto } = medidasReducidas(bmp.width, bmp.height);
  const redimensionada = ancho !== bmp.width;
  const c = document.createElement("canvas");
  c.width = ancho;
  c.height = alto;
  c.getContext("2d")!.drawImage(bmp, 0, 0, ancho, alto);
  bmp.close?.();
  const crear = (tipo: string) => new Promise<Blob | null>((res) => c.toBlob(res, tipo, CALIDAD));
  // Safari viejo no crea WebP: toBlob devuelve PNG; entonces JPEG
  let blob = await crear("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await crear("image/jpeg");
  if (!blob) throw new Error("No se pudo procesar la imagen");
  if (!conviene(blob.size, file.size, redimensionada)) return { blob: file, ancho, alto, original: file.size };
  return { blob, ancho, alto, original: file.size };
}

/** Espacio usado y disponible para esta app en el navegador (aproximado) */
export async function espacioNavegador(): Promise<{ usado: number; cuota: number; persistente: boolean } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  const persistente = (await navigator.storage.persisted?.()) ?? false;
  return { usado: e.usage ?? 0, cuota: e.quota ?? 0, persistente };
}

/** Pide al navegador que no borre los datos de la app cuando le falte espacio (una vez) */
export async function pedirPersistencia(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  if (await navigator.storage.persisted?.()) return true;
  return navigator.storage.persist();
}
