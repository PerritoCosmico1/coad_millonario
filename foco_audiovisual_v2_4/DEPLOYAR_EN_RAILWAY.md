# Railway · FOCO V2.4

Para una instalación nueva, conecta el repositorio GitHub al servicio y usa como Root Directory:

`/foco_audiovisual_v2_4`

La app usa la variable `PORT` de Railway. Si defines manualmente `PORT=8080`, Public Networking debe apuntar también al puerto 8080.

Variables opcionales:

- `HOST_PIN` — PIN inicial de una instalación sin configuración persistente. El default es `0000` y luego puede cambiarse desde la app.
- `ACCESS_CODE` — código general opcional para links públicos.
- `DATA_DIR` — ruta de datos si quieres sobrescribir la ruta automática.

Para persistencia, monta un Railway Volume en `/app/data`.

Health check:

`/api/health`

Para actualizar desde V2.3 consulta `ACTUALIZAR_DESDE_V2_3.md`.
