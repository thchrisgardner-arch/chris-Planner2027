"use client";

/**
 * Cierre del proyecto: al marcarlo como terminado, Tuerca y Centavo dicen juntos cómo quedó
 * (presupuesto contra gastado, ingresos y balance si aplica, horas de enfoque y valor por hora).
 * Se puede descargar como imagen con el mismo «Descargar imagen» de /progreso.
 */
import { useRef } from "react";
import { Download } from "lucide-react";
import { Asistente } from "@/components/asistentes/Asistente";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { filasCierre, tituloCierre } from "@/lib/proyectos/dinero";
import { descargarResumen } from "@/modules/asistentes/exportarImagen";
import { useHorasEnfoque } from "@/modules/enfoque/ModoEnfoque";
import { slug } from "@/lib/proyectos/exportarVoz";
import type { Project } from "@/types/db";

export function CierreProyecto({ proyecto: p, onClose }: { proyecto: Project; onClose: () => void }) {
  const { db } = useData();
  const today = useToday();
  const horas = useHorasEnfoque(p.id);
  const { estado } = useAsistentes();
  const tuerca = estado.ajustes.tuerca;
  const centavo = estado.ajustes.centavo;
  const refTuerca = useRef<HTMLDivElement>(null);
  const refCentavo = useRef<HTMLDivElement>(null);
  const filas = filasCierre(p, db.transactions, today, horas);
  const titulo = tituloCierre(p, db.transactions, today);

  return (
    <Modal
      open
      onClose={onClose}
      title="Cierre del proyecto"
      description={`${tuerca.nombre} y ${centavo.nombre} te cuentan cómo quedó.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              descargarResumen({
                titulo,
                filas,
                svg: refTuerca.current?.querySelector("svg") ?? null,
                svg2: refCentavo.current?.querySelector("svg") ?? null,
                archivo: `lifeos-cierre-${slug(p.name)}.png`,
              })
            }
          >
            <Download size={17} /> Descargar imagen
          </Button>
        </>
      }
    >
      <div className="flex items-end gap-1" aria-hidden>
        <div ref={refTuerca}>
          <Asistente id="tuerca" size={84} momento="orgulloso" angulo="tres-cuartos" colores={tuerca.colores} accesorio={tuerca.accesorio} decorativo animado={false} fx={false} />
        </div>
        <div ref={refCentavo}>
          <Asistente id="centavo" size={72} momento="celebrando" angulo="tres-cuartos-espejo" colores={centavo.colores} accesorio={centavo.accesorio} decorativo animado={false} fx={false} />
        </div>
      </div>
      <h3 className="mt-2 text-[22px] leading-tight">{titulo}</h3>
      <ul className="mt-4 divide-y divide-line rounded-[20px] bg-bg-2 px-4">
        {filas.map((f) => (
          <li key={f.label} className="flex items-center justify-between gap-3 py-3">
            <span className="text-[14px]">{f.label}</span>
            <span className="num text-[14.5px] font-bold">{f.valor}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
