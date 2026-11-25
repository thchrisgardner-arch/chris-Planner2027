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
