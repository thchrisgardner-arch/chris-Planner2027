/**
 * Monedas de los deseos de la wishlist. Un deseo guarda su precio en la moneda de la tienda
 * (`currency`: COP, USD o EUR; sin valor, COP). Si la persona escribió una tasa de cambio
 * (`lifeos:monedas`), se muestra el equivalente en pesos aparte y las metas de ahorro lo usan;
 * sin tasa, un precio en dólares no se suma ni se compara con pesos.
 */
import { crearAlmacen } from "@/lib/almacenLocal";
import { formatCOP } from "@/utils/money";

export type Moneda = "COP" | "USD" | "EUR";
export const MONEDAS: Moneda[] = ["COP", "USD", "EUR"];

export const almacenMonedas = crearAlmacen<{ version: 1; tasas: Partial<Record<Moneda, number>> }>("lifeos:monedas", () => ({ version: 1, tasas: {} }), (c) => ({
  version: 1,
  tasas: (c.tasas as Partial<Record<Moneda, number>>) ?? {},
}));

export const monedaDe = (w: { currency?: string | null }): Moneda => (w.currency === "USD" || w.currency === "EUR" ? w.currency : "COP");

/** Precio en pesos: el mismo si es COP; convertido con la tasa guardada; null si no hay tasa */
export function enPesos(w: { price: number; currency?: string | null }, tasas: Partial<Record<Moneda, number>> = almacenMonedas.leer().tasas): number | null {
  const m = monedaDe(w);
  if (m === "COP") return w.price;
  const t = tasas[m];
  return t && t > 0 ? Math.round(w.price * t) : null;
}

/** Para comparar con lo ahorrado o con lo que queda libre: sin tasa, nunca "alcanza" */
export const enPesosOInfinito = (w: { price: number; currency?: string | null }) => enPesos(w) ?? Number.POSITIVE_INFINITY;

/** "US$ 24,00" · "€ 24,99" · "$ 96.000" */
export function formatoPrecio(w: { price: number; currency?: string | null }): string {
  const m = monedaDe(w);
  if (m === "COP") return formatCOP(w.price);
  const n = w.price.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${m === "USD" ? "US$" : "€"} ${n}`;
}

/** "≈ $96.000" (solo si hay tasa y la moneda no es COP) */
export function equivalente(w: { price: number; currency?: string | null }): string | null {
  if (monedaDe(w) === "COP") return null;
  const p = enPesos(w);
  return p !== null ? `≈ ${formatCOP(p)}` : null;
}
