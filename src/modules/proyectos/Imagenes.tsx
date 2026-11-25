"use client";

/**
 * Imágenes del proyecto: subir, arrastrar o pegar; galería alineada; vista grande con anterior y
 * siguiente; usar como portada. Se reducen a 1600 px para no llenar el almacenamiento.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { espacio, guardarArchivo, leerArchivo, nuevoId, useEspacio, type ImagenProyecto } from "@/lib/proyectos/espacio";
import { cn } from "@/utils/cn";

const urls = new Map<string, string>();

/** URL de un archivo guardado (se crea una sola vez por archivo) */
export function useArchivoUrl(id: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(id ? (urls.get(id) ?? null) : null);
  useEffect(() => {
    if (!id) return;
    if (urls.has(id)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(urls.get(id)!);
      return;
    }
    let vivo = true;
    void leerArchivo(id).then((b) => {
      if (!b || !vivo) return;
      const u = URL.createObjectURL(b);
      urls.set(id, u);
      setUrl(u);
    });
    return () => {
      vivo = false;
    };
  }, [id]);
  return url;
}

async function reducir(file: File): Promise<{ blob: Blob; ancho: number; alto: number }> {
  const bmp = await createImageBitmap(file);
  const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala);
  const h = Math.round(bmp.height * escala);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  const tipo = file.type === "image/png" && escala === 1 ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo procesar"))), tipo, 0.86));
  return { blob, ancho: w, alto: h };
}

export function useSubirImagenes(proyectoId: string) {
  const { toast } = useFeedback();
  return async (files: FileList | File[]) => {
    const lista = [...files].filter((f) => f.type.startsWith("image/"));
    if (!lista.length) return;
    let ok = 0;
    for (const f of lista) {
      try {
        const { blob, ancho, alto } = await reducir(f);
        const id = nuevoId("img");
        await guardarArchivo(id, blob);
        espacio.agregarImagen({ id, proyectoId, nombre: f.name || "Imagen", ancho, alto, creada: new Date().toISOString() });
        ok++;
      } catch {
        toast(`No se pudo agregar ${f.name}.`, "error");
      }
    }
    if (ok) toast(ok === 1 ? "Imagen agregada" : `${ok} imágenes agregadas`);
  };
}

function Miniatura({ img, onAbrir, portada }: { img: ImagenProyecto; onAbrir: () => void; portada: boolean }) {
  const url = useArchivoUrl(img.id);
  return (
    <button type="button" onClick={onAbrir} className="focus-ring group relative aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-[16px] bg-bg-2" aria-label={`Ver ${img.nombre}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      ) : null}
      {portada ? <span className="absolute left-2 top-2 rounded-full bg-bg/90 px-2 py-0.5 text-[11px] font-medium">Portada</span> : null}
    </button>
  );
}

export function Imagenes({ proyectoId }: { proyectoId: string }) {
  const e = useEspacio();
  const subir = useSubirImagenes(proyectoId);
  const input = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);
  const imgs = e.imagenes.filter((i) => i.proyectoId === proyectoId);
  const portada = e.portadas[proyectoId];

  // Pegar imágenes desde el portapapeles en cualquier parte de la página del proyecto
  useEffect(() => {
    const onPaste = (ev: ClipboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
      const files = [...(ev.clipboardData?.files ?? [])];
      if (files.length) void subir(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [subir]);

  return (
    <div>
      <div
        onDragOver={(ev) => {
          ev.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(ev) => {
          ev.preventDefault();
          setArrastrando(false);
          void subir(ev.dataTransfer.files);
        }}
        className={cn("grid grid-cols-2 gap-2 rounded-[20px] transition-colors sm:grid-cols-3", arrastrando && "bg-[color-mix(in_oklab,var(--color-brand)_18%,transparent)] p-2")}
      >
        {imgs.map((img, i) => (
          <Miniatura key={img.id} img={img} portada={portada === img.id} onAbrir={() => setAbierta(i)} />
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="focus-ring flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[16px] border-2 border-dashed border-line-strong text-muted hover:border-[var(--color-fg)] hover:text-fg"
        >
          <ImagePlus size={22} />
          <span className="text-[12.5px] font-medium">Agregar imágenes</span>
          <span className="hidden text-[11px] text-dim sm:block">o arrástralas / pégalas</span>
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(ev) => {
          if (ev.target.files) void subir(ev.target.files);
          ev.target.value = "";
        }}
      />
      {abierta !== null && imgs[abierta] ? (
        <VistaGrande imgs={imgs} i={abierta} portada={portada} proyectoId={proyectoId} onCambiar={setAbierta} onCerrar={() => setAbierta(null)} />
      ) : null}
    </div>
  );
}

function VistaGrande({
  imgs,
  i,
  portada,
  proyectoId,
  onCambiar,
  onCerrar,
}: {
  imgs: ImagenProyecto[];
  i: number;
  portada?: string;
  proyectoId: string;
  onCambiar: (i: number) => void;
  onCerrar: () => void;
}) {
  const { confirm } = useFeedback();
  const img = imgs[i];
  const url = useArchivoUrl(img.id);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onCerrar();
      if (ev.key === "ArrowRight" && i < imgs.length - 1) onCambiar(i + 1);
      if (ev.key === "ArrowLeft" && i > 0) onCambiar(i - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [i, imgs.length, onCambiar, onCerrar]);
  const esPortada = portada === img.id;
  const borrar = async () => {
    if (!(await confirm({ title: "¿Eliminar esta imagen?", confirmLabel: "Eliminar", destructive: true }))) return;
    await espacio.borrarImagen(img.id);
    if (imgs.length <= 1) onCerrar();
    else onCambiar(Math.max(0, i - 1));
  };
  return createPortal(
    <div className="fixed inset-0 z-[95] flex flex-col bg-black/85 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={img.nombre}>
      <div className="flex items-center gap-2 text-white">
        <p className="min-w-0 flex-1 truncate text-[14px]">
          {img.nombre} <span className="num text-white/60">· {i + 1} de {imgs.length}</span>
        </p>
        <Button variant="secondary" size="sm" onClick={() => espacio.ponerPortada(proyectoId, esPortada ? null : img.id)}>
          {esPortada ? "Quitar portada" : "Usar como portada"}
        </Button>
        <Button variant="secondary" size="icon-sm" aria-label="Eliminar imagen" onClick={borrar}>
          <Trash2 size={16} />
        </Button>
        <Button variant="secondary" size="icon-sm" aria-label="Cerrar" onClick={onCerrar}>
          <X size={17} />
        </Button>
      </div>
      <div className="relative mt-3 flex min-h-0 flex-1 items-center justify-center" onClick={onCerrar}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={img.nombre} className="max-h-full max-w-full rounded-[12px] object-contain" onClick={(ev) => ev.stopPropagation()} />
        ) : null}
        {i > 0 ? (
          <button type="button" aria-label="Anterior" onClick={(ev) => (ev.stopPropagation(), onCambiar(i - 1))} className="absolute left-0 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-white/90 text-black">
            <ChevronLeft size={22} />
          </button>
        ) : null}
        {i < imgs.length - 1 ? (
          <button type="button" aria-label="Siguiente" onClick={(ev) => (ev.stopPropagation(), onCambiar(i + 1))} className="absolute right-0 grid h-11 w-11 cursor-pointer place-items-center rounded-full bg-white/90 text-black">
            <ChevronRight size={22} />
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
