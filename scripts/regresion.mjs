/**
 * Capturas de regresión visual (sin dependencias): abre Edge/Chrome sin ventana por CDP y guarda
 * cada pantalla en modo demo, en 1440×900 y 375×812, en claro y oscuro, sin animaciones.
 *
 *   node scripts/regresion.mjs <carpeta-salida> [url-base] [--alto 800x600]
 *   node scripts/regresion.mjs docs/regresion/antes http://localhost:5209
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const salida = process.argv[2] ?? "docs/regresion/antes";
const base = (process.argv[3] ?? "http://localhost:5209").replace(/\/$/, "");
const extra = process.argv.includes("--800") ? [{ nombre: "800", w: 800, h: 600, movil: false }] : [];

// RUTAS="/configuracion?seccion=progreso,/salud" para capturar solo esas
const RUTAS = process.env.RUTAS ? process.env.RUTAS.split(",") : ["/", "/finanzas", "/proyectos", "/salud", "/wishlist", "/objetivos", "/calendario", "/progreso", "/configuracion"];
const TAMANOS = [{ nombre: "1440", w: 1440, h: 900, movil: false }, { nombre: "375", w: 375, h: 812, movil: true }, ...extra];
const TEMAS = ["claro", "oscuro"];

const NAVEGADORES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
];
const exe = NAVEGADORES.find((p) => existsSync(p));
if (!exe) throw new Error("No encontré Edge ni Chrome");

const PUERTO = 9300 + Math.floor(Math.random() * 400);
const perfil = mkdtempSync(join(tmpdir(), "lifeos-regresion-"));
const nav = spawn(exe, [`--headless=new`, `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`, "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function conectar() {
  for (let k = 0; k < 50; k++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
      const pag = lista.find((t) => t.type === "page");
      if (pag) return pag.webSocketDebuggerUrl;
    } catch {
      /* todavía arrancando */
    }
    await esperar(200);
  }
  throw new Error("El navegador no respondió");
}

const ws = new WebSocket(await conectar());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let n = 0;
const pendientes = new Map();
const eventos = [];
ws.addEventListener("message", (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pendientes.has(d.id)) {
    const { ok, ko } = pendientes.get(d.id);
    pendientes.delete(d.id);
    d.error ? ko(new Error(d.error.message)) : ok(d.result);
  } else if (d.method) eventos.push(d);
});
const cdp = (method, params = {}) =>
  new Promise((ok, ko) => {
    const id = ++n;
    pendientes.set(id, { ok, ko });
    ws.send(JSON.stringify({ id, method, params }));
  });

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });

mkdirSync(salida, { recursive: true });
const errores = [];

for (const tema of TEMAS) {
  const guion = await cdp("Page.addScriptToEvaluateOnNewDocument", {
    source: `try{localStorage.setItem("lifeos:ui:theme","${tema}");localStorage.setItem("lifeos:onboarding-done","1");localStorage.setItem("lifeos:tutorial","visto")}catch(e){}`,
  });
  for (const t of TAMANOS) {
    await cdp("Emulation.setDeviceMetricsOverride", { width: t.w, height: t.h, deviceScaleFactor: 1, mobile: t.movil });
    await cdp("Emulation.setTouchEmulationEnabled", { enabled: t.movil });
    for (const ruta of RUTAS) {
      eventos.length = 0;
      await cdp("Page.navigate", { url: `${base}${ruta}${ruta.includes("?") ? "&" : "?"}demo=1` });
      for (let k = 0; k < 100 && !eventos.some((e) => e.method === "Page.loadEventFired"); k++) await esperar(100);
      // Espera a que cargue la app (sin esqueleto) y cierra cualquier pop-up del día
      for (let k = 0; k < 60; k++) {
        const { result } = await cdp("Runtime.evaluate", { expression: `!document.querySelector('[aria-busy="true"]') && !!document.querySelector("main")` });
        if (result.value) break;
        await esperar(150);
      }
      await esperar(900);
      for (let k = 0; k < 3; k++) {
        await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
        await esperar(250);
      }
      await cdp("Runtime.evaluate", { expression: "window.scrollTo(0,0); document.activeElement && document.activeElement.blur && document.activeElement.blur()" });
      await esperar(400);
      const { result: alto } = await cdp("Runtime.evaluate", { expression: "Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)" });
      const { result: ancho } = await cdp("Runtime.evaluate", { expression: "document.documentElement.scrollWidth" });
      if (ancho.value > t.w) errores.push(`${ruta} ${t.nombre} ${tema}: scroll horizontal (${ancho.value}px)`);
      const h = Math.min(alto.value, 8000);
      const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: t.w, height: h, scale: 1 } });
      const nombre = `${ruta === "/" ? "inicio" : ruta.slice(1).replace(/[?=&/]+/g, "-")}-${t.nombre}-${tema}.png`;
      writeFileSync(join(salida, nombre), Buffer.from(data, "base64"));
      console.log("ok", nombre);
    }
  }
  await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier: guion.identifier });
}

ws.close();
nav.kill();
await esperar(500);
try {
  rmSync(perfil, { recursive: true, force: true });
} catch {
  /* el navegador aún suelta el perfil */
}
if (errores.length) console.log("\nAvisos:\n" + errores.join("\n"));
