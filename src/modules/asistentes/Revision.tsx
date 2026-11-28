"use client";

/**
 * Revisión semanal: los domingos (o el primer día que abras la app en la semana) el asistente
 * principal invita a una revisión de 1 minuto en 3 pasos. Completarla da +25 XP.
 */
import { useMemo, useState } from "react";
import Link from "@/components/Enlace";
import { ArrowUpRight } from "lucide-react";
import { Asistente } from "@/components/asistentes/Asistente";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { FICHAS } from "@/lib/asistentes/definiciones";
import { getMensajeAsistente } from "@/lib/asistentes/motor";
import { ANIMO_LABEL, poseDeAnimo } from "@/lib/asistentes/animo";
import { ASISTENTE_IDS, type AsistenteId, type Pose } from "@/lib/asistentes/tipos";
import { resumenSemanal } from "@/lib/asistentes/resumenSemana";
import { formatCOP } from "@/utils/money";
import { cn } from "@/utils/cn";
import { useGamificacion } from "./Gamificacion";
import { useSemana } from "./semana";

const INVITA = {
  seco: "Un minuto para revisar la semana. Rápido, lo prometo.",
  motivador: "Revisemos tu semana. Un minuto y arrancas con todo.",
  tranquilo: "¿Revisamos tu semana? Toma un minuto.",
};

export function InvitacionRevision() {
  const g = useGamificacion();
  const { estado } = useAsistentes();
  const [abierta, setAbierta] = useState(false);
  if (!g.revisionPendiente && !abierta) return null;
  const id = estado.principal;
  const a = estado.ajustes[id];
  return (
    <>
      {g.revisionPendiente ? (
        <div className="card flex flex-wrap items-center gap-3 py-3 pl-3 pr-4">
          <Asistente id={id} size={48} pose="feliz" colores={a.colores} accesorio={a.accesorio} mostrarProp={a.mostrarProp} decorativo />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold">Revisión de la semana · 1 minuto</p>
            <p className="text-[13px] text-muted">{INVITA[a.tono]}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={g.posponerRevision}>
              Más tarde
            </Button>
            <Button size="sm" variant="primary" onClick={() => setAbierta(true)}>
              Empezar
            </Button>
          </div>
        </div>
      ) : null}
      <ModalRevision abierta={abierta} onClose={() => setAbierta(false)} />
    </>
  );
}

function ModalRevision({ abierta, onClose }: { abierta: boolean; onClose: () => void }) {
  const { db } = useData();
  const today = useToday();
  const g = useGamificacion();
  const { estado } = useAsistentes();
  const [paso, setPaso] = useState(0);
  const s = useSemana(today);

  // Módulo con menor salud (entre los activos con datos)
  const menor = useMemo(() => {
    const con = ASISTENTE_IDS.filter((id) => estado.ajustes[id].activo && g.saludes[id].puntaje !== null);
    return con.sort((x, y) => (g.saludes[x].puntaje ?? 0) - (g.saludes[y].puntaje ?? 0))[0] ?? estado.principal;
  }, [estado, g.saludes]);
  const am = estado.ajustes[menor];
  const sm = g.saludes[menor];
  const msg = useMemo(() => getMensajeAsistente(menor, { db, today, tono: am.tono, forzarSalud: g.demo ? g.forzarSalud : undefined }), [menor, db, today, am.tono, g.demo, g.forzarSalud]);
  const cerrar = () => {
    setPaso(0);
    onClose();
  };

  // Resumen del domingo: gasto frente a la semana anterior, entrenamientos y la meta más cercana
  const r = useMemo(() => (today ? resumenSemanal(db, today) : null), [db, today]);
  const comentarios: { clave: string; id: AsistenteId; pose: Pose; texto: string }[] = [];
  if (r) {
    if (r.gasto > 0 || r.gastoAnterior > 0)
      comentarios.push({
        clave: "gasto",
        id: "centavo",
        pose: r.variacion !== null && r.variacion > 10 ? "preocupado" : "feliz",
        texto:
          r.variacion === null
            ? `Gastaste ${formatCOP(r.gasto)} en los últimos 7 días.`
            : r.variacion === 0
              ? `Gastaste ${formatCOP(r.gasto)}, igual que la semana anterior.`
              : `Gastaste ${formatCOP(r.gasto)}: un ${Math.abs(r.variacion)} % ${r.variacion < 0 ? "menos" : "más"} que la semana anterior.`,
      });
    if (r.entreno)
      comentarios.push({
        clave: "entreno",
        id: "brote",
        pose: r.entreno.hechos >= r.entreno.meta ? "celebrando" : r.entreno.hechos === 0 ? "triste" : "feliz",
        texto: `${Math.min(r.entreno.hechos, r.entreno.meta)} de ${r.entreno.meta} entrenamientos esta semana.${
          r.entreno.rachaSemanas > 1 ? ` Llevas ${r.entreno.rachaSemanas} semanas completas seguidas.` : r.entreno.hechos >= r.entreno.meta ? " Semana completa." : ""
        }`,
      });
    if (r.meta)
      comentarios.push({
        clave: "meta",
        id: "centavo",
        pose: "orgulloso",
        texto: `Tu meta más cerca: ${r.meta.nombre}, al ${r.meta.pct} %. Faltan ${formatCOP(r.meta.falta)}.`,
      });
  }

  const titulos = ["Tu semana en cifras", "Lo que más necesita atención", "Una acción para empezar"];
  return (
    <Modal
      open={abierta}
      onClose={cerrar}
      title={titulos[paso]}
      description={`Paso ${paso + 1} de 3 · Revisión semanal`}
      size="sm"
      footer={
        <>
          {paso > 0 ? (
            <Button variant="ghost" onClick={() => setPaso(paso - 1)}>
              Atrás
            </Button>
          ) : null}
          {paso < 2 ? (
            <Button variant="primary" data-autofocus onClick={() => setPaso(paso + 1)}>
              Siguiente
            </Button>
          ) : (
            <Button
              variant="primary"
              data-autofocus
              onClick={() => {
                g.completarRevision();
                cerrar();
              }}
            >
              Completar (+25 XP)
            </Button>
          )}
        </>
      }
    >
      <div className="mb-4 flex gap-1.5" aria-hidden>
        {[0, 1, 2].map((n) => (
          <span key={n} className={cn("h-1.5 flex-1 rounded-full", n <= paso ? "bg-brand" : "bg-elev")} />
        ))}
      </div>
      {paso === 0 ? (
        <>
          <ul className="divide-y divide-line rounded-[20px] bg-card px-4">
            {[
              ["XP ganado", String(s.xp)],
              ["Hábitos cumplidos", String(s.habitos)],
              ["Tareas terminadas", String(s.tareas)],
              ["Días activos", `${s.dias} de 7`],
            ].map(([l, v]) => (
              <li key={l} className="flex items-center justify-between py-3 text-[14.5px]">
                <span>{l}</span>
                <span className="num font-bold">{v}</span>
              </li>
            ))}
          </ul>
          {/* Lo que dice cada asistente de su parte de la semana */}
          <ul className="mt-3 grid gap-2">
            {comentarios.map((c) => {
              const a = estado.ajustes[c.id];
              return (
                <li key={c.clave} className="flex items-center gap-3 rounded-[18px] bg-card p-3">
                  {a.activo ? <Asistente id={c.id} size={40} pose={c.pose} colores={a.colores} accesorio={a.accesorio} decorativo /> : null}
                  <p className="min-w-0 flex-1 text-[13.5px] leading-snug">
                    <span className="font-medium">{a.nombre}:</span> {c.texto}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      ) : paso === 1 ? (
        <div className="flex items-center gap-4 rounded-[20px] bg-card p-4">
          <Asistente id={menor} size={96} pose={poseDeAnimo(sm.animo, today)} colores={am.colores} accesorio={am.accesorio} mostrarProp={am.mostrarProp} nombre={am.nombre} />
          <div className="min-w-0">
            <p className="text-[13px] text-muted">
              {FICHAS[menor].modulo} · salud {sm.puntaje ?? "sin datos"} · {ANIMO_LABEL[sm.animo].toLowerCase()}
            </p>
            <p className="mt-1 text-[15px]">{msg.texto}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-[20px] bg-card p-4">
          <p className="text-[15px]">
            {am.nombre} sugiere empezar por {FICHAS[menor].modulo.toLowerCase()}.
          </p>
          {msg.accion ? (
            <Link href={msg.accion.href} onClick={cerrar} className="focus-ring mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-fg px-4 text-[13.5px] font-medium text-on-fg">
              {msg.accion.label} <ArrowUpRight size={15} />
            </Link>
          ) : null}
          <p className="mt-3 text-[12.5px] text-muted">Al completar la revisión sumas 25 XP.</p>
        </div>
      )}
    </Modal>
  );
}
