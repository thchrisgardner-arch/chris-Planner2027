"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { EspacioProyecto } from "@/modules/proyectos/EspacioProyecto";

function Contenido() {
  const { id } = useParams<{ id: string }>();
  return <EspacioProyecto id={id} />;
}

// Espacio de trabajo de un proyecto (datos del navegador)
export default function Page() {
  return (
    <Suspense>
      <Contenido />
    </Suspense>
  );
}
