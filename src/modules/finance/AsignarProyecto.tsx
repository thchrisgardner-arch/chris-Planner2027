"use client";

/**
 * «Asignar a proyecto» (Finanzas → Movimientos): uno o varios movimientos pasan a un proyecto, o
 * quedan sin proyecto. Es el mismo movimiento: los saldos de las cuentas no cambian.
 * Se opera con teclado: casillas normales, Tab entre ellas y Enter para guardar.
 */
import { useMemo, useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { Field, Select } from "@/components/ui/Field";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { palabraClave } from "@/lib/captura/interpretar";
import { recordarProyecto } from "@/lib/captura/aprendizaje";
import type { Transaction } from "@/types/db";
import { formatCOP } from "@/utils/money";
import { formatShortDate } from "@/utils/dates";
import { cn } from "@/utils/cn";

export function AsignarProyecto({ filas, preseleccion, onClose, proyectoInicial }: { filas: Transaction[]; preseleccion: string[]; onClose: () => void; proyectoInicial?: string }) {
  const { db, update } = useData();
  const today = useToday();
  // Solo gastos e ingresos (una transferencia no es gasto ni ingreso de un proyecto)
  const candidatos = useMemo(() => filas.filter((t) => t.type !== "transferencia").slice(0, 200), [filas]);
  const [proyecto, setProyecto] = useState(proyectoInicial ?? (preseleccion.length === 1 ? (candidatos.find((t) => t.id === preseleccion[0])?.project_id ?? "") : ""));
  const [sel, setSel] = useState<Set<string>>(() => new Set(preseleccion));
  const [error, setError] = useState<string | null>(null);
  const nombre = (id: string | null | undefined) => db.projects.find((p) => p.id === id)?.name;
  const todos = candidatos.length > 0 && candidatos.every((t) => sel.has(t.id));

  const cambiar = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const guardar = async () => {
    const elegidos = candidatos.filter((t) => sel.has(t.id));
    if (!elegidos.length) {
      setError("Elige al menos un movimiento.");
      return false;
    }
    const destino = proyecto || null;
    for (const t of elegidos) {
      if ((t.project_id ?? null) === destino) continue;
      await update("transactions", t.id, { project_id: destino });
      // Aprendizaje: con dos asignaciones de la misma descripción, la captura lo sugiere
      recordarProyecto(palabraClave(t.description), destino);
    }
    const n = elegidos.length;
    return destino ? `${n === 1 ? "1 movimiento asignado" : `${n} movimientos asignados`} a ${nombre(destino)}.` : `${n === 1 ? "1 movimiento quedó" : `${n} movimientos quedaron`} sin proyecto.`;
  };

  return (
    <FormModal open onClose={onClose} title="Asignar a proyecto" description="Es el mismo movimiento: se ve en Finanzas y en el proyecto. Los saldos no cambian." submitLabel="Asignar" onSubmit={guardar}>
      <Field label="Proyecto">
        {(id) => (
          <Select id={id} value={proyecto} onChange={(e) => setProyecto(e.target.value)}>
            <option value="">Sin proyecto</option>
            {db.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend className="mb-1.5 flex w-full items-center justify-between gap-3 text-[13px] text-muted">
          <span>
            Movimientos · {sel.size} de {candidatos.length}
          </span>
        </legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] px-2 text-[13.5px] font-medium">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-fg)]" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(candidatos.map((t) => t.id)))} />
          Todos los de la lista
        </label>
        <ul className="max-h-[42dvh] divide-y divide-line overflow-y-auto rounded-[16px] bg-bg-2 px-2">
          {candidatos.map((t) => (
            <li key={t.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                <input type="checkbox" className="h-4 w-4 shrink-0 accent-[var(--color-fg)]" checked={sel.has(t.id)} onChange={() => cambiar(t.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px]">{t.description}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {formatShortDate(t.date)}
                    {t.project_id ? ` · ${nombre(t.project_id) ?? "Proyecto"}` : ""}
                  </span>
                </span>
                <span className={cn("num shrink-0 text-[13.5px]", t.type === "ingreso" ? "text-brand-soft" : "text-fg")}>
                  {t.type === "ingreso" ? "+" : "−"}
                  {formatCOP(t.amount)}
                </span>
              </label>
            </li>
          ))}
        </ul>
        {filas.length > candidatos.length && today ? <p className="text-[12px] text-dim">Las transferencias no se asignan a proyectos.</p> : null}
      </fieldset>
      {error ? (
        <p className="text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </FormModal>
  );
}
