"use client";

/**
 * Suscripciones olvidadas (Finanzas → Gastos fijos): cobros que se repiten cada mes en tus movimientos y que
 * aún no están como gasto fijo, con lo que suman al año. Se pueden pasar a gasto fijo (si ya se cobró este
 * mes, ese cobro queda como el pago del mes, sin crear otro pendiente) o descartar con «No es fijo».
 */
import { useMemo, useState } from "react";
import { Repeat } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Asistente } from "@/components/asistentes/Asistente";
import { useData } from "@/lib/store/DataProvider";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useAsistentes } from "@/lib/asistentes/estado";
import { useToday } from "@/hooks/useToday";
import { almacenCobrosIgnorados, cobrosRepetidos, type CobroRepetido } from "@/lib/finanzas/cobrosRepetidos";
import { normalizarConcepto } from "@/lib/finanzas/conceptos";
import { almacenPagosFijos, movDe, nuevoIdPago } from "@/lib/finanzas/pagosFijos";
import { formatShortDate, monthKey } from "@/utils/dates";
import { formatCOP } from "@/utils/money";

export function CobrosRepetidos() {
  const { db } = useData();
  const { toast } = useFeedback();
  const today = useToday();
  const datos = almacenPagosFijos.useValor();
  const ignorados = almacenCobrosIgnorados.useValor().claves;
  const centavo = useAsistentes().estado.ajustes.centavo;
  const [todos, setTodos] = useState(false);

  const lista = useMemo(() => {
    if (!today) return [];
    // Fuera: lo que ya es gasto fijo (por nombre) y los movimientos que crearon los gastos fijos
    const excluir = new Set([...ignorados, ...datos.pagos.filter((p) => movDe(p) === "gasto").map((p) => normalizarConcepto(p.nombre))]);
    const generados = new Set(Object.values(datos.generados).flatMap((m) => Object.values(m)));
    return cobrosRepetidos(
      db.transactions.filter((t) => !generados.has(t.id)),
      today,
      excluir,
    );
  }, [db.transactions, datos, ignorados, today]);

  if (!lista.length) return null;
  const total = lista.reduce((s, c) => s + c.alAnio, 0);
  // Lo que más sorprende: solo las suscripciones (categoría «Suscripciones»)
  const subs = lista.filter((c) => c.categoria === "Suscripciones");
  const totalSubs = subs.reduce((s, c) => s + c.alAnio, 0);
  const visibles = todos ? lista : lista.slice(0, 5);

  const agregar = (c: CobroRepetido) => {
    const id = nuevoIdPago();
    const mes = today ? monthKey(today) : "";
    almacenPagosFijos.cambiar((d) => ({
      ...d,
      pagos: [
        ...d.pagos,
        { id, mov: "gasto", nombre: c.nombre, monto: c.monto, categoria: c.categoria ?? "Suscripciones", cuentaId: c.cuentaId, dia: c.dia, tipo: "suscripcion", activo: true, creado: today },
      ],
      // Si ya se cobró este mes, ese cobro es el pago del mes (no se crea otro pendiente)
      generados: monthKey(c.ultimo) === mes ? { ...d.generados, [id]: { [mes]: c.ultimoId } } : d.generados,
    }));
    toast(`${c.nombre} quedó como gasto fijo: cada ${c.dia}.`);
  };
  const descartar = (c: CobroRepetido) => {
    almacenCobrosIgnorados.cambiar((x) => ({ ...x, claves: [...new Set([...x.claves, c.clave])] }));
    toast(`Listo, ${c.nombre} no se volverá a sugerir.`);
  };

  return (
    <Card>
      <div className="flex items-start gap-3">
        {centavo.activo ? <Asistente id="centavo" size={52} pose="preocupado" colores={centavo.colores} accesorio={centavo.accesorio} decorativo animado={false} /> : null}
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-[16px]">
            <Repeat size={16} /> Cobros que se repiten
          </h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {centavo.nombre}: parecen suscripciones o pagos mensuales que no tienes como gasto fijo. Juntos son unos{" "}
            <span className="num font-medium text-fg">{formatCOP(total)} al año</span>.
          </p>
          {subs.length ? (
            <p className="mt-1.5 inline-flex flex-wrap items-baseline gap-1 rounded-full bg-warn/10 px-3 py-1 text-[13px]">
              Solo en suscripciones ({subs.map((c) => c.nombre).join(", ")}): <span className="num font-bold">{formatCOP(totalSubs)} al año</span>
            </p>
          ) : null}
        </div>
      </div>
      <ul className="mt-3 grid gap-2">
        {visibles.map((c) => (
          <li key={c.clave} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[16px] bg-bg-2 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{c.nombre}</p>
              <p className="num text-[12px] text-muted">
                {formatCOP(c.monto)} al mes · {c.veces} cobros · último {formatShortDate(c.ultimo)}
              </p>
            </div>
            <p className="num shrink-0 text-[13.5px] font-medium">{formatCOP(c.alAnio)} al año</p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button size="sm" variant="primary" className="flex-1 sm:flex-none" onClick={() => agregar(c)}>
                Pasar a gasto fijo
              </Button>
              <Button size="sm" variant="ghost" className="flex-1 sm:flex-none" onClick={() => descartar(c)}>
                No es fijo
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {lista.length > 5 ? (
        <button type="button" onClick={() => setTodos((v) => !v)} className="focus-ring mt-2 cursor-pointer rounded-full px-1 text-[13px] font-medium text-muted hover:text-fg">
          {todos ? "Ver menos" : `Ver todos (${lista.length})`}
        </button>
      ) : null}
    </Card>
  );
}
