"use client";

/** Alimentación: calorías, macros, agua y comidas sugeridas según tu perfil físico. */
import { Droplets, Info } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { planAlimentacion } from "@/lib/salud/alimentacion";
import { habitoDeEntreno } from "@/lib/salud/entrenamiento";
import { usePerfilFisico } from "@/lib/salud/perfil";
import { isScheduled } from "@/modules/habits/selectors";
import { cn } from "@/utils/cn";
import { PerfilFisicoCard } from "./PerfilFisicoCard";

const miles = (n: number) => n.toLocaleString("es-CO");

export function AlimentacionPanel() {
  const { db } = useData();
  const today = useToday();
  const p = usePerfilFisico();
  const habito = habitoDeEntreno(db.habits);
  const entrenaHoy = !!(habito && today && isScheduled(habito, today, db.habit_logs));
  const plan = planAlimentacion(p, entrenaHoy);

  return (
    <div className="grid grid-cols-1 gap-3">
      <PerfilFisicoCard />
      {plan ? (
        <>
          {plan.alertas.length || plan.ajusteNota ? (
            <div className="grid gap-2">
              {[...(plan.ajusteNota ? [plan.ajusteNota] : []), ...plan.alertas].map((a) => (
                <p key={a} className="flex items-start gap-2 rounded-[18px] bg-warn-fill px-4 py-3 text-[13.5px] text-[#0a0a0a]">
                  <Info size={17} className="mt-0.5 shrink-0" /> {a}
                </p>
              ))}
            </div>
          ) : null}

          <Card>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[13px] font-medium text-muted">Tu meta diaria</p>
                <p className="figure mt-1 text-[44px] leading-none">
                  {miles(plan.calorias)} <span className="text-[18px] text-muted">kcal</span>
                </p>
                <p className="mt-2 text-[13px] text-muted">
                  Gasto estimado {miles(plan.gasto)} kcal ·{" "}
                  {plan.objetivoReal === "perder" ? "déficit suave para bajar grasa" : plan.objetivoReal === "ganar" ? "superávit pequeño para ganar músculo" : "mantenimiento"}
                </p>
              </div>
              <div className="rounded-[18px] bg-bg-2 px-4 py-3 text-right">
                <p className="text-[12.5px] text-muted">IMC</p>
                <p className="num text-[22px] font-bold leading-tight">{plan.imc.valor.toLocaleString("es-CO")}</p>
                <p className="text-[12.5px] text-muted">{plan.imc.categoria}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { label: "Proteína", valor: `${plan.proteina} g`, nota: `${Math.round((plan.proteina * 4 * 100) / plan.calorias)} %` },
                { label: "Carbohidratos", valor: `${plan.carbos} g`, nota: `${Math.round((plan.carbos * 4 * 100) / plan.calorias)} %` },
                { label: "Grasa", valor: `${plan.grasa} g`, nota: `${Math.round((plan.grasa * 9 * 100) / plan.calorias)} %` },
                { label: "Agua", valor: `${plan.aguaLitros.toLocaleString("es-CO")} L`, nota: entrenaHoy ? "Hoy entrenas: +0,5 L" : "Al día" },
              ].map((m) => (
                <div key={m.label} className="rounded-[18px] bg-bg-2 p-3">
                  <p className="flex items-center gap-1 text-[12.5px] text-muted">
                    {m.label === "Agua" ? <Droplets size={14} /> : null}
                    {m.label}
                  </p>
                  <p className="num mt-1 text-[20px] font-bold">{m.valor}</p>
                  <p className="text-[12px] text-dim">{m.nota}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Cómo repartirlo en el día" subtitle="Ejemplos con comida de aquí" />
            <ul className="grid gap-2 md:grid-cols-2">
              {plan.comidas.map((c) => (
                <li key={c.nombre} className="rounded-[18px] bg-bg-2 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[15px] font-bold">{c.nombre}</p>
                    <p className="num text-[13px] text-muted">
                      ~{miles(c.kcal)} kcal · {c.proteina} g proteína
                    </p>
                  </div>
                  <p className="mt-1.5 text-[13.5px] text-muted">{c.ejemplo}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Consejos para hoy" />
            <ul className="grid gap-2">
              {plan.consejos.map((c, i) => (
                <li key={i} className={cn("rounded-[16px] bg-bg-2 px-4 py-3 text-[13.5px]")}>
                  {c}
                </li>
              ))}
            </ul>
          </Card>
          <p className="text-center text-[12.5px] text-dim">
            Cálculo orientativo con la fórmula de Mifflin-St Jeor. No reemplaza a un nutricionista ni a un médico.
          </p>
        </>
      ) : null}
    </div>
  );
}
