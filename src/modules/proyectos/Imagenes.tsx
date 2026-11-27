"use client";

/**
 * Panel Imágenes del proyecto (Fase C): subir desde archivo o cámara, arrastrar o pegar; se comprimen
 * en el navegador (2.000 px, WebP o JPEG) y se guardan en IndexedDB, no en localStorage.
 * Galería con orden manual (arrastrar o «Mover»), descripción, vista grande con anterior y siguiente,
 * portada, y adjuntar a una tarea o a un gasto (p. ej. una factura): queda vinculada en los dos lados.
 */
import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Paperclip, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { registrarNuevo } from "@/lib/atajoNuevo";
import { espacio, guardarArchivo, leerArchivo, nuevoId, useEspacio, type ImagenProyecto, type VinculoImagen } from "@/lib/proyectos/espacio";
import { comprimir, espacioNavegador, formatoBytes, pedirPersistencia } from "@/lib/proyectos/imagenes";
import { formatCOP } from "@/utils/money";
import { cn } from "@/utils/cn";

const urls = new Map<string, string>();
const TIPO_ARRASTRE = "application/x-lifeos-imagen";

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

export function useSubirImagenes(proyectoId: string) {
  const { toast } = useFeedback();
  return async (files: FileList | File[]) => {
    const lista = [...files].filter((f) => f.type.startsWith("image/"));
    if (!lista.length) return;
    void pedirPersistencia();
    let ok = 0;
    let antes = 0;
    let despues = 0;
    for (const f of lista) {
      try {
        const { blob, ancho, alto, original } = await comprimir(f);
        const id = nuevoId("img");
        await guardarArchivo(id, blob);
        espacio.agregarImagen({ id, proyectoId, nombre: f.name || "Imagen", ancho, alto, creada: new Date().toISOString(), bytes: blob.size, original });
        antes += original;
        despues += blob.size;
        ok++;
      } catch {
        toast(`No se pudo agregar ${f.name}.`, "error");
      }
    }
    if (!ok) return;
    const ahorro = antes > despues ? ` (de ${formatoBytes(antes)} a ${formatoBytes(despues)})` : "";
    toast(ok === 1 ? `Imagen agregada${ahorro}` : `${ok} imágenes agregadas${ahorro}`);
  };
}

const esTactil = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

function Miniatura({
  img,
  onAbrir,
  portada,
  onSoltar,
}: {
  img: ImagenProyecto;
  onAbrir: () => void;
  portada: boolean;
  onSoltar: (id: string) => void;
}) {
  const url = useArchivoUrl(img.id);
  const [sobre, setSobre] = useState(false);
  const adjuntos = img.vinculos?.length ?? 0;
  return (
    <figure
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(TIPO_ARRASTRE, img.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(TIPO_ARRASTRE)) return;
        e.preventDefault();
        e.stopPropagation();
        setSobre(true);
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        const id = e.dataTransfer.getData(TIPO_ARRASTRE);
        if (!id) return;
        e.preventDefault();
        e.stopPropagation();
        setSobre(false);
        onSoltar(id);
      }}
      className="min-w-0"
    >
      <button
        type="button"
        onClick={onAbrir}
        className={cn("focus-ring group relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-[16px] bg-bg-2", sobre && "ring-2 ring-fg")}
        aria-label={`Ver ${img.descripcion || img.nombre}`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
        ) : null}
        {portada ? <span className="absolute left-2 top-2 rounded-full bg-bg/90 px-2 py-0.5 text-[11px] font-medium">Portada</span> : null}
        {adjuntos ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-bg/90 px-2 py-0.5 text-[11px] font-medium">
            <Paperclip size={11} aria-hidden /> {adjuntos}
            <span className="sr-only">{adjuntos === 1 ? "adjunto" : "adjuntos"}</span>
          </span>
        ) : null}
      </button>
      {img.descripcion ? <figcaption className="mt-1 truncate px-1 text-[12px] text-muted">{img.descripcion}</figcaption> : null}
    </figure>
  );
}

export function Imagenes({ proyectoId }: { proyectoId: string }) {
  const e = useEspacio();
  const { mode } = useData();
  const subir = useSubirImagenes(proyectoId);
  const input = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [navegador, setNavegador] = useState<Awaited<ReturnType<typeof espacioNavegador>>>(null);
  const [tactil, setTactil] = useState(false);
  const imgs = e.imagenes.filter((i) => i.proyectoId === proyectoId);
  const portada = e.portadas[proyectoId];
  const peso = imgs.reduce((n, i) => n + (i.bytes ?? 0), 0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capacidad del dispositivo, solo en el navegador
    setTactil(esTactil());
  }, []);
  useEffect(() => {
    void espacioNavegador().then(setNavegador);
  }, [imgs.length]);
  useEffect(() => registrarNuevo(() => input.current?.click()), []);

  // Pegar imágenes desde el portapapeles en cualquier parte de la página del proyecto
  useEffect(() => {
    const onPaste = (ev: ClipboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
      const files = [...(ev.clipboardData?.files ?? [])];
      if (files.length) void subir(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [subir]);

  /** Suelta la imagen `id` en la posición de `destino` */
  const mover = (id: string, destino: number) => {
    const ids = imgs.map((i) => i.id).filter((x) => x !== id);
    ids.splice(Math.max(0, Math.min(destino, ids.length)), 0, id);
    espacio.ordenarImagenes(proyectoId, ids);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" onClick={() => input.current?.click()} title="Subir imágenes (N)">
          <ImagePlus size={16} /> Subir imágenes
        </Button>
        {tactil ? (
          <Button size="sm" variant="secondary" className="bg-bg-2" onClick={() => camara.current?.click()}>
            <Camera size={16} /> Tomar foto
          </Button>
        ) : null}
        <p className="ml-auto text-[12.5px] text-muted" aria-live="polite">
          {imgs.length ? `${imgs.length} ${imgs.length === 1 ? "imagen" : "imágenes"} · ${formatoBytes(peso)}` : "Sin imágenes"}
          {navegador?.cuota && mode !== "demo" ? ` · Esta app usa ${formatoBytes(navegador.usado)} de ${formatoBytes(navegador.cuota)} disponibles en el navegador` : ""}
        </p>
      </div>
      <div
        onDragOver={(ev) => {
          if (!ev.dataTransfer.types.includes("Files")) return;
          ev.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(ev) => {
          if (!ev.dataTransfer.files.length) return;
          ev.preventDefault();
          setArrastrando(false);
          void subir(ev.dataTransfer.files);
        }}
        className={cn("grid grid-cols-2 gap-2 rounded-[20px] transition-colors sm:grid-cols-3 lg:grid-cols-4", arrastrando && "bg-[color-mix(in_oklab,var(--color-brand)_18%,transparent)] p-2")}
      >
        {imgs.map((img, i) => (
          <Miniatura key={img.id} img={img} portada={portada === img.id} onAbrir={() => setAbierta(i)} onSoltar={(id) => mover(id, i)} />
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
      <input
        ref={camara}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(ev) => {
          if (ev.target.files) void subir(ev.target.files);
          ev.target.value = "";
        }}
      />
      {abierta !== null && imgs[abierta] ? (
        <VistaGrande imgs={imgs} i={abierta} portada={portada} proyectoId={proyectoId} onCambiar={setAbierta} onCerrar={() => setAbierta(null)} onMover={(id, a) => (mover(id, a), setAbierta(a))} />
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
  onMover,
}: {
  imgs: ImagenProyecto[];
  i: number;
  portada?: string;
  proyectoId: string;
  onCambiar: (i: number) => void;
  onCerrar: () => void;
  onMover: (id: string, destino: number) => void;
}) {
  const { db } = useData();
  const { confirm, toast } = useFeedback();
  const img = imgs[i];
  const url = useArchivoUrl(img.id);
  const [descripcion, setDescripcion] = useState(img.descripcion ?? "");
  const cerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- al pasar a otra imagen se muestra su descripción
    setDescripcion(imgs[i]?.descripcion ?? "");
  }, [i, imgs]);
  useEffect(() => cerrarRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (ev.key === "Escape") onCerrar();
      if (ev.key === "ArrowRight" && i < imgs.length - 1) onCambiar(i + 1);
      if (ev.key === "ArrowLeft" && i > 0) onCambiar(i - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [i, imgs.length, onCambiar, onCerrar]);

  const esPortada = portada === img.id;
  const tareas = db.tasks.filter((t) => t.project_id === proyectoId);
  const gastos = db.transactions
    .filter((t) => t.type === "gasto")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40);
  const vinculos = (img.vinculos ?? [])
    .map((v) => ({ v, nombre: v.tabla === "tasks" ? db.tasks.find((t) => t.id === v.id)?.name : (() => { const g = db.transactions.find((t) => t.id === v.id); return g ? `${g.description} · ${formatCOP(g.amount)}` : undefined; })() }))
    .filter((x): x is { v: VinculoImagen; nombre: string } => !!x.nombre);

  const borrar = async () => {
    if (!(await confirm({ title: "¿Eliminar esta imagen?", description: vinculos.length ? "También se quita de lo que la tenía adjunta." : undefined, confirmLabel: "Eliminar", destructive: true }))) return;
    await espacio.borrarImagen(img.id);
    if (imgs.length <= 1) onCerrar();
    else onCambiar(Math.max(0, i - 1));
  };
  const adjuntar = (valor: string) => {
    const [tabla, id] = valor.split(":") as ["tasks" | "transactions", string];
    if (!id) return;
    espacio.vincularImagen(img.id, { tabla, id });
    toast(tabla === "tasks" ? "Imagen adjunta a la tarea" : "Imagen adjunta al gasto");
  };

  return createPortal(
    <div className="fixed inset-0 z-[95] flex flex-col bg-black/85 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={img.descripcion || img.nombre}>
      <div className="flex flex-wrap items-center gap-2 text-white">
        <p className="min-w-0 flex-1 truncate text-[14px]">
          {img.nombre} <span className="num text-white/60">· {i + 1} de {imgs.length}</span>
          {img.bytes ? <span className="num text-white/60"> · {formatoBytes(img.bytes)}{img.original && img.original > img.bytes ? ` (original ${formatoBytes(img.original)})` : ""}</span> : null}
        </p>
        <Button variant="secondary" size="sm" disabled={i === 0} onClick={() => onMover(img.id, i - 1)} aria-label="Mover antes">
          <ChevronLeft size={15} /> Mover
        </Button>
        <Button variant="secondary" size="sm" disabled={i === imgs.length - 1} onClick={() => onMover(img.id, i + 1)} aria-label="Mover después">
          Mover <ChevronRight size={15} />
        </Button>
        <Button variant="secondary" size="sm" onClick={() => espacio.ponerPortada(proyectoId, esPortada ? null : img.id)}>
          {esPortada ? "Quitar portada" : "Usar como portada"}
        </Button>
        <Button variant="secondary" size="icon-sm" aria-label="Eliminar imagen" onClick={borrar}>
          <Trash2 size={16} />
        </Button>
        <Button ref={cerrarRef} variant="secondary" size="icon-sm" aria-label="Cerrar" onClick={onCerrar}>
          <X size={17} />
        </Button>
      </div>
      <div className="relative mt-3 flex min-h-0 flex-1 items-center justify-center" onClick={onCerrar}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={img.descripcion || img.nombre} className="max-h-full max-w-full rounded-[12px] object-contain" onClick={(ev) => ev.stopPropagation()} />
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
      {/* Descripción y adjuntos */}
      <div className="mx-auto mt-3 grid w-full max-w-[860px] gap-2 rounded-[20px] bg-bg p-3 text-fg sm:grid-cols-2">
        <input
          value={descripcion}
          onChange={(ev) => setDescripcion(ev.target.value)}
          onBlur={() => descripcion.trim() !== (img.descripcion ?? "") && espacio.actualizarImagen(img.id, { descripcion: descripcion.trim() || undefined })}
          onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
          placeholder="Agrega una descripción"
          aria-label="Descripción de la imagen"
          maxLength={160}
          className="focus-ring h-11 min-w-0 rounded-full bg-bg-2 px-4 text-[14px] outline-none placeholder:text-dim"
        />
        <Select aria-label="Adjuntar a una tarea o a un gasto" value="" onChange={(ev) => adjuntar(ev.target.value)}>
          {[
            <option key="" value="">
              Adjuntar a…
            </option>,
            // Lista plana: el Select de la app no lee <optgroup>
            ...tareas.map((t) => (
              <option key={t.id} value={`tasks:${t.id}`}>
                {`Tarea: ${t.name}`}
              </option>
            )),
            ...gastos.map((g) => (
              <option key={g.id} value={`transactions:${g.id}`}>
                {`Gasto: ${g.description} · ${formatCOP(g.amount)} · ${g.date}`}
              </option>
            )),
          ]}
        </Select>
        {vinculos.length ? (
          <ul className="flex flex-wrap gap-1.5 sm:col-span-2" aria-label="Adjunta a">
            {vinculos.map(({ v, nombre }) => (
              <li key={`${v.tabla}:${v.id}`} className="inline-flex max-w-full items-center gap-1 rounded-full bg-bg-2 py-1 pl-3 pr-1 text-[12.5px]">
                <Paperclip size={12} aria-hidden />
                <span className="truncate">
                  {v.tabla === "tasks" ? "Tarea" : "Gasto"}: {nombre}
                </span>
                <button
                  type="button"
                  onClick={() => espacio.desvincularImagen(img.id, v)}
                  aria-label={`Quitar de ${nombre}`}
                  className="focus-ring grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-elev"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

/** Modo demo: tres bocetos dibujados en el navegador (sin descargar nada), uno adjunto a una tarea */
export async function crearImagenesEjemplo(proyectoId: string, tareaId?: string) {
  const bocetos = [
    { nombre: "Boceto portada.webp", descripcion: "Boceto de la portada", colores: ["#c9b8ff", "#5ce65c"] },
    { nombre: "Paleta.webp", descripcion: "Paleta lila y negro", colores: ["#0a0a0a", "#c9b8ff"] },
    { nombre: "Casos de estudio.webp", descripcion: "Referencias de casos de estudio", colores: ["#ffd84d", "#f2f2f2"] },
  ];
  for (const [k, b] of bocetos.entries()) {
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 900;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 1200, 900);
    grad.addColorStop(0, b.colores[0]);
    grad.addColorStop(1, b.colores[1]);
    g.fillStyle = grad;
    g.fillRect(0, 0, 1200, 900);
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.fillRect(120, 140, 560, 64);
    g.fillRect(120, 240, 380, 40);
    g.fillRect(120, 620, 960, 160);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/webp", 0.82));
    if (!blob) continue;
    const id = nuevoId("img");
    await guardarArchivo(id, blob);
    espacio.agregarImagen({
      id,
      proyectoId,
      nombre: b.nombre,
      descripcion: b.descripcion,
      ancho: 1200,
      alto: 900,
      creada: new Date(Date.now() - k * 60_000).toISOString(),
      bytes: blob.size,
      original: blob.size,
      ...(k === 2 && tareaId ? { vinculos: [{ tabla: "tasks" as const, id: tareaId }] } : {}),
    });
  }
}

/** En el formulario de una tarea o de un gasto: las imágenes que tiene adjuntas */
export function AdjuntosRegistro({ tabla, id }: { tabla: VinculoImagen["tabla"]; id: string }) {
  const e = useEspacio();
  const imgs = e.imagenes.filter((i) => i.vinculos?.some((v) => v.tabla === tabla && v.id === id));
  if (!imgs.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium">Imágenes adjuntas</p>
      <ul className="flex flex-wrap gap-2">
        {imgs.map((img) => (
          <li key={img.id}>
            <Adjunto img={img} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Adjunto({ img }: { img: ImagenProyecto }) {
  const url = useArchivoUrl(img.id);
  return (
    <a href={url ?? undefined} target="_blank" rel="noreferrer" className="focus-ring block h-16 w-20 overflow-hidden rounded-[12px] bg-bg-2" aria-label={`Abrir ${img.descripcion || img.nombre}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : null}
    </a>
  );
}
