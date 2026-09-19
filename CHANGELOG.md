# Historial de versiones

Hasta la v2.4.1 el proyecto se versionaba subiendo una carpeta nueva completa por cada release (`foco_audiovisual_v2_1` → `foco_audiovisual_v2_4_1`) y cambiando el *Root Directory* en Railway para apuntar a la carpeta vigente. A partir de la v2.5.0 el código vive en la raíz del repositorio y las versiones se distinguen por commits de git y por el campo `version` de `package.json` — ya no hay carpetas duplicadas que mantener sincronizadas a mano.

## 2.5.0 — Consolidación de repositorio + identidad de marca

- Se unificaron las 5 carpetas de versión en la raíz del repo (sin cambios de lógica de juego respecto de la v2.4.1).
- Nombre del programa centralizado (`APP_NAME`/`APP_SHORT_NAME`, ver README) en vez de estar escrito a mano en cada HTML.
- El Service Worker usa el `version` de `package.json` como nombre de caché (`app-shell-<version>`), así que subir de versión basta para forzar que todos los dispositivos descarten caché vieja — ya no depende de editar `sw.js` a mano en cada release.
- Se agregó persistencia del estado de la partida en curso (`data/state.json`): un reinicio del proceso (redeploy, caída, reinicio de Railway) durante el programa ya no borra puntajes ni la ronda activa.
- Logo oficial incorporado (favicon, manifest/PWA, panel de host, pantallas de espera/comerciales/apertura de Broadcast) y paleta retintada hacia el morado/negro de marca (`#7700F2` sobre negro) manteniendo los colores funcionales existentes (semáforo de dificultad, Concursante A/B, correcto/incorrecto).
- Corrección menor: al hacer doble clic accidental en "Revelar correcta", la pregunta ya no podía duplicarse en el historial anti-repetición.
- Corrección menor: una importación de pack muy pesada (>2 MB) ya no deja la solicitud colgada indefinidamente; responde con un error claro.

## 2.4.1

- Corrige que un dispositivo cargara HTML nuevo con CSS/JS de una versión anterior (mezcla de caché entre deployments).
- El borde dorado de la respuesta elegida en modo Clásico sigue toda la geometría hexagonal de la alternativa.

## 2.4.0

- Duelo: sistema de puntos + pozo final único (en vez de premio por pregunta).
- Rediseño visual completo de `/broadcast.html` para lectura en cámara (menos aspecto de interfaz web, más gráfica de TV).
- Pérdida de vidas: se reemplazó el modal que tapaba la pantalla por una animación integrada en el marcador inferior.
- Comodines (50/50, Pista, Cambiar) con motion gráfico propio en Broadcast.
- Pasada de responsive seria: estudio 16:9, notebook, tablet (horizontal/vertical), móvil (horizontal/vertical), ventanas pequeñas.

## 2.3.0 y anteriores

- Modo Clásico con vidas configurables; dinero como escalón alcanzado (no acumulativo).
- "Continuar fuera de competencia" opcional al perder todas las vidas.
- Elección de categoría en vivo, selección aleatoria con historial anti-repetición.
- Temporizador configurable, PIN editable, export/import de pack JSON.
- Banco de preguntas ampliado a 144 preguntas / 8 categorías.
