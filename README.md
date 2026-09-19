# ¿Quién es el Audiovisual?

Web app de control para un concurso televisivo en vivo: un panel de producción, dos interfaces de concursante y una salida `/broadcast.html` pensada para entrar al switcher/VTR/proyector.

Frontend en HTML/CSS/JS plano (sin build step) y backend Node.js con `http` nativo. El servidor mantiene el estado de la partida y sincroniza Host, Broadcast, Concursante A y Concursante B en tiempo real mediante **Server-Sent Events** (no usa WebSocket).

## Estructura del repositorio

```text
server.js               servidor HTTP + API + lógica de la partida
public/                  todo lo que se sirve al navegador
  host.html              panel de control
  broadcast.html         salida al aire (16:9)
  player.html            interfaz de concursante (?player=A o B)
  index.html             portada con los 4 enlaces
  common.js, styles.css  compartidos por las páginas
  sw.js                  service worker (cache de la app)
  assets/                logo e íconos
data/                    config/preguntas/estado persistente (si no hay Volume, vive aquí)
seed/                    banco de preguntas de fábrica, se usa solo si data/ está vacío
test/                    suite de pruebas (`npm test`)
```

Antes del repo tenía una carpeta nueva por cada versión (`foco_audiovisual_v2_1`, `_v2_2`...) y Railway apuntaba su *Root Directory* a la última. Eso se consolidó: ahora todo vive en la raíz y el historial de versiones queda en los commits de git, no en carpetas duplicadas. Ver `CHANGELOG.md`.

## Cómo cambiar el nombre del programa

El nombre puede cambiar en cualquier momento sin tocar HTML/CSS/JS:

1. En Railway, agrega la variable de entorno `APP_NAME` (y opcionalmente `APP_SHORT_NAME`, usada en títulos de pestaña cortos). Ejemplo: `APP_NAME=¿Quién es el Audiovisual?`.
2. Si no defines la variable, el nombre por defecto es el que está en `server.js` (`APP_NAME`, cerca del inicio del archivo) — edítalo ahí si prefieres no usar variables de entorno.
3. Vuelve a desplegar. El nombre se propaga solo a: título de las pestañas, manifest (PWA/ícono), pantalla de PIN del panel de host, `/api/health` y el arranque por consola.

Esto es **independiente** del título que se muestra al aire (`Título del programa` en la pestaña Configuración del panel de host), que ya era editable desde la propia app y no requiere redeploy — sirve para renombrar por temporada/capítulo sin tocar nada técnico.

El logo (`public/assets/logo.png`, `icon-192.png`, `icon-512.png`) se reemplaza simplemente sobrescribiendo esos archivos con la misma proporción/transparencia.

## Cómo forzar que todos los dispositivos actualicen caché

Cada deploy que cambie HTML/CSS/JS de forma relevante, sube la versión en `package.json` (`npm version patch` o edita el campo `version` a mano). Esa versión se usa como parámetro de caché (`?v=...`) y como nombre del cache del Service Worker (`app-shell-<version>`), así que un cambio de versión basta para que todos los dispositivos descarten su caché viejo automáticamente en la próxima carga. No hace falta editar `sw.js` a mano.

## Ruleta de categorías (segmento especial)

Además del juego principal (Clásico/Duelo) hay un segundo sistema, totalmente aparte: una ruleta de categorías pensada para un bloque especial del programa. Reutiliza el mismo banco de preguntas, pero sin vidas ni rondas encadenadas — solo giro → categoría → pregunta → tiempo → correcto/incorrecto.

- Se activa/desactiva con el botón **Ruleta** de la barra superior del host, igual que **Comercial**. Mientras está al aire, el juego principal queda congelado exactamente donde estaba (puntajes, ronda, pregunta activa) y se retoma sin pérdidas al volver.
- Panel propio en la pestaña **Ruleta** del host: mucho más simple que el del juego principal.
- Configurable desde esa misma pestaña: categorías incluidas, si se repiten o no, tiempo de respuesta, duración del giro, dificultad de la pregunta (aleatoria o fija) y premio por acierto (ninguno o monto fijo).
- No repite preguntas que ya hayan salido por el juego principal (comparten el historial anti-repetición).
- Broadcast y Concursante tienen pantallas propias para la ruleta (giro, categoría, pregunta, resultado), visualmente distintas del juego principal pero con la misma identidad de marca.

## Arquitectura

- **Estado en memoria**: la partida en curso (fase, puntajes, temporizador, etc.) vive en una variable del proceso para que las acciones del host se reflejen al instante en todas las pantallas. Se sincroniza vía SSE (`/api/stream`).
- **Persistencia de configuración y preguntas**: `data/config.json` y `data/questions.json` se guardan en disco en cada cambio. En Railway, monta un **Volume** en la ruta de datos para que sobrevivan a un redeploy (ver más abajo).
- **Recuperación ante caídas/redeploys**: además de config y preguntas, el estado de la partida en curso también se guarda en `data/state.json` (juego principal) y `data/wheel.json` (Ruleta) en cada acción. Si el proceso se reinicia a mitad de programa (crash, redeploy, reinicio de Railway), al volver a levantar el servidor ambos sistemas continúan exactamente donde iban — puntajes, ronda/giro y pregunta activa incluidos — en vez de reiniciar en blanco. Por seguridad, si el reinicio ocurrió con las respuestas abiertas, esa ronda se recupera **bloqueada** (no se resucita un cronómetro corriendo a ciegas); el anfitrión revela la respuesta correcta o usa "Reiniciar ronda actual" con total normalidad.
- **Respaldo manual**: la pestaña Configuración permite exportar/importar el pack completo (preguntas + configuración) como JSON, independiente del Volume.

## Rutas

- `/host.html` — panel de producción (protegido por PIN)
- `/broadcast.html` — salida al aire
- `/player.html?player=A` / `?player=B`
- `/api/health`

## Uso local

Requiere Node.js 18+.

Windows: `INICIAR_APP.bat`

macOS/Linux: `./iniciar_mac_linux.sh`

Default local: `http://localhost:8765`

## Railway

Ver `DEPLOYAR_EN_RAILWAY.md`.

## Pruebas

```
npm test
```

La suite levanta el servidor real contra un directorio de datos temporal y comprueba, entre otras cosas: vidas, puntos, pool de preguntas, 50/50, cambio de pregunta, PIN, temporizador, Duelo por velocidad, que el ganador por puntos reciba el pozo completo, que la marca se propague a HTML/manifest/service worker, y que un reinicio del proceso a mitad de una pregunta abierta recupere la partida de forma segura.
