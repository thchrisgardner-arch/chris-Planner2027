import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Carpeta de compilación configurable: permite medir una build de producción (Lighthouse) sin
  // tocar la de un servidor de desarrollo que esté corriendo. Por defecto, .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  // En este equipo «localhost:5209» lo ocupa otro proyecto: se abre por 127.0.0.1, y en desarrollo
  // Next bloquea la conexión en vivo (HMR) de orígenes no autorizados; sin ella la app no arranca.
  allowedDevOrigins: ["127.0.0.1"],
  partialPrefetching: true,
  // El service worker de avisos nunca se cachea, para que los cambios lleguen de inmediato
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
