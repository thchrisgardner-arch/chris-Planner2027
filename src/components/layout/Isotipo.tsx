/**
 * Isotipo de LIFE for LIFE: el rostro de Centavo (la mascota amarilla), sonriendo.
 * Un solo dibujo en SVG (texto fijo, colores fijos) que usan la app y las rutas que generan los
 * íconos PNG (next/og, que lo recibe como imagen).
 */
const VIEWBOX = "28 38 144 116";

const ojo = (x: number) =>
  `<ellipse cx="${x}" cy="96" rx="15" ry="16.2" fill="#ffffff"/>` +
  `<circle cx="${x + 1}" cy="97" r="8.6" fill="#0a0a0a"/>` +
  `<circle cx="${x + 4.3}" cy="93.4" r="2.9" fill="#ffffff"/>` +
  `<circle cx="${x - 1.9}" cy="100.3" r="1.4" fill="#ffffff"/>`;

/** Contenido del SVG (orejas, cara, cachetes, ojos, nariz y sonrisa) */
const ROSTRO =
  // Orejas
  `<circle cx="62" cy="62" r="17" fill="#ffd84d"/><circle cx="138" cy="62" r="17" fill="#ffd84d"/>` +
  `<circle cx="62" cy="62" r="8" fill="#f2dc8c"/><circle cx="138" cy="62" r="8" fill="#f2dc8c"/>` +
  // Cara con sombra suave abajo
  `<rect x="34" y="60" width="132" height="92" rx="46" fill="#e8b820"/>` +
  `<rect x="34" y="56" width="132" height="90" rx="45" fill="#ffd84d"/>` +
  // Cachetes
  `<ellipse cx="57" cy="122" rx="16" ry="12" fill="#fff1b8"/><ellipse cx="143" cy="122" rx="16" ry="12" fill="#fff1b8"/>` +
  ojo(80) +
  ojo(120) +
  // Nariz y sonrisa
  `<path d="M95 111 Q100 107 105 111 Q103 116 100 117 Q97 116 95 111 Z" fill="#cfc2a6"/>` +
  `<path d="M90 123 Q100 133 110 123" fill="none" stroke="#0a0a0a" stroke-width="4.2" stroke-linecap="round"/>`;

/** SVG completo como texto (para convertir en imagen) */
export const ROSTRO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" width="288" height="232">${ROSTRO}</svg>`;
export const ROSTRO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(ROSTRO_SVG)}`;
/** Proporción alto/ancho del dibujo */
export const ROSTRO_PROPORCION = 116 / 144;

/** Isotipo suelto (sin fondo) */
export function Isotipo({ size = 34, className, titulo }: { size?: number; className?: string; titulo?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={VIEWBOX}
      className={className}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      // Dibujo fijo definido arriba (no viene de datos del usuario)
      dangerouslySetInnerHTML={{ __html: ROSTRO }}
    />
  );
}
