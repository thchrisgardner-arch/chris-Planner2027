"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import type { Progreso } from "@/lib/asistentes/progreso";
import { useGamificacion } from "./Gamificacion";

/** Ajustes de gamificación en Configuración (?seccion=progreso). */
export function AjustesProgreso() {
  const g = useGamificacion();
  const { toast } = useFeedback();
  const a = g.progreso.ajustes;
  const cambiar = (p: Partial<Progreso["ajustes"]>) => {
    g.cambiarAjustes(p);
    toast("Guardado");
  };
  return (
    <div className="grid max-w-[820px] gap-3">
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
        </div>
      </Card>
    </div>
  );
}
