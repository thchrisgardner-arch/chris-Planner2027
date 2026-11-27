"use client";

/** Precarga las secciones principales cuando la primera pantalla ya está lista y el navegador libre. */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cuandoLibre } from "@/utils/cuandoLibre";

const RUTAS = ["/", "/finanzas", "/proyectos", "/salud", "/wishlist", "/objetivos", "/calendario", "/progreso", "/configuracion"];

export function PrecargarRutas() {
  const router = useRouter();
  useEffect(() => cuandoLibre(() => RUTAS.forEach((r) => router.prefetch(r)), 2500), [router]);
  return null;
}
