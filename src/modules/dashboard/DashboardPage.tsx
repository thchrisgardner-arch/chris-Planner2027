"use client";

import { lazy, Suspense, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { ConexionDelDia } from "@/modules/asistentes/ConexionDelDia";
import { DespuesDelPrimerPintado } from "@/components/Diferido";
import { PageHeader } from "@/components/layout/PageHeader";
import { QuickAdd } from "@/components/layout/HeaderActions";
import { Select } from "@/components/ui/Field";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { addMonths, bogotaHour, formatLongDate, monthKey, monthLabel } from "@/utils/dates";
import { KpiRow } from "./KpiRow";

// La parte baja del inicio (gráficos, hábitos, tareas, calendario, proyectos, wishlist) se descarga
// después de la primera vista
const DashboardAbajo = lazy(() => import("./DashboardAbajo"));
import { HeroAsistente } from "@/modules/asistentes/Protagonismo";
import { RecomendarApp } from "@/modules/asistentes/RecomendarApp";
import { InvitacionRevision } from "@/modules/asistentes/Revision";
import { TuDia } from "@/modules/asistentes/TuDia";
import { AvisoRepararRacha } from "@/modules/asistentes/RepararRacha";

function greeting() {
  const h = bogotaHour();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function DashboardPage() {
  const { profile } = useData();
  const today = useToday();
  const current = monthKey(today);
  const [refMonth, setRefMonth] = useState(current);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => addMonths(current, -i)), [current]);
  const firstName = profile?.full_name?.split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(today)}
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
      >
        <div className="w-[210px]">
          <Select
            aria-label="Mes de los indicadores"
            value={refMonth}
            onChange={(e) => setRefMonth(e.target.value)}
            className="rounded-full bg-card"
            renderIcon={() => <CalendarDays size={17} />}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </Select>
        </div>
        <QuickAdd />
      </PageHeader>

      <div className="flex flex-col gap-3">
        <InvitacionRevision />
        <AvisoRepararRacha />
        <HeroAsistente />
        <RecomendarApp />
        <TuDia />
        <ConexionDelDia />
        {refMonth !== current ? (
          // El selector solo cambia los indicadores: se dice para no confundir con el resto del inicio
          <p className="px-1 text-[13px] text-muted" role="status">
            Indicadores de {monthLabel(refMonth)}. El resto del inicio muestra el mes actual.{" "}
            <button type="button" onClick={() => setRefMonth(current)} className="focus-ring cursor-pointer rounded-full font-medium text-fg underline underline-offset-4">
              Volver al mes actual
            </button>
          </p>
        ) : null}
        <KpiRow refMonth={refMonth} />

        {/* Lo de abajo se dibuja justo después del primer pintado: el asistente y tu día se ven antes */}
        <DespuesDelPrimerPintado>
          <Suspense fallback={null}>
            <DashboardAbajo />
          </Suspense>
        </DespuesDelPrimerPintado>
      </div>
    </>
  );
}
