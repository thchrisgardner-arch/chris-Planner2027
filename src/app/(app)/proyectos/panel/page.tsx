import { Suspense } from "react";
import { AbrirUltimoPanel } from "@/modules/proyectos/EspacioDesdeRuta";

// Datos del navegador: sin validación de navegación instantánea
export const instant = false;

// Dirección anterior (/proyectos/panel?id=<id>): lleva al último panel usado del proyecto
export default function Page() {
  return (
    <Suspense>
      <AbrirUltimoPanel />
    </Suspense>
  );
}
