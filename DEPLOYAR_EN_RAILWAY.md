# Railway

## Instalación nueva

Conecta el repositorio de GitHub al servicio. **Root Directory debe quedar vacío** (la raíz del repo) — ya no hay que apuntar a una subcarpeta de versión.

La app usa la variable `PORT` de Railway. Si defines manualmente `PORT=8080`, Public Networking debe apuntar también al puerto 8080.

Variables opcionales:

- `APP_NAME` — nombre del programa que se muestra en pestañas, PIN de host, manifest y `/api/health`. Ver "Cómo cambiar el nombre" en `README.md`.
- `APP_SHORT_NAME` — versión corta del nombre, usada en algunos títulos de pestaña.
- `HOST_PIN` — PIN inicial de una instalación sin configuración persistente. El default es `0000` y luego puede cambiarse desde la app.
- `ACCESS_CODE` — código general opcional para links públicos.
- `DATA_DIR` — ruta de datos si quieres sobrescribir la ruta automática.

Para persistencia entre deployments, monta un Railway **Volume** en la ruta de datos (por ejemplo `/app/data`).

Health check: `/api/health`

## Si tu servicio actual todavía apunta a una carpeta de versión

Antes del repositorio tenía una carpeta nueva por versión (`foco_audiovisual_v2_3`, `foco_audiovisual_v2_4`, `foco_audiovisual_v2_4_1`...) y Railway usaba **Settings → Source → Root Directory** para elegir cuál desplegar. Eso se consolidó: todo el código vive ahora en la raíz del repositorio.

Para migrar un servicio existente:

1. **Settings → Source → Root Directory**: borra el valor (déjalo vacío / `/`).
2. No cambies dominio, Public Networking, Volume, `PORT`, `HOST_PIN` ni `ACCESS_CODE`.
3. Si tu Volume estaba montado apuntando a una ruta dentro de la carpeta de versión vieja, verifica que `DATA_DIR`/el mount path siga siendo el mismo — el servidor sigue leyendo/escribiendo en la misma ubicación de datos (`data/` relativo a la raíz del proyecto, o `RAILWAY_VOLUME_MOUNT_PATH`), así que normalmente no hay que tocar nada del Volume.
4. Guarda y espera el nuevo deployment.
5. Confirma en `/api/health` que responde con la versión actual.

Rollback: si algo falla, puedes volver a apuntar Root Directory a la última carpeta de versión mientras exista en el historial de git (`git checkout <commit-anterior-a-la-consolidación>` en una rama aparte), aunque en la práctica basta con revisar el commit anterior en GitHub — el código es idéntico, solo cambió la ubicación de los archivos.
