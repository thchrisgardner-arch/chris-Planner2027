"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "./Button";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import type { TableName } from "@/types/db";

/** Borra un registro tras confirmar y muestra el resultado. */
export function useDeleteRecord() {
  const { remove } = useData();
  const { confirm, toast } = useFeedback();
  return async (table: TableName, id: string, title: string, description?: string) => {
    const ok = await confirm({ title, description, confirmLabel: "Eliminar", destructive: true });
    if (!ok) return false;
    try {
      await remove(table, id);
      toast("Eliminado.");
      return true;
    } catch (e) {
      toast(e instanceof Error ? `No se pudo eliminar: ${e.message}` : "No se pudo eliminar.", "error");
      return false;
    }
  };
}

export function RowActions({ onEdit, onDelete, label }: { onEdit: () => void; onDelete: () => void; label: string }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label={`Editar ${label}`}>
        <Pencil size={17} />
      </Button>
      <Button size="icon-sm" variant="ghost" onClick={onDelete} aria-label={`Eliminar ${label}`} className="hover:text-danger">
        <Trash2 size={15} />
      </Button>
    </div>
  );
}

/** Pestañas internas de un módulo. Las de fases futuras se muestran desactivadas, sin simular contenido. */
export function ModuleTabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: string; soon?: boolean }[];
}) {
  return (
    <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex gap-1 rounded-[14px] border border-line bg-bg-2 p-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={t.value === value}
            disabled={t.soon}
            title={t.soon ? "Llega en la siguiente fase" : undefined}
            onClick={() => onChange(t.value)}
            className={
              "focus-ring flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 text-[13.5px] font-medium transition-all duration-200 disabled:cursor-not-allowed " +
              (t.value === value ? "bg-card text-fg" : t.soon ? "text-dim/70" : "text-muted hover:text-fg")
            }
          >
            {t.label}
            {t.soon ? <span className="rounded-full border border-line px-1.5 text-[10px] text-dim">Pronto</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
