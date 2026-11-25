"use client";

import { useSearchParams } from "next/navigation";
import { EspacioProyecto } from "./EspacioProyecto";

/** Lee el id de la dirección (/proyectos/panel?id=…) y muestra el espacio del proyecto. */
export function EspacioDesdeRuta() {
  const id = useSearchParams().get("id") ?? "";
  return <EspacioProyecto id={id} />;
}

/** Enlace al panel de un proyecto */
export const rutaPanel = (id: string) => `/proyectos/panel?id=${encodeURIComponent(id)}`;
