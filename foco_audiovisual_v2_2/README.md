# FOCO Audiovisual V2.2

Sistema web para controlar un concurso televisivo desde móviles/tablets y enviar una salida 16:9 limpia al switcher/VTR.

## Qué cambia en V2.2

- El tiempo de respuesta se configura en **Configuración**, no ocupa espacio en el panel en vivo. Solo queda un override dentro de **Corrección de emergencia**.
- Los comodines solo pueden usarse cuando corresponde: pregunta activa, alternativas reveladas, respuestas abiertas y antes de que el concursante responda.
- En modo Clásico la apertura presenta únicamente al concursante activo.
- Final en dos etapas:
  1. **Resumen final** con dinero, aciertos, rondas y tiempos.
  2. **Cierre definitivo** con ganador/fin del juego.
- Cada pregunta incluida trae una **pregunta alternativa** para el comodín Cambiar.
- Nueva pool inicial de **62 preguntas principales + 62 alternativas**, repartidas entre:
  - Cámara
  - Sonido
  - Montaje
  - Fotografía
  - Guion
  - Producción
  - Cine
  - Postproducción
- Selección aleatoria desde la pool y memoria de preguntas recientes para reducir repeticiones entre ensayos.
- Plan de rondas configurable. Default:
  - 3 fáciles
  - 3 medias
  - 2 difíciles
  - 1 imposible
- Elección de categoría opcional en modo Clásico:
  - desactivada;
  - una categoría al inicio para toda la partida;
  - elegir nuevamente al cambiar de dificultad.
- La elección puede hacerse **en vivo desde el teléfono del concursante** o desde producción.
- Pantalla comercial centrada.
- En Duelo las marcas ya no dicen A/B: usan la inicial del nombre configurado; si ambos nombres empiezan igual, usa dos letras.
- Reloj de emisión mucho más grande y centrado.
- Urgencia visual desde 10 segundos; se intensifica desde 5.
- Se descartó el modo “Duelo con ventajas/ataques”.

## Premios

- Fácil: **$250.000**
- Medio: **$500.000**
- Difícil: **$1.000.000**
- Imposible: **$10.000.000**

## Rutas

- `/host.html` — producción
- `/broadcast.html` — salida al aire
- `/player.html?player=A`
- `/player.html?player=B`

## Actualizar la instalación de Railway que ya tienes

**No crees otro proyecto, otro dominio ni otro servicio.**

Tu Railway ya está conectado a GitHub. Mantén exactamente la misma carpeta que configuraste como **Root Directory**.

Si Railway actualmente apunta a:

`/foco_audiovisual_v2_1`

entonces en GitHub deja esa carpeta con ese mismo nombre y **reemplaza su contenido** por los archivos de V2.2. No renombres esa carpeta a `foco_audiovisual_v2_2`, a menos que también quieras cambiar Root Directory en Railway.

Haz commit/push. Railway detectará el commit y desplegará V2.2 usando el mismo dominio.

Las variables de Railway siguen iguales:

- `HOST_PIN`
- `ACCESS_CODE`
- `PORT`

Si tu instalación actual funciona con `PORT=8080` y el dominio apunta al puerto 8080, **déjalo así**.

## Persistencia / Railway Volume

Si ya tienes un Volume montado en:

`/app/data`

déjalo exactamente igual.

V2.2 migra la configuración anterior y añade las nuevas preguntas incluidas sin borrar las que ya tenías. El historial de selección se guarda en `history.json`.

El banco incluido vive también en `/seed/questions.json`; esto permite añadir el nuevo pool incluso cuando `/app/data` es un volumen persistente de una versión anterior.

## Selección aleatoria y repeticiones

La app registra las preguntas utilizadas y, por defecto, intenta evitar las últimas 24 entre partidas.

Ese número es configurable. También puedes borrar el historial desde Configuración si quieres volver a habilitar todo el banco.

Si se agota una combinación dificultad/categoría sin preguntas no recientes, la app reutiliza preguntas antiguas antes de quedarse sin ronda.

## Comodín Cambiar

Primero intenta usar la pregunta alternativa emparejada de la misma pregunta. Mantiene dificultad y categoría, reinicia la ronda y **no puede duplicar el premio**.

Si una pregunta personalizada no tiene alternativa, la app intenta buscar otra pregunta disponible de la misma dificultad y categoría.

## Probar localmente

Node.js 18+.

Windows:

`INICIAR_APP.bat`

macOS/Linux:

`./iniciar_mac_linux.sh`

Default local:

`http://localhost:8765`

## Pruebas

`npm test`

Las pruebas comprueban V2.2, entre otras cosas:

- banco inicial y alternativas;
- elección de categoría;
- bloqueo de comodines fuera del momento válido;
- Cambiar sin doble premio;
- resumen + cierre;
- Duelo por velocidad y delta temporal;
- temporizador;
- historial persistente.
