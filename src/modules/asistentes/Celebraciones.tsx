"use client";

/**
 * Celebraciones grandes: subir de nivel, cambiar de etapa, desbloquear un logro o una
 * personalización. Un solo modal recorre la cola (nivel → logro → desbloqueo).
 * Confeti solo aquí: ~40 partículas CSS, 1,5 s, sin librerías y apagado con movimiento reducido.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Asistente } from "@/components/asistentes/Asistente";
import { Button } from "@/components/ui/Button";
import { useAsistentes } from "@/lib/asistentes/estado";
import { FICHAS, type Tono } from "@/lib/asistentes/definiciones";
import type { Accesorio, AsistenteId, Colores } from "@/lib/asistentes/tipos";
import { useGamificacion, type Celebracion } from "./Gamificacion";
import { esSesionDeBienvenida, useTutorialActivo } from "@/modules/tutorial/Tutorial";
import { IconoRacha } from "./Protagonismo";
import { retro, type Retro } from "@/lib/asistentes/sonido";

const DORADA: Colores = { primario: "yellow", secundario: "yellow-soft", detalle: "ink" };

const VOZ_NIVEL: Record<Tono, (etapa: string, cambio: boolean) => string> = {
  seco: (e, c) => (c ? `Etapa ${e}. Esto ya es otra cosa.` : "Subiste de nivel. No está mal."),
  motivador: (e, c) => (c ? `Bienvenido a ${e}. Vas con todo.` : "Un nivel más. Sigue así."),
  tranquilo: (e, c) => (c ? `Llegaste a la etapa ${e}.` : "Subiste de nivel."),
};
const VOZ_LOGRO: Record<Tono, string> = {
  seco: "Lo conseguiste. Lo anoto.",
  motivador: "Logro desbloqueado. Esto se celebra.",
  tranquilo: "Desbloqueaste un logro.",
};
const VOZ_DESBLOQUEO: Record<Tono, (n: string) => string> = {
  seco: (n) => `${n} te deja usar algo nuevo. Pruébalo.`,
  motivador: (n) => `Tu vínculo con ${n} creció. Estrena algo.`,
  tranquilo: (n) => `Nuevo desbloqueo por tu vínculo con ${n}.`,
};

const VOZ_HITO: Record<Tono, (d: number) => string> = {
  seco: (d) => (d >= 30 ? `${d} días sin fallar. Esto ya es costumbre.` : `${d} días seguidos. Vamos bien.`),
  motivador: (d) => (d >= 30 ? `¡${d} días seguidos! Eres imparable.` : `¡${d} días seguidos! No la sueltes.`),
  tranquilo: (d) => `Llevas ${d} días seguidos registrando.`,
};
const VOZ_REPARADA: Record<Tono, string> = {
  seco: "Racha recuperada. Esta vez la cuidamos.",
  motivador: "¡Tu racha está de vuelta! Ahora a cuidarla.",
  tranquilo: "Recuperaste tu racha.",
};
const VOZ_META: Record<Tono, string> = {
  seco: "Meta del día cumplida. Lo que sigue es ganancia.",
  motivador: "¡Llegaste a tu meta de hoy! Lo que sumes ahora es extra.",
  tranquilo: "Llegaste a tu meta de hoy.",
};
const VOZ_MISIONES: Record<Tono, string> = {
  seco: "Las tres misiones. Día redondo.",
  motivador: "¡Completaste todas las misiones de hoy! Día redondo.",
  tranquilo: "Completaste las tres misiones de hoy.",
};

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const nombreMes = (k: string) => MESES[Number(k.slice(5, 7)) - 1] ?? k;

const COLORES_CONFETI =["var(--char-lime)", "var(--char-yellow)", "var(--char-lime-soft)", "var(--char-yellow-soft)", "var(--char-sand)", "var(--char-charcoal)"];

function Confeti({ semilla }: { semilla: number }) {
  const piezas = useMemo(() => {
    // Pseudoaleatorio determinista por pieza (sin estado mutable)
    const r = (i: number, k: number) => {
      const x = Math.sin(i * 12.9898 + k * 78.233 + semilla * 3.7) * 43758.5453;
      return x - Math.floor(x);
    };
    return Array.from({ length: 40 }, (_, i) => ({
      left: r(i, 1) * 100,
      delay: r(i, 2) * 0.35,
      dur: 1.1 + r(i, 3) * 0.4,
      rot: r(i, 4) * 360,
      drift: (r(i, 5) - 0.5) * 80,
      w: 6 + r(i, 6) * 6,
      h: 8 + r(i, 7) * 8,
      color: COLORES_CONFETI[i % COLORES_CONFETI.length],
      redondo: r(i, 8) > 0.6,
    }));
  }, [semilla]);
  return (
    <div className="confeti pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {piezas.map((p, i) => (
        <span
          key={i}
          className="confeti-pieza absolute top-0"
          style={
            {
              left: `${p.left}%`,
              width: p.w,
              height: p.redondo ? p.w : p.h,
              borderRadius: p.redondo ? 999 : 2,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
              "--rot": `${p.rot}deg`,
              "--drift": `${p.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function CapaCelebraciones() {
  const g = useGamificacion();
  const { estado } = useAsistentes();
  const router = useRouter();
  const [i, setI] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const cola = g.celebraciones;
  // Espera a que se cierre el pop-up diario de racha
  const tutorial = useTutorialActivo();
  // (en la sesión de bienvenida ese pop-up no sale, así que no hay que esperarlo)
  const saludoEnPantalla = g.saludoVisible && !esSesionDeBienvenida();
  const abierta = cola.length > 0 && i < cola.length && !saludoEnPantalla && !tutorial;
  const c: Celebracion | undefined = cola[i];

  const cerrar = () => {
    setI(0);
    g.cerrarCelebraciones();
  };
  const siguiente = () => (i + 1 < cola.length ? setI(i + 1) : cerrar());

  // Sonido y vibración una sola vez por celebración, cuando aparece en pantalla
  const sonada = useRef<Celebracion | null>(null);
  const visible = abierta ? c : undefined;
  const ajustes = g.progreso.ajustes;
  useEffect(() => {
    if (!visible || sonada.current === visible) return;
    sonada.current = visible;
    const tipo: Retro = visible.tipo === "balance" && !visible.verde ? "negativo" : visible.tipo === "hito" || visible.tipo === "reparada" ? "racha" : "celebracion";
    retro(tipo, ajustes);
  }, [visible, ajustes]);

  // Foco atrapado y Escape
  useEffect(() => {
    if (!abierta) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setI(0);
        g.cerrarCelebraciones();
      }
      if (e.key === "Tab" && panel.current) {
        const f = [...panel.current.querySelectorAll<HTMLElement>("button, a[href]")];
        if (!f.length) return;
        const primero = f[0];
        const ultimo = f[f.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [abierta, i, g]);

  if (!abierta || !c || typeof document === "undefined") return null;

  // Quién celebra y qué se muestra
  let id: AsistenteId = estado.principal;
  let titulo = "";
  let sub = "";
  let etiqueta = "";
  let accesorio: Accesorio | undefined;
  let colores: Colores | undefined;
  let probar: string | null = null;
  let confeti = true;
  let pose: "celebrando" | "triste" = "celebrando";
  if (c.tipo === "hito") {
    etiqueta = `Hito de racha · +${c.xp} XP`;
    titulo = `${c.dias} días de racha`;
    sub = VOZ_HITO[estado.ajustes[id].tono](c.dias);
  } else if (c.tipo === "reparada") {
    etiqueta = "Racha reparada";
    titulo = `${c.dias} ${c.dias === 1 ? "día" : "días"} de racha`;
    sub = VOZ_REPARADA[estado.ajustes[id].tono];
  } else if (c.tipo === "meta") {
    etiqueta = "Meta diaria cumplida · +10 XP";
    titulo = `${c.meta} XP hoy`;
    sub = VOZ_META[estado.ajustes[id].tono];
  } else if (c.tipo === "misiones") {
    etiqueta = "Misiones del día · +20 XP";
    titulo = "Las 3 misiones";
    sub = VOZ_MISIONES[estado.ajustes[id].tono];
  } else if (c.tipo === "balance") {
    id = "centavo";
    const mes = nombreMes(c.mes);
    if (c.verde) {
      etiqueta = `Mes en verde · +${c.xp} XP`;
      titulo = `${mes} en verde`;
      sub = "Ganaste más de lo que gastaste. Así se construye.";
    } else {
      confeti = false;
      pose = "triste";
      etiqueta = `Mes en rojo · −${Math.abs(c.xp)} XP`;
      titulo = `${mes} en rojo`;
      sub = "Gastaste más de lo que entró. Tu nivel no baja, pero este mes toca recuperar.";
    }
    probar = "/finanzas";
  } else if (c.tipo === "nivel") {
    titulo = `Nivel ${c.nivel}`;
    etiqueta = c.cambioEtapa ? "Nueva etapa" : "Subiste de nivel";
    sub = VOZ_NIVEL[estado.ajustes[id].tono](c.etapa, c.cambioEtapa);
  } else if (c.tipo === "logro") {
    if (c.logro.asistente !== "todos") id = c.logro.asistente;
    titulo = c.logro.titulo;
    etiqueta = "Logro desbloqueado";
    sub = `${VOZ_LOGRO[estado.ajustes[id].tono]} ${c.logro.condicion}.`;
  } else {
    id = c.asistente;
    const a = estado.ajustes[id];
    titulo = c.item.label;
    etiqueta = `Vínculo ${c.item.vinculo} con ${a.nombre}`;
    sub = VOZ_DESBLOQUEO[a.tono](a.nombre);
    if (c.item.tipo === "accesorio") accesorio = c.item.valor as Accesorio;
    if (c.item.tipo === "combinacion") colores = c.item.valor === "dorada" ? DORADA : FICHAS[id].combinaciones[Number(c.item.valor)];
    probar = `/configuracion?seccion=asistentes&asis=${id}`;
  }
  const a = estado.ajustes[id];

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[3px] animate-in" onClick={cerrar} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebracion-titulo"
        aria-describedby="celebracion-sub"
        className="relative w-full max-w-[440px] overflow-hidden rounded-[28px] bg-bg px-6 pb-6 pt-4 text-center animate-in"
      >
        {confeti ? <Confeti key={`${i}-${cola.length}`} semilla={i + 1} /> : null}
        <div className="relative mx-auto -mb-2 flex justify-center">
          <Asistente
            key={`${id}-${i}`}
            id={id}
            size={240}
            pose={pose}
            colores={colores ?? a.colores}
            accesorio={accesorio ?? a.accesorio}
            mostrarProp={a.mostrarProp}
            nombre={a.nombre}
            celebrar={i + 1}
          />
          {c.tipo === "hito" || c.tipo === "reparada" ? (
            <span className="absolute bottom-6 right-[18%] grid place-items-center" aria-hidden>
              <IconoRacha size={72} />
            </span>
          ) : null}
        </div>
        <p className={`relative text-[13px] font-medium ${c.tipo === "balance" && !c.verde ? "text-danger" : "text-brand-soft"}`}>{etiqueta}</p>
        <h2 id="celebracion-titulo" className="relative mt-1 text-[34px] leading-tight tracking-[-0.02em]">
          {titulo}
        </h2>
        <p id="celebracion-sub" className="relative mx-auto mt-2 max-w-[320px] text-[15px] text-muted">
          {sub}
        </p>
        {cola.length > 1 ? (
          <p className="relative mt-3 text-[12px] text-dim" aria-live="polite">
            {i + 1} de {cola.length}
          </p>
        ) : null}
        <div className="relative mt-5 flex flex-wrap justify-center gap-2">
          {probar ? (
            <Button
              variant="secondary"
              className="bg-card"
              onClick={() => {
                cerrar();
                router.push(probar!);
              }}
            >
              {c.tipo === "balance" ? "Ver finanzas" : "Probarlo"}
            </Button>
          ) : null}
          <Button variant="primary" data-autofocus onClick={siguiente}>
            {i + 1 < cola.length ? "Siguiente" : "Continuar"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
