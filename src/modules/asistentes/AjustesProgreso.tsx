"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { META_POR_DEFECTO, METAS_DIARIAS, type Progreso } from "@/lib/asistentes/progreso";
import { cn } from "@/utils/cn";
import { retro, type Retro } from "@/lib/asistentes/sonido";

const PRUEBAS: { tipo: Retro; label: string }[] = [
  { tipo: "xp", label: "Ganar XP" },
  { tipo: "mision", label: "Misión" },
  { tipo: "racha", label: "Racha" },
  { tipo: "celebracion", label: "Celebración" },
  { tipo: "negativo", label: "Mes en rojo" },
];
import { AvisosCelular } from "@/modules/avisos/AvisosCelular";
import { useGamificacion } from "./Gamificacion";
import { almacenAnimo } from "@/lib/animoUsuario";

/** Ajustes de gamificación en Configuración (?seccion=progreso). */
export function AjustesProgreso() {
  const g = useGamificacion();
  const { toast } = useFeedback();
  const a = g.progreso.ajustes;
  const animo = almacenAnimo.useValor();
  const cambiar = (p: Partial<Progreso["ajustes"]>) => {
    g.cambiarAjustes(p);
    toast("Guardado");
  };
  return (
    <div className="grid max-w-[820px] grid-cols-1 gap-3">
      <Card>
        <CardHeader title="Gamificación" subtitle="XP, niveles, rachas, logros y vínculos" />
        <div className="flex items-start justify-between gap-4 rounded-[20px] bg-bg-2 p-4">
          <div>
            <p className="text-[14.5px] font-medium">{a.gamificacion ? "Activada" : "Modo tranquilo"}</p>
            <p className="mt-0.5 text-[13px] text-muted">
              El modo tranquilo oculta el XP, los niveles y las rachas. Tus asistentes y su ánimo siguen igual.
            </p>
          </div>
          <Switch checked={a.gamificacion} onChange={(v) => cambiar({ gamificacion: v })} label="Gamificación" />
        </div>
        <div className="mt-3 rounded-[20px] bg-bg-2 p-4">
          <p className="text-[14.5px] font-medium">Meta diaria</p>
          <p className="mt-0.5 text-[13px] text-muted">Cuánto XP quieres sumar cada día. Llegar a la meta da +10 XP.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Meta diaria">
            {METAS_DIARIAS.map((m) => {
              const on = (a.metaDiaria ?? META_POR_DEFECTO) === m.xp;
              return (
                <button
                  key={m.xp}
                  type="button"
                  aria-pressed={on}
                  disabled={!a.gamificacion}
                  onClick={() => cambiar({ metaDiaria: m.xp })}
                  className={cn(
                    "focus-ring cursor-pointer rounded-[16px] p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    on ? "bg-fg text-on-fg" : "bg-card hover:bg-elev",
                  )}
                >
                  <span className="block text-[14px] font-bold">{m.label}</span>
                  <span className={cn("mt-0.5 block text-[12px]", on ? "opacity-80" : "text-muted")}>{m.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Celebraciones y reacciones" subtitle="Cómo te avisan los asistentes de tus avances" />
        <div className="grid gap-3">
          <label className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-bg-2 p-4">
            <span>
              <span className="block text-[14.5px] font-medium">Celebraciones</span>
              <span className="block text-[13px] text-muted">Modal con confeti al subir de nivel, ganar un logro o desbloquear algo.</span>
            </span>
            <span className="w-full sm:w-[220px]">
              <Select
                aria-label="Celebraciones"
                value={a.celebraciones}
                disabled={!a.gamificacion}
                onChange={(e) => cambiar({ celebraciones: e.target.value as Progreso["ajustes"]["celebraciones"] })}
              >
                <option value="todas">Todas</option>
                <option value="solo-grandes">Solo las grandes</option>
                <option value="ninguna">Ninguna</option>
              </Select>
            </span>
          </label>
          <div className="flex items-start justify-between gap-4 rounded-[20px] bg-bg-2 p-4">
            <div>
              <p className="text-[14.5px] font-medium">Reacciones negativas</p>
              <p className="mt-0.5 text-[13px] text-muted">
                Un aviso al abrir la app si se rompió tu racha o hay un pago vencido. Máximo uno al día y siempre con una salida.
              </p>
            </div>
            <Switch checked={a.negativas} disabled={!a.gamificacion} onChange={(v) => cambiar({ negativas: v })} label="Reacciones negativas" />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-[20px] bg-bg-2 p-4">
            <div>
              <p className="text-[14.5px] font-medium">Pop-up diario de racha</p>
              <p className="mt-0.5 text-[13px] text-muted">La primera vez que abres la app cada día: tu racha, la semana y lo que te falta hoy.</p>
            </div>
            <Switch checked={a.saludo !== false} disabled={!a.gamificacion} onChange={(v) => cambiar({ saludo: v })} label="Pop-up diario de racha" />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-[20px] bg-bg-2 p-4">
            <div>
              <p className="text-[14.5px] font-medium">¿Cómo amaneciste?</p>
              <p className="mt-0.5 text-[13px] text-muted">Tu asistente te pregunta al abrir la app. Si el día es difícil, todos van con calma. Solo lo ves tú.</p>
            </div>
            <Switch
              checked={animo.activo}
              onChange={(v) => {
                almacenAnimo.cambiar((d) => ({ ...d, activo: v }));
                toast("Guardado");
              }}
              label="Chequeo de ánimo diario"
            />
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Sonido y vibración" subtitle="Un sonido corto y un golpecito al ganar XP, cumplir misiones y celebrar" />
        <div className="grid gap-3">
          <div className="flex items-start justify-between gap-4 rounded-[20px] bg-bg-2 p-4">
            <div>
              <p className="text-[14.5px] font-medium">Sonidos</p>
              <p className="mt-0.5 text-[13px] text-muted">Suenan solo después de tocar la pantalla al menos una vez (regla del navegador).</p>
            </div>
            <Switch
              checked={a.sonido !== false}
              disabled={!a.gamificacion}
              onChange={(v) => {
                cambiar({ sonido: v });
                if (v) retro("xp", { sonido: true, vibracion: false });
              }}
              label="Sonidos"
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-[20px] bg-bg-2 p-4">
            <div>
              <p className="text-[14.5px] font-medium">Vibración</p>
              <p className="mt-0.5 text-[13px] text-muted">En Android funciona siempre. En iPhone depende del sistema (iOS 18 o más) y puede no sentirse.</p>
            </div>
            <Switch
              checked={a.vibracion !== false}
              disabled={!a.gamificacion}
              onChange={(v) => {
                cambiar({ vibracion: v });
                if (v) retro("mision", { sonido: false, vibracion: true });
              }}
              label="Vibración"
            />
          </div>
          <div className="rounded-[20px] bg-bg-2 p-4">
            <p className="text-[14.5px] font-medium">Probar</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PRUEBAS.map((p) => (
                <button
                  key={p.tipo}
                  type="button"
                  disabled={!a.gamificacion}
                  onClick={() => retro(p.tipo, a)}
                  className="focus-ring h-9 cursor-pointer rounded-full bg-card px-3 text-[13px] font-medium hover:bg-elev disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <AvisosCelular />
    </div>
  );
}
