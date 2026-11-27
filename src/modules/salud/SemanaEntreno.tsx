"use client";

/**
 * Marcar los días entrenados, sobre el MISMO hábito «Entrenar» (habit_logs): marcar aquí es lo mismo
 * que marcarlo en el inicio y al revés. Un toque marca o desmarca; se puede marcar un día no
 * planeado (cuenta igual para XP y racha); los días futuros no se marcan; se puede ir hasta 4
 * semanas atrás para corregir olvidos. El detalle (tipo y duración) es opcional.
 */
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, Field, Input } from "@/components/ui/Field";
import { FormModal } from "@/components/ui/FormModal";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { logFor } from "@/modules/habits/selectors";
import { DIAS_LARGOS, diasDeSemana, etiquetaDia, resumenSemana, type DiaSemana } from "@/lib/salud/semanaEntreno";
import { almacenEntrenos, guardarDetalle, textoDetalle, TIPOS_ENTRENO, type TipoEntreno } from "@/lib/salud/entrenos";
import type { Habit } from "@/types/db";
import { WEEKDAYS_SHORT, addDays, formatShortDate, parseISO, startOfWeek } from "@/utils/dates";
import { cn } from "@/utils/cn";

const SEMANAS_ATRAS = 4;

export function SemanaEntreno({ habito }: { habito: Habit }) {
  const { db, insert, remove } = useData();
  const today = useToday();
  const detalles = almacenEntrenos.useValor().detalles;
  const [atras, setAtras] = useState(0);
  const [ocupado, setOcupado] = useState<string | null>(null);
  // Último día marcado: ofrece «Agregar detalle» (nunca obligatorio)
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  if (!today) return null;

  const lunes = addDays(startOfWeek(today), -7 * atras);
  const dias = diasDeSemana(habito, db.habit_logs, lunes, today);
  const titulo = atras === 0 ? "Esta semana" : atras === 1 ? "La semana pasada" : `Semana del ${formatShortDate(lunes)}`;
  const marcadoUltimo = ultimo ? !!logFor(db.habit_logs, habito.id, ultimo) : false;

  const marcar = async (d: DiaSemana) => {
    if (d.futuro || ocupado) return;
    setOcupado(d.fecha);
    try {
      const log = logFor(db.habit_logs, habito.id, d.fecha);
      if (log) {
        await remove("habit_logs", log.id);
        if (ultimo === d.fecha) setUltimo(null);
      } else {
        await insert("habit_logs", { habit_id: habito.id, date: d.fecha });
        setUltimo(d.fecha);
      }
    } finally {
      setOcupado(null);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold">{titulo}</h2>
          <p className="mt-0.5 text-[13px] text-muted">{resumenSemana(habito, dias, today)}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="icon-sm" variant="ghost" aria-label="Semana anterior" disabled={atras >= SEMANAS_ATRAS} onClick={() => setAtras((n) => Math.min(SEMANAS_ATRAS, n + 1))}>
            <ChevronLeft size={18} />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Semana siguiente" disabled={atras === 0} onClick={() => setAtras((n) => Math.max(0, n - 1))}>
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1.5" role="group" aria-label={`Días entrenados: ${titulo.toLowerCase()}`}>
        {dias.map((d) => (
          <button
            key={d.fecha}
            type="button"
            aria-pressed={d.hecho}
            aria-label={etiquetaDia(d)}
            title={textoDetalle(detalles[d.fecha]) ?? undefined}
            disabled={d.futuro || ocupado === d.fecha}
            onClick={() => void marcar(d)}
            className={cn(
              "focus-ring flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[16px] text-[11px] transition-all disabled:cursor-not-allowed",
              d.hecho ? "bg-brand text-[#0a0a0a]" : d.planeado ? "bg-fg text-on-fg" : "bg-bg hover:bg-elev",
              d.hoy && !d.hecho && "ring-[1.5px] ring-fg ring-offset-2 ring-offset-[var(--color-card)]",
              d.futuro && "opacity-40",
            )}
          >
            <span>{WEEKDAYS_SHORT[d.dia]}</span>
            <span className="num text-[14px] font-medium">{parseISO(d.fecha).getUTCDate()}</span>
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-3 min-h-9 text-[13px] text-muted">
        {ultimo && marcadoUltimo ? (
          <p className="flex flex-wrap items-center gap-2">
            {DIAS_LARGOS[(parseISO(ultimo).getUTCDay() + 6) % 7]} marcado.
            {textoDetalle(detalles[ultimo]) ? (
              <button type="button" onClick={() => setEditando(ultimo)} className="focus-ring min-h-9 cursor-pointer rounded-full bg-bg-2 px-3 text-[12.5px] font-medium text-fg">
                {textoDetalle(detalles[ultimo])}
              </button>
            ) : (
              <button type="button" onClick={() => setEditando(ultimo)} className="focus-ring inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full bg-bg-2 px-3 text-[12.5px] font-medium text-fg hover:bg-elev">
                <Plus size={14} /> Agregar detalle
              </button>
            )}
          </p>
        ) : (
          <p>Toca un día para marcarlo; otra vez para desmarcarlo. También cuentan los días extra.</p>
        )}
      </div>
      {editando ? <DetalleEntrenoForm fecha={editando} onClose={() => setEditando(null)} /> : null}
    </Card>
  );
}

function DetalleEntrenoForm({ fecha, onClose }: { fecha: string; onClose: () => void }) {
  const actual = almacenEntrenos.leer().detalles[fecha];
  const [tipo, setTipo] = useState<TipoEntreno | "">(actual?.tipo ?? "");
  const [minutos, setMinutos] = useState(actual?.minutos ? String(actual.minutos) : "");
  return (
    <FormModal
      open
      onClose={onClose}
      title="Detalle del entrenamiento"
      description={`${DIAS_LARGOS[(parseISO(fecha).getUTCDay() + 6) % 7]} ${parseISO(fecha).getUTCDate()}. Es opcional.`}
      size="sm"
      onSubmit={async () => {
        const m = Number(minutos);
        guardarDetalle(fecha, { tipo: tipo || null, minutos: Number.isFinite(m) && m > 0 ? Math.round(m) : null });
        return "Detalle guardado.";
      }}
    >
      <Field label="Tipo">{() => <ChoiceGroup value={tipo} onChange={(v) => setTipo(v as TipoEntreno)} options={TIPOS_ENTRENO} />}</Field>
      <Field label="Duración (minutos)">
        {(id) => <Input id={id} inputMode="numeric" value={minutos} placeholder="Ej. 45" onChange={(e) => setMinutos(e.target.value.replace(/\D/g, "").slice(0, 3))} />}
      </Field>
    </FormModal>
  );
}
