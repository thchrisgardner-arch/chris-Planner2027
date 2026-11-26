"use client";

/**
 * "¿Cómo amaneciste?": la primera apertura del día, el asistente principal pregunta con 5 opciones
 * ilustradas por él mismo. Toma 3 segundos, se puede saltar y se apaga en Configuración → Progreso.
 * No sale en la sesión de bienvenida ni durante el tutorial; el pop-up de racha espera a que se responda.
 */
import { useSyncExternalStore } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Asistente } from "@/components/asistentes/Asistente";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useAsistentes } from "@/lib/asistentes/estado";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { almacenAnimo, chequeoPendiente, OPCIONES_ANIMO, registrarAnimo, saltarAnimo, type NivelAnimo } from "@/lib/animoUsuario";
import { esSesionDeBienvenida, useTutorialActivo } from "@/modules/tutorial/Tutorial";
import { useGamificacion } from "./Gamificacion";

const RESPUESTA: Record<NivelAnimo, string> = {
  1: "Gracias por decirlo. Hoy vamos suave: dos misiones y nada de regaños.",
  2: "Entendido. Hoy vamos con calma, sin presión.",
  3: "Bien. Un día normal también suma.",
  4: "¡Eso! Aprovechemos el día.",
  5: "¡Qué bueno! Vamos con toda.",
};

/** Forzar el chequeo desde el panel de pruebas (modo demo) */
let forzado = false;
const oyentes = new Set<() => void>();
export function abrirChequeoAnimo() {
  forzado = true;
  oyentes.forEach((f) => f());
}
function cerrarChequeo() {
  forzado = false;
  oyentes.forEach((f) => f());
}
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

/** ¿Se está mostrando o está por mostrarse hoy? (el pop-up de racha espera) */
export function useChequeoEnCurso() {
  const datos = almacenAnimo.useValor();
  const today = useToday();
  const { mode, status } = useData();
  const tutorial = useTutorialActivo();
  const f = useSyncExternalStore(suscribir, () => forzado, () => false);
  if (f) return true;
  if (status !== "ready" || !today || mode === "demo" || tutorial || esSesionDeBienvenida()) return false;
  return chequeoPendiente(datos, today);
}

export function ChequeoAnimo() {
  const visible = useChequeoEnCurso();
  const today = useToday();
  const { estado } = useAsistentes();
  const g = useGamificacion();
  const { toast } = useFeedback();
  if (!visible) return null;
  const a = estado.ajustes[estado.principal];

  const cerrar = cerrarChequeo;
  const elegir = (n: NivelAnimo) => {
    registrarAnimo(today, n);
    if (n <= 2) g.suavizarDia();
    cerrar();
    toast(`${a.nombre}: ${RESPUESTA[n]}`);
  };

  return (
    <Modal
      open
      onClose={() => {
        saltarAnimo(today);
        cerrar();
      }}
      size="md"
      title="¿Cómo amaneciste?"
      description={`${a.nombre} quiere saber. Solo lo ves tú.`}
      footer={
        <Button
          variant="ghost"
          onClick={() => {
            saltarAnimo(today);
            cerrar();
          }}
        >
          Saltar
        </Button>
      }
    >
      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Tu ánimo de hoy">
        {OPCIONES_ANIMO.map((o) => (
          <button
            key={o.nivel}
            type="button"
            onClick={() => elegir(o.nivel)}
            className="focus-ring flex cursor-pointer flex-col items-center gap-1 rounded-[16px] bg-card px-1 py-2.5 text-[12.5px] font-medium transition-colors hover:bg-elev"
          >
            <Asistente id={estado.principal} size={52} pose={o.pose} colores={a.colores} accesorio={a.accesorio} decorativo animado={false} fx={false} />
            {o.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
