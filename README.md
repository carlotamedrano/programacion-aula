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
6. **Abre la app.** La dirección aparece en **Domains** (algo como `programacion-aula.vercel.app`). Ábrela y escribe tu contraseña. Cada dispositivo la pide una vez.
   - En el móvil, puedes usar **Añadir a pantalla de inicio** para tenerla como una app más.

## Cómo funciona

- Lo que marques o escribas se guarda en la nube y aparece en tus otros dispositivos al abrir la app o al volver a ella.
- Si no hay conexión, los cambios se guardan en el dispositivo y se suben cuando vuelve la red.
- Arriba a la derecha verás si los cambios se han guardado.
- Las mejoras se publican en este repositorio y Vercel actualiza la app sola en uno o dos minutos. Tus datos no se tocan.

## Archivos

- `index.html`: la app completa.
- `api/state.js`: guarda y devuelve los datos, solo si la contraseña es correcta.
- `package.json`: la librería de almacenamiento de Vercel.
