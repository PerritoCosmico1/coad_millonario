# Actualizar FOCO V2.2 en tu Railway actual

Esta guía asume que V2.1 ya está online y funcionando.

## Lo importante

No borres el servicio de Railway.
No generes otro dominio.
No cambies Networking.
No cambies el puerto si ahora funciona.

Solo vas a actualizar el código conectado a GitHub.

## 1. Conserva el Root Directory actual

En tu caso Railway fue configurado para mirar una subcarpeta del repositorio.

Si en Settings → Source → Root Directory aparece:

`/foco_audiovisual_v2_1`

**esa ruta debe seguir existiendo.**

Copia los archivos de V2.2 dentro de esa carpeta reemplazando los antiguos, pero conserva el nombre `foco_audiovisual_v2_1`.

## 2. Archivos nuevos importantes

Asegúrate de subir también:

- `seed/questions.json`
- `data/history.json`

y de reemplazar:

- `server.js`
- `public/`
- `test/`
- `package.json`
- `README.md`

## 3. Commit y push

Haz un commit en la misma rama que Railway está observando y súbelo a GitHub.

Railway debería crear automáticamente un nuevo deployment.

## 4. No cambies estas variables

Conserva las que ya te funcionan:

`HOST_PIN=...`
`ACCESS_CODE=...`
`PORT=8080`

Si tu Public Networking ya apunta al 8080 y la web abre, no lo toques.

## 5. Volume

Si ya montaste un Volume en:

`/app/data`

consérvalo.

V2.2 puede leer la configuración/preguntas antiguas y añade el nuevo banco incluido desde `seed/questions.json`.

## 6. Comprobación después del deploy

Abre:

`/api/health`

Debería responder algo que incluya:

`"version":"2.2.0"`

Después prueba:

- `/host.html`
- `/broadcast.html`
- `/player.html?player=A`
- `/player.html?player=B`

Haz una ronda completa antes de usarlo al aire.

## Rollback

Si algo sale mal, Railway conserva deployments anteriores. Puedes volver temporalmente al deployment de V2.1 desde la pestaña Deployments sin cambiar el dominio.
