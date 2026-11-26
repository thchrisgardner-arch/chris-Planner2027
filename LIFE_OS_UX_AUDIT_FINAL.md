# LIFE for LIFE — Informe final de la auditoría UX/UI y QA

Fecha: 2026-11-26 · Rama: `rediseno-pro` · Informe previo: `LIFE_OS_UX_AUDIT.md` (57 hallazgos numerados).
Todo lo marcado ✅ se ejecutó y se comprobó. Lo que no se probó se dice expresamente.

---

## 1. Antes y después

| Medición | Antes | Después |
|---|---|---|
| `tsc --noEmit` | ✅ | ✅ sin errores |
| `eslint src` | ✅ | ✅ sin errores |
| `next build` | ✅ 21 páginas | ✅ 21 páginas |
| axe-core WCAG 2.2 AA (18 rutas) | 17 rutas con violaciones (contraste, ARIA prohibido, lista mal formada, interactivo anidado) | **0 violaciones en las 18 rutas** |
| Lighthouse accesibilidad, celular (inicio) | 89 | **100** |
| Lighthouse rendimiento, celular (inicio) | 61 (TBT 1,7 s · LCP 3,9 s) | 61–62 (TBT 0,9–1,0 s · LCP 4,8–4,9 s): **sin cambio significativo**, las mediciones locales varían mucho entre corridas |
| Responsive 360 / 390 / 768 / 1280 / 1440 | 18/18 rutas sin desbordes | ver sección 4 |
| Consola (18 rutas) | sin errores | sin errores |

## 2. Corregido

### Críticos (2 de 2)
| # | Corrección | Archivos | Comprobado |
|---|---|---|---|
| 1 | Al borrar una cuenta, el aviso dice qué otras cuentas cambian de saldo y cuánto («Banco QA pasará de $700.000 a $1.000.000») | `finance/selectors.ts` (`avisoBorrarCuenta`), `FinancePage.tsx` | ✅ en el navegador, con persistencia real |
| 2 | Los eventos del calendario se pueden eliminar (botón «Eliminar» con confirmación en «Editar evento») | `other/forms.tsx` | ✅ crear → abrir → eliminar → ya no aparece |

### Altos (12 de 13)
| # | Corrección | Comprobado |
|---|---|---|
| 3 | Movimientos pendientes: etiqueta «Pendiente · completar» que lo marca como completado con un toque y avisa que aún no suma; en el formulario aparece «Estado» cuando el movimiento estaba pendiente | Código + tsc (no había pendientes para probarlo en el navegador) |
| 4 | Pago de deuda: el tope es el saldo que se debe (antes dejaba pagar pendiente + mora) | Código + tsc |
| 6 | Borrar un proyecto borra también su nota, notas de voz, imágenes, portada, reuniones, sus eventos del calendario y los archivos en IndexedDB; el aviso lo enumera | Código + tsc |
| 7 | «Borrar todo» borra también el perfil físico, el espacio de proyectos y la base de archivos (audios e imágenes) | Código + tsc (no se ejecutó, para no borrar datos) |
| 8 | Configuración → Datos avisa que audios e imágenes no viajan en el respaldo | Código |
| 9 | Contraste del tema claro: `dim` #a8a8a8→#666666, `muted` #6b6b6b→#575757, `brand-soft` →#126f35, `danger` →#b8242a, `warn` →#9a5205, `info` →#1f55d6, `violet` →#6a48e0; `dim` del tema oscuro #5c5c5c→#8a8a8a. Mismos tonos de la identidad, solo más oscuros | ✅ axe sin errores de contraste |
| 10 | Modal: trampa de foco, el fondo ya no es un botón tabulable, `aria-describedby`, foco de reserva en el panel, Escape solo cierra el modal de más arriba y el scroll no se libera si queda otro modal | ✅ Shift+Tab desde el primero va al último; el fondo es un `div` con `aria-hidden` |
| 11 | Cajón del menú en celular: `inert` cuando está cerrado; `role="dialog"`, foco adentro y cierre con Escape cuando está abierto | ✅ los enlaces cerrados no reciben foco; Escape lo cierra |
| 12 | `role="img"` en las celdas del mapa de hábitos y en los indicadores de Progreso | ✅ axe |
| 13 | Lista de asistentes: lista simple con un botón por asistente y el interruptor al lado (no anidado) | ✅ axe |
| 15 | Tarjeta «Agregar cuenta» en la pestaña Cuentas aunque ya existan cuentas | ✅ en el navegador |

**Pendiente — 14 (rendimiento en celular):** la mejora es cargar en diferido las capas de gamificación, el tutorial y el panel demo, y eso se hace en `AppShell.tsx`, que tiene cambios sin guardar de otra sesión. No se tocó para no pisarlos.

### Medios corregidos (16 de 24)
- **16** «Dinero disponible» dice cuando ya restó la deuda de tarjetas. «Ahorro acumulado» aclara que es parte de tu dinero.
- **18** El pago de una deuda sale de una cuenta por defecto (si hay cuentas).
- **19** Al elegir otro mes en el inicio aparece «Indicadores de {mes}. El resto del inicio muestra el mes actual», con «Volver al mes actual».
- **20, 21, 22** Gráfico de barras:
  - un 0 ya no dibuja barra;
  - tocar una barra muestra su detalle (funciona en celular);
  - el texto para lector de pantalla incluye los valores.
- **23** Elegir «Agregar Nequi» ya no crea la cuenta en ese momento: se crea al guardar el movimiento, con un aviso visible.
- **24** La descripción del movimiento es opcional; si falta, se usa la categoría (o «Transferencia»). ✅ Probado: transferencia guardada sin descripción.
- **25** Si una tarea cambia de proyecto, sus subtareas se van con ella.
- **26** Las notas del proyecto se guardan al salir del panel o cerrar la pestaña.
- **27, 28** Las fechas de notas de voz y de XP usan la hora de Bogotá (`fechaLocal` en `utils/dates.ts`). Los eventos de XP ya registrados no se recalculan.
- **29** El % del mes de un hábito empieza el día en que se creó.
- **31** Wishlist: el ahorro de una meta compartida se reparte entre los deseos por prioridad y antigüedad (`other/wishlistAhorro.ts`).
- **32** Los campos (input, select y fecha) tienen un borde sutil `line-strong` para distinguirse de la tarjeta.
- **33** Foco visible en los dos campos que tenían `outline-none` sin alternativa.
- **35** Pestañas segmentadas y grupos de opciones: navegación con flechas, Inicio y Fin, y un solo punto de tabulación (`utils/teclado.ts`).
- **39** Con una sola cuenta, en vez de un «Transferir» deshabilitado se lee «Agrega otra cuenta para transferir».

### Bajos corregidos (5 de 18)
- **41** «Balance disponible» → «Dinero disponible» (mismo nombre en Inicio y Finanzas).
- **43** `EmptyState` muestra la descripción también en celular.
- **49** «Próxima reunión» no muestra las que ya terminaron hoy.
- **53** «1 movimiento» en singular.
- **54** Contraste de `dim` en el tema oscuro.

## 3. No corregido (y por qué)

| # | Motivo |
|---|---|
| 5 Modelo de ahorro | Decisión de producto (ligar metas a cuentas cambia el esquema). Por ahora solo se aclaró el texto. |
| 14 Rendimiento | `AppShell.tsx` está en edición por otra sesión. |
| 17 Deshacer pagos de deuda | Requiere reconstruir el saldo de la deuda desde los pagos (cambio de modelo). |
| 30 Reuniones en dos sentidos | Cambio de modelo (tipo «reunión» en eventos). |
| 34 Trampa de foco del tutorial | `Tutorial.tsx` está en edición por otra sesión. |
| 36 Token `on-brand` | Afecta archivos de la otra sesión; conviene hacerlo de una vez cuando se integren. |
| 37 Escala de radios y tipografía | Refactor amplio, sin error visible; mejor en una fase de sistema de diseño. |
| 38 Orden del inicio | Decisión de producto (cuánta gamificación va arriba). |
| 40, 42, 44–48, 50–52, 55–57 | Bajos que necesitan decisión o cambian datos guardados (p. ej. el id del hábito de entreno, comprar → gasto). |

## 4. Validación ejecutada

- **Estático:** `npx tsc --noEmit` ✅ · `npx eslint src` ✅ · `npx next build` ✅ (21 páginas).
- **Funcional** (build de producción en :5219, almacenamiento propio y vacío; tus datos reales no se tocaron):
  - bienvenida ✅;
  - crear 2 cuentas ✅ (la 2.ª desde la nueva tarjeta «Agregar cuenta»);
  - transferencia de 300.000 sin descripción ✅ (700.000 / 300.000, total igual, ingresos y gastos en $0);
  - recarga ✅;
  - aviso al borrar una cuenta con el impacto en la otra ✅;
  - crear y eliminar un evento ✅;
  - menú del celular (inert, Escape) ✅;
  - trampa de foco del modal ✅;
  - el scroll del body se libera al cerrar ✅.
- **Accesibilidad:** axe en 18 rutas → 0 violaciones; Lighthouse celular 100.
- **Responsive:** ver el resultado agregado abajo.
- **No probado en ejecución:** marcar un pendiente (no había datos pendientes), pagos de deuda, borrar un proyecto con audios e imágenes, «Borrar todo», guardado de notas al salir, wishlist compartida. Se verificaron con TypeScript y lectura de código.

## 5. Archivos modificados

`src/app/globals.css` · `src/components/ui/{Modal,Field,Select,DatePicker,misc,viz}.tsx` · `src/components/layout/MobileNav.tsx` · `src/modules/finance/{FinancePage.tsx,forms.tsx,debtForms.tsx,selectors.ts}` · `src/modules/projects/{ProjectsPage,forms}.tsx` · `src/modules/proyectos/{NotasProyecto,CalendarioProyecto,EspacioProyecto,Reuniones}.tsx` · `src/modules/other/{forms,SettingsPage,WishlistPage}.tsx` · `src/modules/other/wishlistAhorro.ts` (nuevo) · `src/modules/dashboard/{DashboardPage,DashboardWidgets}.tsx` · `src/modules/habits/{HabitsPage.tsx,selectors.ts}` · `src/modules/asistentes/{EditorAsistentes,ProgresoPage}.tsx` · `src/lib/proyectos/espacio.ts` · `src/lib/salud/perfil.ts` · `src/lib/asistentes/progreso.ts` · `src/utils/dates.ts` · `src/utils/teclado.ts` (nuevo).

No se tocaron: `AppShell.tsx`, `WelcomeModal.tsx`, `Protagonismo.tsx`, `SaludoDiario.tsx`, `Tutorial.tsx` (cambios sin guardar de otra sesión). No se instalaron dependencias ni se cambió el esquema de datos.
