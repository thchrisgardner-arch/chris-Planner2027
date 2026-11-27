/** Acuerdos de reunión: leer responsable y fecha para volverlos tarea (usa el parser de captura rápida). */
import { interpretarLocal } from "@/lib/captura/interpretar";

const NO_SON_NOMBRES = new Set(
  "el la los las un una unos unas se hay hoy mañana manana pasado lunes martes miercoles miércoles jueves viernes sabado sábado domingo antes despues después cuando todos todas nadie alguien equipo cliente".split(" "),
);

/**
 * Lee un acuerdo de reunión y propone la tarea:
 *  - responsable: «Ana: …», «@Ana …», «… a cargo de Ana», «responsable Ana» o «Ana envía …»
 *  - fecha: la que traiga el texto (parser de captura rápida), o ninguna
 */
export function interpretarAcuerdo(texto: string, hoy: string): { nombre: string; responsable: string | null; fecha: string | null } {
  let t = texto.trim().replace(/\s+/g, " ");
  let responsable: string | null = null;
  const patronNombre = "([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?: [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)";
  const patrones: RegExp[] = [
    new RegExp(`^@?${patronNombre}\\s*:\\s*`),
    new RegExp(`(?:^|\\s)@${patronNombre}\\b`),
    new RegExp(`\\s*\\b(?:a cargo de|responsable:?|encargad[oa]:?)\\s+${patronNombre}\\b`, "i"),
  ];
  for (const p of patrones) {
    const m = t.match(p);
    if (m) {
      responsable = m[1];
      // «Ana: enviar…» y «a cargo de Ana» salen del nombre de la tarea; «@Ana» queda como «Ana»
      t = p === patrones[1] ? t.replace(`@${m[1]}`, m[1]) : t.replace(m[0], m.index === 0 ? "" : " ").trim();
      break;
    }
  }
  if (!responsable) {
    // «Ana envía la propuesta»: nombre propio al inicio seguido de un verbo conjugado (no infinitivo)
    const m = t.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,14}) ([a-záéíóúñ]+)/);
    if (m && !NO_SON_NOMBRES.has(m[1].toLowerCase()) && !/(ar|er|ir)$/.test(m[1].toLowerCase()) && /[aeá]$/.test(m[2])) responsable = m[1];
  }
  const p = interpretarLocal(t, { hoy });
  // El parser pone hoy cuando no hay fecha en la frase: solo cuenta si la frase la trae
  const conFecha = p.fecha && (p.fecha !== hoy || /\b(hoy|esta (?:tarde|noche|mañana))\b/i.test(t) || p.descripcion.length < t.length);
  const limpio = conFecha ? p.descripcion : t;
  // Restos de la fecha («el viernes» cuando también había «4 de diciembre») y puntuación final
  const nombre = (limpio || t)
    .replace(/\s+(?:el |este |próximo |proximo )?(?:lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)$/i, "")
    .replace(/[\s,;:.]+$/, "")
    .replace(/^./, (c) => c.toUpperCase());
  return { nombre, responsable, fecha: conFecha ? p.fecha : null };
}

