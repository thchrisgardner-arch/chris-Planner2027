# LIFE for LIFE (LIFE OS 2027) — Auditoría UX/UI, Product Design y QA

Fecha: 2026-11-26 · Rama: `rediseno-pro` · Next 16.4.6 + React 19 + Tailwind 4
Este informe se escribió **antes** de modificar archivos. Todo lo marcado como «verificado» se comprobó en ejecución o en el código; lo que no se pudo comprobar se indica como tal.

---

## 1. Resumen ejecutivo

La app está sólida en lo básico: compila, pasa TypeScript y ESLint sin errores, no tiene errores de consola en las 18 rutas, no se desborda en ningún ancho probado (360–1440 px) y el cálculo de transferencias es correcto. Los problemas importantes están en **integridad de datos** (borrados en cascada que cambian saldos de otras cuentas, datos huérfanos, «Borrar todo» incompleto), en **accesibilidad** (contraste del texto gris claro, modales sin trampa de foco, cajón móvil enfocable estando oculto) y en **rendimiento en celular** (TBT 1,7 s).

| Categoría | Resultado |
|---|---|
| `tsc --noEmit` | ✅ sin errores |
| `eslint src` | ✅ sin errores |
| `next build` | ✅ 21 páginas |
| Consola (18 rutas, modo demo) | ✅ sin errores |
| Responsive 360 / 390 / 768 / 1280 / 1440 | ✅ 18/18 rutas sin desbordes en todos los anchos |
| Lighthouse celular (inicio) | Rendimiento 61 · Accesibilidad 89 · Buenas prácticas 100 · SEO 100 |
| Lighthouse escritorio (inicio / finanzas / proyectos) | Rendimiento 94 / 93 / 94 · Accesibilidad 93 / 97 / 97 |
| axe-core WCAG 2.2 AA (18 rutas) | 17 rutas con contraste insuficiente, 3 con ARIA prohibido, 1 con lista mal formada |

Hallazgos: **2 CRÍTICOS · 13 ALTOS · 24 MEDIOS · 18 BAJOS** (sección 9).

## 2. Método

- Inspección de código de los módulos (`src/modules/*`, `src/components/*`, `src/lib/*`) con tres revisiones paralelas: finanzas/dashboard, diseño/accesibilidad, y proyectos/salud/wishlist/objetivos/calendario/progreso.
- Ejecución en el build de producción (`next start` en :5219) para no depender del servidor de desarrollo, que recargaba por los cambios de otra sesión.
- Responsive: iframes a 360, 390, 768, 1280 y 1440 px sobre 18 rutas; se buscan elementos fuera del viewport (excluyendo contenedores con scroll horizontal intencional o texto truncado) y scroll horizontal del documento.
- Accesibilidad: axe-core 4.10 (etiquetas wcag2a/aa, wcag21a/aa, wcag22aa) en las 18 rutas + Lighthouse.
- QA funcional con persistencia real en un origen limpio (`127.0.0.1:5219`, almacenamiento vacío, separado de tus datos reales): bienvenida, crear cuentas, transferencia, recarga, borrado de cuenta.
- **No se tocaron tus datos reales** (`localStorage` de :5209 / Vercel).

## 3. Inventario y estado de funciones

| Módulo | Implementado | Parcial / UI sin lógica | Con bug |
|---|---|---|---|
| Dashboard | Widgets de racha, Tu día, KPIs, actividad, hábitos, ahorro, tareas, calendario, proyectos, wishlist | Selector de mes solo afecta los KPI | Gráficos con barras para 0 |
| Finanzas | Movimientos (gasto/ingreso/transferencia), cuentas, ahorros, deudas con pagos, gráficos, categorías | Presupuestos y análisis «Próximamente» | Pendientes que no se pueden completar, cascada de borrado de cuentas, pagos de deuda |
| Proyectos | CRUD proyectos/tareas/subtareas, lista y kanban, filtros, progreso | Kanban sin arrastrar; «en proceso» no se ve | Datos huérfanos al borrar, subtareas al mover |
| Espacio del proyecto | Tareas, notas, imágenes, notas de voz con transcripción, reuniones, calendario | Respaldo sin archivos | Notas pierden lo último escrito, fechas UTC |
| Salud | Hábitos, entrenamiento, alimentación (Mifflin-St Jeor verificado) | — | % mensual, enlace de entreno por nombre |
| Wishlist | CRUD, filtros, meta ligada | Comprar no genera gasto | Ahorro contado dos veces |
| Objetivos | CRUD, ±10 %, por área | Hitos «Próximamente» | Estado y % pueden contradecirse |
| Calendario | Día/semana/mes, filtros, solapes | Sin recurrentes | **No se pueden borrar eventos** |
| Progreso | XP, niveles, misiones, rachas, reparar | — | Fechas UTC en XP de hábitos |
| Configuración | Perfil, asistentes, progreso, datos (exportar/importar) | — | «Borrar todo» incompleto; respaldo sin audios/imágenes |

## 4. UX por módulo

**Dashboard.** Antes del primer dato real hay cuatro bloques de gamificación (invitación, reparar racha, héroe del asistente, Tu día). El selector de mes solo cambia la fila de KPI; el resto del tablero sigue en el mes actual sin decirlo. «Balance disponible» y «Dinero disponible» nombran cosas parecidas en sitios distintos.

**Finanzas.**
- Registrar un gasto toma 5 acciones y la descripción es obligatoria, aunque el comercio y la categoría podrían bastar.
- La cuenta por defecto es la primera de la lista.
- Elegir «Agregar Nequi» en el selector crea la cuenta en ese instante, aunque luego canceles.
- Con al menos una cuenta, la pestaña Cuentas ya no tiene botón «Agregar cuenta»; solo se llega desde el «+».
- «Transferir» deshabilitado solo explica el motivo con `title` (no funciona en táctil).
- Los movimientos pendientes muestran una etiqueta, pero no dicen que no cuentan en el saldo, y no hay forma de marcarlos como completados.
- El texto dice «1 movimientos».

**Proyectos.** Flujo claro. Al borrar un proyecto, el aviso menciona solo las tareas, pero también se pierden notas, audios, imágenes y reuniones, que quedan huérfanos. Al reabrir una tarea se pierde «en proceso».

**Salud.** Bien resuelto (cálculos correctos, alertas). El % del mes castiga a los hábitos nuevos, porque cuenta desde el día 1.

**Wishlist.** Varios deseos ligados a la misma meta muestran cada uno el ahorro completo.

**Objetivos.** El título dice «2027» fijo; se puede marcar «logrado» con 40 %.

**Calendario.** No existe forma de eliminar un evento. Los colores no coinciden con los del calendario del proyecto.

**Progreso.** Correcto; arrastra el problema de fechas en UTC (un hábito marcado después de las 7 p. m. de Bogotá cuenta para el día siguiente).

## 5. UI y sistema de diseño

- Tokens claros y consistentes (`globals.css`), tema claro con acento lima. Se mantiene la identidad.
- **Paleta del documento de la fase 2:** el documento propone un tema oscuro (#101312…). **No se aplica:** está guardado que el usuario quiere fondo blanco/hueso y nunca oscuro. Se mantiene el tema claro y solo se ajustan los tonos de texto para cumplir contraste.
- 85 colores en hex y 25 clases arbitrarias. El patrón principal es `text-[#0a0a0a]` sobre amarillo o lima, y el login usa una paleta fuera de marca.
- 16 radios y 30 tamaños de letra distintos; no hay una escala definida.
- Duplicados: `EmptyState` y `EmptyCard`; `EmptyState` oculta la descripción en celular; `CheckCircle` está copiado en varios sitios; hay 106 `<button>` sueltos frente a 79 `<Button>`.
- Los campos de texto (`bg-elev`, sin borde) contrastan 1,11:1 con la tarjeta; el foco del buscador global apenas se nota.

## 6. Responsive

Verificado en 18 rutas × 5 anchos (360, 390, 768, 1280, 1440): **0 elementos fuera del viewport y 0 scroll horizontal**. A 360 px tampoco hay objetivos táctiles por debajo de 24 px. Los gráficos con detalle solo al pasar el mouse (`viz.tsx`) no muestran ese detalle en táctil (ver sección 9).

## 7. Accesibilidad (WCAG 2.2 AA)

Verificado con axe y Lighthouse:
- **Contraste (1.4.3):**
  - `--color-dim` #a8a8a8 tiene 2,12:1 y se usa ~100 veces como texto;
  - `--color-muted` #6b6b6b da 4,26:1 sobre `elev` (pestañas segmentadas inactivas);
  - `--color-brand-soft` #15803d da 4,48:1 sobre tarjeta;
  - `--color-danger` #e5484d da 3,9:1.
- **ARIA prohibido (4.1.2):** `aria-label` en `<span>` sin rol en el mapa de hábitos (`viz.tsx:187`, `HabitsPage.tsx:198`) y en `ProgresoPage.tsx:101,205`.
- **`aria-hidden` con foco (4.1.2):** el cajón móvil cerrado (`MobileNav.tsx:38`) es `aria-hidden` pero sus enlaces siguen siendo enfocables.
- **Lista mal formada (1.3.1):** en Configuración → Asistentes, un `<ul role="listbox">` contiene `<li>` y dentro el `option`, y además hay un switch dentro del option (interactivo anidado).

Verificado en código:
- `Modal` no atrapa el foco, el fondo es un `<button>` en el orden de tabulación (confirmado en ejecución), no hay `aria-describedby` y el foco no tiene a dónde ir si no hay campo.
- El cajón móvil abierto no tiene `role="dialog"` ni cierre con Escape.
- Los tabs segmentados no tienen navegación con flechas.
- Hay inputs con `outline-none` sin estilo de foco.
- El aria-label del gráfico de barras no incluye los valores.

Correcto: botones de ícono con nombre, `alt` en imágenes, jerarquía h1/h2, `lang`, `prefers-reduced-motion`, Escape en popovers.

## 8. QA funcional

| Prueba | Resultado |
|---|---|
| Bienvenida en almacenamiento vacío | ✅ |
| Crear cuenta con saldo inicial 1.000.000 | ✅ |
| Crear segunda cuenta | ✅ (solo desde el «+») |
| Transferir 300.000 | ✅ 700.000 / 300.000, total sin cambio, ingresos y gastos del mes en $0 |
| Recargar la página | ✅ persiste |
| Borrar la cuenta destino | ❌ **la transferencia se borra en las dos cuentas: Banco QA volvió a 1.000.000 sin aviso** |
| Transferencias no cuentan como ingreso/gasto (código) | ✅ |
| Tarjetas con saldo inicial negativo (código) | ✅ |
| Dashboard y Finanzas usan las mismas funciones (código) | ✅ |

No ejecutado en el navegador: deudas, ahorros, proyectos ni notas de voz (micrófono). Para esos módulos los hallazgos salen de la lectura del código, citada con archivo y línea.

## 9. Hallazgos priorizados

Formato: **Módulo · Problema** — Evidencia · Impacto · Solución.

### CRÍTICO

1. **Finanzas · Borrar una cuenta borra transferencias y cambia el saldo de otras cuentas.** Evidencia: `types/db.ts:236-237` (cascada `delete` por `account_id` y `to_account_id`); prueba real: Banco QA pasó de 700.000 a 1.000.000. Impacto: saldos incorrectos sin aviso. Solución: en el aviso de borrado, listar las transferencias con otras cuentas y cómo cambia el saldo de cada una; ofrecer «Archivar» en vez de borrar si hay transferencias.
2. **Calendario · Los eventos no se pueden eliminar.** Evidencia: `other/forms.tsx:342-376`; solo `Reuniones.tsx:114` borra eventos. Impacto: un evento creado por error se queda para siempre. Solución: botón «Eliminar» con confirmación en el formulario del evento.

### ALTO

3. **Finanzas · Movimientos pendientes atrapados.** `forms.tsx:57` conserva el estado y no lo deja cambiar; `selectors.ts:14` solo cuenta los «completado». Solución: acción «Marcar como completado» y una nota de que el pendiente no suma al saldo.
4. **Finanzas · Pago de deuda con validación inconsistente.** `debtForms.tsx:164` permite pagar hasta pendiente + mora, pero luego pone el pendiente en 0. Solución: tope igual al saldo pendiente y mensaje coherente.
5. **Finanzas · Modelo de ahorro desconectado.** `current_amount` de las metas no está ligado a ninguna cuenta; `motor.ts:188-190` resta el ahorro del disponible. Solución: documentar en la UI que el ahorro es una meta, no dinero separado, y no restarlo dos veces. *(Requiere decisión de producto: se propone y no se cambia el esquema.)*
6. **Proyectos · Borrar un proyecto deja datos huérfanos.** `types/db.ts:240`, `espacio.ts` no tiene función de borrado. Notas, audios, imágenes y reuniones quedan guardados, y los eventos «Reunión: …» siguen en el calendario. Solución: `borrarProyecto(id)` en el espacio y un aviso completo.
7. **Configuración · «Borrar todo» no borra todo.** `SettingsPage.tsx:311-322`; quedan `lifeos:espacio`, `lifeos:salud` e IndexedDB `lifeos-archivos`. Impacto: privacidad. Solución: limpiar también esas claves y la base de archivos.
8. **Configuración · El respaldo no incluye audios ni imágenes.** `SettingsPage.tsx:258`. Solución: avisarlo claramente junto al botón de exportar *(incluirlos en base64 queda como mejora futura)*.
9. **Accesibilidad · Contraste del texto secundario.** #a8a8a8 = 2,12:1, ~100 usos. Solución: oscurecer los tokens `dim`, `muted`, `brand-soft` y `danger` en el tema claro, y `dim` en el oscuro.
10. **Accesibilidad · Modal sin trampa de foco y con el fondo enfocable.** `Modal.tsx`. Solución: trampa de foco, fondo `div` con `aria-hidden`, `aria-describedby` y foco de reserva en el panel.
11. **Accesibilidad · Cajón móvil enfocable estando cerrado.** `MobileNav.tsx:38` (Lighthouse `aria-hidden-focus`). Solución: `inert` cuando está cerrado; `role="dialog"`, `aria-modal` y Escape cuando está abierto.
12. **Accesibilidad · ARIA prohibido.** `viz.tsx:187`, `HabitsPage.tsx:198`, `ProgresoPage.tsx:101,205` (132 nodos). Solución: `role="img"` en esos elementos.
13. **Accesibilidad · Lista de asistentes mal formada.** `EditorAsistentes.tsx:131-170`. Solución: `role="listbox"` en un `div`, opciones directas, y el switch fuera del option.
14. **Rendimiento · TBT de 1,7 s en celular.** Lighthouse: 1.277 ms de script en un solo chunk y LCP de 3,9 s. Solución: carga diferida de las capas de gamificación, el tutorial y el panel demo (no son necesarios para pintar).
15. **Finanzas · No hay botón para agregar cuenta con cuentas existentes.** `FinancePage.tsx:355-420`. Solución: botón «Agregar cuenta» en la pestaña Cuentas.

### MEDIO

16. Finanzas · «Dinero disponible» incluye la deuda de tarjetas, que además se muestra aparte → aclarar con un subtítulo.
17. Finanzas · Pagos de deuda sin deshacer; borrar el gasto ligado no devuelve el saldo de la deuda.
18. Finanzas · `comoGasto` apagado por defecto → el pago de la deuda no sale de ninguna cuenta.
19. Dashboard · El selector de mes solo afecta los KPI → indicarlo, o aplicarlo a los demás widgets del mes.
20. Gráficos · `Math.max(4,…)` dibuja barras para valores 0 y para meses futuros → altura 0 para cero.
21. Gráficos · El detalle solo aparece al pasar el mouse → permitir tocar la barra (y tabular).
22. Gráficos · El aria-label del BarChart no tiene valores → incluir etiqueta y valor.
23. Finanzas · Elegir «Agregar Nequi» crea la cuenta aunque se cancele el formulario.
24. Finanzas · Gasto rápido: la descripción es obligatoria y no sugiere categoría a partir del comercio → usar la categoría como descripción de respaldo y sugerir categoría.
25. Proyectos · Cambiar el proyecto de una tarea no mueve sus subtareas (`projects/forms.tsx:126`).
26. Proyectos · Las notas pierden lo último escrito al salir antes de 600 ms (`NotasProyecto.tsx:32-39`).
27. Proyectos · Las notas de voz caen en el día equivocado por usar UTC (`CalendarioProyecto.tsx:28`).
28. Progreso · XP de hábitos y transacciones con fecha UTC (`progreso.ts:322,328`).
29. Hábitos · El % del mes cuenta días anteriores a la creación del hábito (`HabitsPage.tsx:95`).
30. Calendario y Proyectos · Reuniones sincronizadas en un solo sentido (`Reuniones.tsx:220`).
31. Wishlist · El ahorro de una meta se cuenta en cada deseo ligado (`WishlistPage.tsx:113`).
32. Diseño · Los campos no se distinguen de la tarjeta (1,11:1) → borde `line-strong` sutil.
33. Accesibilidad · Inputs con `outline-none` sin foco visible (`EditorAsistentes.tsx:276`, `EspacioProyecto.tsx:239`); la regla global de foco no cubre input, select ni textarea.
34. Accesibilidad · Tutorial con `aria-modal` sin trampa de foco ni devolución del foco.
35. Accesibilidad · Segmented y ChoiceGroup sin navegación con flechas.
36. Diseño · `text-[#0a0a0a]` repetido sobre colores de marca → token `--color-on-brand`.
37. Diseño · Escala de radios y tamaños de letra sin definir (16 y 30 valores).
38. Dashboard · Cuatro bloques de gamificación antes del primer dato.
39. Finanzas · «Transferir» deshabilitado explica el motivo solo con `title`.

### BAJO

40. KPI de deudas «Cuotas del mes» y «Próximo pago» ignoran los pagos ya hechos.
41. Nombres de KPI duplicados o confusos («Balance disponible» y «Dinero disponible»).
42. Historial de movimientos: la búsqueda solo mira la descripción; no hay filtro por cuenta ni por estado; no hay total filtrado.
43. `EmptyState` sin CTA en algunos módulos y con la descripción oculta en celular; `savingsSummary` es código muerto.
44. Duplicados: `EmptyState` y `EmptyCard`, `CheckCircle`, `<button>` sueltos frente a `<Button>`.
45. Calendario: la celda vacía clicable es un `div`.
46. Colores distintos entre el calendario general y el del proyecto; las entregas de proyecto no salen en el calendario.
47. Calendario: los eventos antes de las 05:00 se dibujan a las 5.
48. «Reabrir» una tarea borra el estado «en proceso».
49. «Próxima reunión» incluye las ya pasadas de hoy.
50. El hábito de entreno se reconoce por el nombre.
51. Wishlist: fecha en UTC, sin imagen de respaldo, «comprado» no crea el gasto.
52. Objetivos: estado y % pueden contradecirse; «2027» fijo en el título.
53. «1 movimientos» (plural).
54. Contraste de `dim` en el tema oscuro (#5c5c5c, 2,6–2,9:1).
55. Login con una paleta fuera de marca.
56. Alimentación: no avisa si el objetivo es «ganar» con obesidad.
57. Puntaje «Salud de tus finanzas · 76» sin ingresos ni gastos registrados (poco explicativo).

## 10. Plan de corrección

Orden: integridad de datos → navegación → formularios → responsive → consistencia → accesibilidad → rendimiento.

1. **Críticos y altos:** 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15, y 14 si es seguro.
2. **Medios** de bajo riesgo: 16, 18 (dejar `comoGasto` encendido), 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 36, 39.
3. **Bajos** rápidos: 41, 43 (descripción visible en celular), 45, 48, 49, 53, 54.
4. **Fuera de esta fase** (requieren decisión de producto o cambian el modelo de datos): 5, 17, 30, 37, 38, 46, 47, 50, 51 (gasto al comprar), 52 (filtro por año), 55, y el respaldo con archivos en base64.

## 11. Decisiones tomadas

- **Se mantiene el tema claro.** La paleta oscura del documento contradice una preferencia explícita guardada del usuario. Solo se ajustan los tonos para cumplir contraste, sin cambiar la identidad.
- **No se cambia el esquema de datos.** Las cascadas se resuelven con avisos y lógica en la UI, no cambiando `CASCADES` en silencio, salvo cuando borrar deja basura (proyectos).
- **No se instalan dependencias.** Lighthouse y axe se ejecutaron sin agregarlos al proyecto.
- Los archivos modificados por otra sesión (`AppShell.tsx`, `WelcomeModal.tsx`, `Protagonismo.tsx`, `SaludoDiario.tsx`, `Tutorial.tsx`) no se tocan ni se incluyen en commits de esta auditoría.

## 12. Limitaciones

- Las notas de voz (micrófono), las notificaciones push y la app instalada (Windows/Android) no se probaron en ejecución.
- Lighthouse se midió en local (`next start`), no en Vercel; los valores reales en red móvil pueden variar.
- La auditoría de contraste de axe se hizo a 1280 px; en celular se revisó con Lighthouse.
- Los hallazgos de deudas, ahorro, proyectos, wishlist y calendario vienen del código (con archivo y línea), salvo los críticos 1 (probado) y 2 (probado por ausencia de la acción en el código).
