import { Suspense } from "react";
import { EspacioDesdeRuta } from "@/modules/proyectos/EspacioDesdeRuta";

// Datos del navegador: sin validación de navegación instantánea
export const instant = false;

// Panel «calendario» de un proyecto: /proyectos/panel/calendario?id=<id>. Una ruta fija por panel (sin segmento
// dinámico) para que la compilación con Cache Components pueda prerenderizarla.
export default function Page() {
  return (
    <Suspense>
      <EspacioDesdeRuta panel="calendario" />
    </Suspense>
  );
}
