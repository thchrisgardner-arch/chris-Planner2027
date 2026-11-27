"use client";

import { formatoPrecio } from "@/lib/monedas";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, CalendarDays, FolderKanban, Gift, ListTodo, PiggyBank, Search, Target, X } from "lucide-react";
import { useData } from "@/lib/store/DataProvider";
import { useForms, type FormRequest } from "@/components/providers/FormsProvider";
import { formatCOP } from "@/utils/money";
import { formatShortDate } from "@/utils/dates";
import { normalize } from "@/modules/other/stores";
import { cn } from "@/utils/cn";

interface Hit {
  id: string;
  group: string;
  title: string;
  meta: string;
  Icon: typeof Search;
  form: FormRequest;
}

/** Buscador global: movimientos, tareas, proyectos, wishlist, eventos, metas y objetivos. */
export function GlobalSearch({ className }: { className?: string }) {
  const { db } = useData();
  const open = useForms();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atajo: "/" enfoca el buscador
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setFocus(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const term = normalize(q.trim());
    if (term.length < 2) return [];
    const has = (s: string | null | undefined) => !!s && normalize(s).includes(term);
    const out: Hit[] = [];
    for (const t of db.transactions)
      if (has(t.description) || has(t.category))
        out.push({ id: t.id, group: "Movimientos", title: t.description, meta: `${formatCOP(t.amount)} · ${formatShortDate(t.date)}`, Icon: ArrowLeftRight, form: { kind: "transaction", record: t } });
    for (const t of db.tasks) if (has(t.name)) out.push({ id: t.id, group: "Tareas", title: t.name, meta: t.due_date ? formatShortDate(t.due_date) : "Sin fecha", Icon: ListTodo, form: { kind: "task", record: t } });
    for (const p of db.projects) if (has(p.name) || has(p.category)) out.push({ id: p.id, group: "Proyectos", title: p.name, meta: p.category ?? "Proyecto", Icon: FolderKanban, form: { kind: "project", record: p } });
    for (const w of db.wishlist_items) if (has(w.name)) out.push({ id: w.id, group: "Wishlist", title: w.name, meta: formatoPrecio(w), Icon: Gift, form: { kind: "wish", record: w } });
    for (const e of db.calendar_events) if (has(e.title)) out.push({ id: e.id, group: "Calendario", title: e.title, meta: formatShortDate(e.date), Icon: CalendarDays, form: { kind: "event", record: e } });
    for (const g of db.savings_goals) if (has(g.name)) out.push({ id: g.id, group: "Ahorros", title: g.name, meta: formatCOP(g.target_amount), Icon: PiggyBank, form: { kind: "savings", record: g } });
    for (const g of db.annual_goals) if (has(g.title)) out.push({ id: g.id, group: "Objetivos", title: g.title, meta: `${g.progress} %`, Icon: Target, form: { kind: "goal", record: g } });
    return out.slice(0, 9);
  }, [q, db]);

  const choose = (h: Hit) => {
    setFocus(false);
    setQ("");
    open(h.form);
  };

  const show = focus && q.trim().length >= 2;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div className="flex h-11 items-center gap-2.5 rounded-full bg-card px-4 transition-colors focus-within:bg-elev">
        <Search size={18} className="shrink-0 text-fg" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onFocus={() => setFocus(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setFocus(false);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, hits.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && hits[active]) {
              choose(hits[active]);
            }
          }}
          placeholder="Buscar en tu vida…"
          aria-label="Buscar en tus datos"
          aria-expanded={show}
          aria-controls="buscador-resultados"
          role="combobox"
          className="h-full min-w-0 flex-1 bg-transparent text-[14.5px] text-fg outline-none placeholder:text-dim"
        />
        {q ? (
          <button type="button" aria-label="Borrar búsqueda" onClick={() => setQ("")} className="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-dim hover:text-fg">
            <X size={16} />
          </button>
        ) : (
          <kbd className="hidden rounded-[6px] bg-bg px-1.5 text-[11px] text-dim sm:block">/</kbd>
        )}
      </div>

      {show ? (
        <div id="buscador-resultados" role="listbox" className="absolute left-0 right-0 top-[calc(100%+8px)] z-[70] overflow-hidden rounded-[24px] border border-line bg-bg p-2 animate-in">
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-[13.5px] text-muted">Sin resultados para «{q.trim()}».</p>
          ) : (
            hits.map((h, i) => (
              <button
                key={`${h.group}-${h.id}`}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(h)}
                className={cn("flex w-full cursor-pointer items-center gap-3 rounded-[16px] px-3 py-2.5 text-left", i === active && "bg-card")}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-elev text-fg">
                  <h.Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-fg">{h.title}</span>
                  <span className="block truncate text-[12.5px] text-muted">
                    {h.group} · {h.meta}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
