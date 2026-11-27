"use client";

/**
 * Avisos de dinero de Centavo, sin culpa:
 *  - Al cruzar el 80 % (pensativo): cuánto va y cuánto queda.
 *  - Al cruzar el 100 % (preocupado): cuánto se pasó, con «Ajustar presupuesto» y «Ver gastos».
 * Una vez por cruce, máximo 1 por proyecto al día, con tono tranquilo si la persona amaneció mal.
 * Si la app está en segundo plano y los avisos de Centavo están activos, también sale una
 * notificación local (nada sale del dispositivo).
 * Aquí corre además la migración (versión 1) del presupuesto estimado a `money`.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Asistente } from "@/components/asistentes/Asistente";
import { Button } from "@/components/ui/Button";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { almacenAnimo, diaDificil } from "@/lib/animoUsuario";
import { migrarDineroProyecto } from "@/lib/proyectos/dinero";
import { almacenDinero, mismosDatos, revisarAvisos, type AvisoDinero } from "@/lib/proyectos/avisosDinero";
import { rutaProyecto } from "@/lib/proyectos/vistas";

/* Panel de pruebas: forzar un aviso */
let forzado: AvisoDinero | null = null;
const oyentes = new Set<() => void>();
export function forzarAvisoDinero(a: AvisoDinero | null) {
  forzado = a;
  oyentes.forEach((f) => f());
}
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

let migrando = false;

export function AvisosDinero() {
  const { db, status, mode, update } = useData();
  const today = useToday();
  const animo = almacenAnimo.useValor();
  const { estado } = useAsistentes();
  const router = useRouter();
  const [aviso, setAviso] = useState<AvisoDinero | null>(null);
  const demo = useSyncExternalStore(suscribir, () => forzado, () => null);
  const listo = status === "ready";
  const centavo = estado.ajustes.centavo;

  // Migración versionada: el presupuesto estimado de cada proyecto pasa a money (una vez; segura de repetir)
  useEffect(() => {
    if (!listo || mode === "demo" || migrando || almacenDinero.leer().migracion >= 1) return;
    migrando = true;
    void (async () => {
      try {
        for (const p of db.projects) {
          const cambio = migrarDineroProyecto(p);
          if (cambio) await update("projects", p.id, cambio);
        }
        almacenDinero.cambiar((d) => ({ ...d, migracion: 1 }));
      } catch {
        /* se reintenta al abrir otra vez la app */
      } finally {
        migrando = false;
      }
    })();
    // Solo al quedar listos los datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo]);

  // Cada cambio en proyectos o movimientos: ¿algún proyecto cruzó un umbral?
  useEffect(() => {
    if (!listo || !today) return;
    const antes = almacenDinero.leer();
    const { datos, aviso: nuevo } = revisarAvisos(antes, db.projects, db.transactions, today, diaDificil(animo, today));
    if (!mismosDatos(antes, datos)) almacenDinero.guardar(datos);
    if (!nuevo) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el aviso nace de un cambio en los datos
    setAviso(nuevo);
    notificar(nuevo, centavo.nombre, centavo.activo && centavo.avisos === "en-el-momento");
  }, [listo, today, db.projects, db.transactions, animo, centavo.nombre, centavo.activo, centavo.avisos]);

  const a = demo ?? aviso;
  const cerrar = () => (demo ? forzarAvisoDinero(null) : setAviso(null));
  const ir = (ajustar: boolean) => {
    if (!a) return;
    cerrar();
    router.push(`${rutaProyecto(a.proyectoId, "dinero")}${ajustar ? "&ajustar=1" : ""}`);
  };

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[80] flex justify-center px-4 md:bottom-6 md:justify-end md:pr-6">
      {a ? (
        <div className="card pointer-events-auto flex w-full max-w-[400px] items-start gap-3 p-4 animate-in">
          {centavo.activo ? (
            <Asistente id="centavo" size={56} momento={a.pose} colores={centavo.colores} accesorio={centavo.accesorio} decorativo animado={false} fx={false} />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-snug">
              <span className="font-medium">{centavo.nombre}:</span> {a.texto}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {a.pasado ? (
                <Button size="sm" variant="primary" onClick={() => ir(true)}>
                  Ajustar presupuesto
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" className="bg-bg-2" onClick={() => ir(false)}>
                Ver gastos
              </Button>
            </div>
          </div>
          <button type="button" onClick={cerrar} aria-label="Cerrar aviso" className="focus-ring grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-dim hover:text-fg">
            <X size={17} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Notificación local (solo si la app no está a la vista y la persona activó los avisos de Centavo) */
function notificar(a: AvisoDinero, nombre: string, activos: boolean) {
  if (!activos || typeof window === "undefined" || document.visibilityState === "visible") return;
  if (!("Notification" in window) || Notification.permission !== "granted" || !navigator.serviceWorker) return;
  void navigator.serviceWorker.ready
    .then((reg) => reg.showNotification(`${nombre} · ${a.nombre}`, { body: a.texto, tag: `lifeos-dinero-${a.proyectoId}`, data: { url: rutaProyecto(a.proyectoId, "dinero") } }))
    .catch(() => {});
}
