"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { rutaProyecto, ultimoPanel, type Panel } from "@/lib/proyectos/vistas";
import { EspacioProyecto } from "./EspacioProyecto";

/** /proyectos/panel/<panel>?id=<id>: muestra ese panel del proyecto (cada panel es una ruta fija) */
export function EspacioDesdeRuta({ panel }: { panel: Panel }) {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  useEffect(() => {
    if (!id) router.replace("/proyectos");
  }, [id, router]);
  return id ? <EspacioProyecto id={id} panel={panel} /> : null;
}

/** /proyectos/panel?id=<id> (también la dirección de antes): abre el último panel usado, o Tareas */
export function AbrirUltimoPanel() {
  const id = useSearchParams().get("id");
  const router = useRouter();
  useEffect(() => {
    router.replace(id ? rutaProyecto(id, ultimoPanel(id)) : "/proyectos");
  }, [id, router]);
  return null;
}

/** Enlace a un proyecto (abre su último panel) */
export const rutaPanel = (id: string) => rutaProyecto(id);
