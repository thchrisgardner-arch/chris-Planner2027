"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Cloud, Download, FlaskConical, GraduationCap, UserRound, HardDrive, Monitor, Moon, Plus, Sun, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, Field, Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/misc";
import { initials } from "@/components/layout/HeaderActions";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { TABLES } from "@/types/db";
import { useTheme, type ThemePref } from "@/lib/theme";
import { cn } from "@/utils/cn";
import { TIMEZONE } from "@/utils/dates";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/modules/finance/constants";
import { borrarAsistentes, exportarAsistentes } from "@/lib/asistentes/estado";
import { EditorAsistentes } from "@/modules/asistentes/EditorAsistentes";
import { borrarProgreso, exportarProgreso } from "@/modules/asistentes/Gamificacion";
import { AjustesProgreso } from "@/modules/asistentes/AjustesProgreso";
import { iniciarTutorial } from "@/modules/tutorial/Tutorial";

type Seccion = "perfil" | "apariencia" | "asistentes" | "progreso" | "datos";
const SECCIONES: { value: Seccion; label: string }[] = [
  { value: "perfil", label: "Perfil" },
  { value: "apariencia", label: "Apariencia" },
  { value: "asistentes", label: "Tus asistentes" },
  { value: "progreso", label: "Progreso" },
];
const esSeccion = (v: string | null): v is Seccion => SECCIONES.some((s) => s.value === v);

/** Configuración por secciones: el filtro muestra una sola a la vez (?seccion=perfil|apariencia|asistentes|datos). */
export function SettingsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("seccion");
  const seccion: Seccion = esSeccion(raw) ? raw : "perfil";

  useEffect(() => {
    // Compatibilidad con enlaces viejos: /configuracion#datos → ?seccion=datos
    const h = window.location.hash.replace("#", "");
    if (!raw && esSeccion(h)) router.replace(`/configuracion?seccion=${h}`, { scroll: false });
  }, [raw, router]);

  const elegir = (s: Seccion) => router.replace(`/configuracion?seccion=${s}`, { scroll: false });

  return (
    <>
      <PageHeader title="Configuración" subtitle="Perfil, preferencias, asistentes y tus datos." />
      <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Segmented size="md" label="Secciones de configuración" value={seccion} onChange={elegir} options={SECCIONES} />
      </div>
      {seccion === "perfil" ? (
        <div className="grid max-w-[820px] grid-cols-1 gap-3">
          <ProfileCard />
          <Card>
            <CardHeader title="Tutorial" subtitle="Un recorrido corto que te señala cómo funciona cada parte de la app" />
            <Button variant="primary" onClick={iniciarTutorial}>
              <GraduationCap size={18} /> Ver el tutorial otra vez
            </Button>
          </Card>
        </div>
      ) : seccion === "apariencia" ? (
        <div className="max-w-[820px]">
          <AppearanceCard />
        </div>
      ) : seccion === "asistentes" ? (
        <EditorAsistentes />
      ) : seccion === "progreso" ? (
        <AjustesProgreso />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2 [&>*]:min-w-0">
          <StorageCard />
          <CategoriesCard />
        </div>
      )}
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
      ? { bg: "#f4f4f2", card: "#ffffff", fg: "#0a0a0a", soft: "#e6e6e6" }
      : { bg: "#000000", card: "#1a1a1a", fg: "#f5f5f5", soft: "#262626" };
  return (
    <div className="flex h-full w-full gap-1.5 p-2" style={{ background: c.bg }}>
      <div className="w-[26%] rounded-[8px] p-1.5" style={{ background: c.card }}>
        <div className="mb-1.5 h-1.5 w-3/4 rounded-full" style={{ background: c.fg, opacity: 0.85 }} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-1 h-1 rounded-full" style={{ background: c.soft }} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="h-1.5 w-1/2 rounded-full" style={{ background: c.fg, opacity: 0.85 }} />
        <div className="flex flex-1 gap-1.5">
          <div className="flex-1 rounded-[8px] p-1.5" style={{ background: c.card }}>
            <div className="h-1 w-2/3 rounded-full" style={{ background: c.soft }} />
            <div className="mt-2 h-2 w-1/2 rounded-full" style={{ background: "#5ce65c" }} />
          </div>
          <div className="flex-1 rounded-[8px]" style={{ background: c.card }} />
        </div>
      </div>
    </div>
  );
}

function AppearanceCard() {
  const { pref, setPref } = useTheme();
  const { toast } = useFeedback();
  return (
    <Card id="apariencia">
      <CardHeader title="Apariencia" subtitle="Elige cómo se ve LIFE for LIFE en este dispositivo" />
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
                  "relative aspect-[4/3] overflow-hidden rounded-[16px] transition-all duration-200",
                  active ? "ring-2 ring-fg ring-offset-2 ring-offset-card" : "ring-1 ring-line group-hover:ring-line-strong",
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
                <span className="text-[13.5px]">{o.label}</span>
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
    <Card id="perfil">
      <CardHeader title="Perfil" subtitle="Cómo te saluda LIFE for LIFE" />
      <div className="mb-5 flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand text-[20px] text-[#0a0a0a]" aria-hidden>
          {initials(name || profile?.full_name) || <UserRound size={26} />}
        </span>
        <p className="text-[13px] leading-relaxed text-muted">Tu avatar usa tus iniciales. Pronto podrás subir tu foto.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" error={error}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Correo" hint={mode === "supabase" ? undefined : "Lo podrás agregar cuando llegue la sincronización."}>
          {(id) => <Input id={id} value={profile?.email ?? ""} placeholder="Sin correo" disabled />}
        </Field>
        <Field label="Moneda principal" hint="LIFE for LIFE trabaja en pesos colombianos.">
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
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), profile, data: db, asistentes: exportarAsistentes(), progreso: exportarProgreso() }, null, 2)], { type: "application/json" });
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
    borrarAsistentes();
    borrarProgreso();
    toast("Datos borrados.");
  };

  return (
    <Card id="datos">
      <CardHeader title="Tus datos" subtitle={`${total} registros guardados`} />
      <div className="flex items-start gap-3 rounded-[20px] bg-bg-2 p-4">
        {mode === "local" ? <HardDrive size={20} className="mt-0.5 shrink-0" /> : mode === "demo" ? <FlaskConical size={20} className="mt-0.5 shrink-0" /> : <Cloud size={20} className="mt-0.5 shrink-0" />}
        <div className="text-[13.5px] leading-relaxed">
          <p className="text-fg">{mode === "local" ? "Guardado en este dispositivo" : mode === "demo" ? "Datos de ejemplo" : "Sincronizado"}</p>
          <p className="text-muted">
            {mode === "local"
              ? "Por ahora tus datos se guardan solo en este dispositivo. La sincronización entre dispositivos llegará pronto."
              : mode === "demo"
                ? "Estás viendo datos de ejemplo. Nada de lo que hagas aquí se guarda."
                : "Tus datos se sincronizan entre tus dispositivos y solo tú puedes verlos."}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="secondary" className="bg-bg-2" onClick={exportJSON}>
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
    <Card>
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
          <span key={c} className="rounded-full bg-bg-2 px-3 py-1 text-[12.5px] text-muted">
            {c}
          </span>
        ))}
        {custom.map((c) => (
          <span key={c.id} className="flex items-center gap-1 rounded-full bg-brand py-1 pl-3 pr-1 text-[12.5px] text-[#0a0a0a]">
            {c.name}
            <button
              aria-label={`Eliminar ${c.name}`}
              className="focus-ring grid h-6 w-6 cursor-pointer place-items-center rounded-full hover:bg-black/10"
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
        <Button type="submit" variant="secondary" className="bg-bg-2">
          <Plus size={18} /> Agregar
        </Button>
      </form>
    </Card>
  );
}
