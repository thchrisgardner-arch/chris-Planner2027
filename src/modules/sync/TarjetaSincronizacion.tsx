"use client";

/**
 * Configuración → Datos → «Sincronizar entre dispositivos» (Fase 6.3).
 * Apagada por defecto. Al activarla: cuenta de la nube (correo y contraseña o enlace al correo),
 * respaldo automático de este dispositivo y, si los dos lados ya tienen datos, la persona elige
 * combinar, usar la nube o usar este dispositivo.
 */
import { useEffect, useState } from "react";
import { Check, Cloud, CloudOff, RefreshCw, Shield, Trash2, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useData } from "@/lib/store/DataProvider";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { almacenPendientes, almacenSync } from "@/lib/sync/almacenes";
import { activar, borrarNube, cicloSync, desactivar, sesionNube, situacion } from "@/lib/sync/cliente";
import type { ModoConexion } from "@/lib/sync/motor";
import { cn } from "@/utils/cn";

type Paso = "apagado" | "cuenta" | "elegir" | "conectando";

const OPCIONES: { value: ModoConexion; titulo: string; detalle: string }[] = [
  { value: "combinar", titulo: "Combinar", detalle: "Junta lo de aquí y lo de la nube. No se pierde tu XP ni tu clóset." },
  { value: "nube", titulo: "Usar lo de la nube", detalle: "Este dispositivo queda igual a tu cuenta." },
  { value: "dispositivo", titulo: "Usar este dispositivo", detalle: "Tu cuenta queda igual a este dispositivo." },
];

export function TarjetaSincronizacion({ respaldar }: { respaldar: () => void }) {
  const { mode, reload } = useData();
  const { toast, confirm } = useFeedback();
  const estado = almacenSync.useValor();
  const pendientes = almacenPendientes.useValor().cambios.length;
  const [paso, setPaso] = useState<Paso>("apagado");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [modo, setModo] = useState<ModoConexion>("combinar");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enlace, setEnlace] = useState(false);

  const terminar = async (m: ModoConexion) => {
    setPaso("conectando");
    setError(null);
    try {
      const r = await activar(m);
      if (r.tablas || r.docs.length) await reload();
      toast("Sincronización activada.");
      setPaso("apagado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar la sincronización.");
      setPaso("elegir");
    }
  };

  /** Con sesión: respaldo y, si hace falta, la pregunta de qué hacer con los datos */
  const seguir = async () => {
    setOcupado(true);
    setError(null);
    try {
      const s = await situacion();
      if (s.local) respaldar();
      if (s.local && s.nube) setPaso("elegir");
      else await terminar(s.local ? "combinar" : "nube");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo conectar con la nube.");
    } finally {
      setOcupado(false);
    }
  };

  // Volvió del enlace del correo con la sesión lista: sigue donde iba
  useEffect(() => {
    if (!isSupabaseConfigured || estado.activo || mode === "demo") return;
    if (!new URLSearchParams(window.location.search).has("sincronizar")) return;
    void sesionNube().then((s) => s && void seguir());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const encender = async () => {
    setError(null);
    if (await sesionNube()) await seguir();
    else setPaso("cuenta");
  };

  const entrar = async (crear: boolean) => {
    if (!correo.trim() || clave.length < 8) return setError("Escribe tu correo y una contraseña de al menos 8 caracteres.");
    setOcupado(true);
    setError(null);
    try {
      const auth = (await getSupabase()).auth;
      const { data, error: err } = crear
        ? await auth.signUp({ email: correo.trim(), password: clave, options: { emailRedirectTo: `${window.location.origin}/configuracion?seccion=datos&sincronizar=1` } })
        : await auth.signInWithPassword({ email: correo.trim(), password: clave });
      if (err) throw err;
      setClave("");
      if (crear && !data.session) {
        setEnlace(true);
        return;
      }
      await seguir();
    } catch (e) {
      setError(e instanceof Error ? traducir(e.message) : "No se pudo iniciar sesión.");
    } finally {
      setOcupado(false);
    }
  };

  const enlaceCorreo = async () => {
    if (!correo.trim()) return setError("Escribe tu correo.");
    setOcupado(true);
    setError(null);
    try {
      const { error: err } = await (await getSupabase()).auth.signInWithOtp({
        email: correo.trim(),
        options: { emailRedirectTo: `${window.location.origin}/configuracion?seccion=datos&sincronizar=1` },
      });
      if (err) throw err;
      setEnlace(true);
    } catch (e) {
      setError(e instanceof Error ? traducir(e.message) : "No se pudo enviar el enlace.");
    } finally {
      setOcupado(false);
    }
  };

  const ahora = async () => {
    setOcupado(true);
    try {
      const r = await cicloSync();
      if (r?.tablas) await reload();
      toast("Todo al día.");
    } catch {
      /* el error queda en el estado */
    } finally {
      setOcupado(false);
    }
  };

  const apagar = async () => {
    const ok = await confirm({
      title: "¿Dejar de sincronizar?",
      description: "Tus datos se quedan en este dispositivo y en tu cuenta tal como están. Los cambios nuevos ya no se suben.",
      confirmLabel: "Dejar de sincronizar",
    });
    if (!ok) return;
    await desactivar(true);
    toast("Sincronización desactivada.");
  };

  const borrar = async () => {
    const ok = await confirm({
      title: "¿Borrar tus datos de la nube?",
      description: "Se borra todo lo de tu cuenta en la nube: registros, asistentes, progreso y archivos. No se puede deshacer. Lo de este dispositivo no se toca.",
      confirmLabel: "Borrar de la nube",
      destructive: true,
    });
    if (!ok) return;
    setOcupado(true);
    try {
      await borrarNube();
      toast("Tus datos de la nube se borraron.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo borrar.", "error");
    } finally {
      setOcupado(false);
    }
  };

  const subtitulo = estado.activo ? (estado.email ? `Activa · ${estado.email}` : "Activa") : "Apagada";

  return (
    <Card id="sincronizar">
      <CardHeader title="Sincronizar entre dispositivos" subtitle={subtitulo} />

      {!isSupabaseConfigured || mode === "demo" ? (
        <p className="rounded-[20px] bg-bg-2 p-4 text-[13.5px] leading-relaxed text-muted">
          {mode === "demo"
            ? "En el modo demo no se sincroniza nada."
            : "Para activarla hay que conectar la app a Supabase (las variables NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY). Mientras tanto, todo se guarda solo en este dispositivo."}
        </p>
      ) : estado.activo ? (
        <>
          <Estado error={estado.error} pendientes={pendientes} ultimo={estado.ultimo} />
          {estado.rechazadas.length ? (
            <p className="mt-2 text-[12.5px] text-danger">
              {estado.rechazadas.length === 1 ? "1 registro no se pudo subir" : `${estado.rechazadas.length} registros no se pudieron subir`} porque tiene datos que la nube no acepta (por
              ejemplo, un monto en cero). Corrígelo y se subirá solo.
            </p>
          ) : null}
          <label className="mt-4 flex items-center justify-between gap-3 text-[13.5px]">
            <span>
              Incluir audios e imágenes de tus proyectos
              <span className="block text-[12.5px] text-muted">Hasta 10 MB por archivo.</span>
            </span>
            <Switch
              checked={estado.archivos}
              onChange={(v) => {
                almacenSync.cambiar((e) => ({ ...e, archivos: v }));
                if (v) void ahora();
              }}
              label="Incluir audios e imágenes de tus proyectos"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" className="bg-bg-2" onClick={ahora} loading={ocupado}>
              <RefreshCw size={16} /> Sincronizar ahora
            </Button>
            <Button variant="secondary" className="bg-bg-2" onClick={apagar}>
              Dejar de sincronizar
            </Button>
            <Button variant="danger" onClick={borrar} disabled={ocupado}>
              <Trash2 size={16} /> Borrar mis datos de la nube
            </Button>
          </div>
        </>
      ) : (
        <>
          <label className="flex items-center justify-between gap-3 text-[13.5px]">
            <span>Tus datos viven solo en este dispositivo.</span>
            <Switch checked={paso !== "apagado"} onChange={(v) => (v ? void encender() : setPaso("apagado"))} label="Sincronizar entre dispositivos" />
          </label>
          <ul className="mt-3 flex flex-col gap-1.5 text-[13px] leading-snug">
            <li className="flex gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-brand-soft" aria-hidden />
              Se sube: finanzas, proyectos, hábitos, objetivos, calendario, tus asistentes y su progreso.
            </li>
            <li className="flex gap-2">
              <Shield size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />
              Datos sensibles que también se suben: tu ánimo y tu perfil de salud. Solo tú puedes verlos.
            </li>
            <li className="flex gap-2">
              <X size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
              No se sube: los avisos de este celular. Audios e imágenes, solo si los incluyes.
            </li>
          </ul>

          {paso === "cuenta" ? (
            enlace ? (
              <p className="mt-4 rounded-[20px] bg-bg-2 p-4 text-[13.5px]">Revisa tu correo: te enviamos un enlace. Al abrirlo vuelves aquí y la sincronización sigue sola.</p>
            ) : (
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void entrar(false);
                }}
              >
                <Field label="Correo">
                  {(id) => <Input id={id} type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="tu@correo.com" />}
                </Field>
                <Field label="Contraseña">
                  {(id) => <Input id={id} type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />}
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" type="submit" loading={ocupado}>
                    Entrar
                  </Button>
                  <Button variant="secondary" className="bg-bg-2" type="button" onClick={() => void entrar(true)} disabled={ocupado}>
                    Crear cuenta
                  </Button>
                  <Button variant="ghost" type="button" onClick={enlaceCorreo} disabled={ocupado}>
                    Enviarme un enlace
                  </Button>
                </div>
              </form>
            )
          ) : null}

          {paso === "elegir" || paso === "conectando" ? (
            <div className="mt-4">
              <p className="text-[14px] font-medium">Ya tienes datos en la nube</p>
              <p className="mt-1 text-[12.5px] text-muted">Te descargamos un respaldo de este dispositivo por si acaso.</p>
              <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="Qué hacer con los datos">
                {OPCIONES.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={modo === o.value}
                    onClick={() => setModo(o.value)}
                    className={cn("focus-ring cursor-pointer rounded-[16px] bg-bg-2 px-4 py-3 text-left", modo === o.value && "ring-2 ring-fg")}
                  >
                    <span className="block text-[14px] font-medium">{o.titulo}</span>
                    <span className="block text-[12.5px] text-muted">{o.detalle}</span>
                  </button>
                ))}
              </div>
              <Button variant="primary" className="mt-3" onClick={() => void terminar(modo)} loading={paso === "conectando"}>
                Continuar
              </Button>
            </div>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}

function Estado({ error, pendientes, ultimo }: { error: string | null; pendientes: number; ultimo: string | null }) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  const Icono = error || offline ? CloudOff : Cloud;
  const texto = offline
    ? "Sin conexión: los cambios se guardan aquí y se suben al volver."
    : error
      ? error
      : pendientes
        ? `${pendientes === 1 ? "1 cambio" : `${pendientes} cambios`} por subir.`
        : ultimo
          ? `Todo al día · ${new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" }).format(new Date(ultimo))}`
          : "Preparando…";
  return (
    <div className="flex items-start gap-3 rounded-[20px] bg-bg-2 p-4 text-[13.5px]">
      <Icono size={20} className="mt-0.5 shrink-0" />
      <p className={cn(error && !offline ? "text-danger" : "text-fg")}>{texto}</p>
    </div>
  );
}

const traducir = (m: string) =>
  /invalid login/i.test(m)
    ? "Correo o contraseña incorrectos."
    : /already registered/i.test(m)
      ? "Ese correo ya tiene cuenta: usa «Entrar»."
      : /rate limit/i.test(m)
        ? "Demasiados intentos. Espera un momento."
        : m;
