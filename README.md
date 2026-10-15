# Mi programación de aula

Agenda, horario, programación por unidades, temporalización de lenguas y recursos para 5è de Primària.
Los datos se guardan en un almacén privado de Vercel y se sincronizan entre dispositivos con una contraseña.

## Puesta en marcha en Vercel (una sola vez, unos 10 minutos)

1. **Entra en Vercel.** Ve a vercel.com y entra con **Continue with GitHub**, usando la cuenta `carlotamedrano`. Si no tienes cuenta, se crea en ese momento, con el plan gratuito (Hobby).
2. **Importa el repositorio.** Pulsa **Add New… → Project**. En la lista de repositorios de GitHub, busca `programacion-aula` y pulsa **Import**.
   - Si no aparece, pulsa **Adjust GitHub App Permissions** y dale acceso a ese repositorio.
   - En **Framework Preset** deja **Other**. No cambies nada más y pulsa **Deploy**. Espera a que termine.
3. **Crea el almacén de datos.** Dentro del proyecto, abre la pestaña **Storage → Create Database → Blob**.
   - Ponle un nombre, por ejemplo `datos-aula`.
   - Si te pregunta el tipo de acceso, elige **Private**.
   - Conéctalo al proyecto `programacion-aula`, con todos los entornos marcados.
4. **Pon tu contraseña.** Ve a **Settings → Environment Variables** y añade una variable:
   - Name: `APP_PASSWORD`
   - Value: la contraseña que quieras para entrar en la app. Solo la sabrás tú.
   - Environments: deja marcados **Production** y **Preview**. Pulsa **Save**.
5. **Vuelve a publicar.** Ve a **Deployments**, abre el último despliegue, pulsa el menú **⋯** y elige **Redeploy**. Así la app ya tiene el almacén y la contraseña.
6. **Abre la app.** La dirección aparece en **Domains** (algo como `programacion-aula.vercel.app`). Ábrela y escribe tu contraseña en la pantalla de bienvenida.
   - En el móvil, puedes usar **Añadir a pantalla de inicio** para tenerla como una app más.

## Cómo funciona

- Al abrir la app aparece una pantalla de bienvenida que pide la contraseña. La agenda y el horario no se ven hasta escribirla. Si recargas la misma pestaña, no la vuelve a pedir.
- Sin conexión también se puede entrar, con la copia guardada en el dispositivo, si ya se había entrado antes en él.
- Lo que marques o escribas se guarda en la nube y aparece en tus otros dispositivos al abrir la app o al volver a ella.
- Si no hay conexión, los cambios se guardan en el dispositivo y se suben cuando vuelve la red.
- Arriba a la derecha verás si los cambios se han guardado, y el enlace **Copias de seguridad**: el servidor guarda una copia automática como mucho cada 6 horas (se conservan las 30 últimas) y desde ahí se puede recuperar cualquiera.
- En la **Agenda** se marca lo hecho directamente en cada hora, se pasa de un día a otro con las flechas y aparece un aviso con lo que quedó atrasado.
- **Editar día** permite marcar un día sin clase (entero, solo mañana o solo tarde), un día light, una nota y en qué asignaturas no se avanzó.
- En **Horario**, cada celda tiene su asignatura para la Agenda (el texto puede ser libre) y puede alternar entre dos actividades por semanas.
- En **Programación**, una unidad nueva puede generar sus sesiones a partir de las páginas del libro.
- Las mejoras se publican en este repositorio y Vercel actualiza la app sola en uno o dos minutos. Tus datos no se tocan.

## Asistente con IA

El botón **Asistente** (abajo a la derecha) entiende peticiones como «el viernes hay excursión» o «hoy no he avanzado en Medi» y propone los cambios. No cambia nada hasta pulsar **Aplicar cambios**, y después se puede **Deshacer**.

- Usa **Vercel AI Gateway** con el crédito gratuito mensual de la cuenta. No hace falta clave: la app se identifica sola dentro de Vercel. Si en algún momento no responde, revisa en Vercel la sección **AI Gateway** (que esté activada y con crédito).
- Opcional: la variable `AI_MODEL` permite elegir otro modelo (por ejemplo `anthropic/claude-haiku-4.5`).
- Se envía a la IA un resumen de la programación (horario, días especiales, sesiones y lenguas). Mejor no escribir nombres de alumnos en las notas.

## Archivos

- `index.html`: la app completa.
- `api/state.js`: guarda y devuelve los datos, solo si la contraseña es correcta.
- `api/backups.js`: lista, crea y recupera copias de seguridad.
- `api/assistant.js`: el asistente con IA.
- `api/_lib.js`: código compartido del servidor.
- `package.json`: la librería de almacenamiento de Vercel.
