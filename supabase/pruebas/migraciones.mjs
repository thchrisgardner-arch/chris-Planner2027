// Prueba las migraciones de supabase/migrations en un Postgres real (PGlite), con un auth mínimo como el de Supabase.
// Uso: npm run test:db   (no necesita un proyecto de Supabase ni conexión)
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "supabase/migrations";
const db = new PGlite();
let ok = 0;
let fallos = 0;
const check = (nombre, cond, extra = "") => {
  if (cond) ok++;
  else fallos++;
  console.log(`${cond ? "OK   " : "FALLA"} ${nombre}${extra ? " · " + extra : ""}`);
};
const falla = async (nombre, sql, params) => {
  try {
    await db.query(sql, params);
    check(nombre, false, "no dio error");
  } catch (e) {
    check(nombre, true, e.message.split("\n")[0]);
  }
};

// ── Auth mínimo (igual que Supabase: auth.uid() lee el "sub" del token) ──
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);

// ── Storage mínimo (como el de Supabase: buckets, objects con RLS y foldername) ──
await db.exec(`
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text not null, owner uuid);
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant all on storage.objects to anon, authenticated;
  grant select on storage.buckets to anon, authenticated;
`);

const A = "aaaaaaaa-0000-0000-0000-000000000001";
const B = "bbbbbbbb-0000-0000-0000-000000000002";
const correr = async (f) => db.exec(readFileSync(join(dir, f), "utf8").replace("create extension if not exists pgcrypto;", ""));
await correr("0001_life_os.sql");
await correr("0002_deudas.sql");
await correr("0003_areas_objetivos.sql");
await db.exec(`insert into auth.users values ('${A}'), ('${B}');`);

// Datos que ya existían antes de 0004 (con fecha vieja)
await db.exec(`
  insert into public.accounts (id, user_id, name, type, created_at)
  values ('11111111-0000-0000-0000-000000000001', '${A}', 'Banco viejo', 'banco', '2026-01-15T10:00:00Z');
`);

// ── Migración (dos veces: debe ser repetible) ──
await correr("0004_sincronizacion.sql");
await correr("0004_sincronizacion.sql");
check("0004 se ejecuta dos veces sin errores", true);
await correr("0006_paneles.sql");
await correr("0006_paneles.sql");
check("0006 se ejecuta dos veces sin errores", true);
await correr("0005_archivos.sql");
await correr("0005_archivos.sql");
check("0005 se ejecuta dos veces sin errores", true);

const r = await db.query(`select updated_at = created_at as igual, deleted_at, client_id from public.accounts where name = 'Banco viejo'`);
check("filas viejas: updated_at = created_at", r.rows[0].igual === true);
check("filas viejas: deleted_at y client_id vacíos", r.rows[0].deleted_at === null && r.rows[0].client_id === null);

const cols = await db.query(`
  select count(*)::int n from information_schema.columns
  where table_schema = 'public' and column_name in ('updated_at','deleted_at','client_id')`);
check("23 tablas × 3 columnas nuevas", cols.rows[0].n === 69, `${cols.rows[0].n} columnas`);

const idx = await db.query(`select count(*)::int n from pg_indexes where schemaname = 'public' and indexname like '%_sync_idx'`);
check("índice de sincronización en las 23 tablas", idx.rows[0].n === 23, `${idx.rows[0].n} índices`);

// ── Como usuario A ──
const como = async (rol, uid) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${rol};`);
};
await como("authenticated", A);
await db.query(`insert into public.projects (name, updated_at) values ('Portafolio', '2000-01-01')`);
const p = await db.query(`select id, updated_at, created_at, user_id from public.projects where name = 'Portafolio'`);
check("updated_at lo pone el servidor (ignora 2000-01-01)", new Date(p.rows[0].updated_at).getFullYear() > 2020);
check("user_id por defecto = usuario de la sesión", p.rows[0].user_id === A);
const antes = new Date(p.rows[0].updated_at).getTime();
await new Promise((ok) => setTimeout(ok, 15));
await db.query(`update public.projects set name = 'Portafolio 2027', client_id = 'pc-casa' where id = $1`, [p.rows[0].id]);
const p2 = await db.query(`select updated_at, client_id from public.projects where id = $1`, [p.rows[0].id]);
check("updated_at avanza al editar", new Date(p2.rows[0].updated_at).getTime() > antes);
check("client_id se guarda", p2.rows[0].client_id === "pc-casa");
await falla("client_id de más de 64 caracteres se rechaza", `update public.projects set client_id = repeat('x', 65) where id = $1`, [p.rows[0].id]);

await db.query(`insert into public.user_state (clave, data) values ('progreso', '{"xp": 120}')`);
await db.query(`insert into public.user_state (clave, data) values ('closet', '{"piezas": {}}')`);
await falla("clave desconocida en user_state se rechaza", `insert into public.user_state (clave) values ('cualquier-cosa')`);
await falla("documento de más de 1 MB se rechaza", `insert into public.user_state (clave, data) values ('enfoque', jsonb_build_object('x', repeat(md5(random()::text), 70000)))`);
const mios = await db.query(`select count(*)::int n from public.user_state`);
check("A ve sus 2 documentos", mios.rows[0].n === 2);

// Cambios desde una marca: la consulta que usará el motor
const desde = await db.query(`select count(*)::int n from public.projects where updated_at > now() - interval '1 minute'`);
check("consulta incremental por updated_at", desde.rows[0].n === 1);

// ── Como usuario B: no ve ni toca nada de A ──
await como("authenticated", B);
const vB1 = await db.query(`select count(*)::int n from public.user_state`);
const vB2 = await db.query(`select count(*)::int n from public.projects`);
const vB3 = await db.query(`select count(*)::int n from public.accounts`);
check("B no ve documentos de A", vB1.rows[0].n === 0);
check("B no ve proyectos de A", vB2.rows[0].n === 0);
check("B no ve cuentas de A", vB3.rows[0].n === 0);
const up = await db.query(`update public.user_state set data = '{"xp": 999999}' where user_id = '${A}'`);
check("B no puede editar documentos de A", up.affectedRows === 0);
const del = await db.query(`delete from public.projects where user_id = '${A}'`);
check("B no puede borrar proyectos de A", del.affectedRows === 0);
await falla("B no puede escribir a nombre de A", `insert into public.user_state (user_id, clave) values ('${A}', 'asistentes')`);
await db.query(`insert into public.user_state (clave, data) values ('progreso', '{"xp": 5}')`);
check("B tiene su propio 'progreso' sin chocar con el de A", true);

// ── Sin sesión (anon) ──
await como("anon", null);
await falla("anon no puede leer user_state", `select * from public.user_state`);
const anonP = await db.query(`select count(*)::int n from public.projects`);
check("anon no ve proyectos", anonP.rows[0].n === 0);
await falla("anon no puede vaciar la papelera", `select public.sync_purgar(30)`);

// ── Papelera ──
await como("authenticated", A);
await db.query(`update public.projects set deleted_at = now() - interval '40 days'`);
await db.query(`update public.user_state set deleted_at = now() - interval '5 days' where clave = 'closet'`);
const purg = await db.query(`select public.sync_purgar(30) as n`);
check("sync_purgar borra solo lo de más de 30 días", purg.rows[0].n === 1, `${purg.rows[0].n} fila`);
const quedan = await db.query(`select count(*)::int n from public.user_state`);
check("lo borrado hace 5 días sigue en la papelera", quedan.rows[0].n === 2);
await como("authenticated", B);
const deB = await db.query(`select count(*)::int n from public.user_state`);
check("la papelera de A no tocó lo de B", deB.rows[0].n === 1);
await falla("sync_purgar rechaza días < 1", `select public.sync_purgar(0)`);

// ── Lo de antes sigue igual: dueño de las referencias ──
await como("authenticated", A);
await db.query(`insert into public.accounts (name, type) values ('Nequi', 'billetera')`);
await como("authenticated", B);
const cuentaB = await db.query(`insert into public.accounts (name, type) values ('Davivienda', 'banco') returning id`);
await como("authenticated", A);
await falla(
  "regla anterior intacta: A no puede usar la cuenta de B",
  `insert into public.transactions (type, description, amount, account_id, date) values ('gasto', 'x', 10, $1, '2026-11-26')`,
  [cuentaB.rows[0].id],
);

// ── 0005: archivos del espacio de proyectos ──
await db.exec("reset role");
const bucket = await db.query("select public, file_size_limit from storage.buckets where id = 'archivos'");
check("bucket «archivos» privado y con tope de 10 MB", bucket.rows[0]?.public === false && Number(bucket.rows[0]?.file_size_limit) === 10485760);
await como("authenticated", A);
await db.query(`insert into storage.objects (bucket_id, name) values ('archivos', '${A}/voz1')`);
check("A sube a su carpeta", true);
await falla("A no puede subir a la carpeta de B", `insert into storage.objects (bucket_id, name) values ('archivos', '${B}/intruso')`);
await falla("A no puede subir fuera de una carpeta", `insert into storage.objects (bucket_id, name) values ('archivos', 'suelto')`);
await como("authenticated", B);
const verB = await db.query("select count(*)::int n from storage.objects");
check("B no ve los archivos de A", verB.rows[0].n === 0);
const borB = await db.query(`delete from storage.objects where name = '${A}/voz1'`);
check("B no puede borrar archivos de A", borB.affectedRows === 0);
await como("anon", null);
const verAnon = await db.query("select count(*)::int n from storage.objects");
check("sin sesión no se ve ningún archivo", verAnon.rows[0].n === 0);

// ── 0006: paneles de proyectos ──
await como("authenticated", A);
const proyA = await db.query(`insert into public.projects (name) values ('Portafolio') returning id`);
const pid = proyA.rows[0].id;
const reu = await db.query(
  `insert into public.calendar_events (title, date, start_time, project_id, meeting) values ('Reunión: Kickoff', '2026-12-02', '10:00', $1, '{"modalidad":"video","acuerdos":[{"id":"a1","texto":"Enviar propuesta"}]}') returning project_id, meeting`,
  [pid],
);
check("una reunión es un evento con proyecto y datos de reunión", reu.rows[0].project_id === pid && reu.rows[0].meeting.acuerdos.length === 1);
await falla("meeting tiene que ser un objeto", `insert into public.calendar_events (title, date, meeting) values ('x', '2026-12-02', '[1,2]')`);
const tareaResp = await db.query(`insert into public.tasks (name, project_id, assignee) values ('Enviar propuesta', $1, 'Ana') returning assignee`, [pid]);
check("tarea con responsable", tareaResp.rows[0].assignee === "Ana");
await db.query(`insert into public.user_state (clave, data) values ('documentos', '{"notas":[]}')`);
check("user_state admite «documentos»", true);
await como("authenticated", B);
await falla("B no puede poner un evento en el proyecto de A", `insert into public.calendar_events (title, date, project_id) values ('Intruso', '2026-12-02', $1)`, [pid]);
await como("authenticated", A);
await db.query(`delete from public.projects where id = $1`, [pid]);
const huerfano = await db.query(`select project_id from public.calendar_events where title = 'Reunión: Kickoff'`);
check("al borrar el proyecto, el evento queda sin proyecto (no se pierde)", huerfano.rows.length === 1 && huerfano.rows[0].project_id === null);

console.log(`\n${ok} correctas, ${fallos} fallidas`);
process.exit(fallos ? 1 : 0);
