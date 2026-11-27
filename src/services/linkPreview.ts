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
  /** La tienda pidió una verificación anti-bots: se conserva lo poco que se pudo saber */
  bloqueado?: boolean;
  /** Nombre de la tienda para los avisos («Amazon no dejó leer este producto») */
  tienda?: string;
}

export class PreviewError extends Error {
  constructor(
    message: string,
    public status = 422,
    /** Si la tienda bloqueó la lectura: la URL a la que llegó */
    public bloqueo?: string,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 8000;
const MAX_BYTES = 2_500_000;
const MAX_REDIRECTS = 4;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

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
async function safeFetch(raw: string, accept: string): Promise<{ url: string; body: string; contentType: string; status: number }> {
  let current = raw;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const u = await assertPublicUrl(current);
    const res = await fetch(u, {
      redirect: "manual",
      headers: { "user-agent": UA, accept, "accept-language": "es-CO,es;q=0.9,en;q=0.7", "upgrade-insecure-requests": "1", "cache-control": "no-cache" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, u).toString();
      // Verificaciones anti-bots o inicio de sesión: no se intentan saltar
      if (/verification|captcha|challenge|\/login|signin|validate/i.test(new URL(current).pathname)) {
        throw new PreviewError("La tienda pidió una verificación de seguridad y no deja leer el producto automáticamente.", 422, current);
      }
      continue;
    }
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      throw new PreviewError("La tienda no permitió leer esta página automáticamente.", 422, u.toString());
    }
    if (!res.ok && res.status !== 404) throw new PreviewError(`La tienda respondió con un error (${res.status}).`, 422);

    const reader = res.body?.getReader();
    if (!reader) return { url: u.toString(), body: "", contentType: res.headers.get("content-type") ?? "", status: res.status };
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
    return { url: u.toString(), body, contentType: res.headers.get("content-type") ?? "", status: res.status };
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

/* ───────── Página: Open Graph, JSON-LD y reglas por tienda ───────── */
const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
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

/* ───────── Tienda, moneda y montos ───────── */
export type Tienda = "amazon" | "amazon-es" | "mercadolibre" | "falabella" | "exito" | "otra";

export function tiendaDe(url: string): Tienda {
  const h = new URL(url).hostname;
  if (/(^|\.)amazon\.(es|de|fr|it)$/.test(h)) return "amazon-es";
  if (/(^|\.)amazon\./.test(h)) return "amazon";
  if (/mercadoli[bv]re\.|meli\.la/.test(h)) return "mercadolibre";
  if (/falabella\./.test(h)) return "falabella";
  if (/exito\./.test(h)) return "exito";
  return "otra";
}

const NOMBRE_TIENDA: Record<Tienda, string> = { amazon: "Amazon", "amazon-es": "Amazon", mercadolibre: "Mercado Libre", falabella: "Falabella", exito: "Éxito", otra: "La tienda" };

/**
 * Lee un monto respetando el formato de la tienda: en amazon.com "1,299.99" (coma de miles, punto
 * decimal; "24.00" son 24 dólares, nunca 24.000 pesos); en Colombia y España "1.299.900" o "24,99".
 */
export function leerMonto(texto: string, formato: "en" | "es"): number | null {
  const s = texto.replace(/[^\d.,]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const miles = formato === "en" ? /,/g : /\./g;
  const decimal = formato === "en" ? "." : ",";
  const n = Number(s.replace(miles, "").replace(decimal, "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Moneda que muestra el texto del precio ("COP 53,289.45", "US$24.00", "$24.00" en amazon.com, "24,99 €") */
export function monedaDe(texto: string, tienda: Tienda): string | null {
  if (/\bCOP\b/i.test(texto)) return "COP";
  if (/US\$|\bUSD\b/i.test(texto)) return "USD";
  if (/€|\bEUR\b/i.test(texto)) return "EUR";
  if (/\$/.test(texto)) return tienda === "amazon" ? "USD" : "COP";
  return null;
}

/* ───────── Página bloqueada (verificación anti-bots) ───────── */
export function paginaBloqueada(html: string, url: string): boolean {
  return (
    /\/errors\/validateCaptcha|id=["']captchacharacters["']|Enter the characters you see below|Escribe los caracteres que ves/i.test(html) ||
    /<title>\s*Just a moment\.\.\.\s*<\/title>|cf-browser-verification|challenge-platform\/|cf_chl_/i.test(html) ||
    /\/gz\/account-verification|account-verification\?go=/i.test(url) ||
    /<title>\s*(Attention Required|Access Denied)/i.test(html)
  );
}

/** Nombre a partir del enlace (cuando la tienda no deja leer la página): "/MCO-1366-audifonos-inalambricos-_JM" → "Audifonos inalambricos" */
function tituloDelEnlace(url: string): string | null {
  const u = new URL(url);
  const destino = u.searchParams.get("go");
  const path = destino ? new URL(destino).pathname : u.pathname;
  const partes = path.split("/").filter((p) => /[a-z]{3,}-[a-z]{3,}/i.test(p));
  const p = partes.sort((a, b) => b.length - a.length)[0];
  if (!p) return null;
  const limpio = p
    .replace(/^M[A-Z]{2}-?\d+-?/i, "")
    .replace(/[-_](JM|MP|p)$/i, "")
    .replace(/\d{6,}/g, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : null;
}

/* ───────── Título ───────── */
/** Quita prefijos y sufijos de tienda: "Amazon.com: X : Electrónica", "X | Falabella Colombia", "X - Éxito" */
export function limpiarTitulo(titulo: string, tienda: Tienda, url: string): string {
  let t = titulo;
  if (tienda === "amazon" || tienda === "amazon-es") {
    t = t.replace(/^Amazon\.[a-z.]+\s*:\s*/i, "").replace(/\s+:\s+[^:]{2,60}$/, "").replace(/\s*\|\s*Amazon(\.[a-z.]+)?$/i, "");
  }
  t = t.replace(/\s*[|–—-]\s*(Falabella(\.com)?( Colombia)?|Éxito|exito\.com|Mercado Libre( Colombia)?|MercadoLibre)\s*$/i, "");
  // Genérico: el nombre de la tienda pegado al final
  const marca = new URL(url).hostname.replace(/^www\d?\./, "").split(".")[0].toLowerCase();
  const partes = t.split(/\s+[|–—-]\s+/);
  if (partes.length > 1 && partes[partes.length - 1].toLowerCase().replace(/\s/g, "").includes(marca)) partes.pop();
  return partes.join(" - ").trim();
}

/* ───────── Imagen (la de mayor resolución) ───────── */
const NOT_PRODUCT_IMAGE = /logo|favicon|sprite|placeholder|icon|banner|brand/i;

function allImages(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(allImages);
  if (typeof v === "object") return allImages((v as JsonLd).url ?? (v as JsonLd).contentUrl);
  return [];
}

/** La URL más grande de data-a-dynamic-image ({"url": [ancho, alto], …}) */
function mayorDinamica(atributo: string | undefined): string | null {
  if (!atributo) return null;
  try {
    const mapa = JSON.parse(decode(atributo)) as Record<string, [number, number]>;
    return Object.entries(mapa).sort((a, b) => b[1][0] * b[1][1] - a[1][0] * a[1][1])[0]?.[0] ?? null;
  } catch {
    return null;
  }
}

function imagenAmazon(html: string, id: string): string | null {
  const tag = html.match(new RegExp(`<img[^>]+id=["']${id}["'][^>]*>`, "i"))?.[0] ?? html.match(new RegExp(`<img(?=[^>]*id=["']${id}["'])[^>]*>`, "i"))?.[0];
  if (!tag) return null;
  const hires = tag.match(/data-old-hires=["']([^"']+)["']/i)?.[1];
  if (hires) return decode(hires);
  return mayorDinamica(tag.match(/data-a-dynamic-image=["']([^"']+)["']/i)?.[1]) ?? (tag.match(/\ssrc=["']([^"']+)["']/i)?.[1] ?? null);
}

/** Orden: og:image, JSON-LD, #landingImage (alta resolución), #imgBlkFront (libros) */
function pickImage(html: string, url: string, ld: JsonLd | null): string | null {
  const absolute = (src: string | null) => {
    if (!src) return null;
    try {
      return new URL(decode(src), url).toString();
    } catch {
      return null;
    }
  };
  const candidatos = [
    metaContent(html, ["og:image:secure_url", "og:image"]),
    ...allImages(ld?.image),
    imagenAmazon(html, "landingImage"),
    imagenAmazon(html, "imgBlkFront"),
    metaContent(html, ["twitter:image", "twitter:image:src"]),
  ]
    .map(absolute)
    .filter((x): x is string => !!x);
  const buena = candidatos.find((c) => !NOT_PRODUCT_IMAGE.test(c.split("?")[0]));
  if (buena) return buena;
  const code = [...new URL(url).pathname.matchAll(/\d{6,}/g)].map((m) => m[0]).pop();
  if (code) {
    const m = html.match(new RegExp(`(?:https?:)?//[^"'\\s)]+${code}[^"'\\s)]*\\.(?:jpe?g|png|webp)(?:\\?[^"'\\s)]*)?`, "i"));
    if (m) return absolute(m[0].startsWith("//") ? `https:${m[0]}` : m[0]);
  }
  return candidatos[0] ?? null;
}

/* ───────── Precio ───────── */
/** Bloque de precio principal de Amazon (nunca los productos relacionados de más abajo) */
function bloquePrecioAmazon(html: string): string | null {
  for (const id of ["corePriceDisplay_desktop_feature_div", "corePrice_feature_div", "corePrice_desktop", "apex_desktop"]) {
    const i = html.search(new RegExp(`id=["']${id}["']`));
    if (i < 0) continue;
    const trozo = html.slice(i, i + 6000).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
    if (/a-price/.test(trozo)) return trozo;
  }
  return null;
}

function precioAmazon(html: string, tienda: Tienda): { precio: number; moneda: string | null } | null {
  const formato = tienda === "amazon-es" ? "es" : "en";
  const bloque = bloquePrecioAmazon(html);
  if (bloque) {
    // Parte entera y centavos por separado: el texto oculto a veces llega sin el punto ("$2400" por $24.00)
    const entero = bloque.match(/a-price-whole["']>([\d.,\s]+)/)?.[1];
    const fraccion = bloque.match(/a-price-fraction["']>(\d+)/)?.[1];
    const simbolo = bloque.match(/a-price-symbol["']>([^<]+)/)?.[1] ?? "";
    if (entero) {
      const base = leerMonto(entero.replace(/[.,]\s*$/, ""), formato);
      if (base) return { precio: fraccion ? base + Number(fraccion) / 10 ** fraccion.length : base, moneda: monedaDe(simbolo, tienda) };
    }
    const oculto = bloque.match(/a-offscreen["']>([^<]+)/)?.[1];
    if (oculto && /[.,]\d{1,2}\b/.test(oculto)) {
      const v = leerMonto(oculto, formato);
      if (v) return { precio: v, moneda: monedaDe(oculto, tienda) };
    }
  }
  const viejo = html.match(/id=["']priceblock_(?:ourprice|dealprice)["'][^>]*>([^<]+)/)?.[1];
  if (viejo) {
    const v = leerMonto(viejo, formato);
    if (v) return { precio: v, moneda: monedaDe(viejo, tienda) };
  }
  // Libros: el formato elegido (o el primero) en los botones de formato
  const swatches = html.match(/id=["']tmmSwatches["'][\s\S]{0,6000}/)?.[0];
  if (swatches) {
    const elegido = swatches.match(/swatchElement selected[\s\S]{0,1500}?slot-price[^>]*>[\s\S]*?([A-Z]{3}\s?[\d.,]+|US\$\s?[\d.,]+|\$\s?[\d.,]+|[\d.,]+\s?€)/)?.[1] ?? swatches.match(/slot-price[^>]*>[\s\S]*?([A-Z]{3}\s?[\d.,]+|US\$\s?[\d.,]+|\$\s?[\d.,]+|[\d.,]+\s?€)/)?.[1];
    if (elegido) {
      const v = leerMonto(elegido, formato);
      if (v) return { precio: v, moneda: monedaDe(elegido, tienda) };
    }
  }
  return null;
}

/** Precio de JSON-LD: suele venir como número o "729900" / "24.00" (punto decimal) */
function precioJsonLd(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^\d+(\.\d{1,2})?$/.test(s)) return Number(s) || null;
  return leerMonto(s, "es");
}

/** COP sin decimales; las demás monedas con 2 decimales */
const redondear = (precio: number, moneda: string | null) => (moneda === "USD" || moneda === "EUR" ? Math.round(precio * 100) / 100 : Math.round(precio));

/* ───────── Lectura completa de una página ───────── */
export function fromHtml(html: string, url: string): ProductPreview {
  const tienda = tiendaDe(url);
  if (paginaBloqueada(html, url)) {
    return { url, title: tituloDelEnlace(url), image: null, price: null, currency: null, siteName: NOMBRE_TIENDA[tienda], description: null, source: "pagina", bloqueado: true, tienda: NOMBRE_TIENDA[tienda] };
  }
  const ld = productFromJsonLd(html);
  const offersRaw = ld?.offers;
  const offer = (Array.isArray(offersRaw) ? offersRaw[0] : offersRaw) as JsonLd | undefined;

  const productTitle = html.match(/id=["']productTitle["'][^>]*>([^<]+)</)?.[1];
  const tituloCrudo =
    (productTitle ? decode(productTitle) : null) ??
    (typeof ld?.name === "string" ? decode(ld.name) : null) ??
    metaContent(html, ["og:title", "twitter:title"]) ??
    (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]+)<\/title>/i)![1]) : null);

  let price = precioJsonLd(offer?.price ?? offer?.lowPrice);
  let currency = (typeof offer?.priceCurrency === "string" ? offer.priceCurrency : null) ?? metaContent(html, ["product:price:currency", "og:price:currency"]);
  if (price === null) {
    const meta = metaContent(html, ["product:price:amount", "og:price:amount"]);
    if (meta) price = precioJsonLd(meta);
  }
  if (price === null && (tienda === "amazon" || tienda === "amazon-es")) {
    const a = precioAmazon(html, tienda);
    if (a) {
      price = a.precio;
      currency = a.moneda ?? currency;
    }
  }
  // Último recurso: datos internos de la página, solo si está en pesos colombianos
  if (price === null && /["']COP["']|currency["']?\s*:\s*["']COP/i.test(html)) {
    const m = html.match(/["'](?:price|priceAmount|salePrice|priceValue|currentPrice)["']\s*:\s*["']?(\d{4,}(?:[.,]\d{1,3})*)["']?/i);
    const guess = m ? leerMonto(m[1], "es") : null;
    if (guess && guess >= 1000 && guess <= 200_000_000) {
      price = guess;
      currency = currency ?? "COP";
    }
  }
  const moneda = currency ? currency.toUpperCase() : tienda === "amazon" && price !== null ? "USD" : price !== null && tienda !== "otra" ? "COP" : null;

  return {
    url,
    title: tituloCrudo ? limpiarTitulo(tituloCrudo, tienda, url).slice(0, 160) : null,
    image: pickImage(html, url, ld),
    price: price !== null ? redondear(price, moneda) : null,
    currency: moneda,
    siteName: metaContent(html, ["og:site_name"]) ?? (tienda !== "otra" ? NOMBRE_TIENDA[tienda] : null),
    description: metaContent(html, ["og:description", "description"])?.slice(0, 280) ?? null,
    source: "pagina",
    bloqueado: false,
    tienda: NOMBRE_TIENDA[tienda],
  };
}

export async function readProduct(raw: string): Promise<ProductPreview> {
  const u = await assertPublicUrl(raw.trim());
  const mlId = mercadoLibreId(u);
  if (mlId) {
    const ml = await fromMercadoLibre(mlId, u.toString());
    if (ml) return ml;
  }
  let res: { url: string; body: string; contentType: string; status: number };
  try {
    res = await safeFetch(u.toString(), "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8");
  } catch (e) {
    // La tienda pidió verificación: se dice claro y se conserva lo que se pueda (el nombre del enlace)
    if (e instanceof PreviewError && e.bloqueo) return fromHtml("<title>Just a moment...</title>", e.bloqueo);
    throw e;
  }
  if (res.status === 404) throw new PreviewError("No encontramos ese producto en la tienda. Revisa el enlace.", 422);
  if (res.contentType && !/html|xml/i.test(res.contentType)) throw new PreviewError("Ese enlace no es una página de producto.", 422);
  const p = fromHtml(res.body, res.url);
  if (p.bloqueado) return p;
  // Una página que solo trae el nombre de la tienda no es un producto
  const onlySiteName = p.title && !p.image && !p.price && p.title.length < 30 && /^[\w\s.&-]+$/.test(p.title);
  if ((!p.title && !p.image && !p.price) || onlySiteName) throw new PreviewError("No encontramos datos del producto en esa página.", 422);
  return p;
}
