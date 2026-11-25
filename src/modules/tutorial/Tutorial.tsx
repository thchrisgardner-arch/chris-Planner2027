"use client";

/**
 * Tutorial guiado (coach marks): la primera vez que abres la app oscurece la pantalla, ilumina un
 * elemento a la vez y una burbuja con flecha explica para qué sirve. Se puede saltar y repetir
 * desde Configuración → Perfil. Funciona en escritorio y en celular: cada paso busca el elemento
 * visible en el tamaño de pantalla actual y, si no existe, se salta.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useData } from "@/lib/store/DataProvider";

const CLAVE = "lifeos:tutorial";

interface Paso {
  /** Selector CSS del elemento a señalar; sin selector, la burbuja sale centrada */
  sel?: string;
  titulo: string;
  texto: string;
  /** Texto y elemento alternos en celular (<768 px) */
  textoMovil?: string;
  selMovil?: string;
  /** Espacio extra iluminado arriba (p. ej. el personaje que sobresale de su tarjeta) */
  extraArriba?: number;
}

const PASOS: Paso[] = [
  {
    titulo: "Bienvenido a LIFE OS",
    texto: "Te muestro en un minuto cómo funciona. Puedes saltarlo cuando quieras.",
  },
  {
    sel: 'section[aria-label$="tu asistente"]',
    titulo: "Tu asistente",
    extraArriba: 56,
    texto: "Te acompaña y te habla según cómo vas. Si cumples se pone feliz; si te descuidas, se preocupa.",
  },
  {
    sel: '[data-tour="agregar"]',
    selMovil: 'nav[aria-label="Navegación rápida"] [data-tour="agregar"]',
    titulo: "Registra todo desde aquí",
    texto: "Con este botón agregas un gasto, un ingreso, una tarea, un hábito o un evento en segundos.",
  },
  {
    sel: 'a[aria-label^="Racha de"]',
    titulo: "Tu racha y tu nivel",
    texto: "Cada cosa que registras suma XP y sube tu nivel. Registra algo cada día para no perder la racha.",
  },
  {
    sel: '[data-tour="dia"]',
    titulo: "Tu meta y tus misiones",
    texto: "Cada día tienes una meta de XP y 3 misiones. Cada misión da +10 XP y las tres juntas, +20 extra. La meta la cambias en Configuración → Progreso.",
  },
  {
    sel: '[data-tour="kpis"]',
    titulo: "Tu plata del mes",
    texto: "Balance, ingresos y gastos. Si cierras el mes ganando más de lo que gastas, te llevas +100 XP.",
  },
  {
    sel: '[data-tour="habitos"]',
    titulo: "Tus hábitos",
    texto: "Toca el día para marcar un hábito cumplido. Si cumples todos los del día, es un día perfecto.",
  },
  {
    sel: 'nav[aria-label="Principal"], nav[aria-label="Navegación rápida"]',
    titulo: "Todas las secciones",
    texto: "Finanzas, Proyectos, Hábitos, Wishlist, Objetivos, Calendario y tu Progreso están en este menú.",
    textoMovil: "Aquí cambias de sección. El botón de las tres rayas abre el resto: Objetivos, Calendario, Progreso y Configuración.",
  },
  {
    sel: 'button[aria-label^="Notificaciones"]',
    titulo: "Avisos",
    texto: "Pagos por vencer, tareas de hoy y hábitos pendientes. En Configuración → Progreso puedes recibirlos en tu celular.",
  },
  {
    titulo: "¡Listo!",
    texto: "Ya sabes lo básico. Si quieres ver este tutorial otra vez, está en Configuración → Perfil.",
  },
];

/* ═════════ Estado global (para que el pop-up de racha espere) ═════════ */
let activo = false;
/** Cada apertura es una sesión nueva: el recorrido siempre empieza en el paso 1 */
let sesion = 0;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

/** Abre el tutorial desde cualquier parte (Configuración, panel de pruebas) */
export function iniciarTutorial() {
  activo = true;
  sesion += 1;
  avisar();
}
export function useTutorialActivo() {
  return useSyncExternalStore(suscribir, () => activo, () => false);
}
/** Primera vez en este dispositivo (fuera del modo demo): el tutorial todavía no se ha visto */
export function tutorialPendiente() {
  if (typeof window === "undefined" || window.sessionStorage.getItem("lifeos-demo")) return false;
  try {
    return window.localStorage.getItem(CLAVE) !== "visto";
  } catch {
    return false;
  }
}

/* ═════════ Geometría ═════════ */
type Caja = { top: number; left: number; width: number; height: number };
const MARGEN = 8;

function visible(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
}
function buscar(paso?: Paso) {
  const sel = paso && window.innerWidth < 768 && paso.selMovil ? paso.selMovil : paso?.sel;
  if (!sel) return null;
  return [...document.querySelectorAll(sel)].find(visible) ?? null;
}

export function Tutorial() {
  const { mode } = useData();
  const s = useSyncExternalStore(suscribir, () => sesion, () => 0);

  // Primera vez: arranca solo (nunca en modo demo)
  useEffect(() => {
    if (mode === "demo" || !tutorialPendiente()) return;
    const t = setTimeout(iniciarTutorial, 700);
    return () => clearTimeout(t);
  }, [mode]);

  return <Recorrido key={s} />;
}

function Recorrido() {
  const { mode } = useData();
  const abierto = useTutorialActivo();
  const router = useRouter();
  const pathname = usePathname();
  const [i, setI] = useState(0);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [movil, setMovil] = useState(false);
  const burbuja = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState(180);

  // El recorrido se hace sobre el inicio
  useEffect(() => {
    if (abierto && pathname !== "/") router.push("/");
  }, [abierto, pathname, router]);

  const terminar = useCallback(() => {
    activo = false;
    avisar();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (mode !== "demo") {
      try {
        window.localStorage.setItem(CLAVE, "visto");
      } catch {
        /* sin almacenamiento */
      }
    }
  }, [mode]);

  // Ubicar el elemento del paso (si no está visible en este tamaño, se salta en la misma dirección)
  const direccion = useRef(1);
  const medir = useCallback(() => {
    const paso = PASOS[i];
    const el = buscar(paso);
    setMovil(window.innerWidth < 768);
    if (!paso?.sel) return setCaja(null);
    if (!el) {
      const sig = i + direccion.current;
      if (sig >= 0 && sig < PASOS.length) setI(sig);
      return;
    }
    const r = el.getBoundingClientRect();
    const extra = paso.extraArriba ?? 0;
    setCaja({ top: r.top - MARGEN - extra, left: r.left - MARGEN, width: r.width + MARGEN * 2, height: r.height + MARGEN * 2 + extra });
  }, [i]);

  useEffect(() => {
    if (!abierto || pathname !== "/") return;
    const paso = PASOS[i];
    // Si el elemento no se ve completo con espacio para la burbuja debajo, se sube justo bajo el
    // encabezado. Primero con animación; si a los 600 ms no llegó, de una vez.
    const encuadrar = (suave: boolean) => {
      const el = buscar(paso);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const fijo = getComputedStyle(el).position === "fixed" || !!el.closest('nav[aria-label="Navegación rápida"]');
      const extra = paso.extraArriba ?? 0;
      const lejos = r.top - extra < 72 || (r.bottom + 230 > window.innerHeight && r.top - extra > 100);
      if (!fijo && lejos) window.scrollBy({ top: r.top - 88 - extra, behavior: suave ? "smooth" : "auto" });
    };
    encuadrar(true);
    const t0 = setTimeout(() => encuadrar(false), 600);
    const t1 = setTimeout(medir, 60);
    const t2 = setTimeout(medir, 450);
    const t3 = setTimeout(medir, 700);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [abierto, i, pathname, medir]);

  useLayoutEffect(() => {
    if (burbuja.current) setAlto(burbuja.current.offsetHeight);
  }, [i, caja, movil, abierto]);

  const avanzar = useCallback(
    (d: number) => {
      const sig = i + d;
      if (sig >= PASOS.length) return terminar();
      if (sig < 0) return;
      direccion.current = d;
      setI(sig);
    },
    [i, terminar],
  );

  // Teclado: Escape salta, flechas navegan; el foco va al botón principal
  useEffect(() => {
    if (!abierto) return;
    burbuja.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") terminar();
      if (e.key === "ArrowRight") avanzar(1);
      if (e.key === "ArrowLeft") avanzar(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [abierto, avanzar, terminar]);

  if (!abierto || typeof document === "undefined") return null;
  const paso = PASOS[i];
  const ultimo = i === PASOS.length - 1;

  // Posición de la burbuja: debajo del elemento si cabe; si no, encima; centrada si no hay elemento
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ancho = Math.min(340, vw - 24);
  let estilo: React.CSSProperties;
  let flecha: { left: number; arriba: boolean } | null = null;
  if (caja) {
    const centro = caja.left + caja.width / 2;
    const left = Math.min(Math.max(12, centro - ancho / 2), vw - ancho - 12);
    const fondo = caja.top + caja.height;
    const abajo = fondo > 0 && fondo + 14 + alto < vh - 8;
    const arriba = caja.top < vh && caja.top - 14 - alto > 8;
    let top: number;
    if (abajo) top = fondo + 14;
    else if (arriba) top = caja.top - 14 - alto;
    // Elemento muy alto: burbuja abajo, encima de la barra inferior en celular
    else top = vh - alto - (movil ? 100 : 24);
    // Nunca fuera de la pantalla
    top = Math.min(Math.max(12, top), Math.max(12, vh - alto - 12));
    estilo = { top, left, width: ancho };
    if (abajo || arriba) flecha = { left: Math.min(Math.max(18, centro - left), ancho - 18), arriba: abajo };
  } else {
    estilo = { top: Math.max(12, (vh - alto) / 2), left: (vw - ancho) / 2, width: ancho };
  }

  return createPortal(
    <div className="fixed inset-0 z-[97]" role="presentation">
      {/* Bloquea los clics a la app mientras dura el tutorial */}
      <div className="absolute inset-0" aria-hidden />
      {/* Fondo oscuro con un hueco recortado sobre el elemento señalado */}
      <svg aria-hidden className="pointer-events-none fixed inset-0 h-full w-full animate-in">
        <defs>
          <mask id="tutorial-hueco">
            <rect width="100%" height="100%" fill="white" />
            {caja ? <rect x={caja.left} y={caja.top} width={caja.width} height={caja.height} rx={22} fill="black" className="tutorial-hueco" /> : null}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.58)" mask="url(#tutorial-hueco)" />
      </svg>
      {caja ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[22px] transition-all duration-300 ease-(--ease-os)"
          style={{ ...caja, boxShadow: "0 0 0 2px var(--char-yellow)" }}
        />
      ) : null}
      <div
        ref={burbuja}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-titulo"
        aria-describedby="tutorial-texto"
        className="fixed rounded-[20px] bg-bg p-4 transition-[top,left] duration-300 ease-(--ease-os) animate-in"
        style={estilo}
      >
        {flecha ? (
          <span
            aria-hidden
            className="absolute h-3.5 w-3.5 rotate-45 bg-bg"
            style={{ left: flecha.left - 7, ...(flecha.arriba ? { top: -7 } : { bottom: -7 }) }}
          />
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <p className="num text-[12px] font-medium text-dim">
            {i + 1} de {PASOS.length}
          </p>
          {!ultimo ? (
            <button type="button" onClick={terminar} className="focus-ring cursor-pointer rounded-full px-2 py-1 text-[12.5px] font-medium text-muted hover:text-fg">
              Saltar
            </button>
          ) : null}
        </div>
        <h2 id="tutorial-titulo" className="mt-1 text-[16px] font-bold leading-snug">
          {paso.titulo}
        </h2>
        <p id="tutorial-texto" className="mt-1 text-[13.5px] leading-relaxed text-muted">
          {movil && paso.textoMovil ? paso.textoMovil : paso.texto}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <div className="mr-auto flex gap-1" aria-hidden>
            {PASOS.map((_, k) => (
              <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? "w-4 bg-fg" : "w-1.5 bg-line-strong"}`} />
            ))}
          </div>
          {i > 0 && !ultimo ? (
            <Button variant="secondary" className="h-9 bg-card px-3 text-[13px]" onClick={() => avanzar(-1)}>
              Atrás
            </Button>
          ) : null}
          <Button variant="primary" className="h-9 px-4 text-[13px]" data-autofocus onClick={() => avanzar(1)}>
            {ultimo ? "Empezar" : i === 0 ? "Comenzar" : "Siguiente"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
