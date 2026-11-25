"use client";

/** Panel de pruebas de la gamificación. Solo existe en modo demo (?demo=1): nada se guarda. */
import { useState } from "react";
import { FlaskConical, X } from "lucide-react";
import { Asistente } from "@/components/asistentes/Asistente";
import { Select } from "@/components/ui/Field";
import { useAsistentes } from "@/lib/asistentes/estado";
import { DESBLOQUEOS, LOGROS, etapaDe } from "@/lib/asistentes/progreso";
import { ASISTENTE_IDS, type AsistenteId } from "@/lib/asistentes/tipos";
import { useGamificacion } from "./Gamificacion";

const ANIMOS: { value: string; label: string; salud: number | null | undefined }[] = [
  { value: "auto", label: "Automático", salud: undefined },
  { value: "radiante", label: "Radiante (92)", salud: 92 },
  { value: "feliz", label: "Feliz (72)", salud: 72 },
  { value: "tranquilo", label: "Tranquilo (55)", salud: 55 },
  { value: "preocupado", label: "Preocupado (35)", salud: 35 },
  { value: "triste", label: "Triste (12)", salud: 12 },
  { value: "dormido", label: "Dormido (sin datos)", salud: null },
];

const valorDe = (v: number | null | undefined) => ANIMOS.find((a) => a.salud === v)?.value ?? "auto";

export function PanelDemo() {
  const g = useGamificacion();
  const { estado } = useAsistentes();
  const [abierto, setAbierto] = useState(false);
  if (!g.demo) return null;

  const fijar = (id: AsistenteId, v: string) => {
    const a = ANIMOS.find((x) => x.value === v)!;
    const next = { ...g.forzarSalud };
    if (a.salud === undefined) delete next[id];
    else next[id] = a.salud;
    g.setForzarSalud(next);
  };
  const todos = (v: string) => {
    const a = ANIMOS.find((x) => x.value === v)!;
    g.setForzarSalud(a.salud === undefined ? {} : Object.fromEntries(ASISTENTE_IDS.map((id) => [id, a.salud])));
  };
  const btn = "focus-ring h-9 cursor-pointer rounded-full bg-card px-3 text-[12.5px] font-medium hover:bg-elev";

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto((o) => !o)}
        aria-expanded={abierto}
        aria-label="Panel de pruebas de gamificación"
        className="focus-ring fixed bottom-24 left-3 z-[86] flex h-11 cursor-pointer items-center gap-2 rounded-full bg-warn-fill px-4 text-[13px] font-medium text-[#0a0a0a] md:bottom-6 md:left-20"
      >
        <FlaskConical size={17} /> Pruebas
      </button>
      {abierto ? (
        <div role="dialog" aria-label="Panel de pruebas" className="fixed bottom-40 left-3 z-[86] max-h-[70dvh] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-[24px] bg-bg p-4 shadow-[0_0_0_1px_var(--color-line)] md:bottom-20 md:left-20">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[15px] font-bold">Panel de pruebas</p>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar panel" className="focus-ring grid h-8 w-8 cursor-pointer place-items-center rounded-full hover:bg-card">
              <X size={16} />
            </button>
          </div>

          <p className="mb-2 text-[12.5px] text-muted">Ánimo de cada asistente</p>
          <div className="mb-2">
            <Select aria-label="Ánimo de todos" value="auto" onChange={(e) => todos(e.target.value)}>
              <option value="auto">Todos: elegir…</option>
              {ANIMOS.slice(1).map((a) => (
                <option key={a.value} value={a.value}>
                  Todos: {a.label}
                </option>
              ))}
            </Select>
          </div>
          <ul className="flex flex-col gap-1.5">
            {ASISTENTE_IDS.map((id) => (
              <li key={id} className="flex items-center gap-2">
                <Asistente id={id} size={32} animado={false} fx={false} colores={estado.ajustes[id].colores} decorativo />
                <span className="w-16 truncate text-[13px]">{estado.ajustes[id].nombre}</span>
                <div className="flex-1">
                  <Select aria-label={`Ánimo de ${estado.ajustes[id].nombre}`} value={valorDe(g.forzarSalud[id])} onChange={(e) => fijar(id, e.target.value)}>
                    {ANIMOS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </li>
            ))}
          </ul>

          <p className="mb-2 mt-4 text-[12.5px] text-muted">XP</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={btn} onClick={() => g.sumarXPDemo(50, estado.principal)}>
              +50 XP
            </button>
            <button type="button" className={btn} onClick={() => g.sumarXPDemo(300, estado.principal)}>
              +300 XP
            </button>
            <button type="button" className={btn} onClick={() => g.sumarXPDemo(400, "brote")}>
              +400 XP a Brote
            </button>
          </div>

          <p className="mb-2 mt-4 text-[12.5px] text-muted">Celebraciones</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={btn} onClick={() => g.celebrarDemo({ tipo: "nivel", nivel: g.nivel.nivel + 1, etapa: etapaDe(g.nivel.nivel + 1), cambioEtapa: false })}>
              Subir nivel
            </button>
            <button type="button" className={btn} onClick={() => g.celebrarDemo({ tipo: "nivel", nivel: 11, etapa: etapaDe(11), cambioEtapa: true })}>
              Cambio de etapa
            </button>
            <button type="button" className={btn} onClick={() => g.celebrarDemo({ tipo: "logro", logro: LOGROS[1] })}>
              Logro
            </button>
            <button type="button" className={btn} onClick={() => g.celebrarDemo({ tipo: "desbloqueo", asistente: estado.principal, item: DESBLOQUEOS[3] })}>
              Desbloqueo
            </button>
            <button
              type="button"
              className={btn}
              onClick={() => {
                g.celebrarDemo({ tipo: "nivel", nivel: g.nivel.nivel + 1, etapa: etapaDe(g.nivel.nivel + 1), cambioEtapa: false });
                g.celebrarDemo({ tipo: "logro", logro: LOGROS[0] });
                g.celebrarDemo({ tipo: "desbloqueo", asistente: "centavo", item: DESBLOQUEOS[8] });
              }}
            >
              Las tres en cadena
            </button>
            <button type="button" className={btn} onClick={() => g.celebrarDemo({ tipo: "balance", mes: "2026-10", verde: true, xp: 100 })}>
              Mes en verde
            </button>
            <button type="button" className={btn} onClick={() => g.celebrarDemo({ tipo: "balance", mes: "2026-10", verde: false, xp: -50 })}>
              Mes en rojo
            </button>
          </div>

          <p className="mb-2 mt-4 text-[12.5px] text-muted">Racha</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={btn}
              onClick={() => {
                setAbierto(false);
                g.saludoDemo();
              }}
            >
              Pop-up diario de racha
            </button>
            <button type="button" className={btn} onClick={() => g.romperRachaDemo(true)}>
              Racha rota con protector
            </button>
            <button type="button" className={btn} onClick={() => g.romperRachaDemo(false)}>
              Racha rota sin protector
            </button>
          </div>
          <p className="mt-3 text-[11.5px] text-dim">Modo demo: nada de esto se guarda.</p>
        </div>
      ) : null}
    </>
  );
}
