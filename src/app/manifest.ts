import type { MetadataRoute } from "next";

/** Manifiesto: permite instalar LIFE OS en la pantalla de inicio (necesario para avisos en iPhone). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LIFE OS 2027",
    short_name: "LIFE OS",
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
  };
}
