"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Gift, ImageOff, Plus } from "lucide-react";
import { AsistenteModulo, useVacioAsistente } from "@/modules/asistentes/Presencia";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Badge, EmptyCard, EmptyState, Progress } from "@/components/ui/misc";
import { RowActions, useDeleteRecord } from "@/components/ui/RowActions";
import { useForms } from "@/components/providers/FormsProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import type { WishStatus } from "@/types/db";
import { formatShortDate, relativeDay } from "@/utils/dates";
import { formatCOP, formatKpiCOP, pct, sum } from "@/utils/money";
import { priorityLabel } from "@/modules/projects/constants";
import { cn } from "@/utils/cn";
import { StoreLogo } from "@/components/ui/StoreLogo";
import { STORES, findStore } from "./stores";
import { WISH_CATEGORIES, WISH_CLASSIFICATIONS, WISH_STATUSES, wishStatusLabel, wishStatusTone } from "./constants";

export function WishlistPage() {
  const { db } = useData();
  const open = useForms();

  const vacio = useVacioAsistente("antojo");
  const del = useDeleteRecord();
  const today = useToday();
  const [status, setStatus] = useState<"" | "activos" | WishStatus>("activos");
  const [category, setCategory] = useState("");
  const [store, setStore] = useState("");

  const items = useMemo(
    () =>
      db.wishlist_items
        .filter((w) =>
          (status === "" || (status === "activos" ? w.status !== "comprado" && w.status !== "descartado" : w.status === status)) &&
          (!category || w.category === category) &&
          (!store || (store === "ninguna" ? !findStore(w.store) : w.store === store)),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [db.wishlist_items, status, category, store],
  );
  const activeTotal = sum(db.wishlist_items.filter((w) => w.status !== "comprado" && w.status !== "descartado").map((w) => w.price));
  const bought = db.wishlist_items.filter((w) => w.status === "comprado").length;

  return (
    <>
      <PageHeader title="Wishlist" subtitle="Tu biblioteca de compras y deseos." asistente={<AsistenteModulo id="antojo" oculto={db.wishlist_items.length === 0} />}>
        <Button variant="primary" className="max-md:hidden" onClick={() => open({ kind: "wish" })}>
          <Plus size={18} /> Agregar deseo
        </Button>
      </PageHeader>

      {db.wishlist_items.length === 0 ? (
        <EmptyCard
          ghost="cards"
          title={vacio.frase}
          aside={vacio.aside}
          description="Guarda productos, viajes o experiencias con su precio y asócialos a una meta de ahorro."
          action={
            <Button variant="secondary" className="bg-bg" onClick={() => open({ kind: "wish" })}>
              <Plus size={18} /> Agregar deseo
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <Card className="flex min-h-[120px] flex-col p-5 sm:p-5">
              <h2 className="text-[14px]">Valor de lo pendiente</h2>
              <p className={cn("figure mt-auto pt-4 text-[38px]", activeTotal === 0 && "text-dim")} title={formatCOP(activeTotal)}>
                {formatKpiCOP(activeTotal)}
              </p>
            </Card>
            <Card className="flex min-h-[120px] flex-col p-5 sm:p-5">
              <h2 className="text-[14px]">Comprados</h2>
              <p className={cn("figure mt-auto pt-4 text-[38px]", bought === 0 && "text-dim")}>{bought}</p>
            </Card>
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Estado" className="max-md:col-span-2 md:h-auto md:min-h-[120px] md:items-start md:rounded-[24px] md:bg-card md:p-5 md:text-[14px] md:font-bold md:hover:bg-elev">
              <option value="activos">Pendientes</option>
              <option value="">Todos</option>
              {WISH_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
            <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoría" className="max-md:col-span-2 md:h-auto md:min-h-[120px] md:items-start md:rounded-[24px] md:bg-card md:p-5 md:text-[14px] md:font-bold md:hover:bg-elev">
              <option value="">Todas las categorías</option>
              {WISH_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select value={store} onChange={(e) => setStore(e.target.value)} aria-label="Tienda" className="max-md:col-span-2 md:h-auto md:min-h-[120px] md:items-start md:rounded-[24px] md:bg-card md:p-5 md:text-[14px] md:font-bold md:hover:bg-elev">
              <option value="">Todas las tiendas</option>
              {STORES.filter((s) => db.wishlist_items.some((w) => w.store === s.id)).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="ninguna">Sin tienda</option>
            </Select>
          </div>
          {items.length === 0 ? (
            <EmptyState compact icon={<Gift size={20} />} title="Nada con estos filtros" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {items.map((w) => {
                const goal = db.savings_goals.find((g) => g.id === w.savings_goal_id);
                const saved = goal ? Math.min(goal.current_amount, w.price) : 0;
                const shop = findStore(w.store);
                return (
                  <Card key={w.id} className="flex flex-col overflow-hidden p-0 sm:p-0">
                    <div className="relative aspect-[4/3] bg-elev">
                      {w.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={w.image_url} alt={w.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-dim">
                          <ImageOff size={26} />
                        </div>
                      )}
                      <Badge tone={wishStatusTone(w.status)} className="absolute left-3 top-3 bg-card/90 backdrop-blur">
                        {wishStatusLabel(w.status)}
                      </Badge>
                      {shop ? <StoreLogo store={shop} size={40} className="absolute right-3 top-3" /> : null}
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[16px] font-medium">{w.name}</p>
                          <p className="text-[12px] text-muted">
                            {w.category} · {WISH_CLASSIFICATIONS.find((c) => c.value === w.classification)?.label} · Prioridad {priorityLabel(w.priority).toLowerCase()}
                          </p>
                        </div>
                        <RowActions label={w.name} onEdit={() => open({ kind: "wish", record: w })} onDelete={() => del("wishlist_items", w.id, `¿Eliminar ${w.name}?`)} />
                      </div>
                      <p className="num mt-3 text-[22px] font-medium">{formatCOP(w.price)}</p>
                      {goal ? (
                        <div className="mt-3">
                          <Progress value={pct(saved, w.price)} label={`Ahorro para ${w.name}`} />
                          <p className="mt-1.5 text-[11.5px] text-dim">
                            {Math.round(pct(saved, w.price))} % · meta «{goal.name}»
                          </p>
                        </div>
                      ) : null}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-[11.5px] text-dim">
                        <span>
                          Agregado {formatShortDate(w.created_at.slice(0, 10))}
                          {w.desired_date ? ` · Compra ${relativeDay(w.desired_date, today).toLowerCase()}` : ""}
                        </span>
                        {w.link ? (
                          <a href={w.link} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 text-info hover:underline">
                            {shop ? `Ver en ${shop.name}` : "Ver"} <ExternalLink size={12} />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
