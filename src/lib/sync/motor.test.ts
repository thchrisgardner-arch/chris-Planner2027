import { describe, expect, it } from "vitest";
import { progresoVacio, type Progreso } from "@/lib/asistentes/progreso";
import { CASCADES, type TableName } from "@/types/db";
import { conectar, sincronizar } from "./motor";
import { ORDEN_SUBIDA, TABLAS_SYNC, type Cambio, type ClaveDoc, type Contexto, type DocRemoto, type EstadoSync, type Fila, type FilaRemota, type Remoto } from "./tipos";

/* ═════════ Nube en memoria (el servidor pone la hora, como Postgres) ═════════ */
class Nube {
  filas = new Map<TableName, Map<string, FilaRemota>>();
  docs = new Map<ClaveDoc, DocRemoto>();
  private tic = 0;
  ahora() {
    return new Date(Date.UTC(2026, 10, 26, 12) + ++this.tic * 1000).toISOString();
  }
  tabla(t: TableName) {
    return this.filas.get(t) ?? this.filas.set(t, new Map()).get(t)!;
  }
  remoto(): Remoto {
    const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v));
    return {
      subirFilas: async (t, filas, cid) => {
        for (const f of filas) this.tabla(t).set(f.id, { ...copia(f), user_id: "u1", updated_at: this.ahora(), deleted_at: null, client_id: cid });
      },
      marcarBorradas: async (t, ids, cid) => {
        for (const id of ids) {
          const r = this.tabla(t).get(id);
          if (r) this.tabla(t).set(id, { ...r, deleted_at: this.ahora(), updated_at: this.ahora(), client_id: cid });
        }
      },
      traerFilas: async (t, desde) =>
        copia([...this.tabla(t).values()].filter((r) => !desde || r.updated_at > desde).sort((a, b) => (a.updated_at < b.updated_at ? -1 : 1))),
      idsVivos: async (t) => [...this.tabla(t).values()].filter((r) => !r.deleted_at).map((r) => r.id),
      subirDoc: async (clave, data, cid) => {
        const u = this.ahora();
        this.docs.set(clave, { clave, data: copia(data), updated_at: u, deleted_at: null, client_id: cid });
        return u;
      },
      traerDocs: async (desde) => copia([...this.docs.values()].filter((d) => !desde || d.updated_at > desde)),
      hayDatos: async () => [...this.filas.values()].some((m) => [...m.values()].some((r) => !r.deleted_at)),
      borrarTodo: async () => {
        this.filas.clear();
        this.docs.clear();
      },
    };
  }
}

/* ═════════ Dispositivo simulado (imita localAdapter: cascadas y cambios anotados) ═════════ */
function dispositivo(nube: Nube, nombre: string) {
  const tablas = new Map<TableName, Fila[]>();
  const docs = new Map<ClaveDoc, unknown>();
  let pend: Cambio[] = [];
  let seq = 0;
  let estado: EstadoSync = {
    version: 1,
    activo: true,
    clientId: nombre,
    userId: "u1",
    email: null,
    marcas: {},
    marcaDocs: null,
    docs: {},
    ultimo: null,
    error: null,
    archivos: false,
    subidos: [],
  };
  const anotar = (t: TableName, id: string, op: Cambio["op"]) => pend.push({ seq: ++seq, t, id, op });
  const ctx: Contexto = {
    local: {
      filas: (t) => JSON.parse(JSON.stringify(tablas.get(t) ?? [])),
      guardarFilas: (t, f) => void tablas.set(t, JSON.parse(JSON.stringify(f))),
      doc: (c) => (docs.has(c) ? JSON.parse(JSON.stringify(docs.get(c))) : null),
      guardarDoc: (c, d) => void docs.set(c, JSON.parse(JSON.stringify(d))),
    },
    remoto: nube.remoto(),
    estado: { leer: () => estado, guardar: (e) => void (estado = e) },
    pendientes: {
      leer: () => [...pend],
      quitarHasta: (n) => void (pend = pend.filter((c) => c.seq > n)),
      vaciar: () => void (pend = []),
      agregar: (cs) => cs.forEach((c) => anotar(c.t, c.id, c.op)),
    },
    hoy: "2026-11-26",
  };
  const borrar = (t: TableName, id: string) => {
    tablas.set(
      t,
      (tablas.get(t) ?? []).filter((f) => f.id !== id),
    );
    anotar(t, id, "borrar");
    for (const r of CASCADES[t] ?? []) {
      for (const h of (tablas.get(r.table) ?? []).filter((x) => x[r.field] === id)) {
        if (r.action === "delete") borrar(r.table, h.id);
      }
    }
  };
  return {
    ctx,
    get pendientes() {
      return pend;
    },
    filas: (t: TableName) => tablas.get(t) ?? [],
    doc: (c: ClaveDoc) => docs.get(c),
    ponerDoc: (c: ClaveDoc, d: unknown) => docs.set(c, d),
    insertar: (t: TableName, f: Fila) => {
      tablas.set(t, [...(tablas.get(t) ?? []), { user_id: "local-user", created_at: "2026-11-26T00:00:00Z", ...f }]);
      anotar(t, f.id, "guardar");
    },
    editar: (t: TableName, id: string, patch: Record<string, unknown>) => {
      tablas.set(
        t,
        (tablas.get(t) ?? []).map((f) => (f.id === id ? { ...f, ...patch } : f)),
      );
      anotar(t, id, "guardar");
    },
    borrar,
    sync: () => sincronizar(ctx),
  };
}

const ev = (id: string, refId: string, fecha: string) => ({ id, tipo: "habito" as const, xp: 10, fecha, refId, asistente: "brote" as const });

describe("motor de sincronización", () => {
  it("el orden de subida cubre todas las tablas", () => {
    expect([...ORDEN_SUBIDA].sort()).toEqual([...TABLAS_SYNC].sort());
  });

  it("lo que crea un dispositivo llega al otro", async () => {
    const nube = new Nube();
    const A = dispositivo(nube, "A");
    const B = dispositivo(nube, "B");
    A.insertar("projects", { id: "p1", name: "Portafolio" });
    A.insertar("tasks", { id: "t1", project_id: "p1", name: "Casos" });
    await conectar(A.ctx, "combinar");
    expect(A.pendientes).toHaveLength(0);
    await conectar(B.ctx, "nube");
    expect(B.filas("projects").map((f) => f.name)).toEqual(["Portafolio"]);
    expect(B.filas("tasks")[0]).toMatchObject({ id: "t1", user_id: "local-user" });
    expect(B.filas("tasks")[0]).not.toHaveProperty("updated_at");
  });

  it("cambios cruzados: cada uno ve lo del otro", async () => {
    const nube = new Nube();
    const A = dispositivo(nube, "A");
    const B = dispositivo(nube, "B");
    A.insertar("projects", { id: "p1", name: "Portafolio" });
    await conectar(A.ctx, "combinar");
    await conectar(B.ctx, "nube");
    A.editar("projects", "p1", { name: "Portafolio 2027" });
    B.insertar("habits", { id: "h1", name: "Leer" });
    await A.sync();
    await B.sync();
    await A.sync();
    expect(A.filas("habits").map((f) => f.name)).toEqual(["Leer"]);
    expect(B.filas("projects")[0].name).toBe("Portafolio 2027");
  });

  it("un borrado viaja con su cascada", async () => {
    const nube = new Nube();
    const A = dispositivo(nube, "A");
    const B = dispositivo(nube, "B");
    A.insertar("projects", { id: "p1", name: "Mudanza" });
    A.insertar("tasks", { id: "t1", project_id: "p1", name: "Cotizar" });
    await conectar(A.ctx, "combinar");
    await conectar(B.ctx, "nube");
    A.borrar("projects", "p1");
    await A.sync();
    const r = await B.sync();
    expect(r.tablas).toBe(true);
    expect(B.filas("projects")).toEqual([]);
    expect(B.filas("tasks")).toEqual([]);
    expect(nube.tabla("tasks").get("t1")?.deleted_at).toBeTruthy();
  });

  it("mismo registro editado en los dos: gana el último que llega a la nube", async () => {
    const nube = new Nube();
    const A = dispositivo(nube, "A");
    const B = dispositivo(nube, "B");
    A.insertar("projects", { id: "p1", name: "Base" });
    await conectar(A.ctx, "combinar");
    await conectar(B.ctx, "nube");
    A.editar("projects", "p1", { name: "Desde A" });
    B.editar("projects", "p1", { name: "Desde B" });
    await A.sync();
    await B.sync();
    await A.sync();
    expect(nube.tabla("projects").get("p1")?.name).toBe("Desde B");
    expect(A.filas("projects")[0].name).toBe("Desde B");
    expect(B.filas("projects")[0].name).toBe("Desde B");
  });

  it("un cambio hecho mientras se sincroniza no se pisa", async () => {
    const nube = new Nube();
    const A = dispositivo(nube, "A");
    A.insertar("projects", { id: "p1", name: "Uno" });
    const subirOriginal = A.ctx.remoto.subirFilas;
    A.ctx.remoto.subirFilas = async (t, f, c) => {
      await subirOriginal(t, f, c);
      A.editar("projects", "p1", { name: "Dos" }); // la persona edita justo ahora
    };
    await conectar(A.ctx, "combinar");
    expect(A.filas("projects")[0].name).toBe("Dos");
    expect(A.pendientes).toHaveLength(1);
    A.ctx.remoto.subirFilas = subirOriginal;
    await A.sync();
    expect(nube.tabla("projects").get("p1")?.name).toBe("Dos");
  });

  it("XP: se suma lo de los dos sin duplicar y el clóset se une", async () => {
    const nube = new Nube();
    const A = dispositivo(nube, "A");
    const B = dispositivo(nube, "B");
    const pa: Progreso = { ...progresoVacio(), eventos: [ev("a1", "h1:2026-11-24", "2026-11-24"), ev("a2", "h2:2026-11-25", "2026-11-25")], logros: { "racha-7": "2026-11-20" } };
    const pb: Progreso = { ...progresoVacio(), eventos: [ev("b1", "h1:2026-11-24", "2026-11-24"), ev("b3", "h3:2026-11-26", "2026-11-26")], logros: { "racha-7": "2026-11-18" } };
    pa.racha = { ...pa.racha, diasActivos: ["2026-11-24", "2026-11-25"], mejor: 2 };
    pb.racha = { ...pb.racha, diasActivos: ["2026-11-24", "2026-11-26"], mejor: 1 };
    A.ponerDoc("progreso", pa);
    B.ponerDoc("progreso", pb);
    A.ponerDoc("closet", { version: 1, piezas: { "gafas-sol": { fecha: "2026-11-10", fuente: "racha" } } });
    B.ponerDoc("closet", { version: 1, piezas: { helado: { fecha: "2026-11-12", fuente: "racha" } } });
    await conectar(A.ctx, "combinar");
    await conectar(B.ctx, "combinar");
    await A.sync();
    const p = A.doc("progreso") as Progreso;
    expect(p.eventos.map((e) => e.refId).sort()).toEqual(["h1:2026-11-24", "h2:2026-11-25", "h3:2026-11-26"]);
    expect(p.logros["racha-7"]).toBe("2026-11-18");
    expect(p.racha.actual).toBe(3);
    expect(Object.keys((A.doc("closet") as { piezas: object }).piezas).sort()).toEqual(["gafas-sol", "helado"]);
    expect(B.doc("progreso")).toEqual(A.doc("progreso"));
  });

  it("ajustes de asistentes: el cambio de un dispositivo llega al otro", async () => {
    const nube = new Nube();
    const A = dispositivo(nube, "A");
    const B = dispositivo(nube, "B");
    A.ponerDoc("asistentes", { principal: "centavo" });
    await conectar(A.ctx, "combinar");
    await conectar(B.ctx, "nube");
    A.ponerDoc("asistentes", { principal: "brote" });
    await A.sync();
    const r = await B.sync();
    expect(r.docs).toEqual(["asistentes"]);
    expect(B.doc("asistentes")).toEqual({ principal: "brote" });
  });

  it("sin cambios, un ciclo no sube ni trae nada", async () => {
    const nube = new Nube();
    const A = dispositivo(nube, "A");
    A.insertar("habits", { id: "h1", name: "Leer" });
    A.ponerDoc("asistentes", { principal: "centavo" });
    await conectar(A.ctx, "combinar");
    await A.sync();
    const r = await A.sync();
    expect(r).toEqual({ tablas: false, docs: [], subidas: 0, traidas: 1 });
  });

  it("«usar este dispositivo»: la nube queda igual a este dispositivo", async () => {
    const nube = new Nube();
    const A = dispositivo(nube, "A");
    const B = dispositivo(nube, "B");
    B.insertar("habits", { id: "h-viejo", name: "Viejo" });
    await conectar(B.ctx, "combinar");
    A.insertar("habits", { id: "h1", name: "Leer" });
    await conectar(A.ctx, "dispositivo");
    expect(await nube.remoto().idsVivos("habits")).toEqual(["h1"]);
    await B.sync();
    expect(B.filas("habits").map((f) => f.id)).toEqual(["h1"]);
  });

  it("«usar lo de la nube»: este dispositivo queda igual a la nube", async () => {
    const nube = new Nube();
    const A = dispositivo(nube, "A");
    const B = dispositivo(nube, "B");
    A.insertar("habits", { id: "h1", name: "Leer" });
    await conectar(A.ctx, "combinar");
    B.insertar("habits", { id: "h-local", name: "Solo aquí" });
    await conectar(B.ctx, "nube");
    expect(B.filas("habits").map((f) => f.id)).toEqual(["h1"]);
    expect(await nube.remoto().idsVivos("habits")).toEqual(["h1"]);
  });
});
