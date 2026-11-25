"use client";

/**
 * Aviso para reparar una racha rota (estilo Duolingo): sale en el inicio mientras la racha
 * todavía se pueda recuperar pagando XP. El nivel no baja al pagar.
 */
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useGamificacion } from "./Gamificacion";
import { IconoRacha } from "./Protagonismo";

export function useReparar() {
  const g = useGamificacion();
  const { confirm } = useFeedback();
  return async () => {
    const r = g.reparable;
    if (!r) return;
    const ok = await confirm({
      title: `¿Reparar tu racha por ${r.costo} XP?`,
      description: `Recuperas tu racha de ${r.anterior} días y quedas en ${r.nueva}. Se descuentan ${r.costo} XP de tu total; tu nivel no baja.`,
      confirmLabel: "Reparar racha",
    });
    if (ok) g.repararRacha();
  };
}

export function AvisoRepararRacha() {
  const g = useGamificacion();
  const reparar = useReparar();
  const r = g.reparable;
  if (!g.activo || !r) return null;
  return (
    <section aria-label="Reparar racha" className="card card-warm flex flex-wrap items-center gap-4 py-4 pl-4 pr-5">
      <IconoRacha size={44} apagado />
      <div className="min-w-[200px] flex-1">
        <p className="text-[15px] font-bold">Se rompió tu racha de {r.anterior} días</p>
        <p className="mt-0.5 text-[13px] text-muted">
          Repárala por {r.costo} XP y vuelves a {r.nueva} {r.nueva === 1 ? "día" : "días"}. Solo por hoy y mañana; tu nivel no baja.
        </p>
      </div>
      <Button variant="primary" className="w-full sm:w-auto" onClick={reparar}>
        <Wrench size={17} /> Reparar racha
      </Button>
    </section>
  );
}
