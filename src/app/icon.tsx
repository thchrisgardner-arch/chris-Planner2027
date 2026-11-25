import { ImageResponse } from "next/og";
import { ROSTRO_DATA_URI, ROSTRO_PROPORCION } from "@/components/layout/Isotipo";

// Ícono de la pestaña del navegador: el rostro de Centavo sin fondo
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ROSTRO_DATA_URI} width={64} height={Math.round(64 * ROSTRO_PROPORCION)} alt="" />
      </div>
    ),
    { ...size },
  );
}
