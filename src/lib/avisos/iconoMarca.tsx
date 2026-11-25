import { ImageResponse } from "next/og";

/**
 * Ícono de la app (anillo de progreso de LIFE OS) a pantalla completa. iOS y Android redondean las
 * esquinas por su cuenta, así que el fondo llena todo el cuadro.
 */
export function iconoMarca(tam: number) {
  const s = tam;
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, display: "flex", alignItems: "center", justifyContent: "center", background: "#111412" }}>
        <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8.5" stroke="#2f3732" strokeWidth="3" />
          <path d="M10 1.5a8.5 8.5 0 1 1-8.5 8.5" stroke="#2EE56B" strokeWidth="3" strokeLinecap="round" />
          <circle cx="10" cy="10" r="2.4" fill="#F4F6F4" />
        </svg>
      </div>
    ),
    { width: s, height: s },
  );
}
