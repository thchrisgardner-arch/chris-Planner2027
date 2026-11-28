"use client";

/**
 * «Pregúntale a Centavo» (Fase 5, etapa 1): preguntas sobre tus finanzas respondidas en el
 * dispositivo, con cifras reales y sin IA. Nada sale del dispositivo. Centavo piensa (pensativo)
 * y responde (aprobando), con tono tranquilo si el chequeo de ánimo del día fue bajo.
 */
import { useMemo, useState } from "react";
import { almacenCentavoIA, resumenParaIA } from "@/lib/finanzas/centavoIA";
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
import { cn } from "@/utils/cn";
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
  const [respuesta, setRespuesta] = useState<{ pregunta: string; r: Respuesta; origen: "ia" | "reglas"; aviso?: string } | null>(null);
  // Prototipo de la etapa 2: responder con IA (Claude). Apagado por defecto
  const ia = almacenCentavoIA.useValor().activa;

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
    const tranquilo = diaDificil(animo, today);
    const reglas = responderPregunta(q, resumen, tranquilo);
    if (!ia) {
      // Un instante para que se vea a Centavo pensando (la cuenta es inmediata)
      setTimeout(() => {
        setRespuesta({ pregunta: q.trim(), r: reglas, origen: "reglas" });
        setPensando(false);
      }, 450);
      return;
    }
    // Con IA: la cifra y el enlace salen de la app; la frase, de Claude. Si falla, queda la etapa 1
    void fetch("/api/centavo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pregunta: q.trim(), resumen: resumenParaIA(resumen), tono: tranquilo ? "tranquilo" : "normal" }),
    })
      .then(async (res) => {
        const j = (await res.json().catch(() => ({}))) as { frase?: string; error?: string };
        if (!res.ok || !j.frase) throw new Error(j.error ?? "La IA no respondió.");
        const entendida = reglas.intencion !== "no-entendida";
        setRespuesta({ pregunta: q.trim(), r: { ...reglas, cifra: entendida ? reglas.cifra : null, enlace: entendida ? reglas.enlace : null, frase: j.frase }, origen: "ia" });
      })
      .catch((e: unknown) => setRespuesta({ pregunta: q.trim(), r: reglas, origen: "reglas", aviso: `${e instanceof Error ? e.message : "La IA no respondió."} Respondí sin IA.` }))
      .finally(() => setPensando(false));
  };

  return (
    <Card className={cn("min-w-0", className)}>
      <div className="flex items-start gap-3">
        {centavo.activo ? (
          <Asistente id="centavo" size={56} momento={pensando ? "pensativo" : respuesta ? "aprobando" : "base"} colores={centavo.colores} accesorio={centavo.accesorio} decorativo animado={false} fx={false} />
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px]">Pregúntale a {centavo.nombre}</h2>
          <p className="text-[12.5px] text-muted">{ia ? "Responde con IA a partir de tus totales (prueba)." : "Responde con tus datos, en este dispositivo."}</p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[12px] text-muted" title="Prototipo: envía solo totales (no cada movimiento) a Claude, de Anthropic, para redactar la respuesta.">
          <input
            type="checkbox"
            checked={ia}
            onChange={(e) => almacenCentavoIA.cambiar((d) => ({ ...d, activa: e.target.checked }))}
            className="h-4 w-4 accent-fg"
          />
          IA (prueba)
        </label>
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
      {/* Una sola línea: si no caben, se deslizan de lado (sin barra) */}
      <div className="sin-barra mt-2.5 flex gap-1.5 overflow-x-auto" role="group" aria-label="Preguntas sugeridas">
        {SUGERENCIAS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setTexto(s);
              preguntar(s);
            }}
            className="focus-ring min-h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:text-fg"
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
            <p className="text-[12.5px] text-dim">
              {respuesta.pregunta}
              {respuesta.origen === "ia" ? <span className="ml-1.5 rounded-full bg-bg px-1.5 py-0.5 text-[10.5px] font-medium text-muted">IA</span> : null}
            </p>
            {respuesta.aviso ? <p className="mt-1 text-[12px] text-warn">{respuesta.aviso}</p> : null}
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
