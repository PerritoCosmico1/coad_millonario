# Acceso AR — prototipo

Experiencia de realidad aumentada de IRRUMPE para celulares. Es un **prototipo**: funciona en cualquier lugar y a cualquier hora, y simula el show en vivo.

## Qué se ve

Un holograma con el mapa de puntos de Concepción y los cuatro puntos rojos. Desde cada punto sube un rayo de luz hasta la tarjeta de su artista (foto, nombre y lugar), con el título IRRUMPE arriba.

- **Tocar una tarjeta** abre la ficha del artista: foto a color, punto, redes sociales, tema destacado, "Cómo llegar" y "Ver en el holograma".
- **En vivo**: abajo se muestra quién está tocando, con barra de progreso y quién sigue. En el holograma, ese artista tiene la insignia "EN VIVO" y sus ondas son más fuertes. En el prototipo cada artista toca `ar.segundosPorSet` segundos, en loop; en el evento real se usa la `hora` de cada punto.
- **Artistas**: el line-up completo, con quién está en vivo y quién sigue.
- **Reacciones** (corazón, chispa, rayo): suben desde el punto que está en vivo.
- **Música**: con el micrófono activado, las ondas, rayos y partículas siguen la música que suena en el lugar. Sin micrófono, laten a un pulso de demostración.

## Modos

Al tocar **Entrar a la experiencia** se elige solo el mejor modo:

| Modo | Dónde | Cómo se ve |
|---|---|---|
| **AR completa** (WebXR) | Chrome en Android con ARCore, como el Samsung Galaxy S24 FE | Se apunta al suelo o a una mesa, aparece un anillo rojo y al tocar se apoya el holograma ahí. Se puede caminar alrededor. En una mesa cercana se achica solo. |
| **AR · cámara** | Cualquier celular con cámara y giroscopio (iPhone incluido) | La cámara de fondo y el holograma delante; se mira alrededor moviendo el celular. "Recentrar" lo vuelve a poner al frente. |
| **Sin cámara** | Botón "Sin cámara", o si se niega el permiso | El holograma sobre fondo oscuro; con giroscopio o arrastrando el dedo. |

Si WebXR falla por cualquier motivo, entra en "AR · cámara" automáticamente.

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
hologram.js    el holograma 3D (mapa, puntos, rayos, tarjetas, partículas, reacciones)
sessions.js    los tres modos: WebXR, cámara + giroscopio, sin cámara
audio.js       intensidad de la música por micrófono, o pulso de demostración
```

Usa [three.js](https://threejs.org) desde `../vendor/three.min.js` (generado con `../tools/build-three.sh`). No necesita compilar nada.

Para depurar desde la consola del navegador: `IrrumpeAR.openArtist(0)`, `IrrumpeAR.openLineup()`, `IrrumpeAR.session`, `IrrumpeAR.holo`.

## Ideas para seguir

- Seguimiento de imagen (afiches en cada punto) con [MindAR](https://github.com/hiukim/mind-ar-js), para que cada tarjeta aparezca sobre el afiche real de su punto.
- Reacciones compartidas entre todo el público (requiere un servidor).
- Captura de foto con el holograma para compartir en Instagram.
