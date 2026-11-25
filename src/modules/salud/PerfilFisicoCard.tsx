"use client";

/** Perfil físico: sexo, edad, peso, altura, actividad y objetivo. Se guarda al salir de cada campo. */
import { useState } from "react";
import { Pencil } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, Field, Input, Select } from "@/components/ui/Field";
import { ACTIVIDADES } from "@/lib/salud/alimentacion";
import { guardarPerfil, perfilCompleto, RANGOS, usePerfilFisico, type Actividad, type Objetivo, type Sexo } from "@/lib/salud/perfil";

export const OBJETIVOS: { value: Objetivo; label: string }[] = [
  { value: "perder", label: "Bajar grasa" },
  { value: "mantener", label: "Mantenerme" },
  { value: "ganar", label: "Ganar músculo" },
];

type Campo = "edad" | "pesoKg" | "alturaCm";
const ETIQUETA: Record<Campo, string> = { edad: "Edad", pesoKg: "Peso (kg)", alturaCm: "Altura (cm)" };

export function PerfilFisicoCard() {
  const p = usePerfilFisico();
  const completo = perfilCompleto(p);
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState<Record<Campo, string>>({
    edad: p.edad ? String(p.edad) : "",
    pesoKg: p.pesoKg ? String(p.pesoKg) : "",
    alturaCm: p.alturaCm ? String(p.alturaCm) : "",
  });
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});

  const guardarCampo = (c: Campo) => {
    const raw = texto[c].replace(",", ".").trim();
    if (!raw) return guardarPerfil({ [c]: null });
    const n = Number(raw);
    const [min, max] = RANGOS[c];
    if (!Number.isFinite(n) || n < min || n > max) {
      setErrores((e) => ({ ...e, [c]: `Entre ${min} y ${max}` }));
      return;
    }
    setErrores((e) => ({ ...e, [c]: undefined }));
    guardarPerfil({ [c]: c === "pesoKg" ? Math.round(n * 10) / 10 : Math.round(n) });
  };

  if (completo && !editando) {
    const act = ACTIVIDADES.find((a) => a.value === p.actividad)?.label.toLowerCase();
    const obj = OBJETIVOS.find((o) => o.value === p.objetivo)?.label.toLowerCase();
    return (
      <Card className="flex flex-wrap items-center gap-3 py-4">
        <div className="min-w-[200px] flex-1">
          <p className="text-[13px] font-medium text-muted">Tu perfil</p>
          <p className="mt-0.5 text-[14.5px]">
            {p.sexo === "hombre" ? "Hombre" : "Mujer"} · {p.edad} años · <span className="num">{p.pesoKg.toLocaleString("es-CO")} kg</span> · <span className="num">{p.alturaCm} cm</span> · actividad {act} · objetivo: {obj}
          </p>
        </div>
        <Button variant="secondary" className="bg-bg" onClick={() => setEditando(true)}>
          <Pencil size={16} /> Editar
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Tu perfil físico" subtitle="Solo se guarda en este dispositivo" />
      <div className="grid grid-cols-1 gap-4">
        <Field label="Sexo">{() => <ChoiceGroup value={(p.sexo ?? "") as Sexo} onChange={(v) => guardarPerfil({ sexo: v })} options={[{ value: "hombre", label: "Hombre" }, { value: "mujer", label: "Mujer" }]} />}</Field>
        <div className="grid grid-cols-3 gap-3 [&>*]:min-w-0 [&_input]:w-full [&_input]:min-w-0">
          {(["edad", "pesoKg", "alturaCm"] as Campo[]).map((c) => (
            <Field key={c} label={ETIQUETA[c]} error={errores[c]}>
              {(id) => (
                <Input
                  id={id}
                  inputMode="decimal"
                  value={texto[c]}
                  placeholder={c === "edad" ? "30" : c === "pesoKg" ? "70" : "170"}
                  aria-invalid={!!errores[c] || undefined}
                  onChange={(e) => setTexto((t) => ({ ...t, [c]: e.target.value }))}
                  onBlur={() => guardarCampo(c)}
                />
              )}
            </Field>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Actividad física" hint={ACTIVIDADES.find((a) => a.value === p.actividad)?.hint}>
            {(id) => (
              <Select id={id} value={p.actividad} onChange={(e) => guardarPerfil({ actividad: e.target.value as Actividad })}>
                {ACTIVIDADES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Objetivo">{() => <ChoiceGroup value={p.objetivo} onChange={(v) => guardarPerfil({ objetivo: v })} options={OBJETIVOS} />}</Field>
        </div>
        {completo ? (
          <Button variant="primary" className="justify-self-start" onClick={() => setEditando(false)}>
            Listo
          </Button>
        ) : (
          <p className="text-[13px] text-muted">Completa sexo, edad, peso y altura para ver tus recomendaciones.</p>
        )}
      </div>
    </Card>
  );
}
