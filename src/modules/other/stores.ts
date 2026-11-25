/**
 * Tiendas, comercios y bancos con su logo oficial.
 *
 * Fuentes del ícono (verificadas en el navegador el 2026-11-24):
 *  1. El ícono que cada marca publica en su propio dominio o CDN.
 *  2. Si no publica uno accesible, el favicon oficial de su dominio servido por Google (s2/favicons).
 * Si todas fallan, StoreLogo muestra la inicial con el color de marca.
 * Samsung e IKEA usan su logotipo vectorial oficial (Simple Icons, CC0): no exponen un ícono nítido.
 *
 * `aliases` sirve para reconocer el comercio en la descripción de un movimiento ("Tienda D1", "Pago Netflix").
 * `wishlist` marca las tiendas que aparecen en el selector de la Wishlist.
 */
export type StoreGroup = "tienda" | "supermercado" | "salud" | "comida" | "transporte" | "servicios" | "suscripcion" | "gimnasio" | "banco" | "apuestas";

export interface Store {
  id: string;
  name: string;
  group: StoreGroup;
  /** Dominios para reconocer la tienda desde un enlace */
  domains: string[];
  /** Palabras para reconocerla en un texto (sin tildes, minúsculas) */
  aliases: string[];
  icons: string[];
  color: string;
  wishlist?: boolean;
  svg?: "samsung" | "ikea";
}

const g = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

type Def = Omit<Store, "icons" | "aliases" | "domains"> & { domain?: string; own?: string[]; aliases?: string[]; domains?: string[] };

/**
 * Logos propios: para las marcas sin logo verificable en internet (Morse, Plata, PSE),
 * guarda el oficial en public/logos/<id>.svg o .png y se usará automáticamente (también Miloto y Baloto).
 */
const local = (id: string) => [`/logos/${id}.svg`, `/logos/${id}.png`];

function s(def: Def): Store {
  const { domain, own = [], aliases = [], domains = [], ...rest } = def;
  return {
    ...rest,
    domains: domain ? [domain, ...domains] : domains,
    aliases: [normalize(def.name), ...aliases],
    icons: def.svg ? [] : [...own, ...(domain ? [g(domain)] : local(def.id))],
  };
}

export const STORES: Store[] = [
  /* ── Tiendas (también en la Wishlist) ── */
  s({ id: "amazon", name: "Amazon", group: "tienda", wishlist: true, domain: "amazon.com", domains: ["amazon.", "amzn.to", "a.co"], own: ["https://www.amazon.com/favicon.ico"], color: "#FF9900" }),
  s({ id: "mercadolibre", name: "Mercado Libre", group: "tienda", wishlist: true, domain: "mercadolibre.com.co", domains: ["mercadolibre.", "mercadolivre.", "meli.la"], aliases: ["mercadolibre", "mercado pago", "mercadopago"], own: ["https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/6.6.73/mercadolibre/180x180.png", "https://www.mercadolibre.com.co/favicon.ico"], color: "#FFE600" }),
  s({ id: "falabella", name: "Falabella", group: "tienda", wishlist: true, domain: "falabella.com.co", domains: ["falabella."], own: ["https://www.falabella.com.co/apple-touch-icon.png"], color: "#AAD500" }),
  s({ id: "exito", name: "Éxito", group: "supermercado", wishlist: true, domain: "exito.com", aliases: ["almacenes exito"], own: ["https://exito.vteximg.com.br/arquivos/favicon.ico"], color: "#FFE600" }),
  s({ id: "alkosto", name: "Alkosto", group: "tienda", wishlist: true, domain: "alkosto.com", domains: ["alkosto."], own: ["https://www.alkosto.com/favicon.ico"], color: "#004691" }),
  s({ id: "ktronix", name: "Ktronix", group: "tienda", wishlist: true, domain: "ktronix.com", domains: ["ktronix."], own: ["https://www.ktronix.com/favicon.ico"], color: "#0A2D6E" }),
  s({ id: "homecenter", name: "Homecenter", group: "tienda", wishlist: true, domain: "homecenter.com.co", domains: ["homecenter.", "sodimac."], aliases: ["sodimac"], own: ["https://www.homecenter.com.co/favicon.ico"], color: "#E2001A" }),
  s({ id: "ikea", name: "IKEA", group: "tienda", wishlist: true, domain: "ikea.com", domains: ["ikea."], color: "#0058A3", svg: "ikea" }),
  s({ id: "apple", name: "Apple", group: "tienda", wishlist: true, domain: "apple.com", aliases: ["icloud", "app store"], own: ["https://www.apple.com/apple-touch-icon.png"], color: "#000000" }),
  s({ id: "samsung", name: "Samsung", group: "tienda", wishlist: true, domain: "samsung.com", color: "#1428A0", svg: "samsung" }),
  s({ id: "nike", name: "Nike", group: "tienda", wishlist: true, domain: "nike.com", own: ["https://www.nike.com/apple-touch-icon.png"], color: "#111111" }),
  s({ id: "adidas", name: "Adidas", group: "tienda", wishlist: true, domain: "adidas.co", domains: ["adidas."], own: ["https://www.adidas.co/apple-touch-icon.png"], color: "#000000" }),
  s({ id: "zara", name: "Zara", group: "tienda", wishlist: true, domain: "zara.com", own: ["https://www.zara.com/favicon.ico"], color: "#000000" }),
  s({ id: "hm", name: "H&M", group: "tienda", wishlist: true, domain: "hm.com", aliases: ["h y m", "hym"], own: ["https://www2.hm.com/favicon.ico"], color: "#E50010" }),
  s({ id: "temu", name: "Temu", group: "tienda", wishlist: true, domain: "temu.com", own: ["https://www.temu.com/apple-touch-icon.png"], color: "#FB7701" }),
  s({ id: "shein", name: "Shein", group: "tienda", wishlist: true, domain: "shein.com.co", domains: ["shein."], own: ["https://www.shein.com.co/favicon.ico"], color: "#000000" }),
  s({ id: "rappi", name: "Rappi", group: "comida", wishlist: true, domain: "rappi.com.co", domains: ["rappi."], own: ["https://www.rappi.com.co/favicon.ico"], color: "#FF441F" }),

  /* ── Supermercados ── */
  s({ id: "d1", name: "D1", group: "supermercado", domain: "tiendasd1.com", domains: ["d1.com.co"], aliases: ["tiendas d1", "tienda d1"], color: "#E30613" }),
  s({ id: "ara", name: "Ara", group: "supermercado", domain: "aratiendas.com", aliases: ["tiendas ara", "tienda ara"], color: "#E30613" }),
  s({ id: "olimpica", name: "Olímpica", group: "supermercado", domain: "olimpica.com", aliases: ["sao"], color: "#E30613" }),
  s({ id: "carulla", name: "Carulla", group: "supermercado", domain: "carulla.com", color: "#006341" }),
  s({ id: "jumbo", name: "Jumbo", group: "supermercado", domain: "tiendasjumbo.co", color: "#00A651" }),
  s({ id: "pricesmart", name: "PriceSmart", group: "supermercado", domain: "pricesmart.com", aliases: ["price smart"], color: "#0057A8" }),

  /* ── Salud ── */
  s({ id: "farmatodo", name: "Farmatodo", group: "salud", domain: "farmatodo.com.co", color: "#0046AD" }),
  s({ id: "cruzverde", name: "Cruz Verde", group: "salud", domain: "cruzverde.com.co", color: "#00A651" }),

  /* ── Comida ── */
  s({ id: "starbucks", name: "Starbucks", group: "comida", domain: "starbucks.com.co", color: "#00704A" }),
  s({ id: "mcdonalds", name: "McDonald's", group: "comida", domain: "mcdonalds.com.co", aliases: ["mcdonalds", "mc donalds"], color: "#FFC72C" }),
  s({ id: "kfc", name: "KFC", group: "comida", domain: "kfc.com.co", color: "#E4002B" }),
  s({ id: "dominos", name: "Domino's", group: "comida", domain: "dominos.com.co", aliases: ["dominos"], color: "#006491" }),

  /* ── Transporte y gasolina ── */
  s({ id: "uber", name: "Uber", group: "transporte", domain: "uber.com", aliases: ["uber eats"], color: "#000000" }),
  s({ id: "didi", name: "DiDi", group: "transporte", domain: "didiglobal.com", color: "#FC4C02" }),
  s({ id: "terpel", name: "Terpel", group: "transporte", domain: "terpel.com", color: "#E30613" }),

  /* ── Servicios y telefonía ── */
  s({ id: "claro", name: "Claro", group: "servicios", domain: "claro.com.co", color: "#DA291C" }),
  s({ id: "movistar", name: "Movistar", group: "servicios", domain: "movistar.co", color: "#019DF4" }),
  s({ id: "tigo", name: "Tigo", group: "servicios", domain: "tigo.com.co", aliases: ["une"], color: "#00377B" }),
  s({ id: "enel", name: "Enel", group: "servicios", domain: "enel.com", aliases: ["codensa", "enel codensa"], color: "#0555FA" }),
  s({ id: "cinecolombia", name: "Cine Colombia", group: "servicios", domain: "cinecolombia.com", color: "#E30613" }),
  s({ id: "cinemark", name: "Cinemark", group: "servicios", domain: "cinemark.com.co", color: "#C8102E" }),

  /* ── Suscripciones ── */
  s({ id: "netflix", name: "Netflix", group: "suscripcion", domain: "netflix.com", color: "#E50914" }),
  s({ id: "spotify", name: "Spotify", group: "suscripcion", domain: "spotify.com", color: "#1DB954" }),
  s({ id: "disneyplus", name: "Disney+", group: "suscripcion", domain: "disneyplus.com", aliases: ["disney plus", "disney"], color: "#113CCF" }),
  s({ id: "max", name: "Max", group: "suscripcion", domain: "max.com", aliases: ["hbo max", "hbo"], color: "#002BE7" }),
  s({ id: "primevideo", name: "Prime Video", group: "suscripcion", domain: "primevideo.com", aliases: ["amazon prime"], color: "#00A8E1" }),
  s({ id: "youtube", name: "YouTube", group: "suscripcion", domain: "youtube.com", aliases: ["youtube premium"], color: "#FF0000" }),
  s({ id: "openai", name: "ChatGPT", group: "suscripcion", domain: "openai.com", aliases: ["openai", "chat gpt"], color: "#000000" }),
  s({ id: "adobe", name: "Adobe", group: "suscripcion", domain: "adobe.com", aliases: ["creative cloud"], color: "#FA0F00" }),
  s({ id: "canva", name: "Canva", group: "suscripcion", domain: "canva.com", color: "#00C4CC" }),
  s({ id: "figma", name: "Figma", group: "suscripcion", domain: "figma.com", color: "#000000" }),
  s({ id: "notion", name: "Notion", group: "suscripcion", domain: "notion.so", color: "#000000" }),

  /* ── Apuestas y loterías ── */
  // Baloto: primero el logo guardado en public/logos; si no existe, el ícono oficial de baloto.com (16 px).
  s({ id: "baloto", name: "Baloto", group: "apuestas", domains: ["baloto.com"], own: ["/logos/baloto.png", "/logos/baloto.svg", "https://www.baloto.com/favicon.ico"], color: "#0033A0" }),
  // Miloto: sin logo oficial verificable en internet → inicial, o public/logos/miloto.(svg|png).
  s({ id: "miloto", name: "Miloto", group: "apuestas", color: "#111412" }),

  /* ── Gimnasios ── */
  s({ id: "smartfit", name: "Smart Fit", group: "gimnasio", domain: "smartfit.com.co", aliases: ["smartfit"], color: "#FFB612" }),
  s({ id: "bodytech", name: "Bodytech", group: "gimnasio", domain: "bodytech.com.co", aliases: ["body tech"], color: "#E30613" }),

  /* ── Bancos y billeteras ── */
  s({ id: "bancolombia", name: "Bancolombia", group: "banco", domain: "bancolombia.com", own: ["https://www.bancolombia.com/favicon.ico"], color: "#FDDA24" }),
  s({ id: "nequi", name: "Nequi", group: "banco", domain: "nequi.com.co", color: "#DA0081" }),
  s({ id: "davivienda", name: "Davivienda", group: "banco", domain: "davivienda.com", color: "#ED1C27" }),
  s({ id: "daviplata", name: "DaviPlata", group: "banco", domain: "daviplata.com", color: "#ED1C27" }),
  s({ id: "nu", name: "Nu", group: "banco", domain: "nu.com.co", own: ["https://nu.com.co/favicon.ico"], aliases: ["nubank", "nu colombia"], color: "#820AD1" }),
  s({ id: "bbva", name: "BBVA", group: "banco", domain: "bbva.com.co", color: "#004481" }),
  s({ id: "bancodebogota", name: "Banco de Bogotá", group: "banco", domain: "bancodebogota.com", aliases: ["banco bogota"], color: "#003B71" }),
  s({ id: "occidente", name: "Banco de Occidente", group: "banco", domain: "bancodeoccidente.com.co", aliases: ["occidente"], color: "#0033A0" }),
  s({ id: "itau", name: "Itaú", group: "banco", domain: "itau.co", color: "#EC7000" }),
  s({ id: "lulo", name: "Lulo Bank", group: "banco", domain: "lulobank.com", aliases: ["lulo"], color: "#C6F432" }),
  s({ id: "morse", name: "Morse", group: "banco", color: "#111412" }),
  s({ id: "plata", name: "Plata", group: "banco", aliases: ["banco plata", "plata card"], color: "#FF5A1F" }),
  s({ id: "rappipay", name: "RappiPay", group: "banco", domain: "rappipay.co", aliases: ["rappi pay"], color: "#FF441F" }),
];

/** Medios de pago con logo de marca */
export const PAYMENT_BRANDS: Store[] = [
  s({ id: "pse", name: "PSE", group: "banco", color: "#0B5BA8" }),
];

export const WISHLIST_STORES = STORES.filter((st) => st.wishlist);

/** Bancos sugeridos al crear una cuenta, con el tipo de cuenta más común. */
export const BANK_PRESETS: { id: string; type: "banco" | "billetera" | "ahorros" | "tarjeta_credito" }[] = [
  { id: "bancolombia", type: "banco" },
  { id: "nequi", type: "billetera" },
  { id: "nu", type: "banco" },
  { id: "morse", type: "banco" },
  { id: "plata", type: "banco" },
  { id: "daviplata", type: "billetera" },
  { id: "davivienda", type: "banco" },
  { id: "bbva", type: "banco" },
  { id: "bancodebogota", type: "banco" },
  { id: "lulo", type: "banco" },
  { id: "rappipay", type: "billetera" },
];

export const findBrand = (id: string | null | undefined) => (id ? [...STORES, ...PAYMENT_BRANDS].find((st) => st.id === id) : undefined);

export const findStore = (id: string | null | undefined) => (id ? STORES.find((st) => st.id === id) : undefined);

/** minúsculas y sin tildes, para comparar textos */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Reconoce la tienda a partir del enlace de un producto. */
export function detectStore(link: string): Store | undefined {
  let host: string;
  try {
    host = new URL(link).hostname.toLowerCase().replace(/^www\d?\./, "");
  } catch {
    return undefined;
  }
  return STORES.find((st) =>
    st.domains.some((d) => (d.endsWith(".") ? host.startsWith(d) || host.includes(`.${d}`) : host === d || host.endsWith(`.${d}`))),
  );
}

const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Reconoce un comercio o banco por su nombre dentro de un texto
 * ("Tienda D1" → D1, "Pago Netflix" → Netflix, "Bancolombia ahorros" → Bancolombia).
 * Gana la coincidencia más larga para no confundir "Rappi" con "RappiPay".
 */
export function detectStoreInText(text: string | null | undefined, groups?: StoreGroup[]): Store | undefined {
  if (!text) return undefined;
  const t = normalize(text);
  let best: { store: Store; len: number } | undefined;
  for (const st of STORES) {
    if (groups && !groups.includes(st.group)) continue;
    for (const alias of st.aliases) {
      if (alias.length < 2) continue;
      const re = new RegExp(`(^|[^a-z0-9])${escape(alias)}([^a-z0-9]|$)`);
      if (re.test(t) && (!best || alias.length > best.len)) best = { store: st, len: alias.length };
    }
  }
  return best?.store;
}
