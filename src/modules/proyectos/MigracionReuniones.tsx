"use client";

/**
 * Migración única (Paneles, Fase A): las reuniones guardadas en el espacio de proyectos pasan a ser
 * eventos del calendario con project_id y meeting. Corre una vez, con los datos ya cargados, y es
 * segura de repetir: cada evento recuerda de qué reunión salió (meeting.origen).
 * Las altas y cambios pasan por useData, así quedan anotados para la sincronización.
 */
import { useEffect } from "react";
import { useData } from "@/lib/store/DataProvider";
import { espacio, leerEspacio } from "@/lib/proyectos/espacio";
import { planMigracionReuniones } from "@/lib/proyectos/reuniones";

let enCurso = false;

export function MigracionReuniones() {
  const { status, mode, db, insert, update } = useData();
  const listo = status === "ready" && mode !== "demo";

  useEffect(() => {
    if (!listo || enCurso) return;
    const e = leerEspacio();
    if ((e.version ?? 1) >= 3) return;
    if (!e.reuniones.length) {
      espacio.cerrarMigracionReuniones({});
      return;
    }
    enCurso = true;
    void (async () => {
      try {
        const plan = planMigracionReuniones(e.reuniones, db.calendar_events, db.projects);
        const mapa: Record<string, string> = { ...plan.hechas };
        for (const a of plan.actualizar) {
          await update("calendar_events", a.eventoId, a.patch);
          mapa[a.reunionId] = a.eventoId;
        }
        for (const c of plan.crear) mapa[c.reunionId] = (await insert("calendar_events", c.fila)).id;
        espacio.cerrarMigracionReuniones(mapa);
      } catch {
        /* se reintenta al abrir otra vez la app; nada se duplica */
      } finally {
        enCurso = false;
      }
    })();
    // Solo al quedar listos los datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);

  return null;
}
