"use client";

/**
 * Notas de voz del proyecto: grabadora con onda en vivo y transcripción mientras hablas, y
 * reproductor con onda que se llena al avanzar, transcripción con marcas de tiempo y destacados
 * (fechas, montos, acciones) que se pueden convertir en tareas.
 */
import { useEffect, useRef, useState } from "react";
import { CalendarClock, Check, ChevronDown, Download, FileText, ListPlus, Mic, MoreHorizontal, Pause, Play, Sparkles, Square, Trash2, X } from "lucide-react";
import { Popover } from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { ETIQUETA_DESTACADO, destacados, espacio, guardarArchivo, leerArchivo, nuevoId, tituloVoz, type NotaVoz, type SegmentoVoz } from "@/lib/proyectos/espacio";
import { compartirODescargar, extensionAudio, nombreBase, transcripcionTxt } from "@/lib/proyectos/exportarVoz";
import { interpretarAcuerdo } from "@/lib/proyectos/acuerdos";
import { useToday } from "@/hooks/useToday";
import { relativeDay } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { analizarAudio, audioEjemplo, crearReconocedor, formatoGrabacion, tiempo } from "./audio";

const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** Nota de voz de ejemplo (modo demo): audio sintético y una transcripción con fecha, monto y acciones */
export async function crearNotaEjemplo(proyectoId: string, reunionId?: string) {
  const blob = await audioEjemplo();
  const id = nuevoId("voz");
  const a = await analizarAudio(blob);
  await guardarArchivo(id, blob);
  espacio.agregarVoz({
    id,
    proyectoId,
    reunionId,
    titulo: "Llamada con el cliente (ejemplo)",
    creada: new Date().toISOString(),
    duracion: a.duracion,
    picos: a.picos,
    tipo: "audio/wav",
    transcripcion: [
      { t: 0.5, texto: "Repasamos el avance del diseño de la página de inicio." },
      { t: 6, texto: "El cliente aprobó la paleta y pidió enviar la propuesta final el viernes." },
      { t: 13, texto: "El presupuesto adicional para fotografía es de 800 mil pesos." },
      { t: 19, texto: "Hay que agendar la revisión con su equipo la próxima semana." },
    ],
  });
}

/* ═════════ Grabadora ═════════ */
export function Grabadora({ proyectoId, reunionId, onGuardada }: { proyectoId: string; reunionId?: string; onGuardada?: () => void }) {
  const { mode } = useData();
  const { toast } = useFeedback();
  const [estado, setEstado] = useState<"listo" | "grabando" | "guardando">("listo");
  const [seg, setSeg] = useState(0);
  const [barras, setBarras] = useState<number[]>(() => Array(36).fill(0.06));
  const [texto, setTexto] = useState<SegmentoVoz[]>([]);
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState<string | null>(null);
  // La transcripción falló mientras se grababa (red, permiso, idioma): se dice claro
  const [avisoVoz, setAvisoVoz] = useState<string | null>(null);
  const r = useRef<{
    rec?: MediaRecorder;
    stream?: MediaStream;
    ctx?: AudioContext;
    raf?: number;
    inicio: number;
    trozos: Blob[];
    voz?: ReturnType<typeof crearReconocedor>;
    activo: boolean;
    segmentos: SegmentoVoz[];
    cancelado: boolean;
    /** Lo último que se oyó y todavía no era frase final */
    parcial: string;
    errorVoz: boolean;
    /** Se resuelve cuando el reconocedor terminó de entregar sus últimas frases */
    finVoz?: Promise<void>;
    resolverFin?: () => void;
  }>({ inicio: 0, trozos: [], activo: false, segmentos: [], cancelado: false, parcial: "", errorVoz: false });
  const puedeTranscribir = typeof window !== "undefined" && !!crearReconocedor();

  useEffect(() => () => limpiar(), []);

  function limpiar() {
    const x = r.current;
    x.activo = false;
    if (x.raf) cancelAnimationFrame(x.raf);
    x.stream?.getTracks().forEach((t) => t.stop());
    void x.ctx?.close().catch(() => {});
    try {
      x.voz?.stop();
    } catch {
      /* ya detenido */
    }
  }

  async function empezar() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador no permite grabar audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = formatoGrabacion();
      const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      const x = r.current;
      Object.assign(x, { rec, stream, inicio: performance.now(), trozos: [], activo: true, segmentos: [], cancelado: false, parcial: "", errorVoz: false });
      setAvisoVoz(null);
      rec.ondataavailable = (e) => e.data.size && x.trozos.push(e.data);
      rec.onstop = () => void terminar(tipo || rec.mimeType || "audio/webm");
      rec.start(250);

      // Onda en vivo
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      x.ctx = ctx;
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      const datos = new Uint8Array(an.fftSize);
      let ultimo = 0;
      const tick = (t: number) => {
        if (!x.activo) return;
        if (t - ultimo > 70) {
          ultimo = t;
          an.getByteTimeDomainData(datos);
          let s = 0;
          for (const v of datos) s += ((v - 128) / 128) ** 2;
          const nivel = Math.min(1, Math.sqrt(s / datos.length) * 4.5);
          setBarras((b) => [...b.slice(1), Math.max(0.06, nivel)]);
          setSeg((performance.now() - x.inicio) / 1000);
        }
        x.raf = requestAnimationFrame(tick);
      };
      x.raf = requestAnimationFrame(tick);

      // Transcripción mientras hablas (si el navegador la tiene)
      const voz = crearReconocedor();
      if (voz) {
        x.voz = voz;
        voz.onresult = (e) => {
          let interino = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            if (res.isFinal) {
              const frase = res[0].transcript.trim();
              if (frase) x.segmentos = [...x.segmentos, { t: Math.max(0, (performance.now() - x.inicio) / 1000 - 2), texto: frase.charAt(0).toUpperCase() + frase.slice(1) }];
            } else interino += res[0].transcript;
          }
          x.parcial = interino;
          setTexto(x.segmentos);
          setParcial(interino);
        };
        voz.onerror = (e) => {
          // Silencio o detención: no son fallas
          if (e.error === "no-speech" || e.error === "aborted") return;
          // Algunos navegadores no tienen es-CO: se intenta con español general
          if (e.error === "language-not-supported" && voz.lang !== "es-ES") {
            voz.lang = "es-ES";
            return;
          }
          x.errorVoz = true;
          setAvisoVoz(
            e.error === "network"
              ? "La transcripción necesita conexión a internet. El audio sí se guarda."
              : e.error === "not-allowed" || e.error === "service-not-allowed"
                ? "El navegador no dio permiso para transcribir. El audio sí se guarda."
                : "La transcripción no está disponible ahora. El audio sí se guarda.",
          );
        };
        x.finVoz = new Promise<void>((res) => (x.resolverFin = res));
        voz.onend = () => {
          if (x.activo && !x.errorVoz) {
            try {
              voz.start();
              return;
            } catch {
              /* sin reintento */
            }
          }
          x.resolverFin?.();
        };
        try {
          voz.start();
        } catch {
          /* sin transcripción */
        }
      }
      setSeg(0);
      setTexto([]);
      setParcial("");
      setEstado("grabando");
    } catch {
      setError("No se pudo usar el micrófono. Revisa que Poku Poku tenga permiso para usarlo.");
    }
  }

  function detener(cancelar = false) {
    const x = r.current;
    x.cancelado = cancelar;
    x.activo = false;
    if (!cancelar) setEstado("guardando");
    try {
      x.voz?.stop();
    } catch {
      /* ya detenido */
    }
    if (x.rec && x.rec.state !== "inactive") x.rec.stop();
    else void terminar("audio/webm");
    if (cancelar) setEstado("listo");
  }

  async function terminar(tipo: string) {
    const x = r.current;
    const duracionReloj = (performance.now() - x.inicio) / 1000;
    // Al detener, el navegador entrega la última frase un momento después: se espera (máx. 2 s)
    // para no perderla. Antes se guardaba de inmediato y las notas cortas quedaban sin texto.
    if (x.voz && x.finVoz && !x.cancelado) await Promise.race([x.finVoz, new Promise((res) => setTimeout(res, 2000))]);
    limpiar();
    if (x.cancelado) return;
    // Lo que quedó a medias también cuenta
    const resto = x.parcial.trim();
    if (resto) x.segmentos = [...x.segmentos, { t: Math.max(0, duracionReloj - 2), texto: resto.charAt(0).toUpperCase() + resto.slice(1) }];
    const blob = new Blob(x.trozos, { type: tipo });
    const id = nuevoId("voz");
    let picos = barras;
    let duracion = duracionReloj;
    try {
      const a = await analizarAudio(blob);
      picos = a.picos;
      duracion = a.duracion || duracionReloj;
    } catch {
      /* se usa la onda en vivo */
    }
    await guardarArchivo(id, blob);
    const creada = new Date().toISOString();
    const sinTexto = x.segmentos.length ? undefined : !crearReconocedor() ? "no-soportado" : x.errorVoz ? "error" : "silencio";
    espacio.agregarVoz({ id, proyectoId, reunionId, creada, duracion, picos, transcripcion: x.segmentos, tipo, ...(sinTexto ? { sinTexto } : {}) });
    setEstado("listo");
    setBarras(Array(36).fill(0.06));
    toast("Nota de voz guardada");
    onGuardada?.();
  }

  async function ejemplo() {
    await crearNotaEjemplo(proyectoId, reunionId);
    toast("Nota de ejemplo creada");
  }

  const grabando = estado === "grabando";
  return (
    <div className="relative overflow-clip rounded-[24px] bg-card p-4 sm:p-5">
      {/* Brillo lima en la esquina, como el degradado de la referencia */}
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-56 rounded-full bg-brand opacity-25 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <button
          type="button"
          onClick={() => (grabando ? detener() : empezar())}
          disabled={estado === "guardando"}
          aria-label={grabando ? "Detener y guardar" : "Grabar nota de voz"}
          className={cn(
            "focus-ring grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-60",
            grabando ? "bg-danger text-white" : "bg-fg text-on-fg",
          )}
        >
          {grabando ? <Square size={20} fill="currentColor" /> : <Mic size={22} />}
        </button>
        <div className="min-w-0 flex-1">
          {grabando ? (
            <p className="flex items-center gap-2 text-[14.5px] font-bold">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger" aria-hidden /> Grabando <span className="num font-normal text-muted">{tiempo(seg)}</span>
            </p>
          ) : (
            <p className="text-[14.5px] font-bold">{estado === "guardando" ? "Guardando nota…" : "Graba una nota de voz"}</p>
          )}
          <p className="truncate text-[12.5px] text-muted">
            {grabando ? (avisoVoz ? "Grabando sin transcripción" : "Toca el cuadrado para guardar") : puedeTranscribir ? "Se transcribe mientras hablas" : "Este navegador no transcribe; el audio sí se guarda"}
          </p>
        </div>
        {grabando ? (
          <Button size="icon-sm" variant="ghost" aria-label="Cancelar grabación" onClick={() => detener(true)}>
            <X size={17} />
          </Button>
        ) : mode === "demo" ? (
          <Button size="sm" variant="secondary" className="bg-bg" onClick={ejemplo}>
            Ejemplo
          </Button>
        ) : null}
      </div>

      {grabando ? (
        <div className="relative mt-4">
          <div className="flex h-12 items-center gap-[3px]" aria-hidden>
            {barras.map((b, i) => (
              <span key={i} className="w-full rounded-full bg-fg transition-[height] duration-75" style={{ height: `${Math.round(b * 100)}%` }} />
            ))}
          </div>
          {puedeTranscribir && avisoVoz ? (
            <p className="mt-3 rounded-[16px] bg-bg px-3 py-2 text-[13px] text-muted" aria-live="polite">
              {avisoVoz}
            </p>
          ) : puedeTranscribir ? (
            <p className="mt-3 max-h-24 overflow-y-auto rounded-[16px] bg-bg px-3 py-2 text-[13.5px] leading-relaxed" aria-live="polite">
              {texto.map((s) => s.texto).join(" ")} <span className="text-dim">{parcial}</span>
              {!texto.length && !parcial ? <span className="text-dim">Empieza a hablar…</span> : null}
            </p>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="relative mt-3 rounded-[14px] bg-warn-fill px-3 py-2 text-[13px] text-[#0a0a0a]">{error}</p> : null}
    </div>
  );
}

/* ═════════ Reproductor ═════════ */
export function TarjetaVoz({ nota, reunionTitulo }: { nota: NotaVoz; reunionTitulo?: string }) {
  const { insert } = useData();
  const { toast, confirm } = useFeedback();
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const [sonando, setSonando] = useState(false);
  const [actual, setActual] = useState(0);
  const [velocidad, setVelocidad] = useState(1);
  const [abierta, setAbierta] = useState(false);
  const [editando, setEditando] = useState(false);
  const titulo = tituloVoz(nota);
  const [borrador, setBorrador] = useState("");
  const [creadas, setCreadas] = useState<Set<number>>(new Set());
  const today = useToday();
  // Frase seleccionada en la transcripción (para «Convertir en tarea»)
  const [seleccion, setSeleccion] = useState("");
  const lista = useRef<HTMLOListElement>(null);
  const leerSeleccion = () => {
    const s = window.getSelection();
    const t = s?.toString().replace(/\s+/g, " ").trim() ?? "";
    setSeleccion(t && s?.anchorNode && lista.current?.contains(s.anchorNode) ? t.slice(0, 200) : "");
  };

  useEffect(
    () => () => {
      audio.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  async function preparar() {
    if (audio.current) return audio.current;
    const blob = await leerArchivo(nota.id);
    if (!blob) {
      toast("No se encontró el audio en este dispositivo.", "error");
      return null;
    }
    url.current = URL.createObjectURL(blob);
    const a = new Audio(url.current);
    a.playbackRate = velocidad;
    a.ontimeupdate = () => setActual(a.currentTime);
    a.onended = () => {
      setSonando(false);
      setActual(0);
    };
    audio.current = a;
    return a;
  }
  async function alternar() {
    const a = await preparar();
    if (!a) return;
    if (sonando) {
      a.pause();
      setSonando(false);
    } else {
      await a.play();
      setSonando(true);
    }
  }
  async function ir(seg: number, reproducir = true) {
    const a = await preparar();
    if (!a) return;
    a.currentTime = Math.max(0, Math.min(nota.duracion, seg));
    setActual(a.currentTime);
    if (reproducir && a.paused) {
      await a.play();
      setSonando(true);
    }
  }
  const cambiarVelocidad = () => {
    const v = velocidad === 1 ? 1.5 : velocidad === 1.5 ? 2 : 1;
    setVelocidad(v);
    if (audio.current) audio.current.playbackRate = v;
  };
  const pct = nota.duracion ? actual / nota.duracion : 0;

  /** Convertir en tarea del proyecto: el parser saca la fecha y el responsable si la frase los trae */
  async function crearTarea(k: number | null, texto: string) {
    const a = interpretarAcuerdo(texto, today);
    const base = a.nombre || texto;
    const nombre = base.length > 90 ? `${base.slice(0, 87)}…` : base;
    await insert("tasks", {
      project_id: nota.proyectoId,
      parent_task_id: null,
      name: nombre,
      description: `Desde la nota de voz «${titulo}»`,
      due_date: a.fecha,
      priority: "media",
      status: "pendiente",
      assignee: a.responsable,
    });
    if (k !== null) setCreadas((s) => new Set(s).add(k));
    const extra = [a.fecha ? relativeDay(a.fecha, today).toLowerCase() : "", a.responsable ? `para ${a.responsable}` : ""].filter(Boolean).join(", ");
    toast(extra ? `Tarea creada: ${extra}` : "Tarea creada en el proyecto");
  }
  async function convertirSeleccion() {
    const t = seleccion;
    if (!t) return;
    await crearTarea(null, t);
    window.getSelection()?.removeAllRanges();
    setSeleccion("");
  }
  async function borrar() {
    if (await confirm({ title: "¿Eliminar esta nota de voz?", description: "Se borra el audio y su transcripción.", confirmLabel: "Eliminar", destructive: true })) {
      audio.current?.pause();
      await espacio.borrarVoz(nota.id);
    }
  }
  const renombrar = () => {
    setBorrador(nota.titulo ?? "");
    setEditando(true);
  };
  /** Vacío = vuelve al nombre automático (primeras palabras o «Nota de voz») */
  const guardarTitulo = () => {
    if (!editando) return;
    setEditando(false);
    const t = borrador.trim().slice(0, 60);
    if (t === (nota.titulo ?? "")) return;
    espacio.actualizarVoz(nota.id, { titulo: t || undefined });
  };
  async function bajarAudio() {
    const blob = await leerArchivo(nota.id);
    if (!blob) return toast("El audio de esta nota no está en este dispositivo.", "error");
    const r = await compartirODescargar(blob, `${nombreBase(nota)}.${extensionAudio(blob.type || nota.tipo)}`, titulo);
    if (r !== "cancelado") toast(r === "compartido" ? "Audio compartido" : "Audio descargado");
  }
  async function bajarTexto() {
    const blob = new Blob([transcripcionTxt(nota)], { type: "text/plain;charset=utf-8" });
    const r = await compartirODescargar(blob, `${nombreBase(nota)}.txt`, titulo);
    if (r !== "cancelado") toast(r === "compartido" ? "Transcripción compartida" : "Transcripción descargada");
  }
  const sinTexto =
    nota.sinTexto === "no-soportado"
      ? { corto: "Sin transcripción", largo: "Este navegador no transcribe; el audio sí se guardó." }
      : nota.sinTexto === "error"
        ? { corto: "No se pudo transcribir", largo: "La transcripción falló al grabar (conexión o permiso); el audio sí se guardó." }
        : nota.sinTexto === "silencio"
          ? { corto: "Sin voz detectada", largo: "No se reconoció ninguna frase en la grabación." }
          : { corto: "Sin transcripción", largo: "Esta nota no tiene transcripción." };
  const resaltes = nota.transcripcion.flatMap((s) => destacados(s.texto));

  return (
    <article className="rounded-[22px] bg-bg-2 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {editando ? (
            <input
              autoFocus
              value={borrador}
              maxLength={60}
              placeholder={tituloVoz({ transcripcion: nota.transcripcion })}
              onChange={(e) => setBorrador(e.target.value)}
              onBlur={guardarTitulo}
              onKeyDown={(e) => {
                if (e.key === "Enter") guardarTitulo();
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditando(false);
                }
              }}
              aria-label="Nombre de la nota"
              className="focus-ring block w-full rounded-[8px] bg-transparent text-[14.5px] font-bold outline-none placeholder:font-normal placeholder:text-dim"
            />
          ) : (
            <button type="button" onClick={renombrar} aria-label="Renombrar nota" className="focus-ring block max-w-full cursor-text truncate rounded-[8px] text-left text-[14.5px] font-bold" title="Renombrar nota">
              {titulo}
            </button>
          )}
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
            <span>{fechaHora(nota.creada)}</span>
            {reunionTitulo ? (
              <span className="flex items-center gap-1">
                <CalendarClock size={12} /> {reunionTitulo}
              </span>
            ) : null}
          </p>
        </div>
        <Popover
          side="bottom"
          trigger={({ open, toggle }) => (
            <Button size="icon-sm" variant="ghost" aria-label={`Exportar ${titulo}`} aria-expanded={open} onClick={toggle}>
              <MoreHorizontal size={17} />
            </Button>
          )}
        >
          {(cerrar: () => void) => (
            <div className="grid min-w-[200px] gap-0.5 p-1">
              <button type="button" onClick={() => (cerrar(), void bajarAudio())} className="flex cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13.5px] hover:bg-card">
                <Download size={15} /> Descargar audio
              </button>
              {nota.transcripcion.length ? (
                <button type="button" onClick={() => (cerrar(), void bajarTexto())} className="flex cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13.5px] hover:bg-card">
                  <FileText size={15} /> Descargar transcripción
                </button>
              ) : null}
            </div>
          )}
        </Popover>
        <Button size="icon-sm" variant="ghost" aria-label={`Eliminar ${titulo}`} onClick={borrar}>
          <Trash2 size={16} />
        </Button>
      </div>

      {/* Onda: las barras ya escuchadas se rellenan */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={alternar}
          aria-label={sonando ? "Pausar" : "Reproducir"}
          className="focus-ring grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full bg-fg text-on-fg transition-transform active:scale-95"
        >
          {sonando ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="translate-x-[1px]" />}
        </button>
        <div
          role="slider"
          tabIndex={0}
          aria-label="Posición del audio"
          aria-valuemin={0}
          aria-valuemax={Math.round(nota.duracion)}
          aria-valuenow={Math.round(actual)}
          aria-valuetext={`${tiempo(actual)} de ${tiempo(nota.duracion)}`}
          onClick={(e) => {
            const b = e.currentTarget.getBoundingClientRect();
            void ir(((e.clientX - b.left) / b.width) * nota.duracion);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") void ir(actual + 5, false);
            if (e.key === "ArrowLeft") void ir(actual - 5, false);
          }}
          className="focus-ring relative flex h-11 min-w-0 flex-1 cursor-pointer items-center gap-[2px] rounded-[8px]"
        >
          {nota.picos.map((p, i) => (
            <span
              key={i}
              className={cn("w-full rounded-full transition-colors", i / nota.picos.length < pct ? "bg-fg" : "bg-line-strong")}
              style={{ height: `${Math.round(p * 100)}%` }}
            />
          ))}
          {actual > 0 ? <span aria-hidden className="absolute inset-y-0 w-[2px] rounded-full bg-[var(--color-brand-soft)]" style={{ left: `${pct * 100}%` }} /> : null}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="num text-[12.5px] text-muted">
          {tiempo(actual)} / {tiempo(nota.duracion)}
        </span>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={cambiarVelocidad} className="focus-ring num h-7 cursor-pointer rounded-full bg-bg px-2.5 text-[12px] font-medium hover:bg-elev" aria-label="Velocidad">
            {velocidad}×
          </button>
          {nota.transcripcion.length ? (
            <button
              type="button"
              onClick={() => setAbierta((v) => !v)}
              aria-expanded={abierta}
              className="focus-ring flex h-7 cursor-pointer items-center gap-1 rounded-full bg-bg px-2.5 text-[12px] font-medium hover:bg-elev"
            >
              Transcripción <ChevronDown size={14} className={cn("transition-transform", abierta && "rotate-180")} />
            </button>
          ) : (
            <span className="text-[12px] text-dim" title={sinTexto.largo}>
              {sinTexto.corto}
              <span className="sr-only">. {sinTexto.largo}</span>
            </span>
          )}
        </div>
      </div>
      {!abierta && resaltes.length ? (
        <p className="mt-2 flex flex-wrap gap-1.5">
          {[...new Set(resaltes)].map((t) => (
            <span key={t} className="flex items-center gap-1 rounded-full bg-bg px-2 py-0.5 text-[11.5px] text-muted">
              <Sparkles size={11} className="text-[var(--color-brand-soft)]" /> {ETIQUETA_DESTACADO[t]}
            </span>
          ))}
        </p>
      ) : null}

      {abierta ? (
        <>
        <p className="mt-3 px-1 text-[12px] text-muted">Selecciona una frase para volverla tarea.</p>
        <ol ref={lista} onMouseUp={leerSeleccion} onKeyUp={leerSeleccion} onTouchEnd={() => setTimeout(leerSeleccion, 50)} className="mt-2 grid grid-cols-1 gap-2">
          {nota.transcripcion.map((s, k) => {
            const tipos = destacados(s.texto);
            return (
              <li key={k} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2.5 rounded-[16px] bg-bg p-3">
                <button type="button" onClick={() => ir(s.t)} className="focus-ring num h-6 cursor-pointer self-start rounded-full bg-bg-2 px-2 text-[11.5px] font-medium hover:bg-elev" title="Escuchar desde aquí">
                  {tiempo(s.t)}
                </button>
                <div className="min-w-0">
                  <p className="text-[13.5px] leading-relaxed">{s.texto}</p>
                  {tipos.length ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {tipos.map((t) => (
                        <span key={t} className="flex items-center gap-1 rounded-full bg-bg-2 px-2 py-0.5 text-[11.5px] text-muted">
                          <Sparkles size={11} className="text-[var(--color-brand-soft)]" /> {ETIQUETA_DESTACADO[t]}
                        </span>
                      ))}
                      {tipos.includes("accion") ? (
                        creadas.has(k) ? (
                          <span className="flex items-center gap-1 text-[11.5px] font-medium text-[var(--color-brand-soft)]">
                            <Check size={12} /> Tarea creada
                          </span>
                        ) : (
                          <button type="button" onClick={() => crearTarea(k, s.texto)} className="focus-ring cursor-pointer rounded-full bg-fg px-2.5 py-0.5 text-[11.5px] font-medium text-on-fg">
                            Crear tarea
                          </button>
                        )
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {tipos.includes("accion") ? (
                  <span />
                ) : creadas.has(k) ? (
                  <Check size={15} className="mt-1 text-[var(--color-brand-soft)]" aria-label="Tarea creada" />
                ) : (
                  <button
                    type="button"
                    onClick={() => void crearTarea(k, s.texto)}
                    aria-label={`Convertir en tarea: ${s.texto}`}
                    title="Convertir en tarea"
                    className="focus-ring grid h-7 w-7 cursor-pointer place-items-center self-start rounded-full text-muted hover:bg-bg-2 hover:text-fg [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                  >
                    <ListPlus size={15} />
                  </button>
                )}
              </li>
            );
          })}
          <li className="px-1 text-[11.5px] text-dim">Los destacados se detectan con reglas simples en el texto (fechas, montos y verbos de acción).</li>
        </ol>
        {seleccion ? (
          <div className="sticky bottom-24 mt-2 flex items-center gap-2 rounded-[16px] bg-fg p-2 pl-3 text-on-fg md:bottom-4" role="region" aria-label="Frase seleccionada">
            <p className="min-w-0 flex-1 truncate text-[13px]">«{seleccion}»</p>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void convertirSeleccion()} className="focus-ring shrink-0 cursor-pointer rounded-full bg-on-fg px-3 py-1.5 text-[12.5px] font-medium text-fg">
              Convertir en tarea
            </button>
          </div>
        ) : null}
        </>
      ) : null}
    </article>
  );
}
