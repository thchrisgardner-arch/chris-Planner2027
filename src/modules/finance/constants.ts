import type { AccountType, Beneficiary, TxStatus } from "@/types/db";

export const INCOME_CATEGORIES = ["Salario", "Freelance", "Diseño y proyectos", "Negocios", "Otros ingresos"];

export const EXPENSE_CATEGORIES = [
  "Vivienda",
  "Servicios",
  "Alimentación",
  "Transporte",
  "Salud",
  "Gimnasio",
  "Entretenimiento",
  "Apuestas",
  "Compras personales",
  "Tecnología",
  "Suscripciones",
  "Familia",
  "Ayuda a otras personas",
  "Otros",
];

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "banco", label: "Cuenta bancaria" },
  { value: "efectivo", label: "Efectivo" },
  { value: "billetera", label: "Billetera digital" },
  { value: "ahorros", label: "Ahorros" },
  { value: "tarjeta_credito", label: "Tarjeta de crédito" },
];

export const accountTypeLabel = (t: AccountType) => ACCOUNT_TYPES.find((a) => a.value === t)?.label ?? t;

/** Métodos de pago. brand = id del catálogo de logos; icon = ícono genérico. */
export const PAYMENT_METHODS: { value: string; brand?: string; icon?: "debito" | "credito" | "efectivo" | "transferencia" | "otro" }[] = [
  { value: "Débito", icon: "debito" },
  { value: "Tarjeta de crédito", icon: "credito" },
  { value: "Efectivo", icon: "efectivo" },
  { value: "Transferencia", icon: "transferencia" },
  { value: "Nequi", brand: "nequi" },
  { value: "DaviPlata", brand: "daviplata" },
  { value: "PSE", brand: "pse" },
  { value: "Otro", icon: "otro" },
];

export const BENEFICIARIES: { value: Beneficiary; label: string }[] = [
  { value: "para_mi", label: "Para mí" },
  { value: "otras_personas", label: "Para otras personas" },
  { value: "compartido", label: "Compartido" },
];

export const TX_STATUSES: { value: TxStatus; label: string }[] = [
  { value: "completado", label: "Completado" },
  { value: "pendiente", label: "Pendiente" },
];

/** Colores para gráficos de categorías: verdes y neutros, nunca todo el arcoíris. */
export const CATEGORY_COLORS = ["#2ee56b", "#85e6a5", "#9b82f6", "#66a9f7", "#f4a340", "#5c6b61", "#c4b5fd", "#3a463e"];
