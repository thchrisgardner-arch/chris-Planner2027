# Avisos al celular: puesta en marcha

El código ya está listo. Para que los avisos lleguen al iPhone faltan estos pasos, que se hacen una sola vez y necesitan tus cuentas.

1. **Publicar en Vercel.** En vercel.com → Add New → Project, importa el repositorio `chris-Planner2027` (rama `main`).
2. **Almacenamiento.** En el proyecto de Vercel → Storage → crea una base **Upstash Redis** (plan gratis) y conéctala al proyecto. Crea sola `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. **Variables de entorno.** En Settings → Environment Variables agrega `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `CRON_SECRET`, con los mismos valores del archivo `.env.local` de tu computador. Después vuelve a desplegar (Deployments → Redeploy).
4. **Recordatorio cada hora (GitHub).** En el repositorio → Settings → Secrets and variables → Actions, crea:
   - `APP_URL`: la dirección de Vercel, por ejemplo `https://chris-planner2027.vercel.app`
   - `CRON_SECRET`: el mismo valor del paso 3.
5. **En el iPhone.** Abre la dirección de Vercel en Safari → Compartir → **Agregar a inicio**. Abre LIFE OS desde el ícono → Configuración → Progreso → **Activar avisos** → elige las horas → **Probar**.

Notas:
- Los avisos salen a la hora elegida (hora de Colombia) y pueden llegar unos minutos tarde.
- No llega aviso si ese día ya registraste algo y no te queda nada pendiente.
- Solo viaja al servidor la racha y el número de hábitos y tareas pendientes. Montos y nombres no salen del dispositivo.
- Tus datos viven en cada dispositivo: lo que tienes en el computador no aparece solo en el iPhone.
