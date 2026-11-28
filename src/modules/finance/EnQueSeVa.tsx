"use client";

/**
 * Finanzas → Resumen → «¿En qué se va tu plata?» (Fase 3): los 10 conceptos con más gasto del
 * periodo, agrupados por descripción normalizada, con su barra, monto, porcentaje, veces y la
 * comparación con el periodo anterior. Tocar una categoría del gráfico de al lado filtra la lista.
 * Unir conceptos a mano desde el menú de la fila (se recuerda y se puede deshacer).
 * Compacta: dos columnas en pantallas anchas, una línea de datos por concepto y los 6 primeros
 * a la vista (el resto con «Ver todos»).
 */
import { useMemo, useState } from "react";
import { ChevronDown, MoreHorizontal, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/misc";
import { Popover } from "@/components/ui/Popover";
import { Asistente } from "@/components/asistentes/Asistente";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { crearAlmacen } from "@/lib/almacenLocal";
import { agruparConceptos, comparacion, PERIODOS_CONCEPTOS, rangos, totalGastos, type PeriodoConceptos } from "@/lib/finanzas/conceptos";
import { formatCOP, pct } from "@/utils/money";
import { cn } from "@/utils/cn";

/** Uniones manuales (`lifeos:conceptos`, versión 1): concepto → concepto al que se unió */
export const almacenConceptos = crearAlmacen<{ version: 1; uniones: Record<string, string> }>("lifeos:conceptos", () => ({ version: 1, uniones: {} }), (c) => ({
  version: 1,
  uniones: (c.uniones as Record<string, string>) ?? {},
}));

/** Conceptos a la vista antes de «Ver todos» */
const A_LA_VISTA = 6;

/** «Nuevo», «+40 %», «−20 %» o «Igual»: el periodo de comparación se dice una sola vez arriba */
function cambioCorto(actual: number, anterior: number): string | null {
  if (anterior <= 0) return actual > 0 ? "Nuevo" : null;
  const p = Math.round(((actual - anterior) / anterior) * 100);
  if (p === 0) return "Igual";
  return `${p > 0 ? "+" : "−"}${Math.abs(p)} %`;
}

export function EnQueSeVa({ categoria, onQuitarCategoria, className }: { categoria: string | null; onQuitarCategoria: () => void; className?: string }) {
  const { db } = useData();
  const today = useToday();
  const { estado } = useAsistentes();
  const centavo = estado.ajustes.centavo;
  const { uniones } = almacenConceptos.useValor();
  const [periodo, setPeriodo] = useState<PeriodoConceptos>("mes");
  const [todos, setTodos] = useState(false);
  const r = useMemo(() => (today ? rangos(periodo, today) : null), [periodo, today]);
  const conceptos = useMemo(() => (r ? agruparConceptos(db.transactions, r.actual.desde, r.actual.hasta, uniones, categoria) : []), [db.transactions, r, uniones, categoria]);
  const antes = useMemo(() => (r ? new Map(agruparConceptos(db.transactions, r.anterior.desde, r.anterior.hasta, uniones, categoria).map((c) => [c.clave, c.total])) : new Map<string, number>()), [db.transactions, r, uniones, categoria]);
  if (!r) return null;
  const total = totalGastos(db.transactions, r.actual.desde, r.actual.hasta, categoria);
  const top = conceptos.slice(0, 10);
  const visibles = todos ? top : top.slice(0, A_LA_VISTA);
  const listaUniones = Object.entries(uniones);

  const unir = (desde: string, hacia: string) => almacenConceptos.cambiar((d) => ({ ...d, uniones: { ...d.uniones, [desde]: hacia } }));
  const separar = (clave: string) =>
    almacenConceptos.cambiar((d) => {
      const u = { ...d.uniones };
      delete u[clave];
      return { ...d, uniones: u };
    });

  return (
    <Card className={className}>
      {/* Título y periodo en una fila; en el celular el periodo baja */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold tracking-[-0.01em] text-fg">¿En qué se va tu plata?</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {categoria ? categoria : "Conceptos con más gasto"} · {r.actual.nombre}
            <span className="text-dim"> · cambio frente a {periodo === "anio" ? "los 12 meses anteriores" : r.anterior.nombre}</span>
          </p>
        </div>
        <Segmented size="sm" label="Periodo" value={periodo} onChange={setPeriodo} options={PERIODOS_CONCEPTOS} />
      </div>
      {categoria ? (
        <button type="button" onClick={onQuitarCategoria} className="focus-ring mb-3 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-bg-2 px-3 text-[12.5px] font-medium hover:bg-elev">
          {categoria} <X size={14} aria-hidden /> <span className="sr-only">Quitar filtro</span>
        </button>
      ) : null}
      {top.length === 0 ? (
        <div className="flex items-center gap-3 rounded-[20px] bg-bg-2 p-4">
          {centavo.activo ? <Asistente id="centavo" size={56} momento="asomado" colores={centavo.colores} accesorio={centavo.accesorio} decorativo animado={false} /> : null}
          <p className="text-[13.5px]">
            <span className="font-medium">{centavo.nombre}:</span> {categoria ? `En ${categoria.toLowerCase()} no hay gastos en este periodo.` : "Todavía no hay gastos en este periodo. Cuando registres algunos, te digo en qué se va la plata."}
          </p>
        </div>
      ) : (
        <>
          <ol className="grid gap-x-8 md:grid-cols-2">
            {visibles.map((c, i) => {
              const cambio = cambioCorto(c.total, antes.get(c.clave) ?? 0);
              const largo = comparacion(c.total, antes.get(c.clave) ?? 0, r.anterior.nombre);
              return (
                <li key={c.clave} className="flex items-center gap-3 border-b border-line py-2.5">
                  <span className="num w-5 shrink-0 text-center text-[12px] text-dim" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 text-[13.5px] leading-snug text-fg [overflow-wrap:anywhere]">{c.nombre}</span>
                      <span className="num shrink-0 text-[13.5px] text-fg">{formatCOP(c.total)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full bg-elev" aria-hidden>
                        <div className={cn("h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none", i === 0 ? "bg-brand" : "bg-line-strong")} style={{ width: `${Math.max(4, pct(c.total, top[0].total))}%` }} />
                      </div>
                      <span className="num shrink-0 whitespace-nowrap text-[11.5px] text-muted" title={largo ?? undefined}>
                        {Math.round(pct(c.total, total))} % · {c.veces} {c.veces === 1 ? "vez" : "veces"}
                        {cambio ? <span className="text-dim"> · {cambio}</span> : null}
                      </span>
                    </div>
                  </div>
                  <Popover
                    side="bottom"
                    trigger={({ open, toggle }) => (
                      <Button size="icon-sm" variant="ghost" aria-label={`Opciones de ${c.nombre}`} aria-expanded={open} onClick={toggle} className="-mr-1.5 shrink-0">
                        <MoreHorizontal size={16} />
                      </Button>
                    )}
                  >
                    {(cerrar) => (
                      <div className="grid max-h-[50dvh] min-w-[210px] gap-0.5 overflow-y-auto p-1" role="menu" aria-label={`Opciones de ${c.nombre}`}>
                        <p className="px-3 pb-1 pt-1.5 text-[11.5px] font-medium text-muted">Unir «{c.nombre}» con…</p>
                        {conceptos
                          .filter((x) => x.clave !== c.clave)
                          .slice(0, 12)
                          .map((x) => (
                            <button key={x.clave} type="button" role="menuitem" onClick={() => (cerrar(), unir(c.clave, x.clave))} className="cursor-pointer rounded-[12px] px-3 py-2 text-left text-[13.5px] hover:bg-card">
                              {x.nombre}
                            </button>
                          ))}
                        {c.unidos.length ? <div className="my-1 h-px bg-line" aria-hidden /> : null}
                        {c.unidos.map((u) => (
                          <button key={u} type="button" role="menuitem" onClick={() => (cerrar(), separar(u))} className="cursor-pointer rounded-[12px] px-3 py-2 text-left text-[13.5px] hover:bg-card">
                            Separar «{u}»
                          </button>
                        ))}
                      </div>
                    )}
                  </Popover>
                </li>
              );
            })}
          </ol>
          {top.length > A_LA_VISTA ? (
            <button type="button" onClick={() => setTodos((v) => !v)} aria-expanded={todos} className="focus-ring mt-3 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-bg-2 px-3.5 text-[12.5px] font-medium hover:bg-elev">
              {todos ? "Ver menos" : `Ver todos (${top.length})`}
              <ChevronDown size={14} className={cn("transition-transform duration-200", todos && "rotate-180")} aria-hidden />
            </button>
          ) : null}
        </>
      )}
      {listaUniones.length ? (
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-dim">
          Unidos a mano:
          {listaUniones.map(([desde, hacia]) => (
            <span key={desde} className="inline-flex items-center gap-1 rounded-full bg-bg-2 px-2.5 py-1">
              {desde} → {hacia}
              <button type="button" onClick={() => separar(desde)} className="focus-ring cursor-pointer rounded-full font-medium text-fg underline-offset-2 hover:underline">
                Deshacer
              </button>
            </span>
          ))}
        </p>
      ) : null}
    </Card>
  );
}
