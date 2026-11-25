# LIFE OS 2027

Sistema personal para administrar finanzas, proyectos, hábitos, wishlist, objetivos y calendario.
Español · COP · America/Bogota.

## Ejecutar

```bash
npm install
npm run dev        # http://localhost:3000
```

## Estado de los datos

| Modo | Cuándo | Dónde se guardan |
|---|---|---|
| **Local** (actual) | Sin variables de Supabase | `localStorage` de este navegador. No hay nube ni sincronización entre dispositivos. |
| **Supabase** | Con `.env.local` configurado | PostgreSQL con Auth y RLS: cada persona ve solo sus datos. |

La app indica el modo activo en el menú lateral y en Configuración.

### Conectar Supabase (lo que falta)

1. Crear un proyecto en supabase.com.
2. En **SQL Editor**, ejecutar `supabase/migrations/0001_life_os.sql` (22 tablas, RLS y triggers).
3. Copiar `.env.example` a `.env.local` y completar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Reiniciar `npm run dev`. Aparece `/login` (correo + contraseña) y los datos pasan a la nube.
5. Para desplegar en Vercel, agregar las mismas dos variables en el proyecto.

Los datos guardados en modo local no se migran solos: expórtalos desde Configuración → *Exportar mis datos (JSON)*.

## Arquitectura

```
src/
  app/            rutas (App Router). (app)/ comparte el shell con sidebar
  components/     ui/ (design system), layout/ (sidebar, header, navegación móvil), charts/, providers/
  modules/        dashboard, finance, projects, habits, other (wishlist, objetivos, calendario, configuración)
                  cada módulo tiene sus constantes, cálculos (selectors) y formularios
  hooks/          useToday (fecha Bogotá), useNotifications (avisos calculados)
  lib/            supabase.ts, store/DataProvider (estado + persistencia)
  services/       DataAdapter: localAdapter y supabaseAdapter con el mismo contrato
  types/          entidades (coinciden con el SQL)
  utils/          dinero, fechas, cn
supabase/migrations/   esquema SQL
```

**Reglas financieras**

- Los importes se manejan como pesos enteros en el cliente y como `numeric(14,2)` en la base de datos: nunca hay errores de redondeo por punto flotante.
- El saldo de una cuenta no se guarda: se calcula como saldo inicial + ingresos − gastos ± transferencias completadas.
- Una transferencia es un único registro con cuenta origen y destino. No cuenta como ingreso ni como gasto.
- Los movimientos *pendientes* no afectan el saldo.
- Las tarjetas de crédito guardan la deuda como saldo negativo.

## Fases

**Entrega 1 (lista):** shell responsive, dashboard con 9 widgets, Finanzas (resumen, movimientos con filtros y CSV, cuentas, transferencias, ahorros), Proyectos (lista y Kanban, tareas y subtareas), Hábitos (rachas, semana y mes), Wishlist, Objetivos 2027, Calendario (mes, semana, día) y Configuración (perfil, categorías, exportar y borrar datos).

**Wishlist con enlace:** al pegar el enlace de un producto, `GET /api/producto?url=` lo lee en el servidor (`src/services/linkPreview.ts`) y completa nombre, precio e imagen con los datos Open Graph / JSON-LD de la página. Solo acepta http/https públicos (valida cada redirección contra IPs privadas), con tiempo límite y tamaño máximo. Probado: Falabella, Alkosto, IKEA y Homecenter (sin imagen). Mercado Libre pide verificación anti-bots y su API ahora exige credenciales: se informa y se completa a mano.

**Siguiente fase:** presupuestos con alertas al 80 % y 100 %, deudas y pagos, análisis financiero con proyecciones, entrenamiento, plan de comidas y lista de mercado, hitos de objetivos, foto de perfil, notificaciones persistentes. Las tablas ya existen en el SQL.
