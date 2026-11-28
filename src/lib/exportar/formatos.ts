/**
 * Crea el archivo de un `Documento` en Word (.docx), Excel (.xlsx), PDF o texto (.txt).
 * Las librerías se cargan solo al exportar (no pesan en el resto de la app).
 */
import { aTexto, celdaTexto, type Documento, type Formato, type Seccion } from "./documento";

export async function crearArchivo(doc: Documento, formato: Formato): Promise<Blob> {
  if (formato === "texto") return new Blob(["﻿", aTexto(doc)], { type: "text/plain;charset=utf-8" });
  if (formato === "excel") return excel(doc);
  if (formato === "word") return word(doc);
  return pdf(doc);
}

/* ───────── Excel: una hoja por sección, fila de títulos fija, montos como números ───────── */
async function excel(doc: Documento): Promise<Blob> {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  type Hojas = Parameters<typeof writeXlsxFile>[0];
  const usados = new Set<string>();
  // Excel: máximo 31 caracteres, sin : \ / ? * [ ] y sin repetir
  const nombreHoja = (t: string) => {
    const base = t.replace(/[:\\/?*[\]]/g, " ").slice(0, 31).trim() || "Hoja";
    let n = base;
    for (let i = 2; usados.has(n.toLowerCase()); i++) n = `${base.slice(0, 28)} ${i}`;
    usados.add(n.toLowerCase());
    return n;
  };
  const hojas = doc.secciones.map((s) => ({
    sheet: nombreHoja(s.titulo),
    stickyRowsCount: 1,
    columns: s.columnas.map((c, i) => ({ width: Math.min(45, Math.max(10, c.titulo.length + 2, ...s.filas.map((f) => celdaTexto(f[i], c.tipo).length + 2))) })),
    data: [
      s.columnas.map((c) => ({ value: c.titulo, fontWeight: "bold" as const, backgroundColor: "#EDEDED" })),
      ...s.filas.map((f) =>
        s.columnas.map((c, i) => {
          const v = f[i];
          if (v == null || v === "") return null;
          if ((c.tipo === "dinero" || c.tipo === "numero") && typeof v === "number") return { value: v, type: Number, format: c.tipo === "dinero" ? "#,##0" : "#,##0.##" };
          if (c.tipo === "fecha" && typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return { value: new Date(`${v.slice(0, 10)}T00:00:00Z`), type: Date, format: "dd/mm/yyyy" };
          return { value: String(v), type: String };
        }),
      ),
    ],
  }));
  return writeXlsxFile(hojas as unknown as Hojas, { fontFamily: "Calibri", fontSize: 11 }).toBlob();
}

/* ───────── Word: título y una tabla por sección (horizontal si hay muchas columnas) ───────── */
async function word(doc: Documento): Promise<Blob> {
  const d = await import("docx");
  const ancha = doc.secciones.some((s) => s.columnas.length > 6);
  const borde = { style: d.BorderStyle.SINGLE, size: 4, color: "D9D9D9" };
  const bordes = { top: borde, bottom: borde, left: borde, right: borde, insideHorizontal: borde, insideVertical: borde };
  const derecha = (s: Seccion, i: number) => s.columnas[i].tipo === "dinero" || s.columnas[i].tipo === "numero";
  const celda = (texto: string, opts: { negrita?: boolean; fondo?: string; derecha?: boolean }) =>
    new d.TableCell({
      shading: opts.fondo ? { type: d.ShadingType.CLEAR, color: "auto", fill: opts.fondo } : undefined,
      margins: { top: 60, bottom: 60, left: 90, right: 90 },
      children: [new d.Paragraph({ alignment: opts.derecha ? d.AlignmentType.RIGHT : d.AlignmentType.LEFT, children: [new d.TextRun({ text: texto, bold: opts.negrita, size: 18 })] })],
    });
  const hijos: (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] = [new d.Paragraph({ heading: d.HeadingLevel.TITLE, children: [new d.TextRun(doc.titulo)] })];
  if (doc.subtitulo) hijos.push(new d.Paragraph({ children: [new d.TextRun({ text: doc.subtitulo, color: "6B6B6B" })] }));
  for (const s of doc.secciones) {
    hijos.push(new d.Paragraph({ heading: d.HeadingLevel.HEADING_2, spacing: { before: 320 }, children: [new d.TextRun(`${s.titulo} (${s.filas.length})`)] }));
    if (!s.filas.length) {
      hijos.push(new d.Paragraph({ children: [new d.TextRun({ text: "Sin registros.", color: "6B6B6B" })] }));
      continue;
    }
    hijos.push(
      new d.Table({
        width: { size: 100, type: d.WidthType.PERCENTAGE },
        borders: bordes,
        rows: [
          new d.TableRow({ tableHeader: true, children: s.columnas.map((c, i) => celda(c.titulo, { negrita: true, fondo: "EDEDED", derecha: derecha(s, i) })) }),
          ...s.filas.map((f) => new d.TableRow({ children: s.columnas.map((c, i) => celda(celdaTexto(f[i], c.tipo), { derecha: derecha(s, i) })) })),
        ],
      }),
    );
  }
  const documento = new d.Document({
    creator: "Poku Poku",
    title: doc.titulo,
    styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
    sections: [{ properties: { page: { size: { orientation: ancha ? d.PageOrientation.LANDSCAPE : d.PageOrientation.PORTRAIT }, margin: { top: 900, bottom: 900, left: 900, right: 900 } } }, children: hijos }],
  });
  return d.Packer.toBlob(documento);
}

/* ───────── PDF: hoja horizontal, título y una tabla por sección ───────── */
async function pdf(doc: Documento): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const p = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margen = 36;
  p.setFont("helvetica", "bold").setFontSize(18).text(doc.titulo, margen, margen + 10);
  let y = margen + 28;
  if (doc.subtitulo) {
    p.setFont("helvetica", "normal").setFontSize(10).setTextColor(107).text(doc.subtitulo, margen, y);
    p.setTextColor(0);
    y += 18;
  }
  const alto = p.internal.pageSize.getHeight();
  for (const s of doc.secciones) {
    if (y > alto - 90) {
      p.addPage();
      y = margen;
    }
    p.setFont("helvetica", "bold").setFontSize(12).text(`${s.titulo} (${s.filas.length})`, margen, y + 6);
    y += 14;
    if (!s.filas.length) {
      p.setFont("helvetica", "normal").setFontSize(10).setTextColor(107).text("Sin registros.", margen, y + 6);
      p.setTextColor(0);
      y += 26;
      continue;
    }
    autoTable(p, {
      startY: y,
      margin: { left: margen, right: margen },
      head: [s.columnas.map((c) => c.titulo)],
      body: s.filas.map((f) => s.columnas.map((c, i) => celdaTexto(f[i], c.tipo))),
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [237, 237, 237], textColor: 20, fontStyle: "bold" },
      columnStyles: Object.fromEntries(s.columnas.map((c, i) => [i, c.tipo === "dinero" || c.tipo === "numero" ? { halign: "right" as const } : {}])),
    });
    y = (p as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 26;
  }
  return p.output("blob");
}
