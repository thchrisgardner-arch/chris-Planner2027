/**
 * Captura en PNG cada elemento que tenga un atributo (sin dependencias, Edge/Chrome sin ventana).
 *   node scripts/capturar-elementos.mjs <url> <atributo> <carpeta> [plantilla] [ancho]
 *   node scripts/capturar-elementos.mjs "http://localhost:5209/dev/asistentes?base=1" data-base docs/asistentes/v2 "{v}-base.png"
 * La plantilla usa {v} para el valor del atributo.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, attr, salida, plantilla = "{v}.png", ancho = "1440"] = process.argv.slice(2);
const log = (m) => process.stderr.write(`${m}\n`);
const exe = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((p) => existsSync(p));
const puerto = 9500 + Math.floor(Math.random() * 300);
const nav = spawn(exe, ["--headless=new", `--remote-debugging-port=${puerto}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "cap-"))}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const salir = (c) => {
  nav.kill();
  process.exit(c);
};
setTimeout(() => {
  log("tiempo agotado");
  salir(2);
}, 90000).unref();

let wsUrl = null;
for (let k = 0; k < 60 && !wsUrl; k++) {
  try {
    const p = (await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json()).find((t) => t.type === "page");
    if (p) wsUrl = p.webSocketDebuggerUrl;
  } catch {
    /* todavía arrancando */
  }
  if (!wsUrl) await esperar(250);
}
if (!wsUrl) {
  log("no se pudo conectar con el navegador");
  salir(1);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
log("conectado");
let n = 0;
const pend = new Map();
ws.addEventListener("message", (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) {
    pend.get(d.id)(d);
    pend.delete(d.id);
  }
});
const cdp = (method, params = {}) =>
  new Promise((ok, ko) => {
    const id = ++n;
    pend.set(id, (d) => (d.error ? ko(new Error(d.error.message)) : ok(d.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });

await cdp("Page.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: Number(ancho), height: 1000, deviceScaleFactor: 1, mobile: false });
await cdp("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await cdp("Page.navigate", { url });
log("navegando");
// Espera a que existan los elementos (el servidor de desarrollo compila al pedir)
let lista = [];
for (let k = 0; k < 60; k++) {
  await esperar(1000);
  const { result } = await cdp("Runtime.evaluate", {
    expression: `JSON.stringify([...document.querySelectorAll('[${attr}]')].map(e => { const r = e.getBoundingClientRect(); return { v: e.getAttribute('${attr}'), x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; }))`,
  });
  lista = JSON.parse(result.value ?? "[]");
  if (lista.length) break;
}
// Con la página ya hidratada (lee sus parámetros), se vuelven a medir los elementos
await esperar(4000);
{
  const { result } = await cdp("Runtime.evaluate", {
    expression: `JSON.stringify([...document.querySelectorAll('[${attr}]')].map(e => { const r = e.getBoundingClientRect(); return { v: e.getAttribute('${attr}'), x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; }))`,
  });
  lista = JSON.parse(result.value ?? "[]");
}
log(`${lista.length} elementos`);
mkdirSync(salida, { recursive: true });
for (const el of lista) {
  const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: el.x, y: el.y, width: el.w, height: el.h, scale: 1 } });
  const nombre = plantilla.replace("{v}", el.v);
  writeFileSync(join(salida, nombre), Buffer.from(data, "base64"));
  log(`ok ${nombre}`);
}
ws.close();
salir(0);
