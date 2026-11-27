import { describe, expect, it } from "vitest";
import { crc32, crearZip } from "@/utils/zip";
import { migrarEspacio, tituloVoz, type NotaVoz } from "./espacio";
import { extensionAudio, nombreBase, slug, transcripcionTxt, zipNotas } from "./exportarVoz";

const nota = (p: Partial<NotaVoz> = {}): NotaVoz => ({
  id: "voz1",
  proyectoId: "p1",
  creada: "2026-11-26T17:52:00.000Z",
  duracion: 65,
  picos: [],
  transcripcion: [],
  tipo: "audio/webm;codecs=opus",
  ...p,
});

describe("título de las notas de voz", () => {
  it("usa el nombre elegido", () => expect(tituloVoz(nota({ titulo: " Llamada con Ana " }))).toBe("Llamada con Ana"));
  it("sin nombre: las primeras 6 palabras de la transcripción", () => {
    const n = nota({ transcripcion: [{ t: 0, texto: "Repasamos el avance del diseño de la página." }] });
    expect(tituloVoz(n)).toBe("Repasamos el avance del diseño de…");
    expect(tituloVoz(nota({ transcripcion: [{ t: 0, texto: "Llamar a Ana." }] }))).toBe("Llamar a Ana");
  });
  it("sin nombre ni transcripción: «Nota de voz»", () => expect(tituloVoz(nota())).toBe("Nota de voz"));
  it("la migración quita los títulos automáticos con fecha y deja los elegidos", () => {
    const e = migrarEspacio({
      notas: {},
      voz: [nota({ id: "a", titulo: "Nota de voz · 26 de nov, 12:52 p. m." }), nota({ id: "b", titulo: "Reunión con el cliente" })],
      reuniones: [],
      imagenes: [],
      portadas: {},
    });
    expect(e.version).toBe(2);
    expect(e.voz[0]).not.toHaveProperty("titulo");
    expect(e.voz[1].titulo).toBe("Reunión con el cliente");
  });
});

describe("exportar", () => {
  it("extensión según el formato grabado", () => {
    expect(extensionAudio("audio/webm;codecs=opus")).toBe("webm");
    expect(extensionAudio("audio/mp4")).toBe("m4a");
    expect(extensionAudio("audio/ogg;codecs=opus")).toBe("ogg");
    expect(extensionAudio("audio/wav")).toBe("wav");
  });
  it("nombre de archivo en slug + fecha de Bogotá", () => {
    expect(slug("Llamada con el señor Peña: ¿precio?")).toBe("llamada-con-el-senor-pena-precio");
    expect(nombreBase(nota({ titulo: "Reunión de diseño", creada: "2026-11-27T03:00:00.000Z" }))).toBe("reunion-de-diseno-2026-11-26");
  });
  it("transcripción en texto con marcas de tiempo", () => {
    const txt = transcripcionTxt(nota({ titulo: "Llamada", transcripcion: [{ t: 0.4, texto: "Hola." }, { t: 75, texto: "Enviar la propuesta." }] }));
    expect(txt).toContain("Llamada\n");
    expect(txt).toContain("[0:00] Hola.\n[1:15] Enviar la propuesta.");
  });
});

describe("zip", () => {
  it("crc32 de referencia", () => expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926));
  it("estructura: entradas, directorio central y fin", () => {
    const z = crearZip([
      { nombre: "a.txt", datos: new TextEncoder().encode("hola") },
      { nombre: "reunión.txt", datos: new TextEncoder().encode("ñ") },
    ]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const fin = z.length - 22;
    expect(v.getUint32(fin, true)).toBe(0x06054b50);
    expect(v.getUint16(fin + 10, true)).toBe(2);
    const inicioCentral = v.getUint32(fin + 16, true);
    expect(v.getUint32(inicioCentral, true)).toBe(0x02014b50);
  });
  it("zip de notas: audio, transcripción e índice; cuenta las que no tienen audio", async () => {
    const notas = [nota({ id: "v1", titulo: "Uno", transcripcion: [{ t: 0, texto: "Hola" }] }), nota({ id: "v2", titulo: "Uno" }), nota({ id: "v3" })];
    const { zip, sinAudio } = await zipNotas(notas, async (id) => (id === "v3" ? null : new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" })), "Portafolio");
    expect(sinAudio).toBe(1);
    const texto = new TextDecoder().decode(new Uint8Array(await zip.arrayBuffer()));
    expect(texto).toContain("uno-2026-11-26.webm");
    expect(texto).toContain("uno-2026-11-26.txt");
    expect(texto).toContain("uno-2026-11-26-2.webm");
    expect(texto).toContain('"proyecto": "Portafolio"');
  });
});
