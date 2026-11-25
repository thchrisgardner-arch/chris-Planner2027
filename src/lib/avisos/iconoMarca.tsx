import { ImageResponse } from "next/og";
import { ROSTRO_DATA_URI, ROSTRO_PROPORCION } from "@/components/layout/Isotipo";

/**
 * Ícono de la app (el rostro de Centavo sobre fondo oscuro) a pantalla completa. iOS y Android
 * redondean las esquinas por su cuenta, así que el fondo llena todo el cuadro.
 */
export function iconoMarca(tam: number) {
  const s = tam;
  const ancho = Math.round(s * 0.74);
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, display: "flex", alignItems: "center", justifyContent: "center", background: "#111412" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ROSTRO_DATA_URI} width={ancho} height={Math.round(ancho * ROSTRO_PROPORCION)} alt="" />
      </div>
    ),
    { width: s, height: s },
  );
}
