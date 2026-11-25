import { Suspense } from "react";
import { EspacioDesdeRuta } from "@/modules/proyectos/EspacioDesdeRuta";

// Contenido que depende de datos del navegador: sin validación de navegación instantánea
export const instant = false;

// Panel de un proyecto: /proyectos/panel?id=<id>. El id va en la dirección (no en un segmento
// dinámico) para que la compilación de producción con Cache Components funcione.
export default function Page() {
  return (
    <Suspense>
      <EspacioDesdeRuta />
    </Suspense>
  );
}
