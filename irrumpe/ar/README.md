# Acceso AR — andamiaje

La experiencia de realidad aumentada **todavía no está construida**. Esta carpeta deja listo todo lo que la rodea, para que solo quede implementar la escena.

## Qué hay hoy

- `index.html` — la "app" a la que lleva el botón **Acceso AR** de la landing (en escritorio el botón muestra un QR que apunta acá).
- `ar.js` — lógica de la página:
  - **Bloqueo**: queda cerrada hasta `ar.activaDesde` (o `evento.inicio` si es `null`) y se cierra en `evento.fin`, ambos en `js/config.js`.
  - **Revisión del dispositivo**: HTTPS, cámara, WebXR `immersive-ar`, sensores de movimiento y GPS.
  - **Preparar mi celular**: pide permiso de cámara (y de sensores en iPhone) por adelantado, así la noche del evento no hay diálogos de permisos.
  - **`IrrumpeAR.start(stage)`**: el único punto que hay que reemplazar. Hoy solo muestra "Experiencia en construcción".
- `ar.css` — estilos de la página (usa los tokens de `../styles.css`).

Para probar sin esperar la fecha: abrir `ar/?preview`.

> La cámara solo funciona en un sitio servido por **HTTPS** (o `localhost`). Abrir el archivo directo desde el disco no sirve para probarla.

## Cómo enchufar la experiencia

Reemplazar el cuerpo de `start()` en `ar.js`. Recibe el `<section id="stage">`; si la persona tocó "Preparar mi celular", el `<video id="camera">` ya tiene la cámara trasera corriendo.

Opciones, de más a menos recomendadas para "apuntar el celular a cada punto":

1. **Seguimiento de imagen (image tracking)** con [MindAR](https://github.com/hiukim/mind-ar-js) + three.js o A-Frame. Se pone un afiche o marca física en cada uno de los cuatro puntos y el celular la reconoce. Funciona en Android y iPhone, sin app. Es lo más confiable en la calle: el GPS en ciudad tiene errores de 5–20 m.
2. **AR por ubicación** (GPS + brújula) con [AR.js location-based](https://ar-js-org.github.io/AR.js-Docs/location-based/). No requiere marcas físicas, pero es menos preciso.
3. **WebXR** (`navigator.xr.requestSession('immersive-ar')`) + three.js. Detecta superficies y es lo más inmersivo, pero hoy solo funciona bien en Chrome Android; en iPhone no está disponible.
4. **Objetos 3D sueltos** con [`<model-viewer>`](https://modelviewer.dev/) y su atributo `ar`: abre Quick Look (iPhone) o Scene Viewer (Android). Simple, pero sale del navegador y no sabe dónde está la persona.

Cualquiera de estas librerías se puede cargar con un `<script>` en `index.html`; no hace falta agregar un paso de compilación.
