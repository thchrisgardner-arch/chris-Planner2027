/**
 * Pagos fijos (`lifeos:pagos-fijos`, versión 1): arriendo, servicios, suscripciones y cuotas.
 * Cada mes la app crea un movimiento *pendiente* por pago; al confirmarlo ("Pagado") se vuelve
 * un gasto normal. `generados` recuerda qué movimiento se creó cada mes, así un pendiente que la
 * persona borra no vuelve a aparecer ese mes.
 */
import { crearAlmacen } from "@/lib/almacenLocal";
import { daysInMonth, monthKey, todayISO } from "@/utils/dates";
import type { Database, Transaction } from "@/types/db";

export type TipoPagoFijo = "arriendo" | "servicio" | "suscripcion" | "cuota" | "otro";

export const TIPOS_PAGO_FIJO: { value: TipoPagoFijo; label: string; categoria: string }[] = [
  { value: "arriendo", label: "Arriendo", categoria: "Vivienda" },
  { value: "servicio", label: "Servicio", categoria: "Servicios" },
  { value: "suscripcion", label: "Suscripción", categoria: "Suscripciones" },
  { value: "cuota", label: "Cuota", categoria: "Deudas" },
  { value: "otro", label: "Otro", categoria: "Otros" },
];

export interface PagoFijo {
  id: string;
  nombre: string;
  monto: number;
  categoria: string;
  cuentaId: string | null;
  /** Día del mes (1 a 31; en meses cortos se paga el último día) */
  dia: number;
  tipo: TipoPagoFijo;
  activo: boolean;
  creado: string;
}

export interface DatosPagosFijos {
  version: 1;
  pagos: PagoFijo[];
  /** pagoId → mes (YYYY-MM) → id del movimiento creado */
  generados: Record<string, Record<string, string>>;
}

const vacio = (): DatosPagosFijos => ({ version: 1, pagos: [], generados: {} });

export const almacenPagosFijos = crearAlmacen<DatosPagosFijos>("lifeos:pagos-fijos", vacio, (crudo) => ({
  ...vacio(),
  ...(crudo as Partial<DatosPagosFijos>),
  version: 1,
}));

export const nuevoIdPago = () => `pf${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function fechaDelMes(pago: Pick<PagoFijo, "dia">, mes: string) {
  return `${mes}-${String(Math.min(pago.dia, daysInMonth(mes))).padStart(2, "0")}`;
}

export type EstadoPago = "pagado" | "pendiente" | "omitido" | "sin-generar";

export interface PagoDelMes {
  pago: PagoFijo;
  fecha: string;
  estado: EstadoPago;
  tx: Transaction | null;
  /** Monto pagado (si ya se pagó) o esperado */
  monto: number;
}

/** Cómo va cada pago fijo en un mes */
export function pagosDelMes(datos: DatosPagosFijos, db: Database, mes: string): PagoDelMes[] {
  return datos.pagos
    .filter((p) => p.activo)
    .map((pago) => {
      const txId = datos.generados[pago.id]?.[mes];
      const tx = txId ? (db.transactions.find((t) => t.id === txId) ?? null) : null;
      const estado: EstadoPago = !txId ? "sin-generar" : !tx ? "omitido" : tx.status === "completado" ? "pagado" : "pendiente";
      return { pago, fecha: fechaDelMes(pago, mes), estado, tx, monto: tx?.amount ?? pago.monto };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.pago.nombre.localeCompare(b.pago.nombre));
}

export function resumenMes(lista: PagoDelMes[]) {
  const pagado = lista.filter((x) => x.estado === "pagado").reduce((s, x) => s + x.monto, 0);
  const falta = lista.filter((x) => x.estado === "pendiente" || x.estado === "sin-generar").reduce((s, x) => s + x.monto, 0);
  return { pagado, falta, total: pagado + falta, cuantosPagados: lista.filter((x) => x.estado === "pagado").length, cuantos: lista.filter((x) => x.estado !== "omitido").length };
}

export const mesDe = monthKey;

type Ops = {
  insert: (t: "transactions", d: Omit<Transaction, "id" | "user_id" | "created_at">) => Promise<Transaction>;
  remove: (t: "transactions", id: string) => Promise<void>;
};

/**
 * Completa un movimiento pendiente: lo reemplaza por uno nuevo con fecha de hoy (así la XP cuenta el
 * día en que se paga y no el día en que la app creó el pendiente) y mantiene el vínculo con su pago fijo.
 */
export async function completarPendiente(tx: Transaction, ops: Ops, cambios: { amount?: number; date?: string } = {}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, user_id, created_at, ...resto } = tx;
  const hoy = cambios.date ?? todayISO();
  const nuevo = await ops.insert("transactions", { ...resto, ...cambios, date: hoy, status: "completado" });
  await ops.remove("transactions", tx.id);
  almacenPagosFijos.cambiar((d) => {
    let cambio = false;
    const generados = Object.fromEntries(
      Object.entries(d.generados).map(([pago, meses]) => [
        pago,
        Object.fromEntries(
          Object.entries(meses).map(([mes, txId]) => {
            if (txId !== tx.id) return [mes, txId];
            cambio = true;
            return [mes, nuevo.id];
          }),
        ),
      ]),
    );
    return cambio ? { ...d, generados } : d;
  });
  return nuevo;
}
