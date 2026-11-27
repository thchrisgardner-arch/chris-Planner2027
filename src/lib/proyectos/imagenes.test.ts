import { describe, expect, it } from "vitest";
import { conviene, formatoBytes, medidasReducidas } from "./imagenes";

describe("compresión de imágenes", () => {
  it("el lado mayor queda en 2.000 px y se conserva la proporción", () => {
    expect(medidasReducidas(4032, 3024)).toEqual({ ancho: 2000, alto: 1500 });
    expect(medidasReducidas(1080, 1920)).toEqual({ ancho: 1080, alto: 1920 });
    expect(medidasReducidas(3000, 6000)).toEqual({ ancho: 1000, alto: 2000 });
  });
  it("si comprimir no ahorra, se guarda el original", () => {
    expect(conviene(900_000, 1_000_000, false)).toBe(true);
    expect(conviene(990_000, 1_000_000, false)).toBe(false);
    expect(conviene(1_200_000, 1_000_000, true)).toBe(true);
  });
  it("tamaños en español", () => {
    expect(formatoBytes(512)).toBe("512 B");
    expect(formatoBytes(1536)).toBe("1,5 KB");
    expect(formatoBytes(2_400_000)).toBe("2,3 MB");
  });
});
