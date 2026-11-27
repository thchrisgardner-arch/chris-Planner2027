"use client";

/**
 * Recomendar la app (Fase 6). En el inicio, una tarjeta (nunca un modal) que dice el asistente
 * principal justo después de un momento positivo, con «Compartir», «Ahora no» y «No volver a
 * mostrar». En Configuración, el acceso permanente. Compartir: Web Share en el celular
 * (WhatsApp, Telegram…); en escritorio, copiar el enlace. Sin seguimiento.
 */
import { useEffect, useSyncExternalStore } from "react";
import { Share2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Asistente } from "@/components/asistentes/Asistente";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { almacenAnimo, diaDificil } from "@/lib/animoUsuario";
import { almacenRecomendar, debeMostrar, ENLACE_APP, TEXTO_COMPARTIR } from "@/lib/recomendar";
import { useGamificacion } from "./Gamificacion";

/** Compartir en 2 toques: abre el menú del sistema, o copia el enlace donde no lo hay */
export function useCompartir() {
  const { toast } = useFeedback();
  return async () => {
    const datos = { title: "Poku Poku", text: TEXTO_COMPARTIR, url: ENLACE_APP };
    try {
      if (typeof navigator !== "undefined" && navigator.share && (!navigator.canShare || navigator.canShare(datos))) {
        await navigator.share(datos);
        return;
      }
      const texto = `${TEXTO_COMPARTIR} ${ENLACE_APP}`;
      try {
        await navigator.clipboard.writeText(texto);
      } catch {
        // Navegadores que bloquean el portapapeles: copia clásica con un campo oculto
        const campo = document.createElement("textarea");
        campo.value = texto;
        campo.setAttribute("readonly", "");
        campo.style.position = "fixed";
        campo.style.opacity = "0";
        document.body.appendChild(campo);
        campo.select();
        const ok = document.execCommand("copy");
        campo.remove();
        if (!ok) throw new Error("copia");
      }
      toast("Enlace copiado");
    } catch (e) {
      // Cerrar el menú de compartir no es un error
      if ((e as Error)?.name !== "AbortError") toast("No se pudo compartir. El enlace es " + ENLACE_APP, "error");
    }
  };
}

/* Panel de pruebas (?demo=1): forzar la invitación */
let forzada = false;
const oyentes = new Set<() => void>();
export function forzarRecomendarDemo(v = true) {
  forzada = v;
  oyentes.forEach((f) => f());
}
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

export function RecomendarApp() {
  const today = useToday();
  const datos = almacenRecomendar.useValor();
  const animo = almacenAnimo.useValor();
  const { estado } = useAsistentes();
  const g = useGamificacion();
  const demo = useSyncExternalStore(suscribir, () => forzada, () => false);
  const compartir = useCompartir();
  const principal = estado.principal;
  const a = estado.ajustes[principal];

  // Primer día de uso en este dispositivo
  useEffect(() => {
    if (today && !datos.primerUso) almacenRecomendar.cambiar((d) => ({ ...d, primerUso: today }));
  }, [today, datos.primerUso]);

  const mostrar = !!today && (demo || debeMostrar(datos, today, { diaDificil: diaDificil(animo, today), primerDiaActivo: g.progreso.racha.diasActivos[0] ?? null }));

  // Mostrarla cuenta como «la vez» de los próximos 30 días
  useEffect(() => {
    if (mostrar && !demo && today && datos.ultimo !== today) almacenRecomendar.cambiar((d) => ({ ...d, ultimo: today }));
  }, [mostrar, demo, today, datos.ultimo]);

  if (!mostrar) return null;
  const cerrar = () => {
    if (demo) forzarRecomendarDemo(false);
    // «Ahora no»: se oculta hoy (y por la regla de 30 días, no vuelve antes)
    else almacenRecomendar.cambiar((d) => ({ ...d, momento: null }));
  };

  return (
    <section aria-label="Recomendar la app" aria-live="polite" className="card flex flex-col gap-4 p-5 animate-in sm:flex-row sm:items-center sm:p-6">
      {a.activo ? <Asistente id={principal} size={72} momento="feliz" colores={a.colores} accesorio={a.accesorio} decorativo animado={false} /> : null}
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-snug">
          <span className="font-medium">{a.nombre}:</span> Si te está sirviendo, compártela con alguien que también quiera ordenar su vida.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            onClick={() => {
              void compartir();
              cerrar();
            }}
          >
            <Share2 size={17} /> Compartir
          </Button>
          <Button variant="secondary" className="bg-bg-2" onClick={cerrar}>
            Ahora no
          </Button>
          <button
            type="button"
            onClick={() => {
              if (demo) forzarRecomendarDemo(false);
              almacenRecomendar.cambiar((d) => ({ ...d, nunca: true }));
            }}
            className="focus-ring min-h-11 cursor-pointer rounded-full px-2 text-[12.5px] text-dim underline-offset-2 hover:text-fg hover:underline"
          >
            No volver a mostrar
          </button>
        </div>
      </div>
    </section>
  );
}

/** Configuración → acceso permanente */
export function TarjetaRecomendar() {
  const compartir = useCompartir();
  return (
    <Card>
      <CardHeader title="Recomendar la app" subtitle="Compártela con alguien que también quiera ordenar su vida. No se registra con quién." />
      <Button variant="primary" onClick={() => void compartir()}>
        <Share2 size={18} /> Compartir Poku Poku
      </Button>
    </Card>
  );
}
