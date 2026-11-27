/** ¿Ya se completó (o canceló) la bienvenida en este navegador? (`lifeos:onboarding-done`) */
export const ONBOARDING_KEY = "lifeos:onboarding-done";

export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return true;
  }
}

export function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    /* sin almacenamiento: se mostrará de nuevo, no pasa nada */
  }
}
