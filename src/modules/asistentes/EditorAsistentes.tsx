"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, ChevronDown, FileText, ListTodo, Plus, RotateCcw, Sun, Moon, Calendar } from "lucide-react";
import { Asistente } from "@/components/asistentes/Asistente";
import { Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/misc";
import { Switch } from "@/components/ui/Switch";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { useAsistentes, type AjustesAsistente } from "@/lib/asistentes/estado";
import { AVISOS, FICHAS, TONOS, type Avisos, type Tono } from "@/lib/asistentes/definiciones";
import { motorLocal, type Mensaje } from "@/lib/asistentes/motor";
import {
  ACCESORIOS,
  ACCESORIO_LABEL,
  ASISTENTE_IDS,
  CHAR_COLORS,
  CHAR_COLOR_LABEL,
  EXPRESIONES,
  EXPRESION_LABEL,
  charVar,
  type AsistenteId,
  type CharColor,
  type Colores,
} from "@/lib/asistentes/tipos";
import { cn } from "@/utils/cn";

const TAMANOS = [48, 96, 160, 320] as const;

/**
 * Editor "Tus asistentes": lista · escenario con barra de prueba · propiedades.
 * Autoguardado en cada cambio (clave lifeos:asistentes).
 */
export function EditorAsistentes() {
  const { estado, actualizar, hacerPrincipal, restablecer } = useAsistentes();
  const { toast, confirm } = useFeedback();
  const [sel, setSel] = useState<AsistenteId>(estado.principal);
  const [salto, setSalto] = useState(0);
  const ultimoToast = useRef(0);
  const a = estado.ajustes[sel];
  const ficha = FICHAS[sel];

  const avisarGuardado = () => {
    const now = Date.now();
    if (now - ultimoToast.current > 2500) toast("Guardado");
    ultimoToast.current = now;
  };
  const cambiar = (patch: Partial<AjustesAsistente>) => {
    if (actualizar(sel, patch)) avisarGuardado();
  };
  const elegir = (id: AsistenteId) => {
    setSel(id);
    setSalto((n) => n + 1);
  };
  const onRestablecer = async () => {
    const ok = await confirm({
      title: `¿Restablecer a ${a.nombre}?`,
      description: "Vuelve a su nombre, colores, expresión, accesorio, tono y avisos por defecto.",
      confirmLabel: "Restablecer",
    });
    if (!ok) return;
    restablecer(sel);
    toast("Restablecido");
  };

  return (
    <section id="asistentes" aria-labelledby="asistentes-titulo" className="min-w-0 scroll-mt-24 xl:col-span-2">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="asistentes-titulo" className="text-[22px]">
            Tus asistentes
          </h2>
          <p className="mt-1 text-[14px] text-muted">Elige, nombra y personaliza a quién te acompaña en cada módulo.</p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[260px_minmax(0,1fr)_300px] [&>*]:min-w-0">
        {/* Lista: columna en escritorio, carrusel en tablet y móvil */}
        <Lista estado={estado} sel={sel} onSel={elegir} onActivo={(id, v) => {
          if (!actualizar(id, { activo: v })) toast("El asistente principal no se puede desactivar. Elige otro principal primero.", "error");
          else avisarGuardado();
        }} />

        <Escenario id={sel} a={a} salto={salto} onRestablecer={onRestablecer} onTono={(t) => cambiar({ tono: t })} />

        <Propiedades
          id={sel}
          a={a}
          principal={estado.principal === sel}
          onCambio={cambiar}
          onPrincipal={() => {
            hacerPrincipal(sel);
            avisarGuardado();
          }}
          prop={ficha.prop}
        />
      </div>
    </section>
  );
}

/* ═════════ Lista de asistentes ═════════ */
function Lista({
  estado,
  sel,
  onSel,
  onActivo,
}: {
  estado: ReturnType<typeof useAsistentes>["estado"];
  sel: AsistenteId;
  onSel: (id: AsistenteId) => void;
  onActivo: (id: AsistenteId, v: boolean) => void;
}) {
  return (
    <div className="card p-2 md:col-span-2 xl:col-span-1">
      <ul className="flex gap-1.5 overflow-x-auto xl:flex-col xl:overflow-visible" role="listbox" aria-label="Asistentes">
        {ASISTENTE_IDS.map((id) => {
          const a = estado.ajustes[id];
          const activo = id === sel;
          return (
            <li key={id} className="shrink-0 xl:shrink">
              <div
                role="option"
                aria-selected={activo}
                tabIndex={0}
                onClick={() => onSel(id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSel(id);
                  }
                }}
                className={cn(
                  "focus-ring flex cursor-pointer items-center gap-3 rounded-[18px] p-2 transition-colors",
                  activo ? "bg-bg" : "hover:bg-bg/60",
                  !a.activo && "opacity-60",
                )}
              >
                <Asistente id={id} size={40} colores={a.colores} accesorio={a.accesorio} mostrarProp={a.mostrarProp} animado={false} decorativo />
                <div className="hidden min-w-0 flex-1 xl:block">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[14px] font-medium">{a.nombre}</span>
                    {estado.principal === id ? <span className="rounded-full bg-brand px-2 py-0.5 text-[10.5px] font-medium text-[#0a0a0a]">Principal</span> : null}
                  </div>
                  <span className="block truncate text-[12.5px] text-muted">{FICHAS[id].modulo}</span>
                </div>
                <span className="pr-1 text-[13px] font-medium xl:hidden">{a.nombre}</span>
                <Switch
                  className="hidden xl:inline-flex"
                  checked={a.activo}
                  onChange={(v) => onActivo(id, v)}
                  label={`${a.activo ? "Desactivar" : "Activar"} a ${a.nombre}`}
                  disabled={estado.principal === id}
                  title={estado.principal === id ? "El principal no se puede desactivar" : undefined}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ═════════ Escenario de vista previa + barra de prueba ═════════ */
function Escenario({
  id,
  a,
  salto,
  onRestablecer,
  onTono,
}: {
  id: AsistenteId;
  a: AjustesAsistente;
  salto: number;
  onRestablecer: () => void;
  onTono: (t: Tono) => void;
}) {
  const { db } = useData();
  const today = useToday();
  const [oscuro, setOscuro] = useState(false);
  const [tamano, setTamano] = useState<(typeof TAMANOS)[number]>(320);
  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState<{ q: string; r: Mensaje } | null>(null);

  // Al cambiar de asistente o de tono se limpia la conversación
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRespuesta(null);
  }, [id, a.tono]);

  const ctx = useMemo(() => ({ db, today, tono: a.tono }), [db, today, a.tono]);
  const mensaje = respuesta?.r ?? motorLocal.mensaje(id, ctx);
  // La expresión elegida manda; si es neutral, el mensaje propone la suya
  const expresion = a.expresion !== "neutral" ? a.expresion : mensaje.expresion;

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const q = pregunta.trim();
    if (!q) return;
    setRespuesta({ q, r: motorLocal.responder(id, q, ctx) });
    setPregunta("");
  };

  return (
    <div className="card flex min-h-[420px] flex-col p-3 md:min-h-[560px]">
      {/* Barra de vista flotante */}
      <div className="mx-auto flex flex-wrap items-center justify-center gap-1 rounded-full bg-bg p-1">
        <button
          type="button"
          onClick={() => setOscuro((o) => !o)}
          aria-pressed={oscuro}
          aria-label={oscuro ? "Ver sobre fondo claro" : "Ver sobre fondo oscuro"}
          className="focus-ring grid h-9 w-9 cursor-pointer place-items-center rounded-full hover:bg-card"
        >
          {oscuro ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className="flex rounded-full" role="radiogroup" aria-label="Tamaño de vista previa">
          {TAMANOS.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tamano === t}
              onClick={() => setTamano(t)}
              className={cn("focus-ring h-9 cursor-pointer rounded-full px-3 text-[12.5px] font-medium", tamano === t ? "bg-fg text-on-fg" : "hover:bg-card")}
            >
              {t}
            </button>
          ))}
        </div>
        <button type="button" onClick={onRestablecer} className="focus-ring flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium hover:bg-card">
          <RotateCcw size={15} /> Restablecer
        </button>
      </div>

      {/* Escenario */}
      <div className={cn("relative mt-3 flex flex-1 flex-col items-center justify-center gap-4 overflow-hidden rounded-[20px] px-4 py-8 transition-colors", oscuro ? "bg-neutral-900" : "bg-bg")}>
        <div aria-live="polite" className="max-w-[340px] rounded-[20px] bg-bg-2 px-4 py-3 text-center text-[14.5px] leading-snug text-fg shadow-[0_0_0_1px_var(--color-line)]">
          {respuesta ? <span className="mb-1 block text-[12px] text-muted">Tú: {respuesta.q}</span> : null}
          {a.avisos === "nunca" && !respuesta ? <span className="text-muted">Avisos apagados: {a.nombre} no mostrará burbujas en la app.</span> : mensaje.texto}
        </div>
        <div className="max-md:hidden">
          <Asistente id={id} size={tamano} colores={a.colores} expresion={expresion} accesorio={a.accesorio} mostrarProp={a.mostrarProp} nombre={a.nombre} interactivo celebrar={salto} />
        </div>
        <div className="md:hidden">
          <Asistente id={id} size={Math.min(tamano, 200)} colores={a.colores} expresion={expresion} accesorio={a.accesorio} mostrarProp={a.mostrarProp} nombre={a.nombre} interactivo celebrar={salto} />
        </div>
      </div>

      {/* Barra de prueba (en móvil queda pegada sobre la navegación inferior) */}
      <form onSubmit={enviar} className="sticky bottom-24 z-10 mt-3 rounded-[22px] bg-bg p-2 md:static">
        <label htmlFor="asis-pregunta" className="sr-only">
          Pregúntale algo a {a.nombre}
        </label>
        <input
          id="asis-pregunta"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder={`Pregúntale algo a ${a.nombre}…`}
          className="h-10 w-full bg-transparent px-2 text-[14.5px] text-fg outline-none placeholder:text-dim"
          autoComplete="off"
        />
        <div className="mt-1 flex items-center gap-1.5">
          <Popover
            align="start"
            side="top"
            className="w-[250px]"
            trigger={({ open, toggle }) => (
              <button
                type="button"
                aria-label="Adjuntar"
                aria-expanded={open}
                onClick={toggle}
                className="focus-ring grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-card hover:bg-elev"
              >
                <Plus size={18} />
              </button>
            )}
          >
            {() => (
              <>
                {[
                  { icon: <FileText size={17} />, label: "Adjuntar movimiento" },
                  { icon: <ListTodo size={17} />, label: "Adjuntar tarea" },
                  { icon: <Calendar size={17} />, label: "Adjuntar evento" },
                ].map((x) => (
                  <div key={x.label} aria-disabled className="flex h-11 items-center gap-3 rounded-[14px] px-3 text-[14.5px] text-muted">
                    {x.icon}
                    <span className="flex-1">{x.label}</span>
                    <span className="rounded-full bg-card px-2 py-0.5 text-[11px]">Pronto</span>
                  </div>
                ))}
              </>
            )}
          </Popover>
          <TonoPill tono={a.tono} onChange={onTono} />
          <button type="submit" aria-label="Enviar" disabled={!pregunta.trim()} className="focus-ring ml-auto grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-fg text-on-fg disabled:opacity-40">
            <ArrowUp size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

function TonoPill({ tono, onChange }: { tono: Tono; onChange: (t: Tono) => void }) {
  const actual = TONOS.find((t) => t.value === tono)!;
  return (
    <Popover
      align="start"
      side="top"
      className="w-[230px]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-label={`Tono: ${actual.label}`}
          aria-expanded={open}
          onClick={toggle}
          className="focus-ring flex h-9 cursor-pointer items-center gap-1 rounded-full bg-card px-3 text-[13px] font-medium hover:bg-elev"
        >
          {actual.label} <ChevronDown size={15} />
        </button>
      )}
    >
      {(close) =>
        TONOS.map((t) => (
          <MenuItem
            key={t.value}
            hint={t.value === tono ? "Actual" : undefined}
            onClick={() => {
              onChange(t.value);
              close();
            }}
          >
            {t.label}
          </MenuItem>
        ))
      }
    </Popover>
  );
}

/* ═════════ Propiedades ═════════ */
function Bloque({ titulo, children, defaultOpen = true }: { titulo: string; children: React.ReactNode; defaultOpen?: boolean }) {
  // En móvil se comporta como acordeón; en tablet y escritorio queda abierto
  return (
    <details open={defaultOpen} className="group border-b border-line px-4 py-4 last:border-b-0 md:[&>summary]:pointer-events-none">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-bold">
        {titulo}
        <Plus size={16} className="text-muted transition-transform group-open:rotate-45 md:hidden" aria-hidden />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function Propiedades({
  id,
  a,
  principal,
  onCambio,
  onPrincipal,
  prop,
}: {
  id: AsistenteId;
  a: AjustesAsistente;
  principal: boolean;
  onCambio: (p: Partial<AjustesAsistente>) => void;
  onPrincipal: () => void;
  prop: string;
}) {
  const ficha = FICHAS[id];
  const [nombre, setNombre] = useState(a.nombre);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNombre(a.nombre);
  }, [id, a.nombre]);

  return (
    <div className="card self-start p-0">
      <Bloque titulo="Nombre">
        <Input
          value={nombre}
          placeholder={ficha.nombre}
          aria-label="Nombre del asistente"
          maxLength={20}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => {
            const n = nombre.trim() || ficha.nombre;
            setNombre(n);
            if (n !== a.nombre) onCambio({ nombre: n });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        <p className="mt-2 text-[12.5px] text-muted">
          {ficha.animal} · {ficha.modulo}
        </p>
      </Bloque>

      <Bloque titulo="Color">
        {(["primario", "secundario", "detalle"] as const).map((k) => (
          <Muestras key={k} etiqueta={k[0].toUpperCase() + k.slice(1)} valor={a.colores[k]} onChange={(c) => onCambio({ colores: { ...a.colores, [k]: c } })} />
        ))}
        <p className="mb-2 mt-4 text-[12.5px] text-muted">Combinaciones sugeridas</p>
        <div className="grid max-w-[300px] grid-cols-4 gap-2">
          {ficha.combinaciones.map((combo, i) => {
            const igual = sameColores(combo, a.colores);
            return (
              <button
                key={i}
                type="button"
                aria-label={`Combinación ${i + 1}: ${CHAR_COLOR_LABEL[combo.primario]}, ${CHAR_COLOR_LABEL[combo.secundario]} y ${CHAR_COLOR_LABEL[combo.detalle]}`}
                aria-pressed={igual}
                onClick={() => onCambio({ colores: { ...combo } })}
                className={cn("focus-ring grid aspect-square cursor-pointer place-items-center rounded-[16px] bg-bg transition-shadow", igual && "ring-2 ring-fg")}
              >
                <Asistente id={id} size={48} colores={combo} animado={false} decorativo mostrarProp={a.mostrarProp} />
              </button>
            );
          })}
        </div>
      </Bloque>

      <Bloque titulo="Expresión">
        <div className="grid max-w-[300px] grid-cols-5 gap-1.5" role="radiogroup" aria-label="Expresión">
          {EXPRESIONES.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={a.expresion === e}
              aria-label={EXPRESION_LABEL[e]}
              title={EXPRESION_LABEL[e]}
              onClick={() => onCambio({ expresion: e })}
              className={cn("focus-ring grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-[14px] bg-bg", a.expresion === e && "ring-2 ring-fg")}
            >
              <Asistente id={id} size={44} colores={a.colores} expresion={e} mostrarProp={false} animado={false} decorativo />
            </button>
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Accesorio">
        <div className="grid max-w-[300px] grid-cols-5 gap-1.5" role="radiogroup" aria-label="Accesorio">
          {ACCESORIOS.map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={a.accesorio === x}
              aria-label={ACCESORIO_LABEL[x]}
              title={ACCESORIO_LABEL[x]}
              onClick={() => onCambio({ accesorio: x })}
              className={cn("focus-ring grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-[14px] bg-bg", a.accesorio === x && "ring-2 ring-fg")}
            >
              <Asistente id={id} size={44} colores={a.colores} accesorio={x} mostrarProp={false} animado={false} decorativo />
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 text-[13.5px]">
          Mostrar {prop}
          <Switch checked={a.mostrarProp} onChange={(v) => onCambio({ mostrarProp: v })} label={`Mostrar ${prop}`} />
        </label>
      </Bloque>

      <Bloque titulo="Personalidad">
        <Segmented size="sm" label="Tono" value={a.tono} onChange={(t) => onCambio({ tono: t })} options={TONOS.map((t) => ({ value: t.value, label: t.label }))} />
        <p className="mt-2 text-[12.5px] text-muted">{TONOS.find((t) => t.value === a.tono)?.descripcion}</p>
      </Bloque>

      <Bloque titulo="Avisos">
        <Select aria-label="Avisos" value={a.avisos} onChange={(e) => onCambio({ avisos: e.target.value as Avisos })}>
          {AVISOS.map((x) => (
            <option key={x.value} value={x.value}>
              {x.label}
            </option>
          ))}
        </Select>
      </Bloque>

      <Bloque titulo="Asistente principal">
        <label className="flex items-center justify-between gap-3 text-[13.5px]">
          <span>{principal ? `${a.nombre} es tu principal` : `Hacer principal a ${a.nombre}`}</span>
          <Switch checked={principal} disabled={principal} onChange={(v) => v && onPrincipal()} label="Asistente principal" title={principal ? "Para cambiarlo, elige otro asistente como principal" : undefined} />
        </label>
        <p className="mt-2 text-[12.5px] text-muted">Aparece en el inicio. Solo uno puede serlo a la vez.</p>
      </Bloque>
    </div>
  );
}

function Muestras({ etiqueta, valor, onChange }: { etiqueta: string; valor: CharColor; onChange: (c: CharColor) => void }) {
  return (
    <div className="mb-2.5">
      <p className="mb-1.5 text-[12.5px] text-muted">{etiqueta}</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Color ${etiqueta.toLowerCase()}`}>
        {CHAR_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={valor === c}
            aria-label={CHAR_COLOR_LABEL[c]}
            title={CHAR_COLOR_LABEL[c]}
            onClick={() => onChange(c)}
            className={cn(
              "focus-ring h-6 w-6 cursor-pointer rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110",
              valor === c && "ring-2 ring-fg ring-offset-2 ring-offset-card",
            )}
            style={{ background: charVar(c) }}
          />
        ))}
      </div>
    </div>
  );
}

const sameColores = (x: Colores, y: Colores) => x.primario === y.primario && x.secundario === y.secundario && x.detalle === y.detalle;
