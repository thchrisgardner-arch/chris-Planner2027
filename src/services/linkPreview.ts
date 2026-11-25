/**
 * Lectura de productos desde un enlace (solo servidor).
 *
 * - Mercado Libre: se intenta su API de ítems (hoy exige credenciales) y luego la página;
 *   suele pedir verificación anti-bots, y en ese caso se informa con claridad.
 * - Resto de tiendas: datos que la página publica para redes y buscadores
 *   (Open Graph, Twitter Cards y JSON-LD schema.org/Product).
 *
 * Seguridad: solo http/https, nunca hosts privados o locales (se valida cada redirección),
 * tiempo límite y tamaño máximo de página.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export interface ProductPreview {
  url: string;
  title: string | null;
  image: string | null;
  price: number | null;
  currency: string | null;
  siteName: string | null;
  description: string | null;
  source: "mercadolibre-api" | "pagina";
}

export class PreviewError extends Error {
  constructor(
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 9000;
const MAX_BYTES = 2_500_000;
const MAX_REDIRECTS = 4;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

/* ───────── Protección contra direcciones internas ───────── */
function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new PreviewError("El enlace no es válido.", 400);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new PreviewError("Solo se aceptan enlaces http o https.", 400);
  if (u.username || u.password) throw new PreviewError("El enlace no es válido.", 400);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new PreviewError("Ese enlace no apunta a una tienda pública.", 400);
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addrs.length === 0) throw new PreviewError("No encontramos ese sitio. Revisa el enlace.", 422);
  if (addrs.some((a) => isPrivateIp(a.address))) throw new PreviewError("Ese enlace no apunta a una tienda pública.", 400);
  return u;
}

/** fetch con redirecciones validadas una por una, tiempo límite y tamaño máximo. */
async function safeFetch(raw: string, accept: string): Promise<{ url: string; body: string; contentType: string }> {
  let current = raw;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const u = await assertPublicUrl(current);
    const res = await fetch(u, {
      redirect: "manual",
      headers: { "user-agent": UA, accept, "accept-language": "es-CO,es;q=0.9,en;q=0.7" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, u).toString();
      // Verificaciones anti-bots o inicio de sesión: no se intentan saltar
      if (/verification|captcha|challenge|\/login|signin|validate/i.test(new URL(current).pathname)) {
        throw new PreviewError("La tienda pidió una verificación de seguridad y no deja leer el producto automáticamente.", 422);
      }
      continue;
    }
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      throw new PreviewError("La tienda no permitió leer esta página automáticamente.", 422);
    }
    if (!res.ok) throw new PreviewError(`La tienda respondió con un error (${res.status}).`, 422);

    const reader = res.body?.getReader();
    if (!reader) return { url: u.toString(), body: "", contentType: res.headers.get("content-type") ?? "" };
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      chunks.push(value);
      if (size > MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }
    const body = new TextDecoder("utf-8").decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    return { url: u.toString(), body, contentType: res.headers.get("content-type") ?? "" };
  }
  throw new PreviewError("El enlace redirige demasiadas veces.", 422);
}

/* ───────── Mercado Libre ───────── */
function mercadoLibreId(url: URL): string | null {
  if (!/mercadoli[bv]re\.|meli\.la/.test(url.hostname)) return null;
  const m = url.href.match(/\b(M[A-Z]{2})-?(\d{6,})/i);
  return m ? `${m[1].toUpperCase()}${m[2]}` : null;
}

async function fromMercadoLibre(id: string, url: string): Promise<ProductPreview | null> {
  try {
    const { body } = await safeFetch(`https://api.mercadolibre.com/items/${id}`, "application/json");
    const j = JSON.parse(body) as {
      title?: string;
      price?: number;
      currency_id?: string;
      pictures?: { secure_url?: string; url?: string }[];
      secure_thumbnail?: string;
    };
    if (!j.title) return null;
    const img = j.pictures?.[0]?.secure_url ?? j.pictures?.[0]?.url ?? j.secure_thumbnail ?? null;
    return {
      url,
      title: j.title,
      image: img,
      price: typeof j.price === "number" ? Math.round(j.price) : null,
      currency: j.currency_id ?? null,
      siteName: "Mercado Libre",
      description: null,
      source: "mercadolibre-api",
    };
  } catch {
    return null; // hoy la API exige credenciales (403); se continúa con la página
  }
}

/* ───────── Página: Open Graph, Twitter y JSON-LD ───────── */
const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

function metaContent(html: string, keys: string[]): string | null {
  for (const key of keys) {
    const k = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re1 = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${k}["'][^>]*content=["']([^"']+)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name|itemprop)=["']${k}["']`, "i");
    const m = html.match(re1) ?? html.match(re2);
    if (m?.[1]) return decode(m[1]);
  }
  return null;
}

type JsonLd = Record<string, unknown>;

function findProduct(node: unknown): JsonLd | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const p = findProduct(n);
      if (p) return p;
    }
    return null;
  }
  const o = node as JsonLd;
  const type = o["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return o;
  return findProduct(o["@graph"]) ?? null;
}

function productFromJsonLd(html: string): JsonLd | null {
  const blocks = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const b of blocks) {
    try {
      const p = findProduct(JSON.parse(b[1].trim()));
      if (p) return p;
    } catch {
      /* bloque inválido: se ignora */
    }
  }
  return null;
}

function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[^\d.,]/g, "");
  if (!s) return null;
  // "1.299.900" o "1,299,900" o "1299900.00" o "1.299.900,50"
  const lastSep = Math.max(s.lastIndexOf("."), s.lastIndexOf(","));
  const decimals = lastSep >= 0 ? s.length - lastSep - 1 : 0;
  if (lastSep >= 0 && decimals > 0 && decimals <= 2) s = s.slice(0, lastSep);
  const n = Number(s.replace(/[.,]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Quita el nombre de la tienda pegado al título ("Taladro Makita - Homecenter.com.co" → "Taladro Makita"). */
function cleanTitle(title: string, url: string): string {
  const brand = new URL(url).hostname.replace(/^www\d?\./, "").split(".")[0].toLowerCase();
  const parts = title.split(/\s+[|–—-]\s+/);
  if (parts.length > 1 && parts[parts.length - 1].toLowerCase().replace(/\s/g, "").includes(brand)) parts.pop();
  return parts.join(" - ").trim();
}

const NOT_PRODUCT_IMAGE = /logo|favicon|sprite|placeholder|icon|banner|brand/i;

function allImages(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(allImages);
  if (typeof v === "object") return allImages((v as JsonLd).url ?? (v as JsonLd).contentUrl);
  return [];
}

/**
 * Elige la foto del producto: JSON-LD, Open Graph y Twitter, descartando logos e íconos.
 * Si no queda ninguna, busca en la página una imagen cuyo nombre contenga el código del producto del enlace.
 */
function pickImage(html: string, url: string, ld: JsonLd | null): string | null {
  const absolute = (src: string) => {
    try {
      return new URL(decode(src), url).toString();
    } catch {
      return null;
    }
  };
  const candidates = [
    ...allImages(ld?.image),
    metaContent(html, ["og:image:secure_url"]),
    metaContent(html, ["og:image"]),
    metaContent(html, ["twitter:image", "twitter:image:src"]),
  ]
    .filter((x): x is string => !!x)
    .map(absolute)
    .filter((x): x is string => !!x);

  const good = candidates.find((c) => !NOT_PRODUCT_IMAGE.test(c.split("?")[0]));
  if (good) return good;

  // Código del producto en el enlace (p. ej. /p/195951378886 o /product/153991322)
  const code = [...new URL(url).pathname.matchAll(/\d{6,}/g)].map((m) => m[0]).pop();
  if (code) {
    const re = new RegExp(`(?:https?:)?//[^"'\\s)]+${code}[^"'\\s)]*\\.(?:jpe?g|png|webp)(?:\\?[^"'\\s)]*)?`, "i");
    const m = html.match(re);
    if (m) return absolute(m[0].startsWith("//") ? `https:${m[0]}` : m[0]);
  }
  return candidates[0] ?? null;
}

function fromHtml(html: string, url: string): ProductPreview {
  const ld = productFromJsonLd(html);
  const offersRaw = ld?.offers;
  const offer = (Array.isArray(offersRaw) ? offersRaw[0] : offersRaw) as JsonLd | undefined;

  const title =
    (typeof ld?.name === "string" ? decode(ld.name) : null) ??
    metaContent(html, ["og:title", "twitter:title"]) ??
    (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]+)<\/title>/i)![1]) : null);

  const image = pickImage(html, url, ld);

  let price =
    parsePrice(offer?.price ?? offer?.lowPrice) ??
    parsePrice(metaContent(html, ["product:price:amount", "og:price:amount", "price", "twitter:data1"]));
  let currency =
    (typeof offer?.priceCurrency === "string" ? offer.priceCurrency : null) ??
    metaContent(html, ["product:price:currency", "og:price:currency", "priceCurrency"]);

  // Último recurso: precio en los datos internos de la página, solo si la página está en pesos colombianos
  if (price === null && /["']COP["']|currency["']?\s*:\s*["']COP/i.test(html)) {
    const m = html.match(/["'](?:price|priceAmount|salePrice|priceValue|currentPrice)["']\s*:\s*["']?(\d{4,}(?:[.,]\d{1,3})*)["']?/i);
    const guess = m ? parsePrice(m[1]) : null;
    if (guess && guess >= 1000 && guess <= 200_000_000) {
      price = guess;
      currency = currency ?? "COP";
    }
  }

  return {
    url,
    title: title ? cleanTitle(title, url).slice(0, 160) : null,
    image,
    price,
    currency: currency ? currency.toUpperCase() : null,
    siteName: metaContent(html, ["og:site_name"]),
    description: metaContent(html, ["og:description", "description"])?.slice(0, 280) ?? null,
    source: "pagina",
  };
}

export async function readProduct(raw: string): Promise<ProductPreview> {
  const u = await assertPublicUrl(raw.trim());
  const mlId = mercadoLibreId(u);
  if (mlId) {
    const ml = await fromMercadoLibre(mlId, u.toString());
    if (ml) return ml;
  }
  const { url, body, contentType } = await safeFetch(u.toString(), "text/html,application/xhtml+xml");
  if (contentType && !/html|xml/i.test(contentType)) throw new PreviewError("Ese enlace no es una página de producto.", 422);
  const p = fromHtml(body, url);
  // Una página que solo trae el nombre de la tienda no es un producto
  const onlySiteName = p.title && !p.image && !p.price && p.title.length < 30 && /^[\w\s.&-]+$/.test(p.title);
  if ((!p.title && !p.image && !p.price) || onlySiteName) throw new PreviewError("No encontramos datos del producto en esa página.", 422);
  return p;
}
