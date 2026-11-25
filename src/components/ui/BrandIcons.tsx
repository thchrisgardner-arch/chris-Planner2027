"use client";

import { ArrowLeftRight, Banknote, CircleDashed, CreditCard, Landmark, PiggyBank, Wallet, WalletCards } from "lucide-react";
import { StoreLogo } from "./StoreLogo";
import type { Account, AccountType } from "@/types/db";
import { detectStoreInText, findBrand } from "@/modules/other/stores";
import { PAYMENT_METHODS } from "@/modules/finance/constants";

const TYPE_ICONS: Record<AccountType, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  banco: Landmark,
  efectivo: Banknote,
  billetera: Wallet,
  ahorros: PiggyBank,
  tarjeta_credito: CreditCard,
};

function Tile({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[28%] bg-elev text-fg" style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

/** Logo del banco si se reconoce por el nombre de la cuenta; si no, ícono del tipo de cuenta. */
export function AccountIcon({ account, size = 24 }: { account: Pick<Account, "name" | "type">; size?: number }) {
  const bank = detectStoreInText(account.name, ["banco"]);
  if (bank) return <StoreLogo store={bank} size={size} />;
  const Icon = TYPE_ICONS[account.type] ?? Landmark;
  return (
    <Tile size={size}>
      <Icon size={Math.round(size * 0.55)} />
    </Tile>
  );
}

const GENERIC = {
  debito: CreditCard,
  credito: WalletCards,
  efectivo: Banknote,
  transferencia: ArrowLeftRight,
  otro: CircleDashed,
} as const;

/** Logo original (Nequi, DaviPlata, PSE…) o ícono genérico del método de pago. */
export function PaymentMethodIcon({ value, size = 24 }: { value: string; size?: number }) {
  const m = PAYMENT_METHODS.find((p) => p.value === value);
  const brand = findBrand(m?.brand) ?? detectStoreInText(value, ["banco"]);
  if (brand) return <StoreLogo store={brand} size={size} />;
  if (!m?.icon) return null;
  const Icon = GENERIC[m.icon];
  return (
    <Tile size={size}>
      <Icon size={Math.round(size * 0.55)} />
    </Tile>
  );
}
