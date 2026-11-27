import { Suspense } from "react";
import { EspacioDesdeRuta } from "@/modules/proyectos/EspacioDesdeRuta";

// Datos del navegador: sin validación de navegación instantánea
export const instant = false;

// Panel «tareas» de un proyecto: /proyectos/panel/tareas?id=<id>. Una ruta fija por panel (sin segmento
// dinámico) para que la compilación con Cache Components pueda prerenderizarla.
export default function Page() {
  return (
    <Suspense>
      <EspacioDesdeRuta panel="tareas" />
    </Suspense>
  );
}
