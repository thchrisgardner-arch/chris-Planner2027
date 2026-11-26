/* LIFE for LIFE · service worker: funciona sin conexión (los datos ya viven en el dispositivo) y avisos. */
/* Se registra como /sw.js?cache=1 en producción. En desarrollo (sin ?cache=1) no guarda nada en
   caché, para no interferir con la recarga en vivo; solo atiende los avisos. */
const CACHEAR = new URL(self.location.href).searchParams.get("cache") === "1";
const VERSION = "lifeos-v2";
const ESTATICOS = `${VERSION}-estaticos`;
const PAGINAS = `${VERSION}-paginas`;
const RUTAS = ["/", "/finanzas", "/proyectos", "/salud", "/wishlist", "/objetivos", "/calendario", "/progreso", "/configuracion"];

/** Guarda una página y los archivos /_next/static que usa (así abre sin conexión aunque no se haya visitado). */
async function precargar(ruta) {
  const pag = await caches.open(PAGINAS);
  const est = await caches.open(ESTATICOS);
  const r = await fetch(ruta, { credentials: "same-origin", cache: "no-store" });
  if (!r.ok) return;
  const html = await r.clone().text();
  await pag.put(ruta, r);
  const recursos = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])];
  await Promise.all(
    recursos.map(async (u) => {
      if (await est.match(u)) return;
      const x = await fetch(u).catch(() => null);
      if (x && x.ok) await est.put(u, x);
    }),
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  if (!CACHEAR) return;
  event.waitUntil(Promise.all(RUTAS.map((r) => precargar(r).catch(() => {}))));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(nombres.filter((n) => n.startsWith("lifeos-") && (!CACHEAR || !n.startsWith(VERSION))).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (!CACHEAR) return;
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  // Archivos con huella (no cambian nunca): primero la caché
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(ESTATICOS).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const r = await fetch(req);
        if (r.ok) c.put(req, r.clone());
        return r;
      }),
    );
    return;
  }

  // Íconos, logos e imágenes propias: la caché responde y se actualiza en segundo plano
  if (url.pathname.startsWith("/icono/") || url.pathname.startsWith("/logos/") || /\.(png|svg|ico|webp|jpg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(ESTATICOS).then(async (c) => {
        const hit = await c.match(req);
        const red = fetch(req)
          .then((r) => {
            if (r.ok) c.put(req, r.clone());
            return r;
          })
          .catch(() => hit || Response.error());
        return hit || red;
      }),
    );
    return;
  }

  // Páginas y datos de navegación (RSC): primero la red; sin conexión, lo último guardado
  const esPagina = req.mode === "navigate";
  const esRSC = req.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (!esPagina && !esRSC) return;
  event.respondWith(
    (async () => {
      const c = await caches.open(PAGINAS);
      try {
        const r = await fetch(req);
        if (r.ok && esPagina) c.put(url.pathname, r.clone());
        else if (r.ok) c.put(req, r.clone());
        return r;
      } catch (e) {
        const hit = esPagina ? (await c.match(url.pathname)) || (await c.match("/")) : await c.match(req);
        if (hit) return hit;
        // Sin conexión y sin datos guardados de esa sección: el navegador carga la página completa
        if (esRSC) return Response.error();
        throw e;
      }
    })(),
  );
});

/* ═════════ Avisos ═════════ */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "LIFE for LIFE", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "LIFE for LIFE";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icono/192",
      badge: "/icono/96",
      tag: data.tag || "lifeos",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
