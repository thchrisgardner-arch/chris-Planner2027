import { iconoMarca } from "@/lib/avisos/iconoMarca";

const TAMANOS = [96, 180, 192, 512];

/** GET /icono/192 → PNG del ícono de la app (para el manifiesto y los avisos) */
export async function GET(_req: Request, ctx: RouteContext<"/icono/[tam]">) {
  const { tam } = await ctx.params;
  const n = Number(tam);
  if (!TAMANOS.includes(n)) return new Response("Tamaño no disponible", { status: 404 });
  const img = iconoMarca(n);
  img.headers.set("cache-control", "public, max-age=86400, immutable");
  return img;
}
