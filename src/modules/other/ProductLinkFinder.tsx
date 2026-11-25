"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, ImageOff, Link2, RefreshCw, Sparkles, X } from "lucide-react";
import { StoreLogo } from "@/components/ui/StoreLogo";
import { formatCOP } from "@/utils/money";
import { cn } from "@/utils/cn";
import { detectStore } from "./stores";

export interface ProductResult {
  url: string;
  title: string | null;
  image: string | null;
  price: number | null;
  currency: string | null;
  siteName: string | null;
}

type State =
  | { kind: "idle" }
  | { kind: "loading"; url: string }
  | { kind: "done"; data: ProductResult }
  | { kind: "error"; message: string };

const isUrl = (v: string) => {
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

/**
 * Pega el enlace y la app lee nombre, precio e imagen del producto (vía /api/producto).
 * Se busca solo al pegar o escribir un enlace válido; también hay botón para reintentar.
 */
export function ProductLinkFinder({
  value,
  onChange,
  onResult,
  error,
  autoSearch = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onResult: (r: ProductResult) => void;
  error?: string | null;
  /** En edición no se busca hasta que cambie el enlace */
  autoSearch?: boolean;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const lastFetched = useRef<string | null>(autoSearch ? null : value.trim() || null);
  const ctrl = useRef<AbortController | null>(null);
  const store = isUrl(value) ? detectStore(value.trim()) : undefined;

  const search = async (raw: string, force = false) => {
    const url = raw.trim();
    if (!isUrl(url)) return;
    if (!force && lastFetched.current === url) return;
    lastFetched.current = url;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState({ kind: "loading", url });
    try {
      const res = await fetch(`/api/producto?url=${encodeURIComponent(url)}`, { signal: c.signal });
      const json = (await res.json()) as ProductResult & { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "No pudimos leer ese enlace.");
      setState({ kind: "done", data: json });
      onResult(json);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setState({ kind: "error", message: e instanceof Error ? e.message : "No pudimos leer ese enlace." });
    }
  };

  // Buscar automáticamente al pegar o terminar de escribir un enlace
  useEffect(() => {
    if (!autoSearch && lastFetched.current === value.trim()) return;
    if (!isUrl(value)) return;
    const id = setTimeout(() => void search(value), 650);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => () => ctrl.current?.abort(), []);

  return (
    <div className="rounded-[24px] bg-bg-2 p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-card text-fg">
          <Sparkles size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-medium tracking-[-0.01em]">Pega el enlace del producto</p>
          <p className="text-[12.5px] text-muted">Completamos el nombre, el precio y la imagen por ti.</p>
        </div>
      </div>

      {/* Campo del enlace */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg">
          {store ? <StoreLogo store={store} size={24} /> : <Link2 size={19} />}
        </span>
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          aria-label="Enlace del producto"
          aria-invalid={!!error || undefined}
          placeholder="https://www.falabella.com.co/…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").trim();
            if (isUrl(text)) {
              e.preventDefault();
              onChange(text);
              void search(text, true);
            }
          }}
          className={cn(
            "focus-ring h-12 w-full rounded-[14px] border border-line bg-card pl-12 pr-24 text-[14.5px] text-fg placeholder:text-dim transition-colors hover:border-line-strong focus:border-fg/30",
            error && "border-danger/70",
          )}
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value ? (
            <button
              type="button"
              aria-label="Borrar enlace"
              onClick={() => {
                onChange("");
                lastFetched.current = null;
                setState({ kind: "idle" });
              }}
              className="grid h-9 w-9 cursor-pointer place-items-center rounded-[10px] text-dim transition-colors hover:bg-elev hover:text-fg"
            >
              <X size={17} />
            </button>
          ) : null}
          <button
            type="button"
            disabled={!isUrl(value) || state.kind === "loading"}
            onClick={() => void search(value, true)}
            className="h-9 cursor-pointer rounded-[10px] bg-fg px-3.5 text-[13px] font-medium text-on-fg transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
          >
            Buscar
          </button>
        </div>
      </div>
      {error ? <p className="mt-1.5 text-[12px] text-danger">{error}</p> : null}

      {/* Resultado */}
      {state.kind === "loading" ? (
        <div className="mt-3 flex items-center gap-3.5 rounded-[18px] bg-card p-3" aria-busy="true">
          <div className="skeleton h-[84px] w-[84px] shrink-0 rounded-[14px]" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-5 w-28" />
          </div>
          <p className="sr-only">Leyendo el producto…</p>
        </div>
      ) : null}

      {state.kind === "loading" ? (
        <p className="mt-2 flex items-center gap-2 px-1 text-[12.5px] text-muted">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent" />
          Leyendo el producto{store ? ` en ${store.name}` : ""}…
        </p>
      ) : null}

      {state.kind === "done" ? <ResultCard data={state.data} storeName={store?.name} onRetry={() => void search(value, true)} /> : null}

      {state.kind === "error" ? (
        <div className="mt-3 flex items-start gap-3 rounded-[18px] bg-card p-3.5">
          <CircleAlert size={19} className="mt-0.5 shrink-0 text-warn" />
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-medium">{state.message}</p>
            <p className="mt-0.5 text-[12.5px] text-muted">Puedes completar los datos a mano; el enlace se guarda igual.</p>
          </div>
          <button
            type="button"
            onClick={() => void search(value, true)}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-elev"
          >
            <RefreshCw size={15} /> Reintentar
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ResultCard({ data, storeName, onRetry }: { data: ProductResult; storeName?: string; onRetry: () => void }) {
  const [imgOk, setImgOk] = useState(true);
  const cop = data.currency === null || data.currency === "COP";
  const fields = [
    { label: "Nombre", ok: !!data.title },
    { label: "Precio", ok: data.price !== null && cop },
    { label: "Imagen", ok: !!data.image && imgOk },
  ];
  return (
    <div className="mt-3 rounded-[18px] bg-card p-3 animate-in">
      <div className="flex gap-3.5">
        <div className="grid h-[84px] w-[84px] shrink-0 place-items-center overflow-hidden rounded-[14px] border border-line bg-white">
          {data.image && imgOk ? (
            // Imagen del producto servida por la tienda
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.image} alt={data.title ?? "Producto"} referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="h-full w-full object-contain p-1" />
          ) : (
            <ImageOff size={22} className="text-dim" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] text-muted">{storeName ?? data.siteName ?? new URL(data.url).hostname.replace(/^www\./, "")}</p>
          <p className="mt-0.5 line-clamp-2 text-[14.5px] font-medium leading-snug">{data.title ?? "Producto sin nombre"}</p>
          <p className="num mt-1 text-[18px] font-medium">
            {data.price !== null ? (cop ? formatCOP(data.price) : `${data.currency} ${data.price.toLocaleString("es-CO")}`) : <span className="text-[13px] font-normal text-dim">Precio no disponible</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          aria-label="Buscar de nuevo"
          title="Buscar de nuevo"
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-[10px] text-dim transition-colors hover:bg-elev hover:text-fg"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        {fields.map((f) => (
          <span
            key={f.label}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium",
              f.ok ? "bg-brand/12 text-brand-soft" : "bg-elev text-dim",
            )}
          >
            {f.ok ? <Check size={12} strokeWidth={2.5} /> : <X size={12} />} {f.label}
          </span>
        ))}
        <span className="ml-auto text-[11.5px] text-dim">Revisa antes de guardar</span>
      </div>
      {!cop && data.price !== null ? (
        <p className="mt-2 rounded-[12px] bg-warn/10 px-3 py-2 text-[12.5px] text-warn">
          El precio viene en {data.currency}. Escríbelo en pesos colombianos en «Precio estimado».
        </p>
      ) : null}
    </div>
  );
}
