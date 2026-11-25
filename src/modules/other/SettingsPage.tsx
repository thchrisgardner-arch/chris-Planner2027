"use client";

import { useState } from "react";
import { Check, Cloud, Download, HardDrive, Monitor, Moon, Plus, Sun, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, Field, Input, Select } from "@/components/ui/Field";
import { initials } from "@/components/layout/HeaderActions";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { TABLES } from "@/types/db";
import { useTheme, type ThemePref } from "@/lib/theme";
import { cn } from "@/utils/cn";
import { TIMEZONE } from "@/utils/dates";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/modules/finance/constants";

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Configuración" subtitle="Perfil, preferencias y tus datos." />
      <div className="grid gap-4 xl:grid-cols-2 xl:gap-5">
        <ProfileCard />
        <AppearanceCard />
        <StorageCard />
        <CategoriesCard />
      </div>
    </>
  );
}

/* ───────── Apariencia ───────── */
const THEME_OPTIONS: { value: ThemePref; label: string; hint: string; Icon: typeof Sun }[] = [
  { value: "claro", label: "Claro", hint: "Fondo blanco", Icon: Sun },
  { value: "oscuro", label: "Oscuro", hint: "Pantalla oscura", Icon: Moon },
  { value: "sistema", label: "Sistema", hint: "Igual que tu dispositivo", Icon: Monitor },
];

/** Miniatura del tema: fondo, panel lateral y dos tarjetas. */
function ThemePreview({ mode }: { mode: "light" | "dark" }) {
  const c =
    mode === "light"
      ? { bg: "#f3f4f1", card: "#ffffff", line: "#e3e6e0", fg: "#111412", soft: "#ececea" }
      : { bg: "#0f1110", card: "#161917", line: "#2a2f2c", fg: "#f2f4f2", soft: "#242826" };
  return (
    <div className="flex h-full w-full gap-1.5 p-2" style={{ background: c.bg }}>
      <div className="w-[26%] rounded-[8px] p-1.5" style={{ background: c.card, border: `1px solid ${c.line}` }}>
        <div className="mb-1.5 h-1.5 w-3/4 rounded-full" style={{ background: c.fg, opacity: 0.85 }} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-1 h-1 rounded-full" style={{ background: c.soft }} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="h-1.5 w-1/2 rounded-full" style={{ background: c.fg, opacity: 0.85 }} />
        <div className="flex flex-1 gap-1.5">
          <div className="flex-1 rounded-[8px] p-1.5" style={{ background: c.card, border: `1px solid ${c.line}` }}>
            <div className="h-1 w-2/3 rounded-full" style={{ background: c.soft }} />
            <div className="mt-2 h-2 w-1/2 rounded-full" style={{ background: "#2ee56b" }} />
          </div>
          <div className="flex-1 rounded-[8px]" style={{ background: c.card, border: `1px solid ${c.line}` }} />
        </div>
      </div>
    </div>
  );
}

function AppearanceCard() {
  const { pref, setPref } = useTheme();
  const { toast } = useFeedback();
  return (
    <Card>
      <CardHeader title="Apariencia" subtitle="Elige cómo se ve LIFE OS en este dispositivo" />
      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Tema">
        {THEME_OPTIONS.map((o) => {
          const active = pref === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setPref(o.value);
                toast(`Tema: ${o.label.toLowerCase()}.`);
              }}
              className="focus-ring group cursor-pointer text-left"
            >
              <div
                className={cn(
                  "relative aspect-[4/3] overflow-hidden rounded-[16px] border transition-all duration-200",
                  active ? "border-fg ring-2 ring-fg ring-offset-2 ring-offset-card" : "border-line group-hover:border-line-strong",
                )}
              >
                {o.value === "sistema" ? (
                  <div className="relative h-full w-full">
                    <ThemePreview mode="light" />
                    <div className="absolute inset-0" style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}>
                      <ThemePreview mode="dark" />
                    </div>
                  </div>
                ) : (
                  <ThemePreview mode={o.value === "oscuro" ? "dark" : "light"} />
                )}
                {active ? (
                  <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-fg text-on-fg">
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                ) : null}
              </div>
              <div className="mt-2.5 flex items-center gap-1.5 px-0.5">
                <o.Icon size={16} />
                <span className={cn("text-[13.5px]", active ? "font-semibold" : "font-medium")}>{o.label}</span>
              </div>
              <p className="px-0.5 text-[11.5px] text-muted">{o.hint}</p>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function ProfileCard() {
  const { profile, saveProfile, mode } = useData();
  const { toast } = useFeedback();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return setError("El nombre no puede quedar vacío.");
    setError(null);
    setSaving(true);
    try {
      await saveProfile({ full_name: name.trim() });
      toast("Perfil actualizado.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card id="perfil" className="scroll-mt-24">
      <CardHeader title="Perfil" subtitle="Cómo te saluda LIFE OS" />
      <div className="mb-5 flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-full border border-line bg-gradient-to-b from-bg-2 to-elev text-[20px] font-semibold text-brand-soft">
          {initials(name || profile?.full_name)}
        </span>
        <p className="text-[12.5px] leading-relaxed text-muted">El avatar usa tus iniciales. La foto de perfil llega cuando se conecte el almacenamiento de Supabase.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" error={error}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Correo" hint={mode === "local" ? "Se define al crear tu cuenta en Supabase." : undefined}>
          {(id) => <Input id={id} value={profile?.email ?? ""} placeholder="Sin cuenta conectada" disabled />}
        </Field>
        <Field label="Moneda principal" hint="LIFE OS trabaja en pesos colombianos.">
          {(id) => (
            <Select id={id} value="COP" disabled>
              <option value="COP">COP · Peso colombiano</option>
            </Select>
          )}
        </Field>
        <Field label="Zona horaria">
          {(id) => <Input id={id} value={TIMEZONE} disabled />}
        </Field>
      </div>
      <Button variant="primary" className="mt-5" onClick={save} loading={saving}>
        Guardar perfil
      </Button>
    </Card>
  );
}

function StorageCard() {
  const { db, profile, mode, clearAll } = useData();
  const { confirm, toast } = useFeedback();
  const today = useToday();
  const total = TABLES.reduce((n, t) => n + db[t].length, 0);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), profile, data: db }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeos-datos-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exportados ${total} registros.`);
  };

  const wipe = async () => {
    const ok = await confirm({
      title: "¿Borrar todos tus datos de este navegador?",
      description: `Se eliminarán ${total} registros y tu perfil. Exporta antes si quieres conservarlos.`,
      confirmLabel: "Borrar todo",
      destructive: true,
    });
    if (!ok) return;
    await clearAll();
    toast("Datos borrados.");
  };

  return (
    <Card id="datos" className="scroll-mt-24">
      <CardHeader title="Tus datos" subtitle={`${total} registros guardados`} />
      <div className="flex items-start gap-3 rounded-[14px] border border-line bg-bg-2 p-4">
        {mode === "local" ? <HardDrive size={20} className="mt-0.5 text-warn" /> : <Cloud size={20} className="mt-0.5 text-brand-soft" />}
        <div className="text-[13px] leading-relaxed">
          <p className="font-medium">{mode === "local" ? "Modo local (sin nube)" : "Supabase conectado"}</p>
          <p className="text-muted">
            {mode === "local"
              ? "Todo se guarda solo en este navegador y este dispositivo. No hay sincronización hasta conectar Supabase (ver README del proyecto)."
              : "Tus datos viven en PostgreSQL con políticas RLS: solo tu usuario puede leerlos y modificarlos."}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={exportJSON}>
          <Download size={18} /> Exportar mis datos (JSON)
        </Button>
        {mode === "local" ? (
          <Button variant="danger" onClick={wipe}>
            <Trash2 size={16} /> Borrar datos locales
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function CategoriesCard() {
  const { db, insert, remove } = useData();
  const { toast, confirm } = useFeedback();
  const [kind, setKind] = useState<"gasto" | "ingreso">("gasto");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const base = kind === "gasto" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const custom = db.transaction_categories.filter((c) => c.kind === kind);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError("Escribe un nombre.");
    if ([...base, ...custom.map((c) => c.name)].some((c) => c.toLowerCase() === n.toLowerCase())) return setError("Esa categoría ya existe.");
    setError(null);
    await insert("transaction_categories", { name: n, kind });
    setName("");
    toast(`Categoría «${n}» creada.`);
  };

  return (
    <Card className="xl:col-span-2">
      <CardHeader title="Categorías de movimientos" subtitle="Agrega tus propias categorías a las predeterminadas" />
      <ChoiceGroup
        value={kind}
        onChange={setKind}
        options={[
          { value: "gasto", label: "Gastos" },
          { value: "ingreso", label: "Ingresos" },
        ]}
      />
      <div className="mt-4 flex flex-wrap gap-1.5">
        {base.map((c) => (
          <span key={c} className="rounded-full border border-line px-3 py-1 text-[12.5px] text-muted">
            {c}
          </span>
        ))}
        {custom.map((c) => (
          <span key={c.id} className="flex items-center gap-1 rounded-full border border-brand/30 bg-brand/10 py-1 pl-3 pr-1.5 text-[12.5px] text-brand-soft">
            {c.name}
            <button
              aria-label={`Eliminar ${c.name}`}
              className="grid h-5 w-5 cursor-pointer place-items-center rounded-full hover:bg-brand/20"
              onClick={async () => {
                if (await confirm({ title: `¿Eliminar la categoría ${c.name}?`, description: "Los movimientos que ya la usan la conservan.", confirmLabel: "Eliminar", destructive: true })) {
                  await remove("transaction_categories", c.id);
                  toast("Categoría eliminada.");
                }
              }}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={add} className="mt-4 flex max-w-md items-start gap-2">
        <div className="flex-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "gasto" ? "Ej. Mascotas" : "Ej. Arriendos"} aria-label="Nueva categoría" aria-invalid={!!error || undefined} />
          {error ? <p className="mt-1 text-[12px] text-danger">{error}</p> : null}
        </div>
        <Button type="submit">
          <Plus size={18} /> Agregar
        </Button>
      </form>
    </Card>
  );
}
