# Acceso AR — prototipo

Experiencia de realidad aumentada de IRRUMPE para celulares. Es un **prototipo**: funciona en cualquier lugar y a cualquier hora, y simula el show en vivo.

## Qué se ve

Un tótem holográfico: el mapa de puntos de Concepción en un disco con los cuatro puntos rojos. Desde cada punto sube un rayo de luz hasta la tarjeta de su artista (número, foto, nombre y lugar), con el logo e IRRUMPE arriba.

- **Tocar una tarjeta** abre la ficha del artista: foto a color, punto, botones para seguirlo (Instagram, Spotify, YouTube) y "Cómo llegar"; también género, bio y tema destacado si están cargados. Mientras falte el link real de una red, su botón busca el nombre del artista en esa plataforma (provisorio; `redesProvisorias` en `config.js`).
- **En vivo** (línea inferior): quién está tocando ahora. En el tótem lleva la insignia "EN VIVO" y sus ondas son más fuertes. En el evento real sale de la `hora` de cada punto; en el prototipo rota entre los artistas cada `ar.segundosPorSet` segundos, para mostrar la idea.
- **Íconos inferiores**: line-up, reacciones (corazón, chispa, rayo, que suben desde el punto en vivo) y música.
- **Música**: con el micrófono, las ondas, rayos y partículas siguen la música que suena en el lugar. Sin micrófono laten a un pulso de demostración.
- **Pellizcar** con dos dedos cambia el tamaño del tótem.
- La interfaz es mínima y se atenúa sola tras unos segundos sin tocarla.

## Un solo botón: el modo se elige solo

El lanzador muestra el tótem y un botón, **Entrar**. La página no abre otras apps ni cambia de navegador: usa lo que soporta el navegador en que se abrió.

| Navegador | Qué pasa al tocar Entrar |
|---|---|
| **Chrome** en Android con ARCore, p. ej. Galaxy S24 FE | **AR anclada e interactiva** (WebXR): se apunta al suelo o a una mesa y al tocar se apoya el tótem; ARCore lo mantiene fijo en ese punto. En una mesa cercana se achica solo. Si no detecta superficie (sala oscura), a los 5 s aparece "Colocar al frente". Fichas, reacciones y música. |
| **iPhone** (Safari y otros) | **AR Quick Look** del sistema: el tótem animado (`assets/irrumpe.usdz`) anclado al piso, sin pedir permisos. Al volver aparece "Ver artistas" (modo de abajo, con fichas, reacciones y música). |
| **Otros navegadores** (Firefox, Samsung Internet...) | **Cámara + giroscopio**: interactivo, sigue los giros del celular pero no los pasos. En Android aparece una sola línea: "Para anclarlo al piso, ábrelo en Chrome". |

Solo Chrome implementa la AR anclada en la web (WebXR); Firefox no la tiene. Si se niega la cámara, el tótem se muestra sobre fondo oscuro.

### Permisos, de a uno

- La cámara se pide recién al tocar Entrar, y el micrófono solo si se toca el ícono de ondas.
- Un segundo toque mientras se abre la cámara no abre otra.
- Al minimizar o bloquear el celular se detiene el dibujo y se suelta el micrófono. Al volver se reutiliza la misma cámara (no se vuelve a pedir); solo si el sistema la cortó se abre de nuevo, una vez. El micrófono vuelve solo si el permiso ya estaba dado y después de la cámara; si no, queda apagado hasta tocarlo.
- En AR anclada la sesión se cierra al minimizar y se vuelve a entrar con un toque.

### Rendimiento

- El 3D se dibuja a 1,5× (no a la resolución completa de la pantalla, 2,5–3× en celulares, que no se nota), a un máximo de 60 cuadros por segundo (en pantallas de 120 Hz no vale el doble de trabajo), y la vista previa del lanzador a 30.
- **Calidad adaptable**: si el celular no alcanza ~45 cuadros por segundo, baja la resolución sola hasta que fluya (y la AR anclada parte más liviana).
- Sin desenfoques (`backdrop-filter`) sobre la cámara: se recalculaban en cada cuadro.
- En la landing, las ondas del mapa recorren solo las celdas del anillo visible y en celular se dibujan a 30 cuadros por segundo.

## Galería 360

El mismo tótem sobre la **grabación 360 de una intervención**: un respaldo inmersivo para quien no pudo ir, en cualquier celular (con giroscopio) o computador (arrastrando). Se abre con el botón **360** del lanzador (o `ar/?galeria`, que es a donde lleva "Galería 360" en el QR de computador). Dentro de la experiencia, el mismo botón cambia el fondo entre **Tu cámara** y los videos.

Los videos van en `galeria` de `js/config.js`:

```js
galeria: [
  { punto: 'parque-ecuador', video: 'https://youtu.be/XXXXXXXXXXX' },   // en vivo o grabado
  { punto: 'udec', video: 'assets/360/antipatriarka.mp4', inicio: 30 }, // archivo propio
],
```

Los puntos sin video aparecen como "Próximamente". `config.js` ya trae la entrada "Prueba 360" apuntando a `assets/360/prototipo.mp4`.

**YouTube** (en vivo o grabado): la transmisión 360 de YouTube queda guardada sola en el canal al terminar, así que el mismo link sirve durante y después del evento. Un video de YouTube no se puede usar dentro del 3D (viene de otro dominio), así que el reproductor oficial va a pantalla completa detrás del tótem y en cada cuadro se le indica hacia dónde mirar (`setSphericalProperties`), con el mismo giro que la cámara virtual. Parte con sonido si el navegador lo permite; si no, en silencio, y el ícono de parlante lo activa.

**Archivo propio** (`.mp4` 360, **lo recomendado para el pitch**): se dibuja en una esfera alrededor de la cámara, calza exacto con el tótem y no depende de YouTube ni de bloqueos por derechos. Va en `assets/360/` (la ruta se escribe como las fotos: `assets/360/prototipo.mp4`) o en otro servidor con CORS (link completo). Si el hosting no entrega el video por partes, la app lo descarga entero y lo reproduce igual. Mientras el archivo no esté subido, su fila sale como "Próximamente". Formato y cómo achicarlo: [`assets/360/LEEME.md`](../assets/360/LEEME.md); para revisarlo antes, `probar-360.html` → "Probar un archivo".

### Videos de YouTube bloqueados: probarlos antes

Algunos videos **no se pueden ver fuera de YouTube**: su dueño desactivó la opción, o un titular de derechos (típicamente de la **música**, vía Content ID) lo bloquea en otros sitios. YouTube solo lo dice al intentar reproducirlo incrustado, y puede variar según el país o el aparato. Además, en el navegador del celular algunos videos 360 podrían verse planos.

Por eso, **antes de agregar un video, abrir `probar-360.html` en el celular** (en el sitio publicado) y pegar el link. Lo carga igual que la galería y responde:

- si se puede ver fuera de YouTube (y si no, por qué),
- si es 360 o plano,
- y da la línea lista para copiar a `config.js`, más un botón **Probar con el tótem** (abre `ar/?video=<link>`, sin tocar `config.js`).

Si en la galería un video falla igual, la app quita el aviso de YouTube, deja el tótem y muestra **Ver en YouTube ↗** (la app de YouTube también lo muestra en 360).

**Ojo con las transmisiones del evento:** tendrán la música de los artistas. Si sus canciones están en distribuidoras con Content ID, YouTube podría reclamar la transmisión y bloquearla fuera de YouTube (o silenciarla). Antes del evento conviene pedir a los artistas que agreguen el canal de La Única Compañía a la **lista de canales permitidos** de su distribuidora, y hacer una transmisión de prueba con su música. Para la galería posterior, lo más seguro es el **archivo propio** (`.mp4` exportado de la cámara 360), que no depende de YouTube.

Si el fondo gira al revés que el tótem, avisar: es un signo en `video360.js`.

### Cómo grabar y subir el video

- **Horizontal, equirectangular 2:1** (no vertical): es lo que entrega cualquier cámara 360 y lo que entiende YouTube. Quien lo ve elige hacia dónde mirar, así que la orientación del teléfono no importa.
- La cámara a la altura de los ojos (~1,6 m) y con el lente frontal hacia el escenario: ese es el "frente" que se ve al entrar.
- **YouTube en vivo 360**: activar "Video 360°" al crear la transmisión y enviar en 4K (3840×2160) o 1440p. **Subido después**: 3840×1920 o 5760×2880, con los metadatos 360 que pone la app de la cámara al exportar (si no, YouTube lo muestra plano).
- **Archivo propio**: 2880×1440 (3840×1920 como máximo), H.264, 30 fps, "optimizado para web". Resoluciones mayores (5.7K) y H.265/HEVC muchos celulares no los reproducen. Para la demo, un tramo corto (20–60 s, menos de ~40 MB).
- **Las intervenciones completas** (varios GB cada una) no conviene subirlas a Netlify: mejor un almacenamiento para archivos grandes como Cloudflare R2 (sin costo por transferencia) o Bunny, con CORS, y el link completo en `video`.

## Probarla en el celular

La cámara y la AR **solo funcionan con HTTPS**, así que hay que publicar el sitio (ver `../PITCH.md`).

Para las visuales con música: tocar el ícono de ondas junto a **Entrar** antes de entrar, y permitir el micrófono.

## Editar el contenido

Todo sale de `../js/config.js`: artistas, fotos, redes (`artista.redes`), tema (`artista.musica`), puntos, horarios y videos de la galería (`galeria`). Lo que esté vacío no se muestra (salvo las redes, que mientras tanto buscan al artista).

En `ar` de `config.js`:
- `prototipo: true` — abierta siempre y show simulado. Para el evento real, `false`: se abre en `activaDesde` (o al inicio del evento) y usa las horas reales.
- `segundosPorSet` — cada cuánto rota el artista "en vivo" en la simulación.

### Modelo para iPhone (`assets/irrumpe.usdz`)

Versión del tótem para AR Quick Look, con animaciones en loop (tarjetas que flotan, ondas, pulso a 118 BPM, partículas). Se genera con `../tools/export-3d.html` a partir del mismo `config.js`: si cambian artistas, fotos o puntos, hay que regenerarlo (abrir esa página desde un servidor local y apretar "Generar y descargar") y reemplazar el archivo.

## Archivos

```text
index.html     lanzador (tótem + Entrar) y capa de la experiencia
ar.css         estilos del lanzador y de la interfaz en AR
ar.js          elección automática de modo, interfaz (en vivo, fichas, line-up, reacciones, galería)
hologram.js    el tótem 3D (mapa, puntos, rayos, tarjetas, partículas, reacciones)
sessions.js    los modos: WebXR anclado, cámara + giroscopio, sin cámara, fondo 360; pellizco para escalar
video360.js    fondo 360: reproductor de YouTube guiado por el giroscopio, o un .mp4 en una esfera
audio.js       intensidad de la música por micrófono, o pulso de demostración
```

Usa [three.js](https://threejs.org) desde `../vendor/three.min.js` (generado con `../tools/build-three.sh`). No necesita compilar nada.

Para depurar desde la consola del navegador: `IrrumpeAR.route`, `IrrumpeAR.openArtist(0)`, `IrrumpeAR.openLineup()`, `IrrumpeAR.openGallery()`, `IrrumpeAR.session`, `IrrumpeAR.quality`, `IrrumpeAR.holo`.

## Ideas para seguir

- Resaltar el artista del punto donde está cada persona (GPS) o al que está mirando (GPS + brújula). Es posible en la web; necesita permiso de ubicación.
- Seguimiento de imagen (afiches en cada punto) con [MindAR](https://github.com/hiukim/mind-ar-js), para que cada tarjeta aparezca sobre el afiche real de su punto.
- Reacciones compartidas entre todo el público (requiere un servidor).
- Captura de foto con el tótem para compartir en Instagram.
