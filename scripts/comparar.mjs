/**
 * Compara dos carpetas de capturas PNG píxel a píxel (sin dependencias).
 *   node scripts/comparar.mjs docs/regresion/antes docs/regresion/fase1
 * Imprime, por archivo, si es idéntico o cuántos píxeles cambian y en qué zona.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";

function decodificar(ruta) {
  const b = readFileSync(ruta);
  let i = 8;
  let w = 0;
  let h = 0;
  let tipo = 0;
  const datos = [];
  while (i < b.length) {
    const largo = b.readUInt32BE(i);
    const t = b.toString("ascii", i + 4, i + 8);
    if (t === "IHDR") {
      w = b.readUInt32BE(i + 8);
      h = b.readUInt32BE(i + 12);
      tipo = b[i + 17];
    }
    if (t === "IDAT") datos.push(b.subarray(i + 8, i + 8 + largo));
    i += 12 + largo;
  }
  const r = inflateSync(Buffer.concat(datos));
  const bpp = tipo === 6 ? 4 : 3;
  const fila = w * bpp;
  const o = Buffer.alloc(h * fila);
  for (let y = 0; y < h; y++) {
    const f = r[y * (fila + 1)];
    const src = y * (fila + 1) + 1;
    for (let x = 0; x < fila; x++) {
      const a = x >= bpp ? o[y * fila + x - bpp] : 0;
      const up = y ? o[(y - 1) * fila + x] : 0;
      const c = x >= bpp && y ? o[(y - 1) * fila + x - bpp] : 0;
      let v = r[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const p = a + up - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      o[y * fila + x] = v & 255;
    }
  }
  return { w, h, bpp, o };
}

const [antes, despues] = process.argv.slice(2);
for (const f of readdirSync(antes).filter((x) => x.endsWith(".png")).sort()) {
  const otro = join(despues, f);
  if (!existsSync(otro)) {
    console.log(`falta     ${f}`);
    continue;
  }
  const A = readFileSync(join(antes, f));
  const B = readFileSync(otro);
  if (A.equals(B)) {
    console.log(`idéntica  ${f}`);
    continue;
  }
  const a = decodificar(join(antes, f));
  const b = decodificar(otro);
  if (a.h !== b.h || a.w !== b.w) {
    console.log(`DIFIERE   ${f}  tamaño ${a.w}×${a.h} → ${b.w}×${b.h}`);
    continue;
  }
  let n = 0;
  let x0 = 1e9;
  let x1 = 0;
  let y0 = 1e9;
  let y1 = 0;
  for (let y = 0; y < a.h; y++)
    for (let x = 0; x < a.w; x++) {
      const k = (y * a.w + x) * a.bpp;
      if (a.o[k] !== b.o[k] || a.o[k + 1] !== b.o[k + 1] || a.o[k + 2] !== b.o[k + 2]) {
        n++;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
  console.log(`DIFIERE   ${f}  ${n} px en x ${x0}–${x1}, y ${y0}–${y1}`);
}
