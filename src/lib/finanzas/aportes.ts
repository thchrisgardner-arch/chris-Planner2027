/**
 * Aportes de las metas de ahorro (`lifeos:aportes`, versión 1): qué aportes del plan se confirmaron
 * ("Ahorrado", con su monto) o se saltaron ("Esta vez no"). Igual que los Pagos fijos, la app no
 * mueve dinero: confirmar un aporte suma a la meta como el «Abonar» de siempre.
 * Solo en este dispositivo; viaja en el respaldo y se borra con todo.
 */
import { crearAlmacen } from "@/lib/almacenLocal";
import type { EstadosAporte } from "./planAporte";

interface DatosAportes {
  version: 1;
  /** Meta → fecha del aporte → estado */
  estados: Record<string, EstadosAporte>;
}

export const almacenAportes = crearAlmacen<DatosAportes>("lifeos:aportes", () => ({ version: 1, estados: {} }), (c) => ({
  version: 1,
  estados: (c.estados as DatosAportes["estados"]) ?? {},
}));

export function marcarAporte(metaId: string, fecha: string, estado: "ahorrado" | "saltado", monto: number) {
  almacenAportes.cambiar((d) => ({ ...d, estados: { ...d.estados, [metaId]: { ...(d.estados[metaId] ?? {}), [fecha]: { estado, monto } } } }));
}

/** Al quitar el plan o borrar la meta, sus aportes pendientes dejan de existir */
export function olvidarAportes(metaId: string) {
  almacenAportes.cambiar((d) => {
    const estados = { ...d.estados };
    delete estados[metaId];
    return { ...d, estados };
  });
}
