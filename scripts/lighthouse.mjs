/**
 * Lighthouse móvil N veces sobre una URL y muestra la mediana (rendimiento y accesibilidad).
 *   node scripts/lighthouse.mjs http://localhost:3101/?demo=1 3 [carpeta-para-guardar-el-último-reporte]
 * Usa `npx lighthouse@12` (se descarga la primera vez).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, copyFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, nArg = "3", guardar] = process.argv.slice(2);
const n = Number(nArg);
const dir = mkdtempSync(join(tmpdir(), "lh-"));
const corridas = [];
for (let i = 0; i < n; i++) {
  const base = join(dir, `r${i}`);
  try {
    execFileSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["-y", "lighthouse@12", url, "--form-factor=mobile", "--only-categories=performance,accessibility,best-practices", "--output=json", "--output=html", `--output-path=${base}`, "--chrome-flags=--headless=new", "--quiet"],
      { stdio: "ignore", shell: process.platform === "win32" },
    );
  } catch {
    /* Lighthouse a veces sale con código ≠ 0 aunque escribe el reporte */
  }
  const r = JSON.parse(readFileSync(`${base}.report.json`, "utf8"));
  corridas.push({
    base,
    perf: Math.round(r.categories.performance.score * 100),
    a11y: Math.round(r.categories.accessibility.score * 100),
    bp: Math.round(r.categories["best-practices"].score * 100),
    lcp: r.audits["largest-contentful-paint"].numericValue,
    tbt: r.audits["total-blocking-time"].numericValue,
    fcp: r.audits["first-contentful-paint"].numericValue,
  });
  const c = corridas.at(-1);
  console.log(`corrida ${i + 1}: rendimiento ${c.perf} · accesibilidad ${c.a11y} · LCP ${(c.lcp / 1000).toFixed(1)} s · TBT ${Math.round(c.tbt)} ms · FCP ${(c.fcp / 1000).toFixed(1)} s`);
}
const orden = [...corridas].sort((a, b) => a.perf - b.perf);
const med = orden[Math.floor(orden.length / 2)];
console.log(`MEDIANA: rendimiento ${med.perf} · accesibilidad ${med.a11y} · buenas prácticas ${med.bp}`);
if (guardar) {
  mkdirSync(guardar, { recursive: true });
  copyFileSync(`${med.base}.report.html`, join(guardar, `${new URL(url).pathname.replace(/\W+/g, "") || "inicio"}.report.html`));
}
