import type { MetadataRoute } from "next";

/** Manifiesto: permite instalar Poku Poku en la pantalla de inicio (necesario para avisos en iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Poku Poku",
    short_name: "Poku Poku",
    description: "Sistema personal para administrar finanzas, proyectos, hábitos, objetivos y calendario.",
    lang: "es-CO",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f4f2",
    theme_color: "#f4f4f2",
    icons: [
      { src: "/icono/192", sizes: "192x192", type: "image/png" },
      { src: "/icono/512", sizes: "512x512", type: "image/png" },
      { src: "/icono/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Accesos directos: mantener presionado el ícono de la app
    shortcuts: [
      { name: "Registrar gasto", short_name: "Gasto", description: "Abre la captura rápida", url: "/?captura=1", icons: [{ src: "/icono/96", sizes: "96x96", type: "image/png" }] },
      { name: "Marcar hábitos", short_name: "Hábitos", description: "Tus hábitos de hoy", url: "/salud?vista=habitos", icons: [{ src: "/icono/96", sizes: "96x96", type: "image/png" }] },
      { name: "Ver hoy", short_name: "Hoy", description: "Tu día de un vistazo", url: "/", icons: [{ src: "/icono/96", sizes: "96x96", type: "image/png" }] },
    ],
  };
}
