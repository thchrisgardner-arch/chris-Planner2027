"use client";

import { useEffect, useRef } from "react";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { almacenPagosFijos, fechaDelMes, movDe } from "@/lib/finanzas/pagosFijos";
import { monthKey } from "@/utils/dates";

/** Crea el movimiento pendiente del mes de cada pago o ingreso fijo activo (una sola vez por mes). */
export function GenerarPagosFijos() {
  const { db, insert, status } = useData();
  const today = useToday();
  const datos = almacenPagosFijos.useValor();
  const enCurso = useRef(new Set<string>());

  useEffect(() => {
    if (status !== "ready" || !today) return;
    const mes = monthKey(today);
    for (const p of datos.pagos) {
      const clave = `${p.id}:${mes}`;
      if (!p.activo || datos.generados[p.id]?.[mes] || enCurso.current.has(clave)) continue;
      const cuenta = db.accounts.find((a) => a.id === p.cuentaId)?.id ?? db.accounts.find((a) => a.type !== "tarjeta_credito")?.id ?? db.accounts[0]?.id;
      if (!cuenta) continue;
      enCurso.current.add(clave);
      void insert("transactions", {
        type: movDe(p),
        description: p.nombre,
        amount: p.monto,
        category: p.categoria,
        account_id: cuenta,
        to_account_id: null,
        date: fechaDelMes(p, mes),
        payment_method: null,
        status: "pendiente",
        beneficiary: movDe(p) === "gasto" ? "para_mi" : null,
        notes: null,
      })
        .then((tx) =>
          almacenPagosFijos.cambiar((d) => ({ ...d, generados: { ...d.generados, [p.id]: { ...(d.generados[p.id] ?? {}), [mes]: tx.id } } })),
        )
        .finally(() => enCurso.current.delete(clave));
    }
  }, [status, today, datos, db.accounts, insert]);

  return null;
}
