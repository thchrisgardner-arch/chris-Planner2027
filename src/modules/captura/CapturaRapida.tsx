"use client";

/**
 * Captura rápida: un campo, una frase, Enter. Se abre con Ctrl+K / ⌘K, con la tecla N, desde el
 * botón "Nuevo" y desde el botón + del celular.
 * Este archivo es liviano y siempre está cargado (apertura, atajos y puente del teclado); el panel
 * con el parser se descarga la primera vez que se abre (PanelCaptura.tsx).
 */
import { lazy, Suspense, useEffect, useSyncExternalStore } from "react";
import { cuandoLibre } from "@/utils/cuandoLibre";

const Panel = lazy(() => import("./PanelCaptura").then((m) => ({ default: m.Panel })));

/* ═════════ Abrir desde cualquier parte ═════════ */
let abierta = false;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());
/**
 * En iPhone el teclado solo se abre si el foco llega dentro del mismo toque. Un campo invisible
 * lo recibe de inmediato y luego se lo pasa al campo de la captura (que monta un instante después).
 */
let puente: HTMLInputElement | null = null;
export function quitarPuente() {
  puente?.remove();
  puente = null;
}
export function abrirCaptura() {
  if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches && !puente) {
    puente = document.createElement("input");
    puente.setAttribute("aria-hidden", "true");
    puente.tabIndex = -1;
    Object.assign(puente.style, { position: "fixed", top: "0", left: "0", width: "1px", height: "1px", opacity: "0", fontSize: "16px", border: "0", padding: "0" });
    document.body.appendChild(puente);
    puente.focus();
  }
  abierta = true;
  avisar();
}
export function cerrarCaptura() {
  quitarPuente();
  abierta = false;
  avisar();
}
const suscribir = (f: () => void) => {
  oyentes.add(f);
  return () => oyentes.delete(f);
};

/** Atajos globales: Ctrl+K / ⌘K siempre; N cuando no se está escribiendo ni hay un diálogo abierto. */
function useAtajos() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        abrirCaptura();
        return;
      }
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      const escribiendo = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      // Un diálogo abierto de verdad (el menú del celular vive cerrado e `inert` en la página)
      const dialogoAbierto = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some((d) => !d.closest("[inert]"));
      if (escribiendo || dialogoAbierto) return;
      e.preventDefault();
      abrirCaptura();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

export function CapturaRapida() {
  useAtajos();
  // Acceso directo del ícono ("Registrar gasto") y aviso de racha: /?captura=1
  useEffect(() => {
    const u = new URL(window.location.href);
    if (u.searchParams.get("captura") !== "1") return;
    u.searchParams.delete("captura");
    window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}${u.hash}`);
    abrirCaptura();
  }, []);
  // Con el navegador libre (después de la primera pantalla) se precarga el panel: abrir es instantáneo
  useEffect(() => cuandoLibre(() => void import("./PanelCaptura")), []);
  const open = useSyncExternalStore(suscribir, () => abierta, () => false);
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <Panel />
    </Suspense>
  );
}
