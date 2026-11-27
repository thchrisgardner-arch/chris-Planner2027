import { describe, expect, it } from "vitest";
import { notasDesdeEspacio, textoAContenido, textoPlano, type Documento } from "./documentos";

describe("notas de proyecto", () => {
  it("texto de antes → documento: párrafos, viñetas y líneas vacías", () => {
    const doc = textoAContenido("Ideas para la portada\n- Foto en blanco y negro\n- Frase corta\n\nRevisar con Laura\n");
    expect(doc.content!.map((b) => b.type)).toEqual(["paragraph", "bulletList", "paragraph", "paragraph"]);
    expect(doc.content![1].content).toHaveLength(2);
    expect(textoPlano(doc)).toBe("Ideas para la portada\nFoto en blanco y negro\nFrase corta\n\nRevisar con Laura");
  });

  it("texto vacío → un párrafo vacío", () => expect(textoAContenido("")).toEqual({ type: "doc", content: [{ type: "paragraph" }] }));

  it("migración: la nota única de cada proyecto pasa a ser su primera nota, sin pisar las que ya existen", () => {
    const existentes: Documento[] = [{ id: "d1", proyectoId: "p2", titulo: "Ya existía", contenido: { type: "doc" }, creado: "", actualizado: "" }];
    const nuevas = notasDesdeEspacio(
      {
        p1: { texto: "Paleta lila y negro", actualizado: "2026-11-20T10:00:00Z" },
        p2: { texto: "No debe duplicarse", actualizado: "2026-11-20T10:00:00Z" },
        p3: { texto: "   ", actualizado: "2026-11-20T10:00:00Z" },
      },
      existentes,
    );
    expect(nuevas).toHaveLength(1);
    expect(nuevas[0]).toMatchObject({ proyectoId: "p1", titulo: "Notas", actualizado: "2026-11-20T10:00:00Z" });
    expect(textoPlano(nuevas[0].contenido)).toBe("Paleta lila y negro");
  });
});

describe("sincronizar notas entre dispositivos", () => {
  it("une las notas de los dos lados; si la misma cambió en ambos, gana la editada más tarde", async () => {
    const { fusionarDoc } = await import("@/lib/sync/fusion");
    const nota = (id: string, titulo: string, actualizado: string) => ({ id, proyectoId: "p1", titulo, contenido: { type: "doc" }, creado: "", actualizado });
    const local = { version: 1, migrado: true, docs: [nota("a", "Acta (celular)", "2026-11-27T10:00:00Z"), nota("b", "Solo en el celular", "2026-11-27T09:00:00Z")] };
    const remoto = { version: 1, migrado: false, docs: [nota("a", "Acta (computador)", "2026-11-27T11:00:00Z"), nota("c", "Solo en el computador", "2026-11-26T09:00:00Z")] };
    const r = fusionarDoc("documentos", local, remoto, "2026-11-27") as { docs: { id: string; titulo: string }[]; migrado: boolean };
    expect(Object.fromEntries(r.docs.map((d) => [d.id, d.titulo]))).toEqual({ a: "Acta (computador)", b: "Solo en el celular", c: "Solo en el computador" });
    expect(r.migrado).toBe(true);
  });
});
