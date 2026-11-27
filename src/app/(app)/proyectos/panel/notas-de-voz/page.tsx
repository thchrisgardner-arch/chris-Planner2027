import { Suspense } from "react";
import { EspacioDesdeRuta } from "@/modules/proyectos/EspacioDesdeRuta";

// Datos del navegador: sin validación de navegación instantánea
export const instant = false;

// Panel «notas-de-voz» de un proyecto: /proyectos/panel/notas-de-voz?id=<id>. Una ruta fija por panel (sin segmento
// dinámico) para que la compilación con Cache Components pueda prerenderizarla.
export default function Page() {
  return (
    <Suspense>
      <EspacioDesdeRuta panel="notas-de-voz" />
    </Suspense>
  );
}
