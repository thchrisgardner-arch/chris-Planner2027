/**
 * .zip mínimo, sin dependencias, armado en el navegador. Guarda los archivos sin recomprimir
 * (método «store»): el audio grabado (webm, m4a) ya viene comprimido, así que comprimirlo otra vez
 * casi no ahorra espacio y una librería (JSZip ~30 KB) no se justifica para esto.
 * Nombres en UTF-8 (tildes y eñes se ven bien en Windows y macOS).
 */

const TABLA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface EntradaZip {
  nombre: string;
  datos: Uint8Array;
  fecha?: Date;
}

function fechaDos(d: Date) {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    dia: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export function crearZip(entradas: EntradaZip[]): Uint8Array {
  const utf8 = new TextEncoder();
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const e of entradas) {
    const nombre = utf8.encode(e.nombre);
    const crc = crc32(e.datos);
    const { hora, dia } = fechaDos(e.fecha ?? new Date());

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // versión necesaria
    local.setUint16(6, 0x0800, true); // nombre en UTF-8
    local.setUint16(8, 0, true); // sin compresión
    local.setUint16(10, hora, true);
    local.setUint16(12, dia, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, e.datos.length, true);
    local.setUint32(22, e.datos.length, true);
    local.setUint16(26, nombre.length, true);
    local.setUint16(28, 0, true);
    locales.push(new Uint8Array(local.buffer), nombre, e.datos);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, hora, true);
    central.setUint16(14, dia, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, e.datos.length, true);
    central.setUint32(24, e.datos.length, true);
    central.setUint16(28, nombre.length, true);
    central.setUint32(42, desplazamiento, true);
    centrales.push(new Uint8Array(central.buffer), nombre);

    desplazamiento += 30 + nombre.length + e.datos.length;
  }

  const tamCentral = centrales.reduce((n, p) => n + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, entradas.length, true);
  fin.setUint16(10, entradas.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, desplazamiento, true);

  const partes = [...locales, ...centrales, new Uint8Array(fin.buffer)];
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}
