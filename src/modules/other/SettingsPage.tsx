"use client";

import { almacenDocumentos, documentos } from "@/lib/proyectos/documentos";
import { almacenVistas } from "@/lib/proyectos/vistas";
import { almacenDinero } from "@/lib/proyectos/avisosDinero";
import { almacenEntrenos } from "@/lib/salud/entrenos";
import { almacenAportes } from "@/lib/finanzas/aportes";
import { almacenConceptos } from "@/modules/finance/EnQueSeVa";
import { almacenRecomendar } from "@/lib/recomendar";
import { TarjetaRecomendar } from "@/modules/asistentes/RecomendarApp";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Cloud, Download, FlaskConical, GraduationCap, Upload, HardDrive, Monitor, Moon, Plus, Sun, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup, Field, Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/misc";
import { FotoPerfil, PREFIJO_ASISTENTE, prepararFoto } from "@/components/layout/FotoPerfil";
import { useAsistentes } from "@/lib/asistentes/estado";
import { ASISTENTE_IDS } from "@/lib/asistentes/tipos";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { useToday } from "@/hooks/useToday";
import { TABLES, type Database, type Profile } from "@/types/db";
import { useTheme, type ThemePref } from "@/lib/theme";
import { cn } from "@/utils/cn";
import { TIMEZONE } from "@/utils/dates";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/modules/finance/constants";
import { borrarAsistentes, exportarAsistentes } from "@/lib/asistentes/estado";
import { EditorAsistentes } from "@/modules/asistentes/EditorAsistentes";
import { borrarProgreso, exportarProgreso } from "@/modules/asistentes/Gamificacion";
import { borrarPerfil } from "@/lib/salud/perfil";
import { borrarTodoEspacio, guardarArchivo, leerArchivo, leerEspacio } from "@/lib/proyectos/espacio";
import { almacenCaptura } from "@/lib/captura/aprendizaje";
import { TarjetaInstalar } from "@/modules/pwa/AppInstalable";
import { almacenAnimo } from "@/lib/animoUsuario";
import { almacenEnfoque } from "@/modules/enfoque/ModoEnfoque";
import { almacenConexiones } from "@/modules/asistentes/ConexionDelDia";
import { almacenPagosFijos } from "@/lib/finanzas/pagosFijos";
import { AjustesProgreso } from "@/modules/asistentes/AjustesProgreso";
import { iniciarTutorial } from "@/modules/tutorial/Tutorial";
import { TarjetaSincronizacion } from "@/modules/sync/TarjetaSincronizacion";
import { almacenSync } from "@/lib/sync/almacenes";

type Seccion = "perfil" | "apariencia" | "asistentes" | "progreso" | "datos";
const SECCIONES: { value: Seccion; label: string }[] = [
  { value: "perfil", label: "Perfil" },
  { value: "apariencia", label: "Apariencia" },
  { value: "asistentes", label: "Tus asistentes" },
  { value: "progreso", label: "Progreso" },
  { value: "datos", label: "Datos" },
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
      <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0 sin-barra">
        <Segmented size="md" label="Secciones de configuración" value={seccion} onChange={elegir} options={SECCIONES} desplazable />
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
          <TarjetaRecomendar />
          <TarjetaInstalar />
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
          <TarjetaRespaldoYSync />
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
      <CardHeader title="Apariencia" subtitle="Elige cómo se ve Poku Poku en este dispositivo" />
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

const MONEDAS = [
  { value: "COP", label: "COP · Peso colombiano" },
  { value: "USD", label: "USD · Dólar estadounidense" },
  { value: "EUR", label: "EUR · Euro" },
  { value: "MXN", label: "MXN · Peso mexicano" },
];
const ZONAS = [
  { value: "America/Bogota", label: "Bogotá (GMT−5)" },
  { value: "America/Lima", label: "Lima (GMT−5)" },
  { value: "America/Mexico_City", label: "Ciudad de México (GMT−6)" },
  { value: "America/New_York", label: "Nueva York (GMT−5/−4)" },
  { value: "America/Caracas", label: "Caracas (GMT−4)" },
  { value: "America/Santiago", label: "Santiago (GMT−4/−3)" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires (GMT−3)" },
  { value: "Europe/Madrid", label: "Madrid (GMT+1/+2)" },
];
const CORREO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ProfileCard() {
  const { profile, saveProfile, mode } = useData();
  const { estado } = useAsistentes();
  const { toast } = useFeedback();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [email, setEmail] = useState(profile?.email ?? "");
  const [currency, setCurrency] = useState(profile?.currency || "COP");
  const [timezone, setTimezone] = useState(profile?.timezone || TIMEZONE);
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  // El correo de una cuenta sincronizada lo maneja el inicio de sesión
  const correoEditable = mode !== "supabase";

  const cambios =
    name.trim() !== (profile?.full_name ?? "") ||
    (correoEditable && email.trim() !== (profile?.email ?? "")) ||
    currency !== (profile?.currency || "COP") ||
    timezone !== (profile?.timezone || TIMEZONE) ||
    avatar !== (profile?.avatar_url ?? null);

  const subir = async (file: File) => {
    try {
      setAvatar(await prepararFoto(file));
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo usar esa imagen.", "error");
    }
  };

  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "El nombre no puede quedar vacío.";
    if (correoEditable && email.trim() && !CORREO_OK.test(email.trim())) e.email = "Revisa el correo (ej. nombre@correo.com).";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await saveProfile({
        full_name: name.trim(),
        ...(correoEditable ? { email: email.trim() || null } : {}),
        currency,
        timezone,
        avatar_url: avatar,
      });
      toast("Perfil actualizado.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo guardar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const opcion = (activo: boolean) =>
    cn(
      "focus-ring grid cursor-pointer place-items-center rounded-full p-[3px] transition-[box-shadow,transform] duration-200 hover:scale-[1.05]",
      activo && "ring-2 ring-fg ring-offset-2 ring-offset-card",
    );

  return (
    <Card id="perfil">
      <CardHeader title="Perfil" subtitle="Cómo te saluda Poku Poku" />

      {/* Foto: subir una propia o elegir el rostro de un asistente */}
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center">
        <FotoPerfil avatar={avatar} nombre={name || profile?.full_name} size={88} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium">Foto de perfil</p>
          <p className="mt-0.5 text-[13px] text-muted">Sube tu foto o elige a uno de tus asistentes.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => archivo.current?.click()}>
              <Upload size={15} /> {avatar?.startsWith("data:") ? "Cambiar foto" : "Subir foto"}
            </Button>
            {avatar ? (
              <Button size="sm" variant="ghost" onClick={() => setAvatar(null)}>
                <X size={15} /> Quitar
              </Button>
            ) : null}
            <input
              ref={archivo}
              type="file"
              accept="image/*"
              hidden
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                ev.target.value = "";
                if (f) void subir(f);
              }}
            />
          </div>
        </div>
      </div>
      <div className="mb-6">
        <p className="mb-2.5 text-[13px] text-muted">O usa el rostro de un asistente</p>
        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Foto de perfil predeterminada">
          <button type="button" role="radio" aria-checked={!avatar} aria-label="Mis iniciales" title="Mis iniciales" onClick={() => setAvatar(null)} className={opcion(!avatar)}>
            <FotoPerfil avatar={null} nombre={name || profile?.full_name} size={52} />
          </button>
          {ASISTENTE_IDS.map((id) => {
            const valor = `${PREFIJO_ASISTENTE}${id}`;
            const nombre = estado.ajustes[id].nombre;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={avatar === valor}
                aria-label={nombre}
                title={nombre}
                onClick={() => setAvatar(valor)}
                className={opcion(avatar === valor)}
              >
                <FotoPerfil avatar={valor} nombre={null} size={52} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" error={errors.name}>
          {(id) => <Input id={id} value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name || undefined} />}
        </Field>
        <Field label="Correo (opcional)" error={errors.email} hint={correoEditable ? "Solo se guarda en este dispositivo." : "Es el correo con el que inicias sesión."}>
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="email"
              value={email}
              placeholder="nombre@correo.com"
              disabled={!correoEditable}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email || undefined}
            />
          )}
        </Field>
        <Field label="Moneda principal" hint={currency !== "COP" ? "Se guarda tu preferencia; por ahora los montos se muestran en pesos colombianos." : undefined}>
          {(id) => (
            <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {MONEDAS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Zona horaria" hint={timezone !== TIMEZONE ? "Se guarda tu preferencia; por ahora las fechas se calculan con la hora de Bogotá." : undefined}>
          {(id) => (
            <Select id={id} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {(ZONAS.some((z) => z.value === timezone) ? ZONAS : [{ value: timezone, label: timezone }, ...ZONAS]).map((z) => (
                <option key={z.value} value={z.value}>
                  {z.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={save} loading={saving} disabled={!cambios}>
          Guardar perfil
        </Button>
        {cambios ? <span className="text-[13px] text-muted">Tienes cambios sin guardar</span> : null}
      </div>
    </Card>
  );
}

/** Claves extra del navegador que viajan en el respaldo (perfil físico, espacio de proyectos, captura y pagos fijos) */
const EXTRAS = {
  salud: "lifeos:salud",
  espacio: "lifeos:espacio",
  captura: almacenCaptura.clave,
  pagosFijos: almacenPagosFijos.clave,
  animo: almacenAnimo.clave,
  enfoque: almacenEnfoque.clave,
  conexiones: almacenConexiones.clave,
  documentos: almacenDocumentos.clave,
  vistas: almacenVistas.clave,
  dinero: almacenDinero.clave,
  entrenos: almacenEntrenos.clave,
  aportes: almacenAportes.clave,
  conceptos: almacenConceptos.clave,
  recomendar: almacenRecomendar.clave,
} as const;
const leerExtra = (k: string) => {
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/** Descarga un respaldo completo de este dispositivo (lo usan «Exportar» y la activación de la sincronización) */
function useRespaldo() {
  const { db, profile } = useData();
  const { toast } = useFeedback();
  const today = useToday();
  const total = TABLES.reduce((n, t) => n + db[t].length, 0);
  return async (silencioso = false) => {
    // Notas de voz con su audio (en base64): así el respaldo se restaura completo en otro equipo
    const notasVoz: { id: string; tipo: string; audio: string }[] = [];
    for (const v of leerEspacio().voz) {
      const blob = await leerArchivo(v.id);
      if (blob) notasVoz.push({ id: v.id, tipo: blob.type || v.tipo, audio: await aDataUrl(blob) });
    }
    const respaldo = {
      app: "Poku Poku",
      exported_at: new Date().toISOString(),
      profile,
      data: db,
      asistentes: exportarAsistentes(),
      progreso: exportarProgreso(),
      salud: leerExtra(EXTRAS.salud),
      espacio: leerExtra(EXTRAS.espacio),
      captura: leerExtra(EXTRAS.captura),
      pagosFijos: leerExtra(EXTRAS.pagosFijos),
      animo: leerExtra(EXTRAS.animo),
      enfoque: leerExtra(EXTRAS.enfoque),
      conexiones: leerExtra(EXTRAS.conexiones),
      documentos: leerExtra(EXTRAS.documentos),
      vistas: leerExtra(EXTRAS.vistas),
      dinero: leerExtra(EXTRAS.dinero),
      entrenos: leerExtra(EXTRAS.entrenos),
      aportes: leerExtra(EXTRAS.aportes),
      conceptos: leerExtra(EXTRAS.conceptos),
      recomendar: leerExtra(EXTRAS.recomendar),
      notasVoz,
    };
    const blob = new Blob([JSON.stringify(respaldo, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `life-for-life-respaldo-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (!silencioso) toast(`Exportados ${total} registros.`);
  };
}

const aDataUrl = (blob: Blob) =>
  new Promise<string>((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result));
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(blob);
  });

function TarjetaRespaldoYSync() {
  const respaldar = useRespaldo();
  return <TarjetaSincronizacion respaldar={() => void respaldar(true)} />;
}

function StorageCard() {
  const { db, mode, clearAll, importAll } = useData();
  const { confirm, toast } = useFeedback();
  const total = TABLES.reduce((n, t) => n + db[t].length, 0);
  const archivo = useRef<HTMLInputElement>(null);
  const [importando, setImportando] = useState(false);
  const exportJSON = useRespaldo();
  const sincronizado = almacenSync.useValor().activo && mode === "local";

  const importar = async (file: File) => {
    let r: { exported_at?: string; profile?: Profile | null; data?: Record<string, unknown>; asistentes?: unknown; progreso?: unknown; salud?: unknown; espacio?: unknown; captura?: unknown; pagosFijos?: unknown; animo?: unknown; enfoque?: unknown; conexiones?: unknown; documentos?: unknown; vistas?: unknown; dinero?: unknown; entrenos?: unknown; aportes?: unknown; conceptos?: unknown; recomendar?: unknown; notasVoz?: { id: string; tipo?: string; audio: string }[] };
    try {
      r = JSON.parse(await file.text());
    } catch {
      toast("Ese archivo no es un respaldo válido (no es JSON).", "error");
      return;
    }
    if (!r?.data || !TABLES.some((t) => Array.isArray(r.data![t]))) {
      toast("Ese archivo no parece un respaldo de Poku Poku.", "error");
      return;
    }
    const nuevos = TABLES.reduce((n, t) => n + (Array.isArray(r.data![t]) ? (r.data![t] as unknown[]).length : 0), 0);
    const fecha = r.exported_at ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" }).format(new Date(r.exported_at)) : "fecha desconocida";
    const ok = await confirm({
      title: "¿Reemplazar tus datos con este respaldo?",
      description: `Respaldo del ${fecha} con ${nuevos} registros. Reemplaza los ${total} registros actuales de este dispositivo.${total ? " Antes te descargamos una copia de lo actual por si acaso." : ""}`,
      confirmLabel: "Importar respaldo",
      destructive: true,
    });
    if (!ok) return;
    setImportando(true);
    try {
      if (total) await exportJSON(true);
      const escribir = (k: string, v: unknown) => (v == null ? window.localStorage.removeItem(k) : window.localStorage.setItem(k, JSON.stringify(v)));
      if (r.asistentes) escribir("lifeos:asistentes", r.asistentes);
      if (r.progreso) escribir("lifeos:progreso", r.progreso);
      if (r.salud) escribir(EXTRAS.salud, r.salud);
      if (r.espacio) escribir(EXTRAS.espacio, r.espacio);
      if (r.captura) escribir(EXTRAS.captura, r.captura);
      if (r.pagosFijos) escribir(EXTRAS.pagosFijos, r.pagosFijos);
      if (r.animo) escribir(EXTRAS.animo, r.animo);
      if (r.enfoque) escribir(EXTRAS.enfoque, r.enfoque);
      if (r.conexiones) escribir(EXTRAS.conexiones, r.conexiones);
      if (r.documentos) escribir(EXTRAS.documentos, r.documentos);
      if (r.vistas) escribir(EXTRAS.vistas, r.vistas);
      if (r.dinero) escribir(EXTRAS.dinero, r.dinero);
      if (r.entrenos) escribir(EXTRAS.entrenos, r.entrenos);
      if (r.aportes) escribir(EXTRAS.aportes, r.aportes);
      if (r.conceptos) escribir(EXTRAS.conceptos, r.conceptos);
      if (r.recomendar) escribir(EXTRAS.recomendar, r.recomendar);
      // Audios de las notas de voz
      for (const n of Array.isArray(r.notasVoz) ? r.notasVoz : []) {
        if (typeof n?.id !== "string" || typeof n.audio !== "string" || !n.audio.startsWith("data:")) continue;
        await guardarArchivo(n.id, await (await fetch(n.audio)).blob());
      }
      await importAll(r.data as unknown as Database, r.profile ?? null);
      toast(`Respaldo importado: ${nuevos} registros.`);
      // Recarga para que asistentes, progreso y demás partes lean lo importado
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo importar el respaldo.", "error");
    } finally {
      setImportando(false);
    }
  };

  const wipe = async () => {
    const ok = await confirm({
      title: "¿Borrar todos tus datos de este navegador?",
      description: `Se eliminarán ${total} registros, tu perfil, tu perfil físico y el espacio de tus proyectos (notas, reuniones, audios e imágenes). Exporta antes si quieres conservarlos.`,
      confirmLabel: "Borrar todo",
      destructive: true,
    });
    if (!ok) return;
    await clearAll();
    borrarAsistentes();
    borrarProgreso();
    borrarPerfil();
    almacenCaptura.borrar();
    almacenPagosFijos.borrar();
    almacenAnimo.borrar();
    almacenEnfoque.borrar();
    almacenConexiones.borrar();
    documentos.borrarTodo();
    almacenVistas.borrar();
    almacenDinero.borrar();
    almacenEntrenos.borrar();
    almacenAportes.borrar();
    almacenConceptos.borrar();
    almacenRecomendar.borrar();
    await borrarTodoEspacio();
    toast("Datos borrados.");
  };

  return (
    <Card id="datos">
      <CardHeader title="Tus datos" subtitle={`${total} registros guardados`} />
      <div className="flex items-start gap-3 rounded-[20px] bg-bg-2 p-4">
        {mode === "local" ? <HardDrive size={20} className="mt-0.5 shrink-0" /> : mode === "demo" ? <FlaskConical size={20} className="mt-0.5 shrink-0" /> : <Cloud size={20} className="mt-0.5 shrink-0" />}
        <div className="text-[13.5px] leading-relaxed">
          <p className="text-fg">{sincronizado ? "Guardado aquí y en tu cuenta" : mode === "local" ? "Guardado en este dispositivo" : mode === "demo" ? "Datos de ejemplo" : "Sincronizado"}</p>
          <p className="text-muted">
            {sincronizado
              ? "Tus datos se sincronizan entre tus dispositivos y solo tú puedes verlos."
              : mode === "local"
              ? "Tus datos se guardan solo en este dispositivo. Puedes activar la sincronización entre dispositivos en esta misma sección."
              : mode === "demo"
                ? "Estás viendo datos de ejemplo. Nada de lo que hagas aquí se guarda."
                : "Tus datos se sincronizan entre tus dispositivos y solo tú puedes verlos."}
          </p>
        </div>
      </div>
      <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
        El respaldo incluye tus registros, perfil, progreso, las notas y reuniones de tus proyectos y tus notas de voz con su audio. Las imágenes no
        viajan en el respaldo: al restaurarlo en otro equipo aparecerán sin archivo.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" className="bg-bg-2" onClick={() => void exportJSON()}>
          <Download size={18} /> Exportar respaldo
        </Button>
        {mode === "local" ? (
          <>
            <Button variant="primary" onClick={() => archivo.current?.click()} disabled={importando}>
              <Upload size={18} /> {importando ? "Importando…" : "Importar respaldo"}
            </Button>
            <input
              ref={archivo}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(ev) => {
                const f = ev.target.files?.[0];
                ev.target.value = "";
                if (f) void importar(f);
              }}
            />
          </>
        ) : null}
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
