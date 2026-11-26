"use client";

/** Notas del proyecto: un documento libre que se guarda solo mientras escribes (tipo Notion). */
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { espacio, useEspacio } from "@/lib/proyectos/espacio";

const hace = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(iso));
};

export function NotasProyecto({ proyectoId }: { proyectoId: string }) {
  const e = useEspacio();
  const guardada = e.notas[proyectoId];
  const [texto, setTexto] = useState(guardada?.texto ?? "");
  const [pendiente, setPendiente] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  // Crece con el contenido
  useEffect(() => {
    const t = area.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.max(160, t.scrollHeight)}px`;
  }, [texto]);

  // Lo último escrito se guarda también al salir del panel o cerrar la pestaña (antes se perdía si salías antes de 0,6 s)
  const ultimo = useRef({ texto, pendiente });
  useEffect(() => {
    ultimo.current = { texto, pendiente };
  });
  useEffect(() => {
    const guardarYa = () => {
      if (ultimo.current.pendiente) espacio.guardarNota(proyectoId, ultimo.current.texto);
    };
    window.addEventListener("pagehide", guardarYa);
    return () => {
      window.removeEventListener("pagehide", guardarYa);
      guardarYa();
    };
  }, [proyectoId]);

  // Guardado automático 0,6 s después de dejar de escribir
  useEffect(() => {
    if (!pendiente) return;
    const t = setTimeout(() => {
      espacio.guardarNota(proyectoId, texto);
      setPendiente(false);
    }, 600);
    return () => clearTimeout(t);
  }, [texto, pendiente, proyectoId]);

  return (
    <div>
      <textarea
        ref={area}
        value={texto}
        onChange={(ev) => {
          setTexto(ev.target.value);
          setPendiente(true);
        }}
        aria-label="Notas del proyecto"
        placeholder={"Escribe ideas, decisiones, enlaces o lo que necesites recordar…\n\nUsa líneas con «- » para listas."}
        className="block w-full resize-none rounded-[18px] bg-bg-2 px-4 py-3.5 text-[14.5px] leading-relaxed outline-none placeholder:text-dim focus:ring-2 focus:ring-[var(--color-brand)]"
      />
      <p className="mt-1.5 flex items-center gap-1 px-1 text-[12px] text-dim" aria-live="polite">
        {pendiente ? (
          "Guardando…"
        ) : guardada ? (
          <>
            <Check size={13} /> Guardado {hace(guardada.actualizado)}
          </>
        ) : (
          "Se guarda solo mientras escribes"
        )}
      </p>
    </div>
  );
}
