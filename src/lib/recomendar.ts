/**
 * Recomendar la app (Fase 6): invitar a compartirla en el momento justo, sin molestar, sin
 * recompensas y sin seguimiento (no se registra quién compartió con quién).
 * `lifeos:recomendar` (versión 1), solo en este dispositivo; viaja en el respaldo.
 */
import { crearAlmacen } from "@/lib/almacenLocal";
import { diffDays } from "@/utils/dates";

export const ENLACE_APP = "https://chris-planner2027.vercel.app";
export const TEXTO_COMPARTIR = "Estoy ordenando mi plata, mis hábitos y mis proyectos con Poku Poku. Si quieres probarla:";

export interface DatosRecomendar {
  version: 1;
  /** Primer día en que se abrió la app en este dispositivo */
  primerUso: string | null;
  /** Último día en que se mostró la invitación (máximo una vez cada 30 días) */
  ultimo: string | null;
  /** «No volver a mostrar» */
  nunca: boolean;
  /** Día del último momento positivo (racha de 7, logro, meta cumplida, nueva etapa) */
  momento: string | null;
  /** Día del último momento negativo (mes en rojo, racha rota) */
  negativo: string | null;
}

export const almacenRecomendar = crearAlmacen<DatosRecomendar>(
  "lifeos:recomendar",
  () => ({ version: 1, primerUso: null, ultimo: null, nunca: false, momento: null, negativo: null }),
  (c) => ({
    version: 1,
    primerUso: (c.primerUso as string) ?? null,
    ultimo: (c.ultimo as string) ?? null,
    nunca: !!c.nunca,
    momento: (c.momento as string) ?? null,
    negativo: (c.negativo as string) ?? null,
  }),
);

export const DIAS_DE_USO = 7;
export const CADA_DIAS = 30;

/**
 * ¿Se muestra hoy? Deben cumplirse todas: 7 días de uso o más, un momento positivo hoy, ningún
 * momento negativo hoy, ánimo no bajo, nunca antes de 30 días desde la última vez y no haber
 * elegido «No volver a mostrar». (El día del onboarding queda fuera por los 7 días de uso.)
 */
export function debeMostrar(d: DatosRecomendar, hoy: string, o: { diaDificil: boolean; primerDiaActivo?: string | null }): boolean {
  if (d.nunca || o.diaDificil) return false;
  const desde = [d.primerUso, o.primerDiaActivo].filter((x): x is string => !!x).sort()[0];
  if (!desde || diffDays(hoy, desde) < DIAS_DE_USO) return false;
  if (d.momento !== hoy || d.negativo === hoy) return false;
  if (d.ultimo && diffDays(hoy, d.ultimo) < CADA_DIAS) return false;
  return true;
}

export function marcarMomento(tipo: "positivo" | "negativo", hoy: string) {
  almacenRecomendar.cambiar((d) => (tipo === "positivo" ? { ...d, momento: hoy } : { ...d, negativo: hoy }));
}
