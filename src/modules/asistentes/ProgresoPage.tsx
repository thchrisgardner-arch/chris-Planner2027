"use client";

import { useMemo, useRef } from "react";
import Link from "@/components/Enlace";
import { CalendarCheck, Download, Flame, Lock, ListChecks, PiggyBank, Shield, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { BarChart } from "@/components/ui/viz";
import { Asistente } from "@/components/asistentes/Asistente";
import { useToday } from "@/hooks/useToday";
import { useAsistentes } from "@/lib/asistentes/estado";
import { FICHAS } from "@/lib/asistentes/definiciones";
import { DESBLOQUEOS, ETAPAS, LOGROS, semanaDe } from "@/lib/asistentes/progreso";
import { ASISTENTE_IDS, type AsistenteId } from "@/lib/asistentes/tipos";
import { addDays } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { useGamificacion } from "./Gamificacion";
import { BarraXP, IconoRacha } from "./Protagonismo";
import { descargarResumen } from "./exportarImagen";
import { almacenAnimo, OPCIONES_ANIMO } from "@/lib/animoUsuario";

export function ProgresoPage() {
  const g = useGamificacion();
  const { estado } = useAsistentes();
  const today = useToday();

  if (!g.activo) {
    return (
      <>
        <PageHeader title="Progreso" subtitle="Niveles, racha, logros y vínculos." />
        <Card>
          <h2 className="text-[18px]">Modo tranquilo activado</h2>
          <p className="mt-1 text-[14px] text-muted">El XP, los niveles y las rachas están ocultos. Tus asistentes y su ánimo siguen igual.</p>
          <Link href="/configuracion?seccion=progreso" className="focus-ring mt-4 inline-flex h-10 items-center rounded-full bg-fg px-4 text-[13.5px] font-medium text-on-fg">
            Activar la gamificación
          </Link>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Progreso" subtitle="Niveles, racha, logros y vínculos con tus asistentes." />
      <div className="grid gap-3 xl:grid-cols-12 [&>*]:min-w-0">
        <Escalera className="xl:col-span-7" principal={estado.principal} />
        <ResumenSemana className="xl:col-span-5" today={today} />
        <Racha className="xl:col-span-7" today={today} />
        <Historial className="xl:col-span-5" today={today} />
        <Logros className="xl:col-span-7" />
        <Vinculos className="xl:col-span-5" />
      </div>
    </>
  );
}

/* ═════════ Escalera de etapas ═════════ */
function Escalera({ className, principal }: { className?: string; principal: AsistenteId }) {
  const g = useGamificacion();
  const { estado } = useAsistentes();
  const a = estado.ajustes[principal];
  const actual = ETAPAS.indexOf(g.nivel.etapa);
  const alturas = [96, 128, 160, 192, 224, 256];
  const enEtapa = ((g.nivel.nivel - 1) % 5) + 1;
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[18px]">Nivel {g.nivel.nivel}</h2>
          <p className="text-[13px] text-muted">Etapa {g.nivel.etapa}</p>
        </div>
        <p className="num text-[13px] text-muted">{g.nivel.xpParaSiguiente ? `${g.nivel.xpEnNivel} / ${g.nivel.xpParaSiguiente} XP` : "Nivel máximo"}</p>
      </div>
      <div className="relative mt-24 grid grid-cols-6 items-end gap-1.5 sm:gap-3" aria-label={`Escalera de etapas: estás en ${g.nivel.etapa}`}>
        {ETAPAS.map((e, i) => (
          <div key={e} className="relative flex flex-col items-center justify-end">
            {i === actual ? (
              <div className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2" style={{ bottom: alturas[i] - 6 }}>
                <Asistente id={principal} size={96} pose={g.nivel.nivel % 2 ? "celebrando" : "orgulloso"} colores={a.colores} accesorio={a.accesorio} mostrarProp={a.mostrarProp} decorativo />
              </div>
            ) : null}
            {i === 5 ? (
              <svg viewBox="0 0 48 32" width="44" height="30" aria-hidden className="absolute" style={{ bottom: alturas[i] + (i === actual ? 96 : 8) }}>
                <path d="M4 26 L8 8 L18 18 L24 4 L30 18 L40 8 L44 26 Z" style={{ fill: "var(--char-yellow)" }} />
                <rect x="4" y="24" width="40" height="6" rx="2" style={{ fill: "var(--char-yellow-shade)" }} />
              </svg>
            ) : null}
            <div
              className={cn(
                "@container flex w-full items-start justify-center overflow-hidden rounded-[16px] pt-3 font-bold",
                i < actual ? "bg-fg text-on-fg" : i === actual ? "bg-brand text-[#0a0a0a]" : "bg-elev text-muted",
              )}
              style={{ height: alturas[i] }}
            >
              <span className="nombre-etapa">{e}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <div className="flex gap-1.5" role="img" aria-label={`Nivel ${enEtapa} de 5 en esta etapa`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={cn("h-3 w-3 rounded-full", n < enEtapa ? "bg-fg" : n === enEtapa ? "bg-brand" : "bg-elev")} />
          ))}
        </div>
        <BarraXP valor={g.nivel.xpEnNivel} max={g.nivel.xpParaSiguiente} className="flex-1" />
      </div>
    </Card>
  );
}

/* ═════════ Resumen de la semana ═════════ */
import { useSemana } from "./semana";

function tituloSemana(xp: number, tono: string) {
  if (xp >= 300) return tono === "tranquilo" ? "Gran semana" : tono === "motivador" ? "Semana imparable" : "Semana redonda";
  if (xp >= 100) return tono === "motivador" ? "Buena semana, sigue" : "Buena semana";
  if (xp > 0) return tono === "seco" ? "Semana tranquila. Muy tranquila." : "Semana tranquila";
  return tono === "seco" ? "Semana en pausa. Pasa." : "Una semana para retomar";
}

export function ResumenSemana({ className, today }: { className?: string; today: string }) {
  const { estado } = useAsistentes();
  const id = estado.principal;
  const a = estado.ajustes[id];
  const s = useSemana(today);
  const ref = useRef<HTMLDivElement>(null);
  const titulo = tituloSemana(s.xp, a.tono);
  const filas = [
    { icon: <Sparkles size={18} />, label: "XP ganado", valor: String(s.xp) },
    { icon: <Flame size={18} />, label: "Hábitos cumplidos", valor: String(s.habitos) },
    { icon: <ListChecks size={18} />, label: "Tareas terminadas", valor: String(s.tareas) },
    { icon: <CalendarCheck size={18} />, label: "Días activos", valor: `${s.dias} de 7` },
    { icon: <PiggyBank size={18} />, label: "Aportes al ahorro", valor: String(s.aportes) },
  ];
  return (
    <Card className={cn("relative overflow-visible", className)}>
      <div ref={ref} className="pointer-events-none absolute -right-2 -top-10 sm:-top-12">
        <Asistente id={id} size={150} pose={s.xp >= 100 ? "celebrando" : s.xp > 0 ? "feliz" : "idle"} colores={a.colores} accesorio={a.accesorio} mostrarProp={a.mostrarProp} decorativo fx={false} />
      </div>
      <p className="text-[13px] text-muted">Resumen de la semana</p>
      <h2 className="mt-1 max-w-[60%] text-[26px] leading-tight">{titulo}</h2>
      <ul className="mt-6 divide-y divide-line rounded-[20px] bg-bg px-4">
        {filas.map((f) => (
          <li key={f.label} className="flex items-center gap-3 py-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-card text-fg">{f.icon}</span>
            <span className="flex-1 text-[14.5px]">{f.label}</span>
            <span className="num text-[15px] font-bold">{f.valor}</span>
          </li>
        ))}
      </ul>
      <Button
        variant="secondary"
        className="mt-4 bg-bg"
        onClick={() =>
          descargarResumen({
            titulo,
            filas: filas.map(({ label, valor }) => ({ label, valor })),
            svg: ref.current?.querySelector("svg") ?? null,
            archivo: `lifeos-semana-${semanaDe(today)}.png`,
          })
        }
      >
        <Download size={17} /> Descargar imagen
      </Button>
    </Card>
  );
}

/* ═════════ Racha y calendario de días activos ═════════ */
function Racha({ className, today }: { className?: string; today: string }) {
  const g = useGamificacion();
  const r = g.progreso.racha;
  const activos = new Set(r.diasActivos);
  const usados = new Set(r.usados);
  const inicio = addDays(semanaDe(today), -7 * 12);
  const semanas = Array.from({ length: 13 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(inicio, w * 7 + d)));
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="flex items-center gap-3">
          <IconoRacha size={44} apagado={!r.actual} />
          <div>
            <p className="figure text-[48px]">{r.actual}</p>
            <p className="text-[13px] text-muted">{r.actual === 1 ? "día de racha" : "días de racha"}</p>
          </div>
        </div>
        <div>
          <p className="num text-[20px] font-bold">{r.mejor}</p>
          <p className="text-[12.5px] text-muted">Mejor racha</p>
        </div>
        <div>
          <p className="flex items-center gap-1" role="img" aria-label={`${r.protectores} protectores disponibles`}>
            {[0, 1].map((i) => (
              <Shield key={i} size={20} className={i < r.protectores ? "text-fg" : "text-line-strong"} fill={i < r.protectores ? "var(--char-lime)" : "none"} />
            ))}
          </p>
          <p className="text-[12.5px] text-muted">Protectores (1 cada 7 días)</p>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto">
        <div className="grid w-max grid-flow-col grid-rows-7 gap-1" role="img" aria-label="Días activos de los últimos 3 meses">
          {semanas.flat().map((d) => (
            <span
              key={d}
              title={d}
              className={cn(
                "relative grid h-4 w-4 place-items-center rounded-[5px] sm:h-5 sm:w-5",
                d > today ? "bg-transparent" : activos.has(d) ? "bg-brand" : usados.has(d) ? "bg-warn-fill" : "bg-elev",
                d === today && "ring-[1.5px] ring-fg",
              )}
            >
              {usados.has(d) ? <Shield size={10} aria-hidden /> : null}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[12.5px] text-muted">Lima: día con actividad. Amarillo: día salvado por un protector.</p>
      <CalendarioAnimo semanas={semanas} today={today} />
    </Card>
  );
}

/** Calendario de ánimo (chequeo diario) junto al de racha. Solo aparece si has respondido alguna vez. */
const COLOR_ANIMO: Record<number, string> = {
  1: "var(--char-gray)",
  2: "var(--char-gray-light)",
  3: "var(--char-cream)",
  4: "var(--char-lime-soft)",
  5: "var(--char-lime)",
};
function CalendarioAnimo({ semanas, today }: { semanas: string[][]; today: string }) {
  const d = almacenAnimo.useValor();
  const dias = semanas.flat();
  if (!dias.some((x) => d.registros[x])) return null;
  return (
    <div className="mt-6">
      <p className="text-[14px] font-medium">Tu ánimo</p>
      <p className="text-[12.5px] text-muted">Solo lo ves tú y vive en este dispositivo.</p>
      <div className="mt-3 overflow-x-auto">
        <div className="grid w-max grid-flow-col grid-rows-7 gap-1" role="img" aria-label="Ánimo de los últimos 3 meses">
          {dias.map((x) => {
            const n = d.registros[x];
            const op = OPCIONES_ANIMO.find((o) => o.nivel === n);
            return (
              <span
                key={x}
                title={op ? `${x}: ${op.label}` : x}
                className={cn("h-4 w-4 rounded-[5px] sm:h-5 sm:w-5", x > today ? "bg-transparent" : n ? "" : "bg-elev", x === today && "ring-[1.5px] ring-fg")}
                style={n ? { background: COLOR_ANIMO[n] } : undefined}
              />
            );
          })}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-muted">
        {OPCIONES_ANIMO.map((o) => (
          <span key={o.nivel} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: COLOR_ANIMO[o.nivel] }} aria-hidden />
            {o.label}
          </span>
        ))}
      </p>
    </div>
  );
}

/* ═════════ Historial de XP (12 semanas) ═════════ */
function Historial({ className, today }: { className?: string; today: string }) {
  const g = useGamificacion();
  const data = useMemo(() => {
    const ini = semanaDe(today);
    return Array.from({ length: 12 }, (_, i) => {
      const desde = addDays(ini, -7 * (11 - i));
      const hasta = addDays(desde, 6);
      const xp = g.progreso.eventos.filter((e) => e.fecha >= desde && e.fecha <= hasta).reduce((s, e) => s + e.xp, 0);
      return { label: i === 11 ? "Esta" : `S${i + 1}`, values: [xp] };
    });
  }, [g.progreso.eventos, today]);
  return (
    <Card className={className}>
      <h2 className="text-[18px]">XP por semana</h2>
      <p className="text-[13px] text-muted">Últimas 12 semanas · total {g.xp} XP</p>
      <div className="mt-6">
        <BarChart data={data} activeIndex={11} height={170} formatTooltip={(d) => `${d.values[0]} XP`} />
      </div>
    </Card>
  );
}

/* ═════════ Logros ═════════ */
function Logros({ className }: { className?: string }) {
  const g = useGamificacion();
  const { estado } = useAsistentes();
  const ganados = LOGROS.filter((l) => g.progreso.logros[l.id]).length;
  return (
    <Card className={className}>
      <h2 className="text-[18px]">Logros</h2>
      <p className="text-[13px] text-muted">
        {ganados} de {LOGROS.length} desbloqueados
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {LOGROS.map((l) => {
          const fecha = g.progreso.logros[l.id];
          const asis = l.asistente === "todos" ? estado.principal : l.asistente;
          const a = estado.ajustes[asis];
          return (
            <li key={l.id} className={cn("flex items-center gap-2.5 rounded-[18px] p-2.5", fecha ? "bg-bg" : "bg-bg/50")}>
              <span className={cn("relative grid h-12 w-12 shrink-0 place-items-center rounded-full", fecha ? "bg-brand/25" : "bg-elev")}>
                <span className={cn(!fecha && "opacity-40 grayscale")}>
                  <Asistente id={asis} size={40} pose={fecha ? "celebrando" : "dormido"} colores={a.colores} animado={false} fx={false} decorativo />
                </span>
                {!fecha ? (
                  <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-fg text-on-fg">
                    <Lock size={10} aria-hidden />
                  </span>
                ) : null}
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate text-[13.5px] font-bold", !fecha && "text-muted")}>{l.titulo}</span>
                <span className="block text-[11.5px] leading-snug text-muted">{fecha ? `Desbloqueado el ${fecha.split("-").reverse().join("/")}` : l.condicion}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ═════════ Vínculos con cada asistente ═════════ */
function Vinculos({ className }: { className?: string }) {
  const g = useGamificacion();
  const { estado } = useAsistentes();
  return (
    <Card className={className}>
      <h2 className="text-[18px]">Vínculos</h2>
      <p className="text-[13px] text-muted">Crecen con el XP de cada módulo y desbloquean personalización.</p>
      <ul className="mt-4 flex flex-col gap-2">
        {ASISTENTE_IDS.map((id) => {
          const a = estado.ajustes[id];
          const v = g.vinculos[id];
          const prox = DESBLOQUEOS.find((d) => d.vinculo > v.nivel);
          return (
            <li key={id} className="flex items-center gap-3 rounded-[18px] bg-bg p-2.5">
              <Asistente id={id} size={44} pose="idle" colores={a.colores} accesorio={a.accesorio} animado={false} fx={false} decorativo />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[14px] font-bold">
                    {a.nombre} <span className="font-normal text-muted">· {FICHAS[id].modulo}</span>
                  </span>
                  <span className="num shrink-0 text-[12.5px]">Vínculo {v.nivel}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-elev" role="progressbar" aria-label={`Vínculo con ${a.nombre}`} aria-valuenow={v.pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-fg" style={{ width: `${v.pct}%` }} />
                </div>
                <p className="mt-1 truncate text-[11.5px] text-muted">{prox ? `Vínculo ${prox.vinculo}: ${prox.label}` : "Todo desbloqueado"}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
