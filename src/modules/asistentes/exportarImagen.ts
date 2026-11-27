/**
 * Exporta la tarjeta "Resumen de la semana" como PNG, dibujada en el cliente con Canvas
 * (sin librerías). El personaje se copia del SVG en pantalla con sus colores ya resueltos.
 */
export interface FilaResumen {
  label: string;
  valor: string;
}

function svgComoImagen(svg: SVGSVGElement): Promise<HTMLImageElement> {
  const clon = svg.cloneNode(true) as SVGSVGElement;
  const orig = svg.querySelectorAll("*");
  const copia = clon.querySelectorAll("*");
  orig.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const c = copia[i] as SVGElement;
    if (!c) return;
    if (cs.fill && cs.fill !== "none") c.setAttribute("fill", cs.fill);
    if (cs.fill === "none") c.setAttribute("fill", "none");
    if (cs.stroke && cs.stroke !== "none") {
      c.setAttribute("stroke", cs.stroke);
      c.setAttribute("stroke-width", cs.strokeWidth);
      c.setAttribute("stroke-linecap", cs.strokeLinecap);
    }
    if (cs.opacity !== "1") c.setAttribute("opacity", cs.opacity);
    c.removeAttribute("class");
  });
  clon.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clon.setAttribute("width", "400");
  clon.setAttribute("height", "400");
  const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clon));
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

function redondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** `svg2`: un segundo personaje (p. ej. el cierre de un proyecto, que lo dicen Tuerca y Centavo juntos) */
export async function descargarResumen({ titulo, filas, svg, svg2, archivo }: { titulo: string; filas: FilaResumen[]; svg: SVGSVGElement | null; svg2?: SVGSVGElement | null; archivo: string }) {
  const W = 1080;
  // Con más filas la tarjeta crece hacia abajo (la marca nunca queda encima de la lista)
  const H = Math.max(1350, 560 + filas.length * 120 + 40 + 150);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const fuente = getComputedStyle(document.body).fontFamily || "sans-serif";
  // Fondo
  ctx.fillStyle = "#f2f2f2";
  redondeado(ctx, 0, 0, W, H, 64);
  ctx.fill();
  // Personaje saliendo por la esquina superior derecha
  if (svg) {
    try {
      const img = await svgComoImagen(svg);
      ctx.drawImage(img, W - 470, -40, 500, 500);
    } catch {
      /* si falla el personaje, la tarjeta sale igual */
    }
  }
  if (svg2) {
    try {
      const img = await svgComoImagen(svg2);
      ctx.drawImage(img, W - 700, 150, 320, 320);
    } catch {
      /* igual que arriba */
    }
  }
  // Título en la voz del asistente
  ctx.fillStyle = "#0a0a0a";
  ctx.font = `700 76px ${fuente}`;
  const palabras = titulo.split(" ");
  let linea = "";
  let y = 250;
  for (const p of palabras) {
    const prueba = linea ? `${linea} ${p}` : p;
    if (ctx.measureText(prueba).width > (svg2 ? 420 : 560) && linea) {
      ctx.fillText(linea, 80, y);
      linea = p;
      y += 88;
    } else linea = prueba;
  }
  ctx.fillText(linea, 80, y);
  // Lista
  const top = 560;
  ctx.fillStyle = "#ffffff";
  redondeado(ctx, 60, top, W - 120, filas.length * 120 + 40, 48);
  ctx.fill();
  filas.forEach((f, i) => {
    const fy = top + 20 + i * 120;
    ctx.fillStyle = "#5ce65c";
    ctx.beginPath();
    ctx.arc(130, fy + 60, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0a0a0a";
    ctx.font = `400 44px ${fuente}`;
    ctx.fillText(f.label, 180, fy + 76);
    ctx.font = `700 46px ${fuente}`;
    const w = ctx.measureText(f.valor).width;
    ctx.fillText(f.valor, W - 110 - w, fy + 76);
    if (i < filas.length - 1) {
      ctx.fillStyle = "#ececec";
      ctx.fillRect(180, fy + 118, W - 290, 3);
    }
  });
  // Marca
  ctx.fillStyle = "#3fc43f";
  ctx.font = `700 52px ${fuente}`;
  const marca = "LIFE for LIFE";
  ctx.fillText(marca, (W - ctx.measureText(marca).width) / 2, H - 90);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = archivo;
  a.click();
}
