"use client";

import { Store as StoreIcon } from "lucide-react";
import { StoreLogo } from "@/components/ui/StoreLogo";
import { cn } from "@/utils/cn";
import { WISHLIST_STORES as STORES } from "./stores";

/** Cuadrícula de tiendas con su logo oficial. Un segundo clic en la elegida la quita. */
export function StorePicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5 min-[460px]:grid-cols-4 sm:grid-cols-6" role="radiogroup" aria-label="Tienda">
      {STORES.map((s) => {
        const active = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(active ? null : s.id)}
            className={cn(
              "focus-ring flex cursor-pointer flex-col items-center gap-1.5 rounded-[12px] border px-1 py-2.5 transition-all duration-200",
              active ? "border-fg bg-card" : "border-line bg-bg-2 hover:border-line-strong hover:bg-card",
            )}
          >
            <StoreLogo store={s} size={30} />
            <span className={cn("max-w-full truncate px-0.5 text-[11.5px]", active ? "font-medium text-fg" : "text-muted")}>{s.name}</span>
          </button>
        );
      })}
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        onClick={() => onChange(null)}
        className={cn(
          "focus-ring flex cursor-pointer flex-col items-center gap-1.5 rounded-[12px] border px-1 py-2.5 transition-all duration-200",
          value === null ? "border-fg bg-card" : "border-line bg-bg-2 hover:border-line-strong hover:bg-card",
        )}
      >
        <span className="grid h-[30px] w-[30px] place-items-center rounded-[28%] border border-line bg-white text-dim">
          <StoreIcon size={17} />
        </span>
        <span className={cn("text-[11.5px]", value === null ? "font-medium text-fg" : "text-muted")}>Otra / ninguna</span>
      </button>
    </div>
  );
}
