# Acceso AR — prototipo

Experiencia de realidad aumentada de IRRUMPE para celulares. Es un **prototipo**: funciona en cualquier lugar y a cualquier hora, y simula el show en vivo.

## Qué se ve

Un tótem holográfico: el mapa de puntos de Concepción en un disco con los cuatro puntos rojos. Desde cada punto sube un rayo de luz hasta la tarjeta de su artista (foto, nombre y lugar), con el título IRRUMPE arriba.

- **Tocar una tarjeta** abre la ficha del artista: foto a color, punto, redes sociales, tema destacado, "Cómo llegar" y "Ver en el tótem".
- **En vivo** (línea inferior): quién está tocando, con barra de progreso y quién sigue. En el tótem, ese artista tiene la insignia "EN VIVO" y sus ondas son más fuertes. En el prototipo cada artista toca `ar.segundosPorSet` segundos, en loop; en el evento real se usa la `hora` de cada punto.
- **Íconos inferiores**: line-up, reacciones (corazón, chispa, rayo, que suben desde el punto en vivo) y música.
- **Música**: con el micrófono, las ondas, rayos y partículas siguen la música que suena en el lugar. Sin micrófono laten a un pulso de demostración.
- **Pellizcar** con dos dedos cambia el tamaño del tótem.
- La interfaz es mínima y se atenúa sola tras unos segundos sin tocarla.

## Modos

Según el celular, el lanzador ofrece la mejor forma de verlo **anclado al mundo** (que uno pueda acercarse, alejarse y rodearlo):

| Celular | Botón principal | Cómo se ve |
|---|---|---|
| Android con **Chrome** y ARCore (p. ej. Galaxy S24 FE) | Entrar a la experiencia | **AR anclada** (WebXR): se apunta al suelo o a una mesa, aparece un anillo rojo y al tocar se apoya el tótem. ARCore lo mantiene fijo en ese punto. En una mesa cercana se achica solo. Si no detecta superficie (sala oscura), a los 5 s aparece "Colocar al frente". |
| Android con otro navegador (Samsung Internet, apps) | Abrir en Chrome · AR anclada | Abre la misma página en Chrome. "Entrar aquí (sin anclaje)" usa el modo con giroscopio. |
| **iPhone** | Ver en tu espacio | **AR Quick Look** (la AR del sistema): el tótem animado (`assets/irrumpe.usdz`) anclado al piso, con un banner de IRRUMPE y el botón "Ver artistas". "Modo interactivo" abre la experiencia con cámara y giroscopio. |
| Cualquier otro | Entrar a la experiencia | **AR · giro**: cámara de fondo y giroscopio. Sigue los giros del celular pero no los pasos. |

"Sin cámara" muestra el tótem sobre fondo oscuro. Si WebXR falla, entra en "AR · giro" automáticamente. Al minimizar o bloquear el celular, la cámara se reabre sola al volver (en AR anclada la sesión se cierra y se vuelve a entrar con un toque).

En computador la página muestra un QR para abrirla en el celular. Para verla igual en un computador (para probar o proyectar), agrega `?preview` a la URL.

## Probarla en el celular

La cámara y WebXR **solo funcionan con HTTPS**, así que hay que publicar el sitio. Lo más rápido es arrastrar la carpeta `irrumpe` a [Netlify Drop](https://app.netlify.com/drop) y abrir en el celular el link que entrega, más `/ar/`.

En el S24 FE:
1. Abrir el link en **Chrome** (para AR completa; Samsung Internet puede usar el modo con cámara).
2. Si Chrome pide instalar o actualizar **Google Play Services para AR**, aceptar.
3. "Entrar a la experiencia" → permitir cámara → apuntar al suelo hasta ver el anillo rojo → tocar.
4. Para las visuales con música, tocar "Música: demo" **antes** de entrar y permitir el micrófono.

## Editar el contenido

Todo sale de `../js/config.js`: artistas, fotos, redes (`artista.redes`), tema (`artista.musica`), puntos y horarios. Las redes que estén vacías aparecen como "Redes por anunciar".

En `ar` de `config.js`:
- `prototipo: true` — abierta siempre y show simulado. Para el evento real, `false`: se abre en `activaDesde` (o al inicio del evento) y usa las horas reales.
- `segundosPorSet` — duración de cada artista en la simulación.

## Archivos

```text
index.html     lanzador (vista previa 3D) + capa de la experiencia
ar.css         estilos del lanzador y de la interfaz en AR
ar.js          lanzador, elección de modo, interfaz (en vivo, fichas, line-up, reacciones)
hologram.js    el tótem 3D (mapa, puntos, rayos, tarjetas, partículas, reacciones)
sessions.js    los modos: WebXR anclado, cámara + giroscopio, sin cámara; pellizco para escalar
audio.js       intensidad de la música por micrófono, o pulso de demostración
```

Usa [three.js](https://threejs.org) desde `../vendor/three.min.js` (generado con `../tools/build-three.sh`). No necesita compilar nada.

### Modelo para iPhone (`assets/irrumpe.usdz`)

Es una versión del tótem para AR Quick Look, con animaciones en loop (tarjetas que flotan, ondas, pulso a 118 BPM, partículas). Se genera con `../tools/export-usdz.html` a partir del mismo `config.js`: si cambian artistas, fotos o puntos, hay que regenerarlo (abrir esa página desde un servidor local y apretar "Generar y descargar") y reemplazar el archivo.

Para depurar desde la consola del navegador: `IrrumpeAR.openArtist(0)`, `IrrumpeAR.openLineup()`, `IrrumpeAR.session`, `IrrumpeAR.holo`.

## Ideas para seguir

- Resaltar el artista del punto donde está cada persona (GPS) o al que está mirando (GPS + brújula). Es posible en la web; necesita permiso de ubicación.
- Seguimiento de imagen (afiches en cada punto) con [MindAR](https://github.com/hiukim/mind-ar-js), para que cada tarjeta aparezca sobre el afiche real de su punto.
- Reacciones compartidas entre todo el público (requiere un servidor).
- Captura de foto con el holograma para compartir en Instagram.
