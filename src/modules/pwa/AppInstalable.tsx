"use client";

/**
 * App en el celular:
 *  - PWA: registra el service worker (sin conexión), guarda el aviso de instalación y, al tercer
 *    día de uso en el celular, el asistente principal sugiere instalarla una sola vez.
 *  - TarjetaInstalar: botón "Instalar app" en Configuración.
 */
import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Asistente } from "@/components/asistentes/Asistente";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useAsistentes } from "@/lib/asistentes/estado";
import { useToday } from "@/hooks/useToday";
import { almacenUso, escucharInstalacion, esMovil, instalarApp, registrarDiaMovil, registrarSW, useInstalacion } from "@/lib/pwa";

export function PWA() {
  const today = useToday();
  const { mode } = useData();
  const estado = useInstalacion();
  const uso = almacenUso.useValor();
  const [movil, setMovil] = useState(false);

  useEffect(() => {
    escucharInstalacion();
    // En desarrollo no se registra solo (el de producción guarda la app en caché). Se registra cuando
    // la página ya cargó y el navegador está libre, para no competir con la primera pantalla.
    let t = 0;
    if (process.env.NODE_ENV === "production") {
      const registrar = () => {
        t = window.setTimeout(() => {
          const ric = (window as Window & { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback;
          if (ric) ric(() => void registrarSW()?.catch(() => {}));
          else void registrarSW()?.catch(() => {});
        }, 3000);
      };
      if (document.readyState === "complete") registrar();
      else window.addEventListener("load", registrar, { once: true });
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende del dispositivo, solo en el navegador
    setMovil(esMovil());
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (today && movil && mode !== "demo") registrarDiaMovil(today);
  }, [today, movil, mode]);

  const sugerir = movil && mode !== "demo" && uso.sugerenciaInstalar === "pendiente" && uso.diasMovil.length >= 3 && (estado === "disponible" || estado === "ios");
  return sugerir ? <SugerenciaInstalar ios={estado === "ios"} /> : null;
}

function SugerenciaInstalar({ ios }: { ios: boolean }) {
  const { estado } = useAsistentes();
  const a = estado.ajustes[estado.principal];
  const cerrar = () => almacenUso.guardar({ ...almacenUso.leer(), sugerenciaInstalar: "mostrada" });
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[70] flex items-start gap-3 rounded-[14px] border border-brand/30 bg-card px-4 py-3 animate-in md:hidden">
      <Asistente id={estado.principal} size={48} pose="feliz" colores={a.colores} accesorio={a.accesorio} decorativo animado={false} />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] leading-snug">
          <span className="font-medium">{a.nombre}:</span>{" "}
          {ios ? (
            <>
              ¿Me llevas en el inicio? Toca <Share size={14} className="inline align-[-2px]" aria-label="Compartir" /> y luego «Agregar a inicio».
            </>
          ) : (
            "Ya van tres días. ¿Me instalas? Abro más rápido y funciono sin internet."
          )}
        </p>
        {!ios ? (
          <div className="mt-2.5 flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                cerrar();
                await instalarApp();
              }}
            >
              Instalar
            </Button>
            <Button size="sm" variant="ghost" onClick={cerrar}>
              Ahora no
            </Button>
          </div>
        ) : null}
      </div>
      <button type="button" onClick={cerrar} aria-label="Cerrar sugerencia" className="focus-ring -m-1 grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-muted">
        <X size={18} />
      </button>
    </div>
  );
}

export function TarjetaInstalar() {
  const estado = useInstalacion();
  const { toast } = useFeedback();
  return (
    <Card>
      <CardHeader title="App en tu dispositivo" subtitle="Instálala para abrirla desde el inicio, a pantalla completa y sin conexión" />
      {estado === "instalada" ? (
        <p className="text-[14px] text-muted">Ya está instalada en este dispositivo.</p>
      ) : estado === "disponible" ? (
        <Button
          variant="primary"
          onClick={async () => {
            if (await instalarApp()) toast("Listo. Ya la tienes en tu inicio.");
          }}
        >
          Instalar app
        </Button>
      ) : estado === "ios" ? (
        <ol className="grid gap-2 text-[14px] text-muted">
          <li className="flex items-center gap-2">
            1. En Safari, toca <Share size={16} className="text-fg" aria-label="Compartir" /> Compartir.
          </li>
          <li className="flex items-center gap-2">
            2. Elige <SquarePlus size={16} className="text-fg" aria-hidden /> «Agregar a inicio».
          </li>
        </ol>
      ) : (
        <p className="text-[14px] text-muted">Ábrela en Chrome, Edge o Safari del celular para instalarla. En el computador, busca el ícono de instalar en la barra de direcciones.</p>
      )}
    </Card>
  );
}
