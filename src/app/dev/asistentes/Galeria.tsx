"use client";

import { useState } from "react";
import { Asistente } from "@/components/asistentes/Asistente";
import { RIGS } from "@/components/asistentes/figuras";
import { ACCESORIOS, ASISTENTE_IDS, EXPRESIONES, EXPRESION_LABEL, type Accesorio, type AsistenteId } from "@/lib/asistentes/tipos";

/** Hojas de poses: los 6 personajes en sus 8 poses (solo desarrollo). */
export function Galeria() {
  const [acc, setAcc] = useState<Accesorio>("ninguno");
  const [solo, setSolo] = useState<AsistenteId | "todos">("todos");
  const [animado, setAnimado] = useState(true);
  const ids = solo === "todos" ? ASISTENTE_IDS : [solo];
  return (
    <div className="min-h-dvh bg-bg p-6 text-fg">
      <div className="mb-5 flex flex-wrap items-center gap-2 text-[13px]">
        {(["todos", ...ASISTENTE_IDS] as const).map((x) => (
          <button key={x} onClick={() => setSolo(x)} className={`rounded-full px-3 py-1.5 capitalize ${solo === x ? "bg-fg text-on-fg" : "bg-card"}`}>
            {x}
          </button>
        ))}
        <span className="mx-2" />
        {ACCESORIOS.map((a) => (
          <button key={a} onClick={() => setAcc(a)} className={`rounded-full px-3 py-1.5 ${acc === a ? "bg-fg text-on-fg" : "bg-card"}`}>
            {a}
          </button>
        ))}
        <button onClick={() => setAnimado((v) => !v)} className="ml-2 rounded-full bg-card px-3 py-1.5">
          {animado ? "Pausar" : "Animar"}
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {ids.map((id) => (
          <section key={id} id={`hoja-${id}`} className="rounded-[24px] bg-card p-5">
            <h2 className="mb-3 text-[15px]">{RIGS[id].nombre}</h2>
            <div className="grid grid-cols-4 gap-3 lg:grid-cols-8">
              {EXPRESIONES.map((p) => (
                <div key={p} className="flex flex-col items-center gap-1 rounded-[18px] bg-bg py-3">
                  <Asistente id={id} pose={p} size={120} accesorio={acc} animado={animado} interactivo />
                  <span className="text-[12px] text-muted">{EXPRESION_LABEL[p]}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-end gap-3">
              {EXPRESIONES.map((p) => (
                <Asistente key={p} id={id} pose={p} size={48} accesorio={acc} animado={false} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
