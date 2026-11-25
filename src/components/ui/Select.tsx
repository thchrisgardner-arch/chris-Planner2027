"use client";

import { Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  id?: string;
  value: string;
  /** Misma forma que el onChange de un <select> nativo: e.target.value */
  onChange?: (e: { target: { value: string } }) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  title?: string;
  /** Ícono o logo a la izquierda de cada opción */
  renderIcon?: (value: string) => React.ReactNode;
}

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** Convierte los <option> hijos en datos, para que la API siga siendo la de un <select>. */
function readOptions(children: React.ReactNode): Option[] {
  const out: Option[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: string; children?: React.ReactNode; disabled?: boolean }>(child) || child.type !== "option") return;
    const label = textOf(child.props.children);
    out.push({ value: child.props.value ?? label, label, disabled: child.props.disabled });
  });
  return out;
}

const LIST_MAX = 296;

/**
 * Selector con el estilo de LIFE for LIFE (reemplaza el desplegable nativo del navegador).
 * Accesible: rol listbox, flechas, Inicio/Fin, Enter, Escape y búsqueda por letra.
 */
export function Select({ id, value, onChange, disabled, className, children, title, renderIcon, ...aria }: SelectProps) {
  const options = useMemo(() => readOptions(children), [children]);
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex] ?? options[0];

  const autoId = useId();
  const listId = `${id ?? autoId}-list`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean; maxH: number } | null>(null);
  const typed = useRef({ text: "", at: 0 });

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    const up = below < Math.min(LIST_MAX, options.length * 40 + 12) && above > below;
    // El ancho final lo decide el contenido (max-content); aquí solo el mínimo y la posición inicial
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left: r.left, width: Math.min(Math.max(r.width, 180), vw - 16), up, maxH: Math.min(LIST_MAX, up ? above : below) });
  }, [options.length]);

  const openList = () => {
    if (disabled) return;
    setActive(Math.max(0, selectedIndex));
    place();
    setOpen(true);
  };
  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    if (o.value !== value) onChange?.({ target: { value: o.value } });
    close();
  };

  // Cerrar con clic fuera, scroll de la página o cambio de tamaño
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !listRef.current?.contains(t)) close(false);
    };
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  // Si la lista (ya con su ancho real) se sale por la derecha, alinearla al borde derecho del botón
  useLayoutEffect(() => {
    const ul = listRef.current;
    const t = triggerRef.current;
    if (!open || !ul || !t) return;
    const vw = window.innerWidth;
    const w = ul.offsetWidth;
    const r = t.getBoundingClientRect();
    if (r.left + w > vw - 8) ul.style.left = `${Math.max(8, r.right - w)}px`;
  }, [open, pos]);

  // Mantener visible la opción activa
  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const move = (from: number, dir: 1 | -1) => {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) return i;
    }
    return from;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const stop = () => {
      e.preventDefault();
      e.nativeEvent.stopPropagation(); // que Escape no cierre también el modal
    };
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        stop();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        stop();
        setActive((a) => move(a, 1));
        return;
      case "ArrowUp":
        stop();
        setActive((a) => move(a, -1));
        return;
      case "Home":
        stop();
        setActive(move(-1, 1));
        return;
      case "End":
        stop();
        setActive(move(options.length, -1));
        return;
      case "Enter":
      case " ":
        stop();
        choose(active);
        return;
      case "Escape":
        stop();
        close();
        return;
      case "Tab":
        close(false);
        return;
    }
    if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      typed.current.text = now - typed.current.at > 700 ? e.key.toLowerCase() : typed.current.text + e.key.toLowerCase();
      typed.current.at = now;
      const i = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={aria["aria-label"]}
        aria-invalid={aria["aria-invalid"] || undefined}
        title={title}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-[14px] border border-transparent bg-elev px-4 text-left text-[15px] text-fg outline-none transition-colors duration-200 hover:bg-line-strong focus-visible:border-fg disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger/70",
          open && "border-fg",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {renderIcon && selected ? renderIcon(selected.value) : null}
          <span className="truncate">{selected?.label ?? ""}</span>
        </span>
        <ChevronDown size={18} className={cn("shrink-0 text-fg transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open && pos && typeof document !== "undefined"
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label={aria["aria-label"]}
              tabIndex={-1}
              style={{
                position: "fixed",
                left: pos.left,
                minWidth: pos.width,
                width: "max-content",
                maxWidth: "calc(100vw - 16px)",
                maxHeight: pos.maxH,
                ...(pos.up ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
              }}
              className={cn(
                "z-[95] overflow-y-auto rounded-[20px] border border-line bg-bg p-1.5",
                pos.up ? "origin-bottom" : "origin-top",
                "animate-in",
              )}
            >
              {options.map((o, i) => {
                const isSel = o.value === selected?.value;
                return (
                  <li
                    key={`${o.value}-${i}`}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSel}
                    aria-disabled={o.disabled || undefined}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(i)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-[14.5px] transition-colors duration-150",
                      i === active ? "bg-elev" : "",
                      isSel ? "font-medium text-fg" : "text-fg",
                      o.disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {renderIcon ? renderIcon(o.value) : null}
                    <span className="flex-1 truncate">{o.label}</span>
                    {isSel ? <Check size={17} className="shrink-0 text-fg" /> : null}
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}
