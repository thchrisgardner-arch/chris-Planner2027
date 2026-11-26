"use client";

/**
 * La conexión del día en el inicio: dos asistentes juntos (mirándose) dicen algo que solo se ve
 * porque todo vive en la misma app. Máximo una al día (`lifeos:conexiones`); se puede cerrar.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { Asistente } from "@/components/asistentes/Asistente";
import { useData } from "@/lib/store/DataProvider";
import { useAsistentes } from "@/lib/asistentes/estado";
import { useToday } from "@/hooks/useToday";
import { crearAlmacen } from "@/lib/almacenLocal";
import { calcularConexiones, CONEXIONES_DEMO, type Conexion } from "@/lib/asistentes/conexiones";
import { useGamificacion } from "./Gamificacion";

interface DatosConexiones {
  version: 1;
  fecha: string;
  id: string | null;
  cerrada: boolean;
}
export const almacenConexiones = crearAlmacen<DatosConexiones>(
  "lifeos:conexiones",
  () => ({ version: 1, fecha: "", id: null, cerrada: false }),
  (c) => ({ version: 1, fecha: String(c.fecha ?? ""), id: (c.id as string) ?? null, cerrada: !!c.cerrada }),
);

/* Panel de pruebas: forzar un ejemplo */
let demo = -1;
const oyentes = new Set<() => void>();
export function mostrarConexionDemo() {
  demo = (demo + 1) % CONEXIONES_DEMO.length;
  oyentes.forEach((f) => f());
}
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

export function ConexionDelDia() {
  const { db } = useData();
  const today = useToday();
  const g = useGamificacion();
  const { estado } = useAsistentes();
  const datos = almacenConexiones.useValor();
  const iDemo = useSyncExternalStore(suscribir, () => demo, () => -1);

  const validas = useMemo(
    () => (today ? calcularConexiones({ db, hoy: today, tareasCompletadas: g.progreso.eventos.filter((e) => e.tipo === "tarea") }) : []),
    [db, today, g.progreso.eventos],
  );

  // Una al día: la primera vez que hay alguna válida hoy, se fija esa
  useEffect(() => {
    if (!today || datos.fecha === today || !validas.length) return;
    almacenConexiones.guardar({ version: 1, fecha: today, id: validas[0].id, cerrada: false });
  }, [today, datos.fecha, validas]);

  let c: Conexion | undefined;
  if (iDemo >= 0) c = CONEXIONES_DEMO[iDemo];
  else if (datos.fecha === today && !datos.cerrada) c = validas.find((x) => x.id === datos.id);
  if (!c) return null;
  const activos = c.asistentes.filter((id) => estado.ajustes[id].activo);
  if (activos.length < 2) return null;
  const [a, b] = c.asistentes.map((id) => estado.ajustes[id]);

  const cerrar = () => {
    if (iDemo >= 0) {
      demo = -1;
      oyentes.forEach((f) => f());
    } else almacenConexiones.guardar({ ...datos, cerrada: true });
  };

  return (
    <section aria-label={`${a.nombre} y ${b.nombre}`} className="card relative flex flex-col gap-4 p-5 animate-in sm:flex-row sm:items-center sm:p-6">
      <div className="flex shrink-0 items-end" aria-hidden>
        <Asistente id={c.asistentes[0]} size={72} pose="feliz" colores={a.colores} accesorio={a.accesorio} decorativo animado={false} />
        {/* El segundo, espejado: los dos se miran */}
        <span className="-ml-2 inline-block -scale-x-100">
          <Asistente id={c.asistentes[1]} size={72} pose="feliz" colores={b.colores} accesorio={b.accesorio} decorativo animado={false} />
        </span>
      </div>
      <div className="min-w-0 flex-1 pr-8">
        <p className="text-[13px] text-muted">
          {a.nombre} y {b.nombre} · Conexión del día
        </p>
        <p className="mt-1 text-[17px] leading-snug sm:text-[18px]" aria-live="polite">
          {c.texto}
        </p>
        <Link href={c.accion.href} className="focus-ring mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-fg px-4 text-[13.5px] font-medium text-on-fg">
          {c.accion.label} <ArrowUpRight size={15} />
        </Link>
      </div>
      <button type="button" onClick={cerrar} aria-label="Cerrar la conexión del día" className="focus-ring absolute right-3 top-3 grid h-10 w-10 cursor-pointer place-items-center rounded-full text-muted hover:bg-elev">
        <X size={18} />
      </button>
    </section>
  );
}
