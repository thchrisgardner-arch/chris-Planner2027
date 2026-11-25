"use client";

/**
 * Notas de voz del proyecto: grabadora con onda en vivo y transcripción mientras hablas, y
 * reproductor con onda que se llena al avanzar, transcripción con marcas de tiempo y destacados
 * (fechas, montos, acciones) que se pueden convertir en tareas.
 */
import { useEffect, useRef, useState } from "react";
import { CalendarClock, Check, ChevronDown, Mic, Pause, Play, Sparkles, Square, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { ETIQUETA_DESTACADO, destacados, espacio, guardarArchivo, leerArchivo, nuevoId, type NotaVoz, type SegmentoVoz } from "@/lib/proyectos/espacio";
import { cn } from "@/utils/cn";
import { analizarAudio, audioEjemplo, crearReconocedor, formatoGrabacion, tiempo } from "./audio";

const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

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
  }>({ inicio: 0, trozos: [], activo: false, segmentos: [], cancelado: false });
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
      Object.assign(x, { rec, stream, inicio: performance.now(), trozos: [], activo: true, segmentos: [], cancelado: false });
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
          setTexto(x.segmentos);
          setParcial(interino);
        };
        voz.onerror = () => {};
        voz.onend = () => {
          if (x.activo) {
            try {
              voz.start();
            } catch {
              /* sin reintento */
            }
          }
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
      setError("No se pudo usar el micrófono. Revisa que LIFE for LIFE tenga permiso para usarlo.");
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
    limpiar();
    if (x.cancelado) return;
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
    espacio.agregarVoz({ id, proyectoId, reunionId, titulo: `Nota de voz · ${fechaHora(creada)}`, creada, duracion, picos, transcripcion: x.segmentos, tipo });
    setEstado("listo");
    setBarras(Array(36).fill(0.06));
    toast("Nota de voz guardada");
    onGuardada?.();
  }

  async function ejemplo() {
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
    toast("Nota de ejemplo creada");
  }

  const grabando = estado === "grabando";
  return (
    <div className="relative overflow-hidden rounded-[24px] bg-card p-4 sm:p-5">
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
            {grabando ? "Toca el cuadrado para guardar" : puedeTranscribir ? "Se transcribe mientras hablas" : "Este navegador no transcribe; el audio sí se guarda"}
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
          {puedeTranscribir ? (
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
  const [titulo, setTitulo] = useState(nota.titulo);
  const [creadas, setCreadas] = useState<Set<number>>(new Set());

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

  async function crearTarea(k: number, texto: string) {
    const nombre = texto.length > 90 ? `${texto.slice(0, 87)}…` : texto;
    await insert("tasks", { project_id: nota.proyectoId, parent_task_id: null, name: nombre, description: `Desde la nota de voz «${nota.titulo}»`, due_date: null, priority: "media", status: "pendiente" });
    setCreadas((s) => new Set(s).add(k));
    toast("Tarea creada en el proyecto");
  }
  async function borrar() {
    if (await confirm({ title: "¿Eliminar esta nota de voz?", description: "Se borra el audio y su transcripción.", confirmLabel: "Eliminar", destructive: true })) {
      audio.current?.pause();
      await espacio.borrarVoz(nota.id);
    }
  }
  const guardarTitulo = () => {
    setEditando(false);
    const t = titulo.trim();
    if (t && t !== nota.titulo) espacio.actualizarVoz(nota.id, { titulo: t });
    else setTitulo(nota.titulo);
  };
  const resaltes = nota.transcripcion.flatMap((s) => destacados(s.texto));

  return (
    <article className="rounded-[22px] bg-bg-2 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {editando ? (
            <input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onBlur={guardarTitulo}
              onKeyDown={(e) => e.key === "Enter" && guardarTitulo()}
              aria-label="Título de la nota"
              className="w-full rounded-[10px] bg-bg px-2 py-1 text-[14.5px] font-bold outline-none ring-2 ring-[var(--color-brand)]"
            />
          ) : (
            <button type="button" onClick={() => setEditando(true)} className="focus-ring block max-w-full cursor-text truncate rounded-[8px] text-left text-[14.5px] font-bold" title="Cambiar título">
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
            <span className="text-[12px] text-dim">Sin transcripción</span>
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
        <ol className="mt-3 grid grid-cols-1 gap-2">
          {nota.transcripcion.map((s, k) => {
            const tipos = destacados(s.texto);
            return (
              <li key={k} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 rounded-[16px] bg-bg p-3">
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
              </li>
            );
          })}
          <li className="px-1 text-[11.5px] text-dim">Los destacados se detectan con reglas simples en el texto (fechas, montos y verbos de acción).</li>
        </ol>
      ) : null}
    </article>
  );
}
