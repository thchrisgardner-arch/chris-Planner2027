"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, EyeOff, HardDrive, Lock, Mail } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { useData } from "@/lib/store/DataProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Logo } from "@/components/layout/Logo";
import {
  LOCAL_LOGIN_ENABLED,
  createLocalAccount,
  getLocalAccount,
  normalizeEmail,
  startLocalSession,
  verifyLocalAccount,
} from "@/services/localAuth";
import { cn } from "@/utils/cn";

type Step = "email" | "password" | "signup";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const { status, reload, saveProfile } = useData();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Si ya hay sesión (o el login local está desactivado), entrar directo
  useEffect(() => {
    if (status === "ready" || (!isSupabaseConfigured && !LOCAL_LOGIN_ENABLED)) router.replace("/");
  }, [status, router]);

  // En modo local con cuenta creada, sugerir su correo
  useEffect(() => {
    if (!isSupabaseConfigured) {
      const acc = getLocalAccount();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- precarga el correo guardado en este dispositivo
      if (acc) setEmail(acc.email);
    }
  }, []);

  const go = (s: Step) => {
    setError(null);
    setNotice(null);
    setPassword("");
    setConfirm("");
    setStep(s);
  };

  const enter = async (fullName?: string) => {
    await reload();
    if (fullName) await saveProfile({ full_name: fullName });
    router.replace("/");
  };

  /* Paso 1 · correo */
  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) return setError("Escribe un correo válido.");
    if (isSupabaseConfigured) return go("password");
    const acc = getLocalAccount();
    if (!acc) return go("signup");
    if (acc.email !== normalizeEmail(email)) {
      return setError("Este dispositivo ya tiene un acceso creado con otro correo.");
    }
    go("password");
  };

  /* Paso 2 · contraseña */
  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return setError("Escribe tu contraseña.");
    setLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured) {
        const { error: err } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw new Error(err.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : err.message);
      } else {
        const ok = await verifyLocalAccount(email, password);
        if (!ok) throw new Error("La contraseña no es correcta.");
        startLocalSession(email, remember);
      }
      await enter();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  /* Paso 2b · crear acceso */
  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Escribe tu nombre.");
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured) {
        const { data, error: err } = await getSupabase().auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (err) throw new Error(err.message);
        if (!data.session) {
          setNotice("Te enviamos un correo para confirmar la cuenta. Después inicia sesión.");
          go("password");
          return;
        }
      } else {
        await createLocalAccount(email, password);
        startLocalSession(email, remember);
      }
      await enter(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el acceso.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!isSupabaseConfigured) return;
    const { error: err } = await getSupabase().auth.resetPasswordForEmail(email.trim());
    if (err) setError(err.message);
    else setNotice("Te enviamos un enlace para restablecer la contraseña.");
  };

  const titles: Record<Step, { h: string; p: string }> = {
    email: { h: "Tu vida, en orden.", p: "Finanzas, proyectos, hábitos y objetivos 2027 en un solo lugar." },
    password: { h: "Bienvenido de nuevo", p: "Ingresa tu contraseña para continuar." },
    signup: { h: "Crea tu acceso", p: "Solo te tomará un momento." },
  };

  const passwordInput = (id: string, value: string, set: (v: string) => void, auto: string, placeholder?: string) => (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={auto}
        value={value}
        placeholder={placeholder}
        onChange={(e) => set(e.target.value)}
        className="h-12 pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 cursor-pointer place-items-center rounded-[10px] text-dim transition-colors hover:bg-elev hover:text-fg"
      >
        {show ? <EyeOff size={19} /> : <Eye size={19} />}
      </button>
    </div>
  );

  return (
    <main className="grid min-h-dvh bg-bg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ── Columna del formulario ── */}
      <section className="flex min-h-dvh flex-col px-6 py-7 sm:px-10 lg:px-14">
        <Logo />

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <div key={step} className="animate-in">
            {step !== "email" ? (
              <button
                type="button"
                onClick={() => go("email")}
                className="mb-6 inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] text-[13px] text-muted transition-colors hover:text-fg"
              >
                <ArrowLeft size={17} /> Cambiar correo
              </button>
            ) : null}

            <h1 className="text-[34px] font-medium leading-[1.08] tracking-[-0.03em] sm:text-[40px]">{titles[step].h}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">{titles[step].p}</p>

            <div className="card mt-8 p-6 sm:p-7">
              {step === "email" ? (
                <form onSubmit={submitEmail} noValidate className="flex flex-col gap-4">
                  <Field label="Correo electrónico" error={error}>
                    {(id) => (
                      <Input
                        id={id}
                        type="email"
                        autoComplete="email"
                        autoFocus
                        placeholder="tucorreo@ejemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        aria-invalid={!!error || undefined}
                        className="h-12"
                      />
                    )}
                  </Field>
                  <Button type="submit" variant="primary" className="h-12 w-full text-[15px]">
                    <Mail size={19} /> Continuar con correo
                  </Button>
                </form>
              ) : (
                <>
                  <div className="mb-5 flex items-center gap-3 rounded-[22px] bg-bg-2 px-3.5 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-fg text-[13px] font-medium text-on-fg">
                      {email.trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 truncate text-[14px]">{email.trim()}</span>
                  </div>

                  {step === "password" ? (
                    <form onSubmit={submitPassword} noValidate className="flex flex-col gap-4">
                      <Field label="Contraseña" error={error}>
                        {(id) => passwordInput(id, password, setPassword, "current-password")}
                      </Field>
                      <RememberMe value={remember} onChange={setRemember} />
                      {notice ? <p className="text-[13px] text-brand-soft">{notice}</p> : null}
                      <Button type="submit" variant="primary" loading={loading} className="h-12 w-full text-[15px]">
                        <Lock size={18} /> Iniciar sesión
                      </Button>
                      {isSupabaseConfigured ? (
                        <div className="flex justify-between text-[13px]">
                          <button type="button" onClick={resetPassword} className="cursor-pointer text-muted hover:text-fg">
                            ¿Olvidaste tu contraseña?
                          </button>
                          <button type="button" onClick={() => go("signup")} className="cursor-pointer font-medium text-fg hover:underline">
                            Crear cuenta
                          </button>
                        </div>
                      ) : (
                        <p className="text-[12px] leading-relaxed text-dim">
                          En modo local la contraseña no se puede recuperar. Si la olvidas, tendrás que borrar los datos de este navegador.
                        </p>
                      )}
                    </form>
                  ) : (
                    <form onSubmit={submitSignup} noValidate className="flex flex-col gap-4">
                      <Field label="Tu nombre">
                        {(id) => (
                          <Input id={id} autoComplete="name" autoFocus placeholder="Ej. Chris" value={name} onChange={(e) => setName(e.target.value)} className="h-12" />
                        )}
                      </Field>
                      <Field label="Contraseña" hint="Mínimo 8 caracteres.">
                        {(id) => passwordInput(id, password, setPassword, "new-password")}
                      </Field>
                      <Field label="Confirmar contraseña" error={error}>
                        {(id) => passwordInput(id, confirm, setConfirm, "new-password")}
                      </Field>
                      <RememberMe value={remember} onChange={setRemember} />
                      <Button type="submit" variant="primary" loading={loading} className="h-12 w-full text-[15px]">
                        Crear acceso y entrar
                      </Button>
                    </form>
                  )}
                </>
              )}
            </div>

            {!isSupabaseConfigured ? (
              <p className="mt-5 flex items-start gap-2 text-[12.5px] leading-relaxed text-dim">
                <HardDrive size={17} className="mt-0.5 shrink-0 text-warn" />
                Modo local: tu acceso y tus datos se guardan solo en este dispositivo. Para tener cuenta en la nube hay que conectar Supabase.
              </p>
            ) : null}
          </div>
        </div>

        <p className="text-[12px] text-dim">© 2027 LIFE OS · Personal Life Management System</p>
      </section>

      {/* ── Panel visual (solo escritorio) ── */}
      <aside className="relative hidden overflow-hidden p-4 lg:block">
        <div className="relative h-full overflow-hidden rounded-[32px] bg-elev">
          <Showcase />
        </div>
      </aside>
    </main>
  );
}

function RememberMe({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="flex cursor-pointer items-center gap-2.5 self-start text-[13.5px] text-muted"
    >
      <span
        className={cn(
          "grid h-5 w-5 place-items-center rounded-[6px] border transition-colors",
          value ? "border-fg bg-fg text-on-fg" : "border-line-strong bg-card",
        )}
      >
        {value ? <Check size={13} strokeWidth={2.5} /> : null}
      </span>
      Mantener sesión iniciada
    </button>
  );
}

/** Composición decorativa con piezas del sistema visual (sin cifras ni datos). */
function Showcase() {
  const bars = [38, 62, 48, 80, 56, 92, 70];
  return (
    <div className="absolute inset-0 flex items-center justify-center p-10">
      <div className="grid w-full max-w-[520px] grid-cols-6 gap-4">
        {/* Medidor */}
        <div className="col-span-3 rounded-[24px] bg-card p-6">
          <div className="h-2.5 w-24 rounded-full bg-elev" />
          <svg viewBox="0 0 240 128" className="mt-6 w-full" aria-hidden>
            {Array.from({ length: 22 }, (_, i) => {
              const a0 = 180 + i * (180 / 22) + 1.2;
              const a1 = 180 + (i + 1) * (180 / 22) - 1.2;
              const p = (r: number, a: number) => `${120 + r * Math.cos((a * Math.PI) / 180)} ${120 + r * Math.sin((a * Math.PI) / 180)}`;
              return (
                <path
                  key={i}
                  d={`M ${p(80, a0)} L ${p(108, a0)} A 108 108 0 0 1 ${p(108, a1)} L ${p(80, a1)} A 80 80 0 0 0 ${p(80, a0)} Z`}
                  fill={i < 15 ? "#2ee56b" : "var(--color-elev)"}
                />
              );
            })}
          </svg>
        </div>

        {/* Hábitos */}
        <div className="col-span-3 flex flex-col gap-2.5 rounded-[24px] bg-card p-6">
          <div className="mb-2 h-2.5 w-20 rounded-full bg-elev" />
          {[true, true, false].map((done, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[22px] bg-bg-2 px-3 py-2.5">
              <span className={cn("grid h-5 w-5 place-items-center rounded-full", done ? "bg-brand" : "border-[1.5px] border-line-strong")}>
                {done ? <Check size={12} strokeWidth={2.5} className="text-[#06240f]" /> : null}
              </span>
              <span className="h-2 flex-1 rounded-full bg-elev" style={{ maxWidth: `${70 - i * 12}%` }} />
            </div>
          ))}
        </div>

        {/* Barras */}
        <div className="col-span-4 rounded-[24px] bg-card p-6">
          <div className="h-2.5 w-28 rounded-full bg-elev" />
          <div className="mt-6 flex h-32 items-end gap-2.5">
            {bars.map((h, i) => (
              <div key={i} className="flex h-full flex-1 items-end gap-1">
                <span className="flex-1 rounded-t-[6px] rounded-b-[2px] bg-brand" style={{ height: `${h}%` }} />
                <span className="flex-1 rounded-t-[6px] rounded-b-[2px] bg-[#f4a340]" style={{ height: `${h * 0.55}%` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Anillo + colores */}
        <div className="col-span-2 flex flex-col items-center justify-center gap-4 rounded-[24px] bg-fg p-6">
          <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden className="-rotate-90">
            <circle cx="36" cy="36" r="29" fill="none" stroke="#2f3732" strokeWidth="8" />
            <circle cx="36" cy="36" r="29" fill="none" stroke="#2ee56b" strokeWidth="8" strokeLinecap="round" strokeDasharray="182" strokeDashoffset="50" />
          </svg>
          <div className="flex gap-1.5">
            {["#c9b8ff", "#b9f0cc", "#bcdcff", "#ffd1b3"].map((c) => (
              <span key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />
            ))}
          </div>
        </div>

        <p className="col-span-6 mt-4 text-center text-[15px] leading-relaxed text-muted">
          Control, claridad y crecimiento.
          <br />
          <span className="text-fg">Un centro de mando para tu 2027.</span>
        </p>
      </div>
    </div>
  );
}
