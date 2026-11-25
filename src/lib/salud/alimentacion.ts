/**
 * Recomendaciones de alimentación a partir del peso, la altura, la edad, el sexo, la actividad y el
 * objetivo. Fórmula de Mifflin-St Jeor para el gasto en reposo. Son orientativas: no reemplazan a un
 * nutricionista. Lógica pura, sin React.
 */
import type { Actividad, Objetivo, PerfilFisico } from "./perfil";

const FACTOR: Record<Actividad, number> = { sedentaria: 1.2, ligera: 1.375, moderada: 1.55, alta: 1.725 };

export const ACTIVIDADES: { value: Actividad; label: string; hint: string }[] = [
  { value: "sedentaria", label: "Sedentaria", hint: "Trabajo sentado, sin ejercicio" },
  { value: "ligera", label: "Ligera", hint: "1–3 días de ejercicio" },
  { value: "moderada", label: "Moderada", hint: "3–5 días de ejercicio" },
  { value: "alta", label: "Alta", hint: "6–7 días o trabajo físico" },
];

export function imcDe(pesoKg: number, alturaCm: number) {
  const m = alturaCm / 100;
  const valor = pesoKg / (m * m);
  const categoria = valor < 18.5 ? "Bajo peso" : valor < 25 ? "Peso saludable" : valor < 30 ? "Sobrepeso" : "Obesidad";
  return { valor: Math.round(valor * 10) / 10, categoria };
}

export interface Comida {
  nombre: string;
  kcal: number;
  proteina: number;
  ejemplo: string;
}

export interface PlanAlimentacion {
  imc: { valor: number; categoria: string };
  reposo: number;
  gasto: number;
  objetivoReal: Objetivo;
  ajusteNota: string | null;
  calorias: number;
  proteina: number;
  grasa: number;
  carbos: number;
  aguaLitros: number;
  comidas: Comida[];
  consejos: string[];
  alertas: string[];
}

const redondear = (n: number, a = 10) => Math.round(n / a) * a;

/** Ejemplos de platos (Colombia) por comida y objetivo */
const PLATOS: Record<Objetivo, string[]> = {
  perder: [
    "2 huevos pericos + 1 arepa pequeña + 1 fruta (papaya o fresas) + café sin azúcar",
    "150 g de pechuga o carne magra + ½ taza de arroz + ½ taza de fríjoles o lentejas + ensalada grande",
    "Yogur griego natural + 1 fruta, o un puñado de maní",
    "Pescado o pollo a la plancha + verduras salteadas + ½ papa o ½ plátano cocido",
  ],
  mantener: [
    "2–3 huevos pericos + 1 arepa + 1 fruta + café o chocolate",
    "150 g de pollo, carne o pescado + 1 taza de arroz + ½ taza de fríjoles + ensalada + ½ plátano maduro",
    "Yogur con granola o una fruta con maní",
    "Proteína (pollo, huevo, atún) + papa, yuca o arroz + verduras",
  ],
  ganar: [
    "3 huevos + 1 arepa grande con queso + 1 fruta + avena en leche",
    "180 g de carne, pollo o pescado + 1½ taza de arroz + ½ taza de fríjoles + plátano maduro + ensalada",
    "Batido de leche con banano, avena y mantequilla de maní",
    "Pasta o arroz con pollo + verduras + 1 vaso de leche o yogur",
  ],
};

export function planAlimentacion(p: PerfilFisico, entrenaHoy: boolean): PlanAlimentacion | null {
  if (!p.sexo || !p.edad || !p.pesoKg || !p.alturaCm) return null;
  const { pesoKg: peso, alturaCm: altura, edad } = p;
  const imc = imcDe(peso, altura);
  const reposo = Math.round(10 * peso + 6.25 * altura - 5 * edad + (p.sexo === "hombre" ? 5 : -161));
  const gasto = Math.round(reposo * FACTOR[p.actividad]);
  const alertas: string[] = [];

  // Seguridad: con bajo peso no se recomienda déficit
  let objetivoReal: Objetivo = p.objetivo;
  let ajusteNota: string | null = null;
  if (p.objetivo === "perder" && imc.valor < 18.5) {
    objetivoReal = "mantener";
    ajusteNota = "Tu IMC está en bajo peso, así que el plan es de mantenimiento y no de déficit.";
  }
  if (edad < 18) alertas.push("Eres menor de 18 años: estas cifras son solo una referencia. Consulta a un profesional antes de cambiar tu alimentación.");
  if (imc.valor >= 35) alertas.push("Con un IMC de 35 o más conviene un plan guiado por un profesional de la salud.");

  const minimo = p.sexo === "hombre" ? 1500 : 1200;
  let calorias = objetivoReal === "perder" ? gasto - 400 : objetivoReal === "ganar" ? gasto + 300 : gasto;
  calorias = redondear(Math.max(calorias, minimo, objetivoReal === "perder" ? reposo : 0));

  // Proteína por kg; con IMC alto se calcula sobre un peso de referencia (IMC 25) para no exagerar
  const pesoRef = imc.valor > 30 ? 25 * (altura / 100) ** 2 : peso;
  const gPorKg = objetivoReal === "perder" ? 2 : objetivoReal === "ganar" ? 1.8 : 1.6;
  const proteina = redondear(pesoRef * gPorKg, 5);
  const grasa = redondear(Math.max(pesoRef * 0.8, (calorias * 0.22) / 9), 5);
  const carbos = redondear(Math.max(0, (calorias - proteina * 4 - grasa * 9) / 4), 5);
  const aguaLitros = Math.round((peso * 0.035 + (entrenaHoy ? 0.5 : 0)) * 10) / 10;

  const reparto = [
    { nombre: "Desayuno", pct: 0.25 },
    { nombre: "Almuerzo", pct: 0.35 },
    { nombre: "Merienda", pct: 0.12 },
    { nombre: "Cena", pct: 0.28 },
  ];
  const comidas = reparto.map((c, i) => ({
    nombre: c.nombre,
    kcal: redondear(calorias * c.pct),
    proteina: redondear(proteina * c.pct, 5),
    ejemplo: PLATOS[objetivoReal][i],
  }));

  const consejos = [
    objetivoReal === "perder"
      ? "Llena la mitad del plato con verduras y prioriza la proteína en cada comida: ayuda a no pasar hambre."
      : objetivoReal === "ganar"
        ? "Come cada 3–4 horas y no te saltes comidas: el superávit pequeño y constante es el que funciona."
        : "Mantén horarios regulares y porciones parecidas cada día.",
    entrenaHoy ? "Hoy entrenas: come algo con carbohidratos 1–2 horas antes y proteína después del entreno." : "Hoy no entrenas: baja un poco el arroz o la arepa y mantén la proteína.",
    "Evita las bebidas azucaradas; el agua, el café o el té sin azúcar no suman calorías.",
  ];

  return { imc, reposo, gasto, objetivoReal, ajusteNota, calorias, proteina, grasa, carbos, aguaLitros, comidas, consejos, alertas };
}
