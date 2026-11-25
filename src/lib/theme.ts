"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemePref = "claro" | "oscuro" | "sistema";

import { THEME_KEY } from "./themeScript";

export { THEME_KEY };

function systemIsDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(pref: ThemePref) {
  const dark = pref === "oscuro" || (pref === "sistema" && systemIsDark());
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? "#0f1110" : "#f3f4f1"));
}

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "oscuro" || v === "sistema" ? v : "claro";
  } catch {
    return "claro";
  }
}

/** Preferencia de tema: se guarda en este navegador y sigue al sistema cuando se elige "Sistema". */
export function useTheme() {
  const [pref, setPrefState] = useState<ThemePref>("claro");

  useEffect(() => {
    // Lee la preferencia guardada al montar
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con localStorage tras hidratar
    setPrefState(readPref());
  }, []);

  useEffect(() => {
    if (pref !== "sistema") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("sistema");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const setPref = useCallback((next: ThemePref) => {
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* sin almacenamiento: se aplica solo en esta visita */
    }
    applyTheme(next);
    setPrefState(next);
  }, []);

  return { pref, setPref };
}

/** Mantiene el tema al día si la preferencia es "Sistema" y el dispositivo cambia de modo. */
export function ThemeWatcher() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readPref() === "sistema") applyTheme("sistema");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return null;
}
