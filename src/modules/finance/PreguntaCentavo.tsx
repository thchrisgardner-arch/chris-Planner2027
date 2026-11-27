"use client";

/**
 * «Pregúntale a Centavo» (Fase 5, etapa 1): preguntas sobre tus finanzas respondidas en el
 * dispositivo, con cifras reales y sin IA. Nada sale del dispositivo. Centavo piensa (pensativo)
 * y responde (aprobando), con tono tranquilo si el chequeo de ánimo del día fue bajo.
 */
import { useMemo, useState } from "react";
import Link from "@/components/Enlace";
import { ArrowUpRight, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Asistente } from "@/components/asistentes/Asistente";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { almacenAnimo, diaDificil } from "@/lib/animoUsuario";
import { almacenPagosFijos, pagosDelMes, resumenMes } from "@/lib/finanzas/pagosFijos";
import { armarResumen, responderPregunta, SUGERENCIAS, type Respuesta } from "@/lib/finanzas/preguntas";
import { monthKey } from "@/utils/dates";
import { almacenConceptos } from "./EnQueSeVa";

export function PreguntaCentavo({ className }: { className?: string }) {
  const { db } = useData();
  const today = useToday();
  const { estado } = useAsistentes();
  const centavo = estado.ajustes.centavo;
  const animo = almacenAnimo.useValor();
  const fijosDatos = almacenPagosFijos.useValor();
  const { uniones } = almacenConceptos.useValor();
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [respuesta, setRespuesta] = useState<{ pregunta: string; r: Respuesta } | null>(null);

  const resumen = useMemo(() => {
    if (!today) return null;
    const lista = pagosDelMes(fijosDatos, db, monthKey(today));
    const rm = resumenMes(lista);
    const pendientes = lista.filter((x) => x.estado === "pendiente" || x.estado === "sin-generar").length;
    return armarResumen(db, today, { pagado: rm.pagado, falta: rm.falta, pendientes, total: rm.total }, uniones);
  }, [db, today, fijosDatos, uniones]);

  const preguntar = (q: string) => {
    if (!q.trim() || !resumen || !today) return;
    setPensando(true);
    // Un instante para que se vea a Centavo pensando (la cuenta es inmediata)
    setTimeout(() => {
      setRespuesta({ pregunta: q.trim(), r: responderPregunta(q, resumen, diaDificil(animo, today)) });
      setPensando(false);
    }, 450);
  };

  return (
    <Card className={className}>
      <div className="flex items-start gap-3">
        {centavo.activo ? (
          <Asistente id="centavo" size={56} momento={pensando ? "pensativo" : respuesta ? "aprobando" : "base"} colores={centavo.colores} accesorio={centavo.accesorio} decorativo animado={false} fx={false} />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px]">Pregúntale a {centavo.nombre}</h2>
          <p className="text-[12.5px] text-muted">Responde con tus datos, en este dispositivo.</p>
        </div>
      </div>
      <form
        className="mt-3 flex items-center gap-2 rounded-[16px] bg-bg-2 p-1.5 pl-3"
        onSubmit={(e) => {
          e.preventDefault();
          preguntar(texto);
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ej. ¿Cómo voy en comida?"
          aria-label={`Pregúntale a ${centavo.nombre}`}
          className="min-w-0 flex-1 rounded-[8px] bg-transparent px-1 py-1.5 text-[14px] outline-none placeholder:text-dim focus-visible:ring-2 focus-visible:ring-fg"
        />
        <Button type="submit" size="sm" variant="primary" disabled={!texto.trim()} aria-label="Preguntar">
          <Send size={15} />
        </Button>
      </form>
      <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Preguntas sugeridas">
        {SUGERENCIAS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setTexto(s);
              preguntar(s);
            }}
            className="focus-ring min-h-9 cursor-pointer rounded-full border border-line px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:text-fg"
          >
            {s}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="mt-3">
        {pensando ? (
          <p className="text-[13px] text-muted">{centavo.nombre} está sacando la cuenta…</p>
        ) : respuesta ? (
          <div className="rounded-[18px] bg-bg-2 p-4">
            <p className="text-[12.5px] text-dim">{respuesta.pregunta}</p>
            {respuesta.r.cifra ? <p className="figure mt-1 text-[30px] leading-tight">{respuesta.r.cifra}</p> : null}
            <p className="mt-1 text-[14px]">
              <span className="font-medium">{centavo.nombre}:</span> {respuesta.r.frase}
            </p>
            {respuesta.r.enlace ? (
              <Link href={respuesta.r.enlace.href} className="focus-ring mt-2 inline-flex items-center gap-1 rounded-full text-[13px] font-medium hover:underline">
                {respuesta.r.enlace.label} <ArrowUpRight size={14} />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
