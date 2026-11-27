/** Los seis paneles de un proyecto (sin estado: se puede importar desde el servidor) */
export const PANELES = ["tareas", "notas-de-voz", "reuniones", "notas", "imagenes", "calendario"] as const;
export type Panel = (typeof PANELES)[number];
export const esPanel = (v: string | null | undefined): v is Panel => (PANELES as readonly string[]).includes(v ?? "");
