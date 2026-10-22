# Acceso AR — prototipo

Experiencia de realidad aumentada de IRRUMPE para celulares. Es un **prototipo**: funciona en cualquier lugar y a cualquier hora, y simula el show en vivo.

## Qué se ve

Un tótem holográfico: el mapa de puntos de Concepción en un disco con los cuatro puntos rojos. Desde cada punto sube un rayo de luz hasta la tarjeta de su artista (número, foto, nombre y lugar), con el logo e IRRUMPE arriba.

- **Tocar una tarjeta** abre la ficha del artista: foto a color, punto, y —si están cargados— género, bio, redes, tema destacado. Siempre, "Cómo llegar".
- **En vivo** (línea inferior): quién está tocando ahora. En el tótem lleva la insignia "EN VIVO" y sus ondas son más fuertes. En el evento real sale de la `hora` de cada punto; en el prototipo rota entre los artistas cada `ar.segundosPorSet` segundos, para mostrar la idea.
- **Íconos inferiores**: line-up, reacciones (corazón, chispa, rayo, que suben desde el punto en vivo) y música.
- **Música**: con el micrófono, las ondas, rayos y partículas siguen la música que suena en el lugar. Sin micrófono laten a un pulso de demostración.
- **Pellizcar** con dos dedos cambia el tamaño del tótem.
- La interfaz es mínima y se atenúa sola tras unos segundos sin tocarla.

## Un solo botón: el modo se elige solo

El lanzador muestra el tótem y un botón, **Entrar**. Una página web no puede saber cuál es el navegador predeterminado, pero sí qué soporta el navegador en que se abrió, y con eso elige:

| Navegador | Qué pasa al tocar Entrar |
|---|---|
| **Chrome** (y otros Chromium con WebXR) en Android con ARCore, p. ej. Galaxy S24 FE | **AR anclada e interactiva** (WebXR): se apunta al suelo o a una mesa y al tocar se apoya el tótem; ARCore lo mantiene fijo en ese punto. En una mesa cercana se achica solo. Si no detecta superficie (sala oscura), a los 5 s aparece "Colocar al frente". Fichas, reacciones y música. |
| **iPhone** (Safari y otros) | **AR Quick Look** del sistema: el tótem animado (`assets/irrumpe.usdz`) anclado al piso, con un banner de IRRUMPE. |
| **Android sin WebXR** (Firefox, Samsung Internet...) | **Scene Viewer** de Google: el tótem animado (`assets/irrumpe.glb`) anclado al piso. Si el visor no abre en 3 s, entra solo al modo con giroscopio. |
| Cualquier otro | **Cámara + giroscopio**: interactivo, sigue los giros del celular pero no los pasos. |

Al volver de Quick Look o Scene Viewer aparece "Ver artistas", que abre la versión interactiva (fichas, reacciones, música). Si se niega la cámara, el tótem se muestra sobre fondo oscuro.

Al minimizar o bloquear el celular se sueltan la cámara y el micrófono, y se retoman al volver. En AR anclada la sesión se cierra y se vuelve a entrar con un toque.

En computador la página muestra un QR para abrirla en el celular. Para verla igual en un computador (para probar o proyectar), agrega `?preview` a la URL.

## Probarla en el celular

La cámara y la AR **solo funcionan con HTTPS**, así que hay que publicar el sitio (ver `../PITCH.md`).

Para las visuales con música: tocar el ícono de ondas junto a **Entrar** antes de entrar, y permitir el micrófono.

## Editar el contenido

Todo sale de `../js/config.js`: artistas, fotos, redes (`artista.redes`), tema (`artista.musica`), puntos y horarios. Lo que esté vacío no se muestra.

En `ar` de `config.js`:
- `prototipo: true` — abierta siempre y show simulado. Para el evento real, `false`: se abre en `activaDesde` (o al inicio del evento) y usa las horas reales.
- `segundosPorSet` — cada cuánto rota el artista "en vivo" en la simulación.

### Modelos para iPhone y Android (`assets/irrumpe.usdz`, `assets/irrumpe.glb`)

Versiones del tótem para los visores de AR del sistema, con animaciones en loop (tarjetas que flotan, ondas, pulso a 118 BPM, partículas). Se generan con `../tools/export-3d.html` a partir del mismo `config.js`: si cambian artistas, fotos o puntos, hay que regenerarlos (abrir esa página desde un servidor local y apretar "Generar y descargar") y reemplazar los archivos.

## Archivos

```text
index.html     lanzador (tótem + Entrar) y capa de la experiencia
ar.css         estilos del lanzador y de la interfaz en AR
ar.js          elección automática de modo, interfaz (en vivo, fichas, line-up, reacciones)
hologram.js    el tótem 3D (mapa, puntos, rayos, tarjetas, partículas, reacciones)
sessions.js    los modos: WebXR anclado, cámara + giroscopio, sin cámara; pellizco para escalar
audio.js       intensidad de la música por micrófono, o pulso de demostración
```

Usa [three.js](https://threejs.org) desde `../vendor/three.min.js` (generado con `../tools/build-three.sh`). No necesita compilar nada.

Para depurar desde la consola del navegador: `IrrumpeAR.route`, `IrrumpeAR.openArtist(0)`, `IrrumpeAR.openLineup()`, `IrrumpeAR.session`, `IrrumpeAR.holo`.

## Ideas para seguir

- Resaltar el artista del punto donde está cada persona (GPS) o al que está mirando (GPS + brújula). Es posible en la web; necesita permiso de ubicación.
- Seguimiento de imagen (afiches en cada punto) con [MindAR](https://github.com/hiukim/mind-ar-js), para que cada tarjeta aparezca sobre el afiche real de su punto.
- Reacciones compartidas entre todo el público (requiere un servidor).
- Captura de foto con el tótem para compartir en Instagram.
