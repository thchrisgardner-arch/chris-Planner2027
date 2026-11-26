"use client";

/**
 * Importar extracto (CSV o Excel): subir → columnas → revisar → confirmar. Todo se lee en el
 * navegador; ningún archivo sale del dispositivo. Las columnas de cada banco se recuerdan.
 */
import { useMemo, useRef, useState } from "react";
import { FileUp, Upload } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/misc";
import { Switch } from "@/components/ui/Switch";
import { Asistente } from "@/components/asistentes/Asistente";
import { useData } from "@/lib/store/DataProvider";
import { useAsistentes } from "@/lib/asistentes/estado";
import { almacenCaptura, guardarPlantilla, recordarCategoria, type PlantillaBanco } from "@/lib/captura/aprendizaje";
import { palabraClave } from "@/lib/captura/interpretar";
import { construirFilas, decodificar, leerCSV, separarEncabezados, sugerirPlantilla, type Celda, type FilaExtracto, type Hoja } from "@/lib/finanzas/extracto";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./constants";
import { formatShortDate } from "@/utils/dates";
import { formatCOP } from "@/utils/money";
import { cn } from "@/utils/cn";

type Paso = "archivo" | "columnas" | "revisar" | "listo";
type Config = Omit<PlantillaBanco, "encabezados">;

export function ImportarExtracto({ onClose }: { onClose: () => void }) {
  const { db, insertMany } = useData();
  const { estado } = useAsistentes();
  const centavo = estado.ajustes.centavo;
  const guardado = almacenCaptura.useValor();
  const archivo = useRef<HTMLInputElement>(null);
  const [paso, setPaso] = useState<Paso>("archivo");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [hoja, setHoja] = useState<Hoja | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [filas, setFilas] = useState<FilaExtracto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [importados, setImportados] = useState(0);

  const categoriasGasto = useMemo(
    () => [...EXPENSE_CATEGORIES, ...db.transaction_categories.filter((c) => c.kind === "gasto").map((c) => c.name).filter((c) => !EXPENSE_CATEGORIES.includes(c))],
    [db.transaction_categories],
  );
  const categoriasIngreso = useMemo(
    () => [...INCOME_CATEGORIES, ...db.transaction_categories.filter((c) => c.kind === "ingreso").map((c) => c.name).filter((c) => !INCOME_CATEGORIES.includes(c))],
    [db.transaction_categories],
  );

  const leer = async (f: File) => {
    setError(null);
    setCargando(true);
    try {
      let crudas: Celda[][];
      if (/\.xlsx$/i.test(f.name)) {
        const { default: readXlsxFile } = await import("read-excel-file");
        crudas = (await readXlsxFile(f)) as Celda[][];
      } else if (/\.xls$/i.test(f.name)) {
        throw new Error("Los archivos .xls antiguos no se pueden leer. Ábrelo en Excel y guárdalo como .xlsx o .csv.");
      } else {
        crudas = leerCSV(decodificar(await f.arrayBuffer()));
      }
      const h = separarEncabezados(crudas);
      if (!h.datos.length) throw new Error("El archivo no tiene movimientos.");
      const sug = sugerirPlantilla(h);
      // ¿Ya conocemos este banco? (mismos encabezados)
      const firma = h.encabezados.join("|");
      const conocida = guardado.plantillas.find((p) => p.encabezados.join("|") === firma);
      const cuenta = conocida?.cuentaId && db.accounts.some((a) => a.id === conocida.cuentaId) ? conocida.cuentaId : (db.accounts.find((a) => a.type !== "tarjeta_credito")?.id ?? db.accounts[0]?.id ?? null);
      setHoja(h);
      setCfg(conocida ? { ...conocida, cuentaId: cuenta } : { ...sug, nombre: f.name.replace(/\.[^.]+$/, ""), cuentaId: cuenta });
      setNombreArchivo(f.name);
      setPaso("columnas");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    } finally {
      setCargando(false);
    }
  };

  const revisar = () => {
    if (!hoja || !cfg) return;
    if (!cfg.cuentaId) return setError("Elige la cuenta a la que pertenece el extracto.");
    setError(null);
    setFilas(
      construirFilas(hoja, {
        plantilla: cfg,
        existentes: db.transactions,
        categoriasGasto,
        categoriasIngreso,
        aprendidas: guardado.categorias,
      }),
    );
    setPaso("revisar");
  };

  const elegidas = filas.filter((f) => f.incluir);
  const duplicados = filas.filter((f) => f.duplicado).length;
  const conError = filas.filter((f) => f.error).length;

  const confirmar = async () => {
    if (!cfg || !hoja || !elegidas.length) return;
    setCargando(true);
    setProgreso(0);
    try {
      const nuevos = await insertMany(
        "transactions",
        elegidas.map((f) => ({
          type: f.tipo,
          description: f.descripcion,
          amount: f.monto,
          category: f.categoria,
          account_id: cfg.cuentaId!,
          to_account_id: null,
          date: f.fecha!,
          payment_method: null,
          status: "completado" as const,
          beneficiary: f.tipo === "gasto" ? ("para_mi" as const) : null,
          notes: null,
        })),
        setProgreso,
      );
      guardarPlantilla({ ...cfg, encabezados: hoja.encabezados });
      setImportados(nuevos.length);
      setPaso("listo");
    } catch (e) {
      setError(e instanceof Error ? `Se detuvo la importación: ${e.message}` : "Se detuvo la importación.");
    } finally {
      setCargando(false);
    }
  };

  const cambiarFila = (i: number, patch: Partial<FilaExtracto>) => setFilas((fs) => fs.map((f) => (f.i === i ? { ...f, ...patch } : f)));
  const columnas = hoja?.encabezados ?? [];
  // Lista (no Fragment): el Select de la app lee las <option> hijas directas
  const opcionesColumna = (vacio?: string) => [
    ...(vacio
      ? [
          <option key="-1" value="-1">
            {vacio}
          </option>,
        ]
      : []),
    ...columnas.map((c, k) => (
      <option key={k} value={String(k)}>
        {c}
      </option>
    )),
  ];

  const footer =
    paso === "archivo" ? (
      <Button variant="ghost" onClick={onClose}>
        Cancelar
      </Button>
    ) : paso === "columnas" ? (
      <>
        <Button variant="ghost" onClick={() => setPaso("archivo")}>
          Atrás
        </Button>
        <Button variant="primary" onClick={revisar}>
          Revisar movimientos
        </Button>
      </>
    ) : paso === "revisar" ? (
      <>
        <Button variant="ghost" onClick={() => setPaso("columnas")} disabled={cargando}>
          Atrás
        </Button>
        <Button variant="primary" onClick={() => void confirmar()} loading={cargando} disabled={!elegidas.length}>
          {cargando ? `Importando ${progreso} de ${elegidas.length}` : `Importar ${elegidas.length}`}
        </Button>
      </>
    ) : (
      <Button variant="primary" onClick={onClose} data-autofocus>
        Listo
      </Button>
    );

  return (
    <Modal
      open
      onClose={() => !cargando && onClose()}
      size="lg"
      title="Importar extracto"
      description={paso === "listo" ? undefined : "CSV o Excel de tu banco. El archivo se lee en este dispositivo; no se sube a ningún servidor."}
      footer={footer}
    >
      {paso === "archivo" ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => archivo.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) void leer(f);
            }}
            className="focus-ring flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-line-strong bg-card px-6 text-center transition-colors hover:bg-elev"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-bg" aria-hidden>
              <Upload size={20} />
            </span>
            <span className="text-[15px] font-medium">{cargando ? "Leyendo…" : "Elige o arrastra el archivo"}</span>
            <span className="text-[12.5px] text-muted">.csv o .xlsx · Bancolombia, Davivienda, Nequi, Nu y la mayoría de bancos</span>
          </button>
          <input
            ref={archivo}
            type="file"
            accept=".csv,.txt,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            aria-label="Archivo del extracto"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void leer(f);
              e.target.value = "";
            }}
          />
          {guardado.plantillas.length ? (
            <p className="text-[12.5px] text-muted">
              Bancos que ya conozco: {guardado.plantillas.map((p) => p.nombre).join(", ")}. Si el archivo tiene las mismas columnas, las uso solas.
            </p>
          ) : null}
        </div>
      ) : null}

      {paso === "columnas" && cfg && hoja ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <FileUp size={16} aria-hidden /> {nombreArchivo} · {hoja.datos.length} filas
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Banco (para recordar estas columnas)">
              {(id) => <Input id={id} value={cfg.nombre} onChange={(e) => setCfg({ ...cfg, nombre: e.target.value })} />}
            </Field>
            <Field label="Cuenta">
              {(id) => (
                <Select id={id} value={cfg.cuentaId ?? ""} onChange={(e) => setCfg({ ...cfg, cuentaId: e.target.value || null })}>
                  {!db.accounts.length ? <option value="">Primero agrega una cuenta</option> : null}
                  {db.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Fecha">
              {(id) => (
                <Select id={id} value={String(cfg.fecha)} onChange={(e) => setCfg({ ...cfg, fecha: Number(e.target.value) })}>
                  {opcionesColumna()}
                </Select>
              )}
            </Field>
            <Field label="Descripción">
              {(id) => (
                <Select id={id} value={String(cfg.descripcion)} onChange={(e) => setCfg({ ...cfg, descripcion: Number(e.target.value) })}>
                  {opcionesColumna()}
                </Select>
              )}
            </Field>
            <Field label="El valor viene en">
              {(id) => (
                <Select
                  id={id}
                  value={cfg.monto !== null ? "una" : "dos"}
                  onChange={(e) =>
                    setCfg(
                      e.target.value === "una"
                        ? { ...cfg, monto: cfg.monto ?? cfg.debito ?? 0, debito: null, credito: null }
                        : { ...cfg, monto: null, debito: cfg.debito ?? cfg.monto ?? 0, credito: cfg.credito ?? 0 },
                    )
                  }
                >
                  <option value="una">Una columna (gastos con signo menos)</option>
                  <option value="dos">Dos columnas: débito y crédito</option>
                </Select>
              )}
            </Field>
            {cfg.monto !== null ? (
              <Field label="Valor">
                {(id) => (
                  <Select id={id} value={String(cfg.monto)} onChange={(e) => setCfg({ ...cfg, monto: Number(e.target.value) })}>
                    {opcionesColumna()}
                  </Select>
                )}
              </Field>
            ) : (
              <>
                <Field label="Débito (salidas)">
                  {(id) => (
                    <Select id={id} value={String(cfg.debito ?? -1)} onChange={(e) => setCfg({ ...cfg, debito: Number(e.target.value) < 0 ? null : Number(e.target.value) })}>
                      {opcionesColumna("Ninguna")}
                    </Select>
                  )}
                </Field>
                <Field label="Crédito (entradas)">
                  {(id) => (
                    <Select id={id} value={String(cfg.credito ?? -1)} onChange={(e) => setCfg({ ...cfg, credito: Number(e.target.value) < 0 ? null : Number(e.target.value) })}>
                      {opcionesColumna("Ninguna")}
                    </Select>
                  )}
                </Field>
              </>
            )}
          </div>
          {cfg.monto !== null ? (
            <div className="flex items-center justify-between gap-3 rounded-[16px] bg-card px-4 py-3 text-[13.5px]">
              <span>Los gastos vienen como números positivos</span>
              <Switch checked={cfg.invertirSigno} onChange={(v) => setCfg({ ...cfg, invertirSigno: v })} label="Los gastos vienen como números positivos" />
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-[16px] bg-card">
            <table className="w-full min-w-[480px] text-left text-[12.5px]">
              <caption className="sr-only">Primeras filas del archivo</caption>
              <thead>
                <tr className="text-muted">
                  {columnas.map((c, k) => (
                    <th key={k} scope="col" className="px-3 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hoja.datos.slice(0, 3).map((f, i) => (
                  <tr key={i} className="border-t border-line">
                    {columnas.map((_, k) => (
                      <td key={k} className="max-w-[220px] truncate px-3 py-2">
                        {f[k] instanceof Date ? (f[k] as Date).toISOString().slice(0, 10) : String(f[k] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {paso === "revisar" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" aria-live="polite">
            <Badge tone="ink">{elegidas.length} para importar</Badge>
            {duplicados ? <Badge tone="warn">{duplicados} posibles duplicados (sin marcar)</Badge> : null}
            {conError ? <Badge tone="danger">{conError} con error</Badge> : null}
          </div>
          <ul className="flex max-h-[46dvh] flex-col gap-1.5 overflow-y-auto pr-1">
            {filas.map((f) => (
              <li key={f.i} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[16px] bg-card px-3 py-2.5", !f.incluir && "opacity-60")}>
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-fg)]"
                  checked={f.incluir}
                  disabled={!!f.error}
                  aria-label={`Importar ${f.descripcion}`}
                  onChange={(e) => cambiarFila(f.i, { incluir: e.target.checked })}
                />
                <div className="min-w-0 flex-1 basis-[180px]">
                  <p className="truncate text-[13.5px]">{f.descripcion || "Sin descripción"}</p>
                  <p className="text-[12px] text-muted">
                    {f.fecha ? formatShortDate(f.fecha) : "—"}
                    {f.duplicado ? " · ya existe" : ""}
                    {f.error ? ` · ${f.error}` : ""}
                  </p>
                </div>
                <div className="w-[170px] shrink-0">
                  <Select
                    aria-label={`Categoría de ${f.descripcion}`}
                    value={f.categoria}
                    onChange={(e) => {
                      cambiarFila(f.i, { categoria: e.target.value });
                      recordarCategoria(palabraClave(f.descripcion), e.target.value);
                    }}
                  >
                    {(f.tipo === "gasto" ? categoriasGasto : categoriasIngreso).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <span className={cn("num w-[110px] shrink-0 text-right text-[13.5px] font-medium", f.tipo === "ingreso" && "text-brand-soft")}>
                  {f.tipo === "gasto" ? "−" : "+"}
                  {formatCOP(f.monto)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {paso === "listo" ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center" aria-live="polite">
          <Asistente id="centavo" size={120} pose="celebrando" colores={centavo.colores} accesorio={centavo.accesorio} nombre={`${centavo.nombre}, celebrando`} />
          <p className="text-[20px] font-bold leading-snug">{importados} movimientos. Por fin hablamos el mismo idioma.</p>
          <p className="text-[13.5px] text-muted">
            {centavo.nombre} ya los tiene en Finanzas. Si cambias una categoría, la recuerdo para el próximo extracto.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 text-[12.5px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
