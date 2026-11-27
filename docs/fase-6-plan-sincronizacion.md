# Fase 6 · Plan de sincronización con Supabase

> Solo plan. No se escribe código de sincronización hasta que apruebes este documento.
> Fecha: 26 nov 2026 · Estado de la app: Fases 0–5 en `main` (`694b5fe`).

## 1. Cómo está hoy

**La base de datos ya existe en el código.** `supabase/migrations/0001–0003` crean 21 tablas (cuentas, movimientos, presupuestos, ahorros, deudas, proyectos, tareas, hábitos, entrenamientos, comidas, wishlist, objetivos, calendario, avisos…). Todas tienen RLS «solo el dueño» (`user_id = auth.uid()`) y un disparador que impide mezclar filas de dos usuarios. `src/services/supabaseAdapter.ts` ya lee y escribe esas tablas.

**Pero el cambio es todo o nada.** `DataProvider` elige el adaptador por las variables de entorno:
- Sin `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` → modo local (localStorage). **Es el estado actual** (`.env.local` no las tiene).
- Con ellas → modo Supabase para todo el mundo, con inicio de sesión obligatorio, y los datos locales no se migran.

Eso choca con la regla del proyecto: *nada sale del dispositivo sin que el usuario active la sincronización.* Este plan lo corrige.

**Lo que vive fuera de las 21 tablas** (no se sincronizaría hoy aunque se active Supabase):

| Clave local | Qué guarda | ¿Sincronizar? |
|---|---|---|
| `lifeos:asistentes` | Nombre, colores, accesorio, tono y avisos de cada asistente | Sí |
| `lifeos:progreso` | XP (eventos), racha, logros, misiones, ajustes de gamificación | Sí (fusión especial) |
| `lifeos:closet` | Piezas ganadas y su fecha | Sí (unión) |
| `lifeos:pagos-fijos` | Pagos fijos y pendientes | Sí |
| `lifeos:enfoque` | Bloques de enfoque | Sí |
| `lifeos:animo-usuario` · `lifeos:animo-historial` | Chequeos de ánimo e historial de salud de módulos | Sí (dato sensible: ver §5) |
| `lifeos:conexiones` | Conexiones del día ya mostradas | Sí |
| `lifeos:salud` | Perfil de salud | Sí (dato sensible) |
| `lifeos:espacio` + IndexedDB `lifeos-archivos` | Espacio de proyectos: notas, audios, imágenes | Notas sí · archivos opcional (§4.5) |
| `lifeos:captura`, `lifeos:tutorial`, `lifeos:onboarding-done` | Preferencias y banderas de interfaz | Sí (baratas) |
| `lifeos:avisos` | Suscripción push de **este** dispositivo | No (es por dispositivo; ya va a Upstash, solo conteos) |
| `lifeos-demo`, `lifeos:session`, `lifeos:sesion-bienvenida`, `lifeos:uso` | Sesión, modo demo, métricas locales | No |

## 2. Principios

1. **Local primero.** El dispositivo sigue siendo la fuente que la app lee; la nube es una copia que se mantiene al día. La app funciona igual sin conexión.
2. **Apagado por defecto.** Aunque Vercel tenga las variables de Supabase, nadie sube nada hasta activar «Sincronizar entre dispositivos» en Configuración.
3. **Llaves solo en entorno.** `.env.local` y variables de Vercel. Solo la llave pública (`anon`) llega al navegador; la `service_role` nunca.
4. **El modo demo nunca sincroniza.**
5. **Sin pagos.** El modelo de packs cosméticos del clóset (`fuente: "pack"`) queda listo, sin cobro.

## 3. Arquitectura propuesta

```
 UI ──lee/escribe──▶ almacenes locales (como hoy)
                        │ cada cambio
                        ▼
                  bandeja de salida (outbox, IndexedDB)
                        │ en segundo plano, con conexión
                        ▼
                  Supabase (tablas + user_state)  ──▶  otros dispositivos lo traen al abrir / cada 60 s / al volver a la pestaña
```

- **Bandeja de salida:** cada insert/update/delete local se anota (tabla, id, cambio, hora). Se envía en lotes; si falla, reintenta con espera creciente. Nada se pierde sin conexión.
- **Traer cambios:** al abrir la app, al volver a la pestaña y cada 60 s, se piden filas con `updated_at` mayor que la última sincronización. (Realtime de Supabase queda como mejora posterior.)
- **Borrados:** borrado suave (`deleted_at`) para que el borrado viaje a los otros dispositivos; se purga a los 30 días.

### Conflictos

| Tipo de dato | Regla |
|---|---|
| Filas de las 21 tablas | Gana el cambio más reciente por fila (`updated_at` lo pone el servidor). |
| `progreso` | Eventos de XP: **unión por id** (nunca se pierde XP de ningún dispositivo). Racha: se recalcula con la unión de días activos. Logros: unión, con la fecha más antigua. `nivelMax`: el mayor. |
| `closet` | Unión de piezas (la fecha más antigua). |
| `asistentes`, ajustes y banderas | Gana el más reciente por clave. |
| Pagos fijos, enfoque, ánimo, conexiones | Unión por id + el más reciente por elemento. |

## 4. Cambios por etapa (un commit y una revisión contigo por etapa)

### 6.1 Base de datos (`0004_sincronizacion.sql`)
- En las 21 tablas: `updated_at` (puesto por disparador), `deleted_at`, `client_id` (qué dispositivo hizo el cambio), índice `(user_id, updated_at)`.
- Tabla nueva `user_state (user_id, clave, version, data jsonb, updated_at)` con llave `(user_id, clave)` y la misma RLS «solo el dueño». Una fila por almacén local.
- Prueba de RLS con dos usuarios: ninguno puede leer ni escribir lo del otro.

### 6.2 Motor de sincronización (`src/lib/sync/`)
- Bandeja de salida, envío por lotes, traída incremental y fusiones de la tabla anterior.
- Pruebas con vitest: dos dispositivos simulados, cambios cruzados, sin conexión y regreso, borrados, XP sumado en ambos lados.

### 6.3 Activar y desactivar (Configuración)
- Tarjeta «Sincronizar entre dispositivos»: qué se sube, qué no, y el botón para activar.
- Cuenta: la pantalla `/login` ya tiene correo y contraseña con Supabase Auth; se propone sumar el enlace mágico por correo (sin contraseña que recordar).
- **Primer volcado:** antes de nada se descarga un respaldo automático (el exportar que ya existe). Si la nube está vacía, sube lo local; si ya tiene datos, eliges *combinar*, *usar lo de la nube* o *usar este dispositivo*.
- Desactivar: deja de sincronizar y conserva la copia local. Aparte: «Borrar mis datos de la nube» (elimina todo lo del usuario).
- Indicador discreto en el menú: sincronizado / pendiente / sin conexión, reutilizando componentes existentes (sin cambio de diseño).

### 6.4 Almacenes locales → `user_state`
- `crearAlmacen` gana un gancho `alGuardar` para avisar a la bandeja de salida; cada almacén declara su regla de fusión.

### 6.5 Archivos del espacio de proyectos (opcional)
- Bucket privado `archivos` en Supabase Storage, ruta `user_id/…`, política «solo el dueño», límite por archivo (10 MB). Apagado por defecto aunque la sincronización esté activa.

### Verificación de cada etapa
`tsc`, lint, vitest, build de producción, regresión visual contra `docs/regresion/fase5` y prueba real en dos navegadores con la misma cuenta.

## 5. Seguridad y privacidad

- RLS en todas las tablas, en `user_state` y en Storage; ninguna consulta usa la llave de servicio desde el navegador.
- Ánimo y perfil de salud son datos sensibles: solo se suben con la sincronización activa y se muestran en la lista de «qué se sube».
- Exportar y borrar los datos de la nube desde la app (derecho de acceso y supresión, Ley 1581 de 2012 de Colombia).
- Los avisos al celular siguen igual: solo conteos y horas en Upstash, nunca nombres ni montos.

## 6. Lo que necesito de ti antes de empezar

1. **Crear el proyecto en Supabase** (región sugerida: São Paulo, `sa-east-1`) y poner `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local` y en Vercel. Yo no manejo las llaves.
2. **Inicio de sesión:** ¿enlace mágico por correo (recomendado) o también Google?
3. **Archivos (6.5):** ¿se incluyen o se dejan para después?
4. **Aprobación** para arrancar por 6.1.

## 7. Riesgos

- **Plan gratuito de Supabase:** 500 MB de base y 1 GB de archivos; sobra para una persona, pero los audios del espacio de proyectos pueden llenarlo (por eso 6.5 es opcional y con límite).
- **Relojes distintos entre dispositivos:** se evita porque `updated_at` lo pone el servidor.
- **Si Vercel ya tuviera las variables de Supabase:** hoy eso obliga a iniciar sesión y guarda todo en la nube. En `.env.local` no están; hay que confirmar en Vercel antes de 6.3, porque el cambio a «apagado por defecto» afectaría a quien ya use ese modo.
