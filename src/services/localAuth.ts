/**
 * Inicio de sesión en MODO LOCAL (sin Supabase).
 *
 * Protege la entrada a la app en este dispositivo: correo + contraseña, con la contraseña
 * derivada con PBKDF2-SHA-256 (WebCrypto) y una sal aleatoria. Nunca se guarda en texto plano.
 * Importante: no es una cuenta en la nube ni cifra los datos guardados en el navegador;
 * para cuentas reales y sincronización hay que conectar Supabase.
 */

/**
 * Interruptor del inicio de sesión local. En false la app abre directo, sin pantalla de login
 * (pedido del usuario el 2026-11-24). Para reactivarlo, cambia a true.
 */
export const LOCAL_LOGIN_ENABLED = false;

const ACCOUNT_KEY = "lifeos:v1:auth";
const SESSION_KEY = "lifeos:session";
const ITERATIONS = 210_000;

export interface LocalAccount {
  email: string;
  salt: string;
  hash: string;
  iterations: number;
  created_at: string;
}

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf as ArrayBuffer)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return toB64(bits);
}

/** Comparación en tiempo constante */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function getLocalAccount(): LocalAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? (JSON.parse(raw) as LocalAccount) : null;
  } catch {
    return null;
  }
}

export async function createLocalAccount(email: string, password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const account: LocalAccount = {
    email: normalizeEmail(email),
    salt: toB64(salt),
    hash: await derive(password, salt, ITERATIONS),
    iterations: ITERATIONS,
    created_at: new Date().toISOString(),
  };
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

export async function verifyLocalAccount(email: string, password: string): Promise<boolean> {
  const acc = getLocalAccount();
  if (!acc || acc.email !== normalizeEmail(email)) return false;
  const hash = await derive(password, fromB64(acc.salt), acc.iterations);
  return safeEqual(hash, acc.hash);
}

/** remember = true: la sesión sobrevive al cierre del navegador */
export function startLocalSession(email: string, remember: boolean) {
  const value = JSON.stringify({ email: normalizeEmail(email), at: Date.now() });
  sessionStorage.setItem(SESSION_KEY, value);
  if (remember) localStorage.setItem(SESSION_KEY, value);
  else localStorage.removeItem(SESSION_KEY);
}

export function hasLocalSession(): boolean {
  if (!LOCAL_LOGIN_ENABLED) return true;
  const acc = getLocalAccount();
  if (!acc) return false;
  const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  if (!raw) return false;
  try {
    return (JSON.parse(raw) as { email: string }).email === acc.email;
  } catch {
    return false;
  }
}

export function endLocalSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function removeLocalAccount() {
  endLocalSession();
  localStorage.removeItem(ACCOUNT_KEY);
}
