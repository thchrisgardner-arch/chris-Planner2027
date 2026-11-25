"use client";

import { useState } from "react";
import { siIkea, siSamsung } from "simple-icons";
import { cn } from "@/utils/cn";
import type { Store } from "@/modules/other/stores";

const VECTORS = { samsung: siSamsung, ikea: siIkea } as const;

/** Logo oficial de la tienda dentro de un recuadro blanco uniforme. */
export function StoreLogo({ store, size = 32, className }: { store: Store; size?: number; className?: string }) {
  const [attempt, setAttempt] = useState(0);
  const src = store.icons[attempt];
  // Los logotipos vectoriales (Samsung, IKEA) usan casi todo el ancho del recuadro
  const pad = Math.round(size * (store.svg ? 0.06 : 0.16));

  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center overflow-hidden rounded-[28%] border border-line bg-white", className)}
      style={{ width: size, height: size, padding: pad }}
      title={store.name}
    >
      {store.svg ? (
        <svg viewBox="0 0 24 24" role="img" aria-label={store.name} className="h-full w-full" fill={`#${VECTORS[store.svg].hex}`}>
          <path d={VECTORS[store.svg].path} />
        </svg>
      ) : src ? (
        // Ícono oficial servido por la tienda (dominio externo, por eso <img>)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={store.name}
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain"
          onError={() => setAttempt((a) => a + 1)}
        />
      ) : (
        <span
          aria-label={store.name}
          className="grid h-full w-full place-items-center rounded-[22%] text-[0.55em] font-bold text-white"
          style={{ background: store.color, fontSize: size * 0.42 }}
        >
          {store.name.charAt(0)}
        </span>
      )}
    </span>
  );
}
