"use client";

/**
 * Botón «Exportar» con las opciones Word, Excel, PDF y Texto. `crear` arma el documento al momento de exportar
 * (con los datos y filtros de ese instante); el archivo se crea en el navegador y se descarga.
 */
import { useState } from "react";
import { Download, FileSpreadsheet, FileText, FileType, NotebookText } from "lucide-react";
import { Popover, MenuItem } from "@/components/ui/Popover";
import { Button } from "@/components/ui/Button";
import { useFeedback } from "@/components/providers/FeedbackProvider";
import { useToday } from "@/hooks/useToday";
import { FORMATOS, nombreArchivo, type Documento, type Formato } from "@/lib/exportar/documento";
import { descargar } from "@/lib/proyectos/exportarVoz";

const ICONOS: Record<Formato, React.ReactNode> = {
  word: <FileType size={18} />,
  excel: <FileSpreadsheet size={18} />,
  pdf: <FileText size={18} />,
  texto: <NotebookText size={18} />,
};

export function MenuExportar({
  crear,
  archivo,
  etiqueta = "Exportar",
  vacio = "No hay datos para exportar.",
  className,
  variant = "secondary",
  alinear = "start",
}: {
  /** Hacia dónde se abre el menú: «start» desde el borde izquierdo del botón, «end» desde el derecho */
  alinear?: "start" | "end";
  crear: () => Documento;
  /** Base del nombre del archivo ("movimientos" → movimientos-2026-11-27.xlsx) */
  archivo: string;
  etiqueta?: string;
  vacio?: string;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const { toast } = useFeedback();
  const today = useToday();
  const [creando, setCreando] = useState<Formato | null>(null);

  const exportar = async (formato: Formato) => {
    const doc = crear();
    const registros = doc.secciones.reduce((n, s) => n + s.filas.length, 0);
    if (!registros) return toast(vacio, "error");
    setCreando(formato);
    try {
      const { crearArchivo } = await import("@/lib/exportar/formatos");
      const blob = await crearArchivo(doc, formato);
      const f = FORMATOS.find((x) => x.value === formato)!;
      descargar(blob, `${nombreArchivo(archivo)}-${today}.${f.ext}`);
      toast(`Exportado en ${f.label}: ${registros} ${registros === 1 ? "registro" : "registros"}.`);
    } catch {
      toast("No se pudo crear el archivo. Intenta de nuevo.", "error");
    } finally {
      setCreando(null);
    }
  };

  return (
    <Popover
      align={alinear}
      className="w-[260px] p-2"
      trigger={({ open, toggle }) => (
        <Button variant={variant} className={className} onClick={toggle} aria-expanded={open} aria-haspopup="menu" disabled={creando !== null}>
          <Download size={18} /> {creando ? "Creando archivo…" : etiqueta}
        </Button>
      )}
    >
      {(cerrar) => (
        <div role="menu" aria-label="Formato del archivo">
          <p className="px-3 pb-1 pt-1.5 text-[11.5px] font-medium text-muted">Formato</p>
          {FORMATOS.map((f) => (
            <MenuItem
              key={f.value}
              icon={ICONOS[f.value]}
              hint={f.detalle}
              onClick={() => {
                cerrar();
                void exportar(f.value);
              }}
            >
              {f.label}
            </MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}
