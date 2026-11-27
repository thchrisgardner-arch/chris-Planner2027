import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/types/db";
import { interpretarAcuerdo } from "./acuerdos";
import type { Reunion } from "./espacio";
import { migrarEspacio } from "./espacio";
import { cuenta, esReunion, planMigracionReuniones, tituloReunion } from "./reuniones";

const reunion = (p: Partial<Reunion> = {}): Reunion => ({
  id: "reu1",
  proyectoId: "p1",
  titulo: "Revisión de diseño",
  fecha: "2026-12-02",
  inicio: "10:00",
  fin: "10:30",
  modalidad: "video",
  enlace: "https://meet.google.com/abc",
  lugar: "",
  participantes: ["Ana", "Milo"],
  agenda: "Paleta y tipografía",
  creada: "2026-11-20T10:00:00Z",
  ...p,
});
const evento = (p: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "ev1",
  user_id: "local-user",
  created_at: "2026-11-20T10:00:00Z",
  title: "Reunión: Revisión de diseño",
  date: "2026-12-01",
  start_time: "09:00",
  end_time: null,
  type: "personal",
  notes: null,
  ...p,
});
const proyectos = [{ id: "p1", name: "Portafolio 2027" }];

describe("migración de reuniones al calendario", () => {
  it("con evento existente: lo actualiza (la reunión manda en fecha y hora) y le pone proyecto y datos", () => {
    const plan = planMigracionReuniones([reunion({ eventoId: "ev1" })], [evento()], proyectos);
    expect(plan.crear).toHaveLength(0);
    expect(plan.actualizar[0]).toMatchObject({
      eventoId: "ev1",
      reunionId: "reu1",
      patch: { date: "2026-12-02", start_time: "10:00", end_time: "10:30", project_id: "p1", meeting: { participantes: ["Ana", "Milo"], agenda: "Paleta y tipografía", acuerdos: [], origen: "reu1" } },
    });
    expect(plan.actualizar[0].patch.notes).toContain("Proyecto: Portafolio 2027");
  });
  it("sin evento (o borrado del calendario): crea uno nuevo", () => {
    const plan = planMigracionReuniones([reunion({ eventoId: "ya-no-existe" }), reunion({ id: "reu2", eventoId: undefined })], [evento()], proyectos);
    expect(plan.actualizar).toHaveLength(0);
    expect(plan.crear.map((c) => c.reunionId)).toEqual(["reu1", "reu2"]);
    expect(plan.crear[0].fila).toMatchObject({ title: "Reunión: Revisión de diseño", type: "personal", project_id: "p1" });
  });
  it("repetida: no duplica lo que ya se migró", () => {
    const yaMigrado = evento({ id: "ev9", project_id: "p1", meeting: { modalidad: "video", enlace: "", lugar: "", participantes: [], agenda: "", notas: "", acuerdos: [], origen: "reu1" } });
    const plan = planMigracionReuniones([reunion()], [yaMigrado], proyectos);
    expect(plan.crear).toHaveLength(0);
    expect(plan.hechas).toEqual({ reu1: "ev9" });
  });
  it("con un respaldo real de la versión anterior del espacio: títulos y reuniones migran sin perder nada", () => {
    // Forma exacta del respaldo exportado antes de los paneles (versión sin número)
    const respaldo = {
      notas: { p1: { texto: "Ideas para la portada", actualizado: "2026-11-25T12:00:00Z" } },
      voz: [{ id: "voz1", proyectoId: "p1", titulo: "Nota de voz · 26 de nov, 12:52 p. m.", creada: "2026-11-26T17:52:00Z", duracion: 5, picos: [], transcripcion: [], reunionId: "reu1", tipo: "audio/webm" }],
      reuniones: [reunion({ eventoId: "ev1" })],
      imagenes: [],
      portadas: {},
    };
    const e = migrarEspacio(respaldo);
    expect(e.notas.p1.texto).toBe("Ideas para la portada");
    expect(e.voz[0]).not.toHaveProperty("titulo");
    expect(e.reuniones).toHaveLength(1);
    const plan = planMigracionReuniones(e.reuniones, [evento()], proyectos);
    expect(plan.actualizar[0].eventoId).toBe("ev1");
  });
});

describe("reuniones", () => {
  it("una reunión es un evento con proyecto y datos de reunión", () => {
    expect(esReunion(evento())).toBe(false);
    expect(esReunion(evento({ project_id: "p1", meeting: { modalidad: "llamada", enlace: "", lugar: "", participantes: [], agenda: "", notas: "", acuerdos: [] } }))).toBe(true);
  });
  it("el título del proyecto no repite «Reunión:»", () => expect(tituloReunion({ title: "Reunión: Kickoff" })).toBe("Kickoff"));
  it("cuenta regresiva en hora de Bogotá", () => {
    const ahora = new Date("2026-12-02T09:30:00-05:00").getTime();
    expect(cuenta({ date: "2026-12-02", start_time: "10:00", end_time: "10:30" }, ahora)).toEqual({ texto: "En 30 min", tono: "pronto" });
    expect(cuenta({ date: "2026-12-02", start_time: "09:00", end_time: "10:00" }, ahora).tono).toBe("ahora");
    expect(cuenta({ date: "2026-12-01", start_time: "09:00", end_time: "10:00" }, ahora).tono).toBe("pasada");
  });
});

describe("acuerdo → tarea", () => {
  const hoy = "2026-11-27";
  it("«Ana: enviar la propuesta el viernes 4 de diciembre»", () => {
    expect(interpretarAcuerdo("Ana: enviar la propuesta el viernes 4 de diciembre", hoy)).toEqual({ nombre: "Enviar la propuesta", responsable: "Ana", fecha: "2026-12-04" });
  });
  it("«Milo envía la cotización mañana»", () => {
    expect(interpretarAcuerdo("Milo envía la cotización mañana", hoy)).toMatchObject({ responsable: "Milo", fecha: "2026-11-28" });
  });
  it("«Revisar el contrato, a cargo de Laura Gómez»", () => {
    expect(interpretarAcuerdo("Revisar el contrato, a cargo de Laura Gómez", hoy)).toEqual({ nombre: "Revisar el contrato", responsable: "Laura Gómez", fecha: null });
  });
  it("«@Pedro agenda la revisión»", () => expect(interpretarAcuerdo("@Pedro agenda la revisión", hoy).responsable).toBe("Pedro"));
  it("sin responsable ni fecha: solo el texto", () => {
    expect(interpretarAcuerdo("Definir la paleta final", hoy)).toEqual({ nombre: "Definir la paleta final", responsable: null, fecha: null });
    expect(interpretarAcuerdo("El cliente aprueba el presupuesto", hoy).responsable).toBeNull();
  });
});
