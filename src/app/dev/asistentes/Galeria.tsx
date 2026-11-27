"use client";

/**
 * Hojas de verificación de los asistentes (solo desarrollo):
 *  - Fidelidad: el dibujo actual (pose de siempre) junto al nuevo en ángulo de frente.
 *  - Giro: los 5 ángulos.
 *  - Momentos: los 20 momentos.
 * ?base=1 muestra solo cada personaje en grande (para renderizar los PNG de referencia).
 * ?solo=centavo muestra un solo personaje.
 */
import { useEffect, useState } from "react";
import { Asistente } from "@/components/asistentes/Asistente";
import { RIGS } from "@/components/asistentes/figuras";
import { CRECIMIENTO_LABEL, ETAPAS_CRECIMIENTO } from "@/lib/asistentes/crecimiento";
import {
  ACCESORIO_LABEL,
  ANGULOS,
  ANGULO_LABEL,
  ASISTENTE_IDS,
  EXPRESIONES,
  EXPRESION_LABEL,
  MOMENTOS,
  MOMENTO_LABEL,
  MOMENTOS_REY,
  ACCESORIOS,
  ACCESORIOS_SITUACION,
  type Accesorio,
  type AsistenteId,
} from "@/lib/asistentes/tipos";

export function Galeria() {
  const [acc, setAcc] = useState<Accesorio>("ninguno");
  const [solo, setSolo] = useState<AsistenteId | "todos">("centavo");
  const [animado, setAnimado] = useState(false);
  const [base, setBase] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- parámetros de la URL, solo en el navegador
    setBase(q.get("base") === "1");
    const s = q.get("solo");
    if (s === "todos" || (ASISTENTE_IDS as readonly string[]).includes(s ?? "")) setSolo(s as AsistenteId | "todos");
  }, []);

  if (base) {
    return (
      <div className="flex flex-wrap gap-6 bg-white p-6">
        {ASISTENTE_IDS.map((id) => (
          <div key={id} data-base={id} className="grid h-[512px] w-[512px] place-items-center bg-white">
            <Asistente id={id} pose="idle" size={440} animado={false} decorativo />
          </div>
        ))}
      </div>
    );
  }

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
        {[...ACCESORIOS, ...ACCESORIOS_SITUACION].map((a) => (
          <button key={a} onClick={() => setAcc(a)} className={`rounded-full px-3 py-1.5 ${acc === a ? "bg-fg text-on-fg" : "bg-card"}`}>
            {ACCESORIO_LABEL[a]}
          </button>
        ))}
        <button onClick={() => setAnimado((v) => !v)} className="ml-2 rounded-full bg-card px-3 py-1.5">
          {animado ? "Pausar" : "Animar"}
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {ids.map((id) => (
          <section key={id} id={`hoja-${id}`} data-hoja={id} className="rounded-[24px] bg-card p-5">
            <h2 className="mb-3 text-[17px]">{RIGS[id].nombre}</h2>

            <h3 className="mb-2 text-[13px] text-muted">Fidelidad: actual (izquierda) y nuevo de frente (derecha)</h3>
            <div data-seccion="fidelidad" className="mb-5 flex gap-3">
              <figure className="flex flex-col items-center gap-1 rounded-[18px] bg-bg px-4 py-3">
                <Asistente id={id} pose="idle" size={150} accesorio={acc} animado={false} />
                <figcaption className="text-[12px] text-muted">Actual</figcaption>
              </figure>
              <figure className="flex flex-col items-center gap-1 rounded-[18px] bg-bg px-4 py-3">
                <Asistente id={id} momento="base" angulo="frente" size={150} accesorio={acc} animado={false} />
                <figcaption className="text-[12px] text-muted">Nuevo · frente</figcaption>
              </figure>
            </div>

            <h3 className="mb-2 text-[13px] text-muted">Giro: 5 ángulos</h3>
            <div data-seccion="giro" className="mb-5 grid grid-cols-5 gap-3">
              {ANGULOS.map((a) => (
                <figure key={a} className="flex flex-col items-center gap-1 rounded-[18px] bg-bg py-3">
                  <Asistente id={id} momento="base" angulo={a} size={130} accesorio={acc} animado={animado} />
                  <figcaption className="text-[12px] text-muted">{ANGULO_LABEL[a]}</figcaption>
                </figure>
              ))}
            </div>

            <h3 className="mb-2 text-[13px] text-muted">20 momentos</h3>
            <div data-seccion="momentos" className="grid grid-cols-5 gap-3">
              {MOMENTOS.map((m, i) => (
                <figure key={m} className="flex flex-col items-center gap-1 rounded-[18px] bg-bg py-3">
                  <Asistente id={id} momento={m} size={130} accesorio={acc} animado={animado} />
                  <figcaption className="text-[12px] text-muted">
                    {i + 1}. {MOMENTO_LABEL[m]}
                  </figcaption>
                </figure>
              ))}
            </div>

            <h3 className="mb-2 mt-5 text-[13px] text-muted">Crecimiento: 4 etapas (solo suma detalles)</h3>
            <div data-seccion="crecimiento" className="grid grid-cols-4 gap-3">
              {ETAPAS_CRECIMIENTO.map((e) => (
                <figure key={e} className="flex flex-col items-center gap-1 rounded-[18px] bg-bg py-3">
                  <Asistente id={id} momento="base" angulo="tres-cuartos" crecimiento={e} size={130} accesorio={acc} animado={animado} />
                  <figcaption className="text-[12px] text-muted">{CRECIMIENTO_LABEL[e]}</figcaption>
                </figure>
              ))}
            </div>

            <h3 className="mb-2 mt-5 text-[13px] text-muted">Rey: su trono y sus momentos</h3>
            <div data-seccion="rey" className="grid grid-cols-5 gap-3">
              {MOMENTOS_REY.map((m) => (
                <figure key={m} className="flex flex-col items-center gap-1 rounded-[18px] bg-bg pb-3 pt-6">
                  <Asistente id={id} momento={m} crecimiento="rey" size={130} accesorio={acc} animado={animado} />
                  <figcaption className="text-[12px] text-muted">{MOMENTO_LABEL[m]}</figcaption>
                </figure>
              ))}
            </div>

            <h3 className="mb-2 mt-5 text-[13px] text-muted">Las 8 poses de siempre (sin cambios)</h3>
            <div className="flex flex-wrap items-end gap-3">
              {EXPRESIONES.map((p) => (
                <figure key={p} className="flex flex-col items-center">
                  <Asistente id={id} pose={p} size={72} accesorio={acc} animado={false} />
                  <figcaption className="text-[11px] text-muted">{EXPRESION_LABEL[p]}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
