"use client";

/**
 * Panel Calendario del proyecto (Fase C): el mismo calendario de la app (Día / Semana / Mes y filtros)
 * con solo los eventos, reuniones y fechas límite de tareas de este proyecto. Lo que se crea aquí
 * queda en el proyecto y en el calendario general.
 * Tic avisa cuando una fecha límite del proyecto cae en un día que ya está lleno de eventos
 * (misma regla que la conexión Tuerca + Tic).
 */
import { useEffect, useMemo } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Asistente } from "@/components/asistentes/Asistente";
import { Button } from "@/components/ui/Button";
import { useForms } from "@/components/providers/FormsProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { EVENTOS_DIA_LLENO } from "@/lib/asistentes/conexiones";
import { registrarNuevo } from "@/lib/atajoNuevo";
import type { Database, Project } from "@/types/db";
import { addDays, relativeDay } from "@/utils/dates";
import { VistaCalendario, useVistaCalendario } from "@/modules/other/CalendarPage";
import { Seccion } from "./Seccion";

/** Días próximos (14) en que una fecha límite del proyecto choca con un día lleno de eventos */
export function choquesDeAgenda(db: Database, proyectoId: string, hoy: string, dias = 14) {
  const out: { fecha: string; tareas: string[]; eventos: number }[] = [];
  for (let k = 0; k <= dias; k++) {
    const d = addDays(hoy, k);
    const tareas = db.tasks.filter((t) => t.project_id === proyectoId && t.status !== "completada" && t.due_date === d).map((t) => t.name);
    if (!tareas.length) continue;
    const eventos = db.calendar_events.filter((e) => e.date === d).length;
    if (eventos >= EVENTOS_DIA_LLENO) out.push({ fecha: d, tareas, eventos });
  }
  return out;
}

export function PanelCalendario({ proyecto }: { proyecto: Project }) {
  const { db } = useData();
  const open = useForms();
  const today = useToday();
  const { estado: asistentes } = useAsistentes();
  const estado = useVistaCalendario("semana");
  const tic = asistentes.ajustes.tic;

  // Solo lo del proyecto: eventos (y reuniones) con project_id y tareas del proyecto
  const delProyecto = useMemo<Database>(
    () => ({
      ...db,
      calendar_events: db.calendar_events.filter((e) => e.project_id === proyecto.id),
      tasks: db.tasks.filter((t) => t.project_id === proyecto.id),
      habits: [],
      savings_goals: [],
      annual_goals: [],
    }),
    [db, proyecto.id],
  );
  const choques = today ? choquesDeAgenda(db, proyecto.id, today) : [];
  const nuevo = () => open({ kind: "event", defaults: { date: estado.view === "mes" || !estado.cursor ? today : estado.cursor, project_id: proyecto.id } });
  // N crea un evento en el proyecto (se vuelve a registrar con el día que se esté viendo)
  useEffect(() => registrarNuevo(nuevo));

  return (
    <Seccion
      id="calendario"
      titulo="Calendario del proyecto"
      icon={CalendarDays}
      accion={
        <Button size="sm" variant="primary" onClick={nuevo} title="Nuevo evento (N)">
          <Plus size={16} /> Nuevo evento
        </Button>
      }
    >
      {proyecto.due_date ? <p className="-mt-1 mb-3 text-[13px] text-muted">Entrega del proyecto: {relativeDay(proyecto.due_date, today).toLowerCase()}</p> : null}
      {choques.length && tic.activo ? (
        <div className="mb-3 flex items-center gap-3 rounded-[20px] bg-bg-2 p-3" role="status">
          <Asistente id="tic" size={44} pose="preocupado" colores={tic.colores} accesorio={tic.accesorio} decorativo animado={false} />
          <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
            <span className="font-medium">{tic.nombre}:</span> {choques[0].tareas.length === 1 ? `«${choques[0].tareas[0]}» vence` : `${choques[0].tareas.length} tareas vencen`}{" "}
            {relativeDay(choques[0].fecha, today).toLowerCase()} y ese día ya tienes {choques[0].eventos} eventos. ¿Lo mueves o lo adelantas?
            {choques.length > 1 ? <span className="text-muted"> Hay {choques.length - 1} día{choques.length > 2 ? "s" : ""} más así.</span> : null}
          </p>
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0 bg-bg"
            onClick={() => {
              estado.setCursor(choques[0].fecha);
              estado.setView("dia");
            }}
          >
            Ver ese día
          </Button>
        </div>
      ) : null}
      <div className="-mx-4 -mb-4 sm:-mx-5 sm:-mb-5">
        <VistaCalendario db={delProyecto} estado={estado} extra={{ project_id: proyecto.id }} />
      </div>
    </Seccion>
  );
}
