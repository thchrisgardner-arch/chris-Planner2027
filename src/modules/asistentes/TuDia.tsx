"use client";

/**
 * "Tu día" (estilo Duolingo): anillo con el XP de hoy frente a tu meta diaria y las 3 misiones
 * del día. Cada misión da +10 XP; las tres juntas, +20 XP; llegar a la meta, +10 XP.
 */
import Link from "@/components/Enlace";
import { Check, ChevronRight, Target } from "lucide-react";
import { cn } from "@/utils/cn";
import { BarraXP } from "./Protagonismo";
import { useGamificacion } from "./Gamificacion";

function AnilloMeta({ valor, meta }: { valor: number; meta: number }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, meta ? valor / meta : 0);
  const lista = valor >= meta;
  return (
    <div className="relative grid h-[124px] w-[124px] shrink-0 place-items-center" role="img" aria-label={`Meta diaria: ${valor} de ${meta} XP`}>
      <svg viewBox="0 0 108 108" className="absolute inset-0 -rotate-90">
        <circle cx="54" cy="54" r={r} fill="none" stroke="var(--color-elev)" strokeWidth="10" />
        <circle
          cx="54"
          cy="54"
          r={r}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700 ease-(--ease-os)"
        />
      </svg>
      <div className="text-center leading-none">
        {lista ? (
          <span className="mx-auto mb-1 grid h-7 w-7 place-items-center rounded-full bg-brand text-[#0a0a0a]">
            <Check size={16} strokeWidth={3} />
          </span>
        ) : null}
        <p className="figure text-[26px]">{valor}</p>
        <p className="num mt-1 text-[12px] text-muted">de {meta} XP</p>
      </div>
    </div>
  );
}

export function TuDia() {
  const g = useGamificacion();
  if (!g.activo) return null;
  const { xpHoy, meta, misiones } = g.dia;
  const hechas = misiones.filter((m) => m.hecha).length;
  const todas = misiones.length > 0 && hechas === misiones.length;
  const faltan = Math.max(0, meta - xpHoy);

  return (
    <section data-tour="dia" aria-label="Tu día: meta diaria y misiones" className="card grid grid-cols-1 gap-5 p-5 sm:p-6 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)] md:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <AnilloMeta valor={xpHoy} meta={meta} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
            <Target size={15} /> Meta diaria
          </p>
          <h2 className="mt-1 text-[20px] font-bold leading-tight">{faltan ? `Te faltan ${faltan} XP` : "¡Meta cumplida!"}</h2>
          <p className="mt-1 text-[13px] text-muted">{faltan ? "Llega a la meta y suma +10 XP." : "Lo que sumes ahora es extra."}</p>
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h3 className="text-[15px] font-bold">Misiones de hoy</h3>
          <p className={cn("num text-[12.5px]", todas ? "font-medium text-brand-soft" : "text-muted")}>
            {todas ? "¡Completas! +20 XP" : `${hechas} de ${misiones.length} · las ${misiones.length} dan +20 XP`}
          </p>
        </div>
        <ul className="grid grid-cols-1 gap-1.5">
          {misiones.map(({ def, cuenta, hecha }) => (
            <li key={def.id}>
              <Link
                href={def.href}
                className={cn("focus-ring group flex items-center gap-3 rounded-[18px] p-2.5 transition-colors", hecha ? "bg-bg-2" : "bg-bg-2 hover:bg-elev")}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                    hecha ? "bg-brand text-[#0a0a0a]" : "border-2 border-line-strong text-transparent",
                  )}
                  aria-hidden
                >
                  <Check size={16} strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[14px] font-medium", hecha && "text-muted line-through decoration-1")}>{def.texto}</span>
                  {def.meta > 1 && !hecha ? <BarraXP valor={cuenta} max={def.meta} className="mt-1.5 max-w-[180px]" grosor="h-1.5" /> : null}
                </span>
                <span className="num shrink-0 text-[12.5px] text-muted">{hecha ? "+10 XP" : def.meta > 1 ? `${cuenta}/${def.meta}` : "+10 XP"}</span>
                {!hecha ? <ChevronRight size={16} className="shrink-0 text-dim group-hover:text-fg" aria-hidden /> : null}
                <span className="sr-only">{hecha ? "Completada" : "Pendiente"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
