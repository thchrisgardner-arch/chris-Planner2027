/**
 * Dinero en Poku Poku.
 * Los importes en COP se manejan en el cliente como enteros (pesos) para que
 * todas las sumas sean exactas. En la base de datos se guardan como numeric(14,2).
 */

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("es-CO", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCOP(value: number): string {
  return copFormatter.format(Math.round(value)).replace(/ /g, " ");
}

/** $1,2 M · $350 mil — para ejes de gráficos */
export function formatCompactCOP(value: number): string {
  return "$" + compactFormatter.format(Math.round(value)).replace(/ /g, " ");
}

/** Formato compacto para KPIs: $16,4 M · $850 K · $9.500 */
export function formatKpiCOP(value: number): string {
  const n = Math.round(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const one = (x: number) => x.toLocaleString("es-CO", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  if (abs >= 1_000_000) return `${sign}$${one(abs / 1_000_000)} M`;
  if (abs >= 10_000) return `${sign}$${one(abs / 1_000)} K`;
  return `${sign}$${abs.toLocaleString("es-CO")}`;
}

/** Convierte lo que escribe la persona ("1.250.000", "$ 80000") en pesos enteros. */
export function parseCOP(input: string | number): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input) : null;
  const clean = input.replace(/[^\d,-]/g, "").replace(/,\d*$/, "");
  if (!clean || clean === "-") return null;
  const n = Number.parseInt(clean, 10);
  return Number.isFinite(n) ? n : null;
}

/** Formatea mientras se escribe: 1250000 → "1.250.000" */
export function formatAmountInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("es-CO");
}

export function sum(values: number[]): number {
  let total = 0;
  for (const v of values) total += Math.round(v);
  return total;
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (part / total) * 100));
}

/** Variación porcentual; null si no hay base para comparar. */
export function variation(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
