import { afterAll, describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "../../modules/finance/constants";
import { interpretarLocal, palabraClave, type ContextoCaptura, type Propuesta } from "./interpretar";

/** Jueves 26 de noviembre de 2026 */
const ctx: ContextoCaptura = {
  hoy: "2026-11-26",
  cuentas: [
    { id: "nequi", name: "Nequi", type: "billetera" },
    { id: "bcol", name: "Bancolombia Ahorros", type: "banco" },
    { id: "efe", name: "Efectivo", type: "efectivo" },
    { id: "visa", name: "Visa Oro", type: "tarjeta_credito" },
  ],
  proyectos: [
    { id: "monni", name: "Monni" },
    { id: "porta", name: "Portafolio 2027" },
  ],
  categoriasGasto: EXPENSE_CATEGORIES,
  categoriasIngreso: INCOME_CATEGORIES,
  cuentaPorDefecto: "bcol",
};

type Esperado = Pick<Propuesta, "tipo" | "monto" | "fecha"> & Partial<Propuesta>;
const CASOS: [string, Esperado][] = [
  ["almuerzo 25 mil nequi", { tipo: "gasto", monto: 25000, fecha: "2026-11-26", categoria: "Alimentación", cuentaId: "nequi", descripcion: "Almuerzo" }],
  ["me pagaron 3,2 millones", { tipo: "ingreso", monto: 3200000, fecha: "2026-11-26" }],
  ["arriendo 1.200.000 el 5 de cada mes", { tipo: "pago-fijo", monto: 1200000, fecha: "2026-12-05", diaDelMes: 5, categoria: "Vivienda", descripcion: "Arriendo" }],
  ["gym lunes miércoles viernes", { tipo: "habito", monto: null, fecha: null, dias: [0, 2, 4], descripcion: "Gym" }],
  ["reunión con Ana mañana 3pm", { tipo: "evento", monto: null, fecha: "2026-11-27", hora: "15:00", descripcion: "Reunión con Ana" }],
  ["terminar landing de Monni para el viernes", { tipo: "tarea", monto: null, fecha: "2026-11-27", proyectoId: "monni", descripcion: "Terminar landing de Monni" }],
  ["quiero unos audífonos de 400 mil", { tipo: "deseo", monto: 400000, fecha: null, descripcion: "Audífonos", categoria: "Tecnología" }],
  ["taxi 18k", { tipo: "gasto", monto: 18000, fecha: "2026-11-26", categoria: "Transporte" }],
  ["pagué el internet 95.000", { tipo: "gasto", monto: 95000, fecha: "2026-11-26", categoria: "Servicios", descripcion: "Internet" }],
  ["$45.900 mercado en el éxito", { tipo: "gasto", monto: 45900, fecha: "2026-11-26", categoria: "Alimentación" }],
  ["una luca de pan", { tipo: "gasto", monto: 1000, fecha: "2026-11-26", categoria: "Alimentación", descripcion: "Pan" }],
  ["uber 12.500 ayer", { tipo: "gasto", monto: 12500, fecha: "2026-11-25", categoria: "Transporte" }],
  ["gasolina 80 mil el lunes", { tipo: "gasto", monto: 80000, fecha: "2026-11-23", categoria: "Transporte", descripcion: "Gasolina" }],
  ["me consignaron el sueldo 4.500.000", { tipo: "ingreso", monto: 4500000, fecha: "2026-11-26", categoria: "Salario" }],
  ["cobré 1,5 millones al cliente", { tipo: "ingreso", monto: 1500000, fecha: "2026-11-26", categoria: "Freelance" }],
  ["netflix 44.900 mensual", { tipo: "pago-fijo", monto: 44900, fecha: "2026-11-26", diaDelMes: 26, categoria: "Suscripciones", descripcion: "Netflix" }],
  ["spotify 26.900 cada 12", { tipo: "pago-fijo", monto: 26900, fecha: "2026-12-12", diaDelMes: 12, categoria: "Suscripciones" }],
  ["leer 20 minutos todos los días", { tipo: "habito", monto: null, fecha: null, dias: [0, 1, 2, 3, 4, 5, 6], descripcion: "Leer 20 minutos" }],
  ["meditar de lunes a viernes", { tipo: "habito", monto: null, fecha: null, dias: [0, 1, 2, 3, 4], descripcion: "Meditar" }],
  ["correr los fines de semana", { tipo: "habito", monto: null, fecha: null, dias: [5, 6], descripcion: "Correr" }],
  ["cita médica el 3 de diciembre 10am", { tipo: "evento", monto: null, fecha: "2026-12-03", hora: "10:00", descripcion: "Cita médica" }],
  ["cumpleaños de mamá el 15", { tipo: "evento", monto: null, fecha: "2026-12-15", descripcion: "Cumpleaños de mamá" }],
  ["llamada con el banco a las 4", { tipo: "evento", monto: null, fecha: "2026-11-26", hora: "16:00" }],
  ["enviar factura a Monni mañana", { tipo: "tarea", monto: null, fecha: "2026-11-27", proyectoId: "monni" }],
  ["revisar contrato", { tipo: "tarea", monto: null, fecha: null, descripcion: "Revisar contrato" }],
  ["me gustaría un viaje a Cartagena de 2,5 millones", { tipo: "deseo", monto: 2500000, fecha: null, categoria: "Viajes", descripcion: "Viaje a Cartagena" }],
  ["medio millón para el dentista", { tipo: "gasto", monto: 500000, fecha: "2026-11-26", categoria: "Salud", descripcion: "Dentista" }],
  ["cena 120 mil con tarjeta", { tipo: "gasto", monto: 120000, fecha: "2026-11-26", cuentaId: "visa", descripcion: "Cena" }],
  ["domicilio rappi 32.500 daviplata", { tipo: "gasto", monto: 32500, fecha: "2026-11-26", cuentaMencionada: "DaviPlata", categoria: "Alimentación" }],
  ["vendí la bicicleta en 600 mil", { tipo: "ingreso", monto: 600000, fecha: "2026-11-26", categoria: "Negocios" }],
  ["pagué 250 mil de la cuota del carro", { tipo: "gasto", monto: 250000, fecha: "2026-11-26", categoria: "Deudas", descripcion: "Cuota del carro" }],
  ["café 8.500 en efectivo", { tipo: "gasto", monto: 8500, fecha: "2026-11-26", cuentaId: "efe", descripcion: "Café" }],
  ["arriendo 2 palos", { tipo: "gasto", monto: 2000000, fecha: "2026-11-26", categoria: "Vivienda" }],
  ["parqueadero 6000", { tipo: "gasto", monto: 6000, fecha: "2026-11-26", categoria: "Transporte" }],
  ["regalo para mi hermana 150 lucas", { tipo: "gasto", monto: 150000, fecha: "2026-11-26", descripcion: "Regalo para mi hermana" }],
  ["terminar el informe para el 30", { tipo: "tarea", monto: null, fecha: "2026-11-30", descripcion: "Terminar el informe" }],
  ["vacuna del perro en 3 días", { tipo: "tarea", monto: null, fecha: "2026-11-29" }],
  ["partido de fútbol el sábado 8pm", { tipo: "evento", monto: null, fecha: "2026-11-28", hora: "20:00", categoria: "entrenamiento" }],
  ["reunión de equipo el próximo lunes a las 9", { tipo: "evento", monto: null, fecha: "2026-11-30", hora: "09:00", descripcion: "Reunión de equipo" }],
  ["quiero un monitor nuevo", { tipo: "deseo", monto: null, fecha: null, categoria: "Tecnología", descripcion: "Monitor nuevo" }],
  ["luz 180.000 el 20 de cada mes", { tipo: "pago-fijo", monto: 180000, fecha: "2026-12-20", diaDelMes: 20, categoria: "Servicios" }],
  ["recibí 300k de reembolso", { tipo: "ingreso", monto: 300000, fecha: "2026-11-26", descripcion: "Reembolso" }],
  ["almuerzo con Ana el viernes 1pm", { tipo: "evento", monto: null, fecha: "2026-11-27", hora: "13:00", descripcion: "Almuerzo con Ana" }],
  ["compré tenis por 320.000 el 20/11", { tipo: "gasto", monto: 320000, fecha: "2026-11-20", categoria: "Compras personales", descripcion: "Tenis" }],
  ["pagar la tarjeta el 5", { tipo: "tarea", monto: null, fecha: "2026-12-05" }],
  ["hábito de tomar agua", { tipo: "habito", monto: null, fecha: null, descripcion: "Tomar agua" }],
  ["1'250.000 de nómina", { tipo: "ingreso", monto: 1250000, fecha: "2026-11-26", categoria: "Salario" }],
  ["concierto 15 de marzo", { tipo: "evento", monto: null, fecha: "2027-03-15", descripcion: "Concierto" }],
  ["2 millones 300 mil arreglo del carro", { tipo: "gasto", monto: 2300000, fecha: "2026-11-26", descripcion: "Arreglo del carro" }],
  ["dos millones quinientos mil de prima", { tipo: "ingreso", monto: 2500000, fecha: "2026-11-26", categoria: "Salario" }],
  ["un millón y medio para el viaje el sábado pasado", { tipo: "gasto", monto: 1500000, fecha: "2026-11-21" }],
];

const filas: string[] = [];

describe("interpretarLocal: frases reales en es-CO", () => {
  for (const [texto, esperado] of CASOS) {
    it(texto, () => {
      const p = interpretarLocal(texto, ctx);
      const nucleo = p.tipo === esperado.tipo && p.monto === esperado.monto && p.fecha === esperado.fecha;
      filas.push(
        `| ${texto} | ${esperado.tipo} · ${esperado.monto ?? "—"} · ${esperado.fecha ?? "—"} | ${p.tipo} · ${p.monto ?? "—"} · ${p.fecha ?? "—"} | ${p.descripcion} · ${p.categoria ?? "—"}${p.hora ? ` · ${p.hora}` : ""} | ${nucleo ? "Sí" : "No"} |`,
      );
      expect({ tipo: p.tipo, monto: p.monto, fecha: p.fecha }).toEqual({ tipo: esperado.tipo, monto: esperado.monto, fecha: esperado.fecha });
      for (const [k, v] of Object.entries(esperado)) expect(p[k as keyof Propuesta], k).toEqual(v);
    });
  }
});

describe("aprendizaje y entrada", () => {
  it("usa la categoría aprendida antes que las palabras clave", () => {
    const p = interpretarLocal("almuerzo 25 mil", { ...ctx, aprendidas: { almuerzo: "Familia" } });
    expect(p.categoria).toBe("Familia");
  });
  it("ignora una categoría aprendida que ya no existe", () => {
    const p = interpretarLocal("almuerzo 25 mil", { ...ctx, aprendidas: { almuerzo: "Borrada" } });
    expect(p.categoria).toBe("Alimentación");
  });
  it("palabra clave para recordar", () => {
    expect(palabraClave("Almuerzo con Ana")).toBe("almuerzo");
    expect(palabraClave("El arriendo")).toBe("arriendo");
  });
  it("sin cuenta en la frase usa la cuenta por defecto", () => {
    expect(interpretarLocal("taxi 18k", ctx).cuentaId).toBe("bcol");
  });
  it("un año no es un monto", () => {
    expect(interpretarLocal("revisar metas 2027", ctx).monto).toBeNull();
  });
});

afterAll(() => {
  if (!process.env.REPORTE) return;
  mkdirSync("docs/captura", { recursive: true });
  const ok = filas.filter((f) => f.endsWith("| Sí |")).length;
  writeFileSync(
    "docs/captura/resultados-parser.md",
    `# Resultados del parser de captura rápida\n\nHoy de prueba: jueves 26 de noviembre de 2026. Aciertos en tipo, monto y fecha: **${ok} de ${filas.length}** (${Math.round((ok / filas.length) * 100)} %).\n\n| Frase | Esperado (tipo · monto · fecha) | Obtenido | Descripción · categoría | Acierta |\n|---|---|---|---|---|\n${filas.join("\n")}\n`,
  );
});
