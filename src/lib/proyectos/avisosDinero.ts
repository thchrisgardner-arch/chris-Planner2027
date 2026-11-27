/**
 * Lo que recuerdan los avisos de dinero de Centavo (`lifeos:dinero`, versión 1). Solo en este
 * dispositivo; viaja en el respaldo y se borra con el resto de los datos.
 *  - migracion: 1 cuando el «presupuesto estimado» de cada proyecto ya pasó a `money`.
 *  - iniciado: la primera vez solo se anota dónde va cada proyecto (sin avisar de lo que ya pasó).
 *  - avisados: por proyecto, el periodo ("total" o el mes) y los umbrales ya avisados en él.
 *  - ultimo: por proyecto, el último día con aviso (máximo 1 al día).
 */
import { crearAlmacen } from "@/lib/almacenLocal";
import type { Project, Transaction } from "@/types/db";
import { avisadosVigentes, dineroDe, resumenDinero, textoAviso, umbralesAlcanzados, umbralPorAvisar, type TextoAviso } from "./dinero";

export interface DatosDinero {
  version: 1;
  migracion: number;
  iniciado: boolean;
  avisados: Record<string, { clave: string; umbrales: number[] }>;
  ultimo: Record<string, string>;
}

const vacio = (): DatosDinero => ({ version: 1, migracion: 0, iniciado: false, avisados: {}, ultimo: {} });

export const almacenDinero = crearAlmacen<DatosDinero>("lifeos:dinero", vacio, (c) => ({
  version: 1,
  migracion: Number(c.migracion) || 0,
  iniciado: !!c.iniciado,
  avisados: (c.avisados as DatosDinero["avisados"]) ?? {},
  ultimo: (c.ultimo as DatosDinero["ultimo"]) ?? {},
}));

export interface AvisoDinero extends TextoAviso {
  proyectoId: string;
  nombre: string;
  umbral: number;
}

/**
 * Revisa todos los proyectos con presupuesto y devuelve el estado nuevo y, si toca, UN aviso
 * (el de mayor umbral). Pura: no lee ni escribe nada.
 *  - Cada cruce avisa una sola vez por periodo; si se cruzan dos a la vez, sale solo el más alto.
 *  - Máximo un aviso por proyecto al día (el resto espera al día siguiente).
 *  - Si el gasto baja del umbral (o sube el presupuesto), ese umbral se olvida y un nuevo cruce avisa.
 */
export function revisarAvisos(d: DatosDinero, proyectos: Project[], txs: Transaction[], hoy: string, tranquilo: boolean): { datos: DatosDinero; aviso: AvisoDinero | null } {
  const avisados = { ...d.avisados };
  const ultimo = { ...d.ultimo };
  let aviso: AvisoDinero | null = null;
  for (const p of proyectos) {
    if (p.status === "completado") continue;
    const din = dineroDe(p);
    if (!din.presupuesto) {
      delete avisados[p.id];
      continue;
    }
    const r = resumenDinero(p, txs, hoy);
    const pct = r.pct ?? 0;
    const prev = avisados[p.id]?.clave === r.clave ? avisados[p.id].umbrales : [];
    let vigentes = avisadosVigentes(pct, prev);
    if (!d.iniciado) {
      // Primera vez: lo que ya estaba cruzado no se avisa (no es un cruce nuevo)
      vigentes = umbralesAlcanzados(pct, din.alertas);
    } else if (!aviso && ultimo[p.id] !== hoy) {
      const u = umbralPorAvisar(pct, din.alertas, vigentes);
      if (u !== null) {
        aviso = { proyectoId: p.id, nombre: p.name, umbral: u, ...textoAviso(p.name, u, r, tranquilo) };
        vigentes = [...new Set([...vigentes, ...din.alertas.filter((a) => a <= u && pct >= a)])].sort((a, b) => a - b);
        ultimo[p.id] = hoy;
      }
    }
    avisados[p.id] = { clave: r.clave, umbrales: vigentes };
  }
  return { datos: { ...d, iniciado: true, avisados, ultimo }, aviso };
}

/** ¿Cambió algo que valga la pena guardar? (evita escribir en cada render) */
export const mismosDatos = (a: DatosDinero, b: DatosDinero) => JSON.stringify(a) === JSON.stringify(b);

/** Panel de pruebas (?demo=1): el aviso de 80 % o 100 % de un proyecto, sin esperar a que cruce */
export function avisoDeEjemplo(p: Pick<Project, "id" | "name" | "budget"> & { money?: Project["money"] }, umbral: 80 | 100, tranquilo: boolean): AvisoDinero {
  const pres = dineroDe(p).presupuesto?.monto ?? 500_000;
  const gastado = Math.round(pres * (umbral === 100 ? 1.08 : 0.8));
  const r = { presupuesto: pres, periodo: "total" as const, clave: "total", gastado, ingresos: 0, balance: -gastado, disponible: pres - gastado, pct: (gastado / pres) * 100, movimientos: [] };
  return { proyectoId: p.id, nombre: p.name, umbral, ...textoAviso(p.name, umbral, r, tranquilo) };
}
