import { describe, expect, it } from "vitest";
import { COMANDOS, leerComando } from "./comandos";

describe("comando / de las notas", () => {
  it("«/» solo muestra todos los comandos", () => expect(leerComando("/")?.opciones).toHaveLength(COMANDOS.length));
  it("filtra mientras escribes (sin tildes)", () => {
    expect(leerComando("/tit")?.opciones.map((c) => c.id)).toEqual(["h1", "h2", "h3"]);
    expect(leerComando("/casi")?.opciones.map((c) => c.id)).toEqual(["casillas"]);
  });
  it("«/gasto almuerzo 25 mil»: gasto con el resto del texto", () => {
    expect(leerComando("/gasto almuerzo 25 mil")).toMatchObject({ consulta: "gasto", resto: "almuerzo 25 mil", opciones: [{ id: "gasto" }] });
  });
  it("«/tarea enviar la propuesta el viernes» y «/evento …»", () => {
    expect(leerComando("/tarea enviar la propuesta el viernes")?.opciones[0].id).toBe("tarea");
    expect(leerComando("/evento revisión con Laura el martes 3 pm")?.opciones[0].id).toBe("evento");
  });
  it("la palabra exacta de un registro va primero aunque otro bloque también coincida", () => {
    expect(leerComando("/cita")?.opciones[0].id).toBe("cita");
    expect(leerComando("/tarea")?.opciones[0].id).toBe("tarea");
  });
  it("texto normal o un comando que no existe: no hay menú", () => {
    expect(leerComando("Hola")).toBeNull();
    expect(leerComando("/xyz")).toBeNull();
    expect(leerComando("a/b")).toBeNull();
  });
});
