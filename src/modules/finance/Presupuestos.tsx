"use client";

/**
 * Presupuestos del mes (Finanzas → Resumen): un tope mensual por categoría de gasto, con barra de avance.
 * Al 80 % la barra se pone amarilla y Centavo avisa con lo que queda por día; al 100 %, roja.
 * Los topes se guardan en `lifeos:presupuestos` (se sincronizan y viajan en el respaldo).
 */
import { useState } from "react";
import { PiggyBank, Plus, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { AmountInput, FormModal } from "@/components/ui/FormModal";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { almacenPresupuestos, estadoPresupuestos, UMBRAL_AVISO } from "@/lib/finanzas/presupuestos";
import { EXPENSE_CATEGORIES } from "./constants";
import { formatAmountInput, formatCOP, parseCOP } from "@/utils/money";
import { cn } from "@/utils/cn";

export function Presupuestos({ className }: { className?: string }) {
  const { db } = useData();
  const today = useToday();
  const { topes } = almacenPresupuestos.useValor();
  const [editar, setEditar] = useState(false);
  const lista = today ? estadoPresupuestos(db, topes, today) : [];

  return (
    <Card className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px]">Presupuestos del mes</h2>
          <p className="text-[12.5px] text-muted">
            {lista.length ? `Al ${UMBRAL_AVISO} % te aviso; la barra cuenta los gastos completados del mes.` : "Ponle un tope mensual a tus categorías de gasto y te aviso cuando vayas al 80 %."}
          </p>
        </div>
        <Button size="sm" variant="secondary" className="bg-bg-2" onClick={() => setEditar(true)}>
          {lista.length ? <SlidersHorizontal size={15} /> : <Plus size={15} />} {lista.length ? "Editar topes" : "Crear presupuestos"}
        </Button>
      </div>

      {lista.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {lista.map((p) => (
            <li key={p.categoria} className="rounded-[16px] bg-bg-2 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[14px] font-medium">{p.categoria}</span>
                <span className={cn("num shrink-0 text-[13px] font-medium", p.nivel === "pasado" ? "text-danger" : p.nivel === "cerca" ? "text-warn" : "text-muted")}>{p.pct} %</span>
              </div>
              <div
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-bg"
                role="progressbar"
                aria-label={`Presupuesto de ${p.categoria}`}
                aria-valuenow={Math.min(100, p.pct)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className={cn("h-full rounded-full", p.nivel === "pasado" ? "bg-danger" : p.nivel === "cerca" ? "bg-warn" : "bg-fg")} style={{ width: `${Math.min(100, p.pct)}%` }} />
              </div>
              <p className="num mt-1.5 text-[12px] text-muted">
                {formatCOP(p.gastado)} de {formatCOP(p.tope)}
                {" · "}
                {p.nivel === "pasado" ? (
                  <span className="text-danger">te pasaste por {formatCOP(-p.restante)}</span>
                ) : (
                  <>
                    quedan {formatCOP(p.restante)} ({formatCOP(p.porDia)} al día)
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-bg-2 p-3 text-[13px] text-muted">
          <PiggyBank size={18} className="shrink-0" /> Ejemplo: Alimentación $800.000, Transporte $250.000, Ocio $300.000.
        </div>
      )}
      {editar ? <EditarTopes onClose={() => setEditar(false)} /> : null}
    </Card>
  );
}

/** Un campo por categoría de gasto (las propias incluidas); vacío = sin presupuesto */
function EditarTopes({ onClose }: { onClose: () => void }) {
  const { db } = useData();
  const actuales = almacenPresupuestos.leer().topes;
  const categorias = [...new Set([...EXPENSE_CATEGORIES, ...db.transaction_categories.filter((c) => c.kind === "gasto").map((c) => c.name), ...Object.keys(actuales)])];
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(categorias.map((c) => [c, actuales[c] ? formatAmountInput(String(actuales[c])) : ""])));
  return (
    <FormModal
      open
      onClose={onClose}
      title="Presupuestos del mes"
      description="Tope de gasto mensual por categoría. Deja vacío lo que no quieras controlar."
      submitLabel="Guardar"
      onSubmit={async () => {
        const topes: Record<string, number> = {};
        for (const [c, v] of Object.entries(valores)) {
          const n = parseCOP(v);
          if (n && n > 0) topes[c] = n;
        }
        almacenPresupuestos.cambiar((d) => ({ ...d, topes }));
        const n = Object.keys(topes).length;
        return n ? `Presupuestos guardados: ${n} ${n === 1 ? "categoría" : "categorías"}.` : "Presupuestos quitados.";
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {categorias.map((c) => (
          <Field key={c} label={c}>
            {(id) => <AmountInput id={id} value={valores[c] ?? ""} onChange={(v) => setValores((x) => ({ ...x, [c]: v }))} />}
          </Field>
        ))}
      </div>
    </FormModal>
  );
}
