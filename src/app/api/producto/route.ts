import { PreviewError, readProduct } from "@/services/linkPreview";

// Lee páginas externas en el servidor (runtime Node por defecto). Es dinámica porque depende
// de ?url=; con cacheComponents no se declaran `dynamic` ni `runtime`. La respuesta va con no-store.

/** GET /api/producto?url=<enlace del producto> → nombre, imagen y precio */
export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return Response.json({ error: "Falta el enlace del producto." }, { status: 400 });
  try {
    const product = await readProduct(url);
    return Response.json(product, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof PreviewError) return Response.json({ error: e.message }, { status: e.status });
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return Response.json(
      { error: timeout ? "La tienda tardó demasiado en responder." : "No pudimos leer ese enlace." },
      { status: 502 },
    );
  }
}
