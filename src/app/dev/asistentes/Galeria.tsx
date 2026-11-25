"use client";

import { useState } from "react";
import { Asistente } from "@/components/asistentes/Asistente";
import { ACCESORIOS, ASISTENTE_IDS, EXPRESIONES, type Accesorio, type Expresion } from "@/lib/asistentes/tipos";

export function Galeria() {
  const [exp, setExp] = useState<Expresion>("neutral");
  const [acc, setAcc] = useState<Accesorio>("ninguno");
  const [dark, setDark] = useState(false);
  return (
    <div data-theme={dark ? "dark" : "light"} className="min-h-dvh bg-bg p-8 text-fg">
      <div className="mb-6 flex flex-wrap gap-2 text-[13px]">
        {EXPRESIONES.map((e) => (
          <button key={e} onClick={() => setExp(e)} className={`rounded-full px-3 py-1.5 ${exp === e ? "bg-fg text-on-fg" : "bg-card"}`}>
            {e}
          </button>
        ))}
        <span className="mx-2" />
        {ACCESORIOS.map((a) => (
          <button key={a} onClick={() => setAcc(a)} className={`rounded-full px-3 py-1.5 ${acc === a ? "bg-fg text-on-fg" : "bg-card"}`}>
            {a}
          </button>
        ))}
        <button onClick={() => setDark((d) => !d)} className="ml-4 rounded-full bg-card px-3 py-1.5">
          {dark ? "Claro" : "Oscuro"}
        </button>
      </div>
      <div id="grupo" className="grid grid-cols-3 gap-6 rounded-[24px] bg-card p-8" style={{ maxWidth: 1000 }}>
        {ASISTENTE_IDS.map((id) => (
          <div key={id} className="flex flex-col items-center gap-2">
            <Asistente id={id} size={260} expresion={exp} accesorio={acc} interactivo />
            <span className="text-[14px] font-bold capitalize">{id}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-end gap-6 rounded-[24px] bg-card p-6" style={{ maxWidth: 1000 }}>
        {ASISTENTE_IDS.map((id) => (
          <div key={id} className="flex items-end gap-3">
            <Asistente id={id} size={48} expresion={exp} accesorio={acc} />
            <Asistente id={id} size={96} expresion={exp} accesorio={acc} />
          </div>
        ))}
      </div>
    </div>
  );
}
