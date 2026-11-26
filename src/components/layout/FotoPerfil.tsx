"use client";

/**
 * Foto de perfil. `profile.avatar_url` puede ser:
 *  - una imagen subida (data URL JPEG de 256 px, viaja en el respaldo con el perfil),
 *  - `asistente:<id>`: el rostro de una de las mascotas, con los colores que le diste,
 *  - vacío: iniciales (o el ícono de persona si no hay nombre).
 */
import { UserRound } from "lucide-react";
import { Asistente } from "@/components/asistentes/Asistente";
import { useAsistentes } from "@/lib/asistentes/estado";
import { ASISTENTE_IDS, type AsistenteId } from "@/lib/asistentes/tipos";
import { cn } from "@/utils/cn";

export const PREFIJO_ASISTENTE = "asistente:";

export function asistenteDeAvatar(avatar: string | null | undefined): AsistenteId | null {
  if (!avatar?.startsWith(PREFIJO_ASISTENTE)) return null;
  const id = avatar.slice(PREFIJO_ASISTENTE.length) as AsistenteId;
  return ASISTENTE_IDS.includes(id) ? id : null;
}

export function iniciales(name: string | null | undefined) {
  if (!name) return "";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Rostro de un asistente recortado en círculo (cabeza grande, cuerpo fuera del marco). */
export function RostroAsistente({ id, size }: { id: AsistenteId; size: number }) {
  const { estado } = useAsistentes();
  const a = estado.ajustes[id];
  // El personaje se dibuja más grande y se sube para que el círculo muestre la cara
  const escala = 1.75;
  return (
    <span className="relative block overflow-hidden rounded-full bg-warm" style={{ width: size, height: size }}>
      <span className="absolute left-1/2 -translate-x-1/2" style={{ top: -size * 0.12 }}>
        <Asistente
          id={id}
          size={Math.round(size * escala)}
          colores={a.colores}
          // En la foto siempre sonríe (no toma el ánimo del momento, que puede ser «dormido» o «molesto»)
          pose="feliz"
          expresion="feliz"
          accesorio={a.accesorio}
          mostrarProp={false}
          fx={false}
          animado={false}
          decorativo
        />
      </span>
    </span>
  );
}

export function FotoPerfil({
  avatar,
  nombre,
  size,
  className,
}: {
  avatar: string | null | undefined;
  nombre: string | null | undefined;
  size: number;
  className?: string;
}) {
  const asis = asistenteDeAvatar(avatar);
  if (asis) {
    return (
      <span className={cn("block shrink-0", className)}>
        <RostroAsistente id={asis} size={size} />
      </span>
    );
  }
  if (avatar?.startsWith("data:image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatar} alt="" width={size} height={size} className={cn("block shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
    );
  }
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full bg-brand font-medium text-[#0a0a0a]", className)}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.32) }}
    >
      {iniciales(nombre) || <UserRound size={Math.round(size * 0.42)} aria-hidden />}
    </span>
  );
}

/** Lee una imagen elegida por la persona y la deja cuadrada, centrada, en JPEG de 256 px. */
export async function prepararFoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Elige un archivo de imagen (JPG, PNG, WebP o HEIC).");
  if (file.size > 15 * 1024 * 1024) throw new Error("La imagen pesa más de 15 MB. Elige una más liviana.");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("No se pudo leer esa imagen. Prueba con una JPG o PNG.");
  }
  const lado = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, 256, 256);
  bmp.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
