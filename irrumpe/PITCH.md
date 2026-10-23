# Plan para el pitch: QR al final del video

Objetivo: que cualquier persona de la sala escanee el QR y en menos de 30 segundos tenga el tótem de IRRUMPE frente a ella, en su propio celular.

## 1. Publicar en una dirección fija (hacerlo hoy)

El QR va "grabado" en el video, así que la dirección no puede cambiar después.

1. Crear una cuenta gratis en [Netlify](https://app.netlify.com) (el Drop sin cuenta se borra a las pocas horas).
2. Crear un sitio nuevo con la opción de **subir/arrastrar manualmente** (deploy manually) y arrastrar la carpeta `irrumpe` completa. Incluye `_headers`, que hace que el modelo para iPhone se sirva bien.
3. En la configuración del sitio, **cambiarle el nombre** por uno corto, por ejemplo `irrumpe` → `https://irrumpe.netlify.app`.
4. Para actualizar algo después: en la sección **Deploys** del mismo sitio, arrastrar de nuevo la carpeta. La dirección no cambia y el QR sigue sirviendo.

Probar `https://irrumpe.netlify.app/ar/` en varios celulares antes de generar el QR.

## 2. Generar el QR para el video

1. Abrir `https://irrumpe.netlify.app/qr.html` (desde el sitio publicado la dirección queda bien sola).
2. Revisar que apunte a `…/ar/` y apretar **Descargar placa 1920×1080**: es el cierre del video, con la marca, el QR grande y la dirección escrita para quien no pueda escanear.
3. Dejar la placa en pantalla **al menos 20–30 segundos** y tenerla como diapositiva fija durante las preguntas.
4. Probar el escaneo **desde la última fila** con la placa proyectada. El QR está probado: se lee aunque la placa se vea muy chica.

Si se necesita solo el código (para otro diseño), la misma página descarga el QR en PNG 2048 o SVG. Siempre negro sobre fondo claro: es lo que leen todas las cámaras.

## 3. Qué verá cada persona

Un solo botón, **Entrar**; la página elige sola lo mejor para cada celular, sin abrir otras apps ni otros navegadores:

| Celular | Qué pasa |
|---|---|
| Android con **Chrome** | AR anclada e interactiva: apunta al piso, toca, y el tótem queda fijo; puede acercarse, rodearlo, tocar artistas, reaccionar y activar la música. |
| Android con **Firefox, Samsung Internet** u otro | El tótem sobre la cámara, interactivo (sigue los giros del celular, no los pasos). Una línea discreta avisa que para anclarlo hay que abrirlo en Chrome. |
| **iPhone** | Se abre la AR del iPhone (Quick Look) con el tótem animado anclado al piso, sin pedir permisos. Al volver, "Ver artistas". |
| Computador | Muestra un QR para abrirlo en el celular, y "Galería 360". |

La AR anclada en la web solo existe en Chrome (WebXR); Firefox no la implementa. Como el QR se abre en el navegador predeterminado de cada uno, conviene decirlo al cierre: **"si tienes Android, ábrelo en Chrome"**.

El botón **360** (junto a Entrar) abre la galería: el tótem sobre la grabación 360 de una intervención. Funciona en cualquier celular, así que es un buen plan B para quien no tenga Chrome.

## 4. Ensayo (con al menos dos días de margen)

- En **la sala real**, con su luz y su Wi-Fi o datos móviles.
- Con al menos **un iPhone, un Samsung** (dejando que abra Samsung Internet), **un Android con Chrome y uno con Firefox**.
- Probar también la **Galería 360** en esos celulares (ver la nota sobre YouTube en `ar/README.md`).
- Cronometrar: desde escanear hasta ver el tótem, idealmente menos de 30 s.
- **Luz**: la AR necesita ver el piso. Si la sala queda a oscuras para el video, pedir que suban las luces cuando aparezca el QR. Si igual no detecta el piso, a los 5 segundos aparece **Colocar al frente**.
- **Música**: con el ícono de ondas activado (junto a Entrar, antes de entrar), el tótem late con lo que suena en la sala, incluida la música del video. Que el audio de la sala esté fuerte en ese momento.

## 5. Cierre sugerido

En pantalla o dicho en vivo, 5 segundos: **"Escaneen el código, toquen Entrar y apunten al piso"** (en Android, con Chrome). Y quien quiera que el tótem baile: "activen Música".

## 6. Plan B

- Grabar la pantalla del S24 FE usando la AR anclada e incluir 10–15 segundos en el video, **antes** del QR: así todos ya vieron lo que van a vivir.
- Tener 2 o 3 celulares del equipo con la AR ya abierta para pasar a quien no pueda escanear.
- Llevar un hotspot de datos por si la red de la sala falla.

## 7. Checklist del contenido

- [ ] `ar.prototipo: true` en `js/config.js` (la AR está abierta siempre y simula el show).
- [ ] Redes de los artistas cargadas en `js/config.js` (si no, aparecen como "Redes por anunciar").
- [ ] Si cambian fotos, artistas o puntos: regenerar `assets/irrumpe.usdz` con `tools/export-3d.html` (instrucciones en esa página) y volver a publicar.
- [ ] Revisar en un iPhone que "Entrar" abra el visor AR del sistema.
- [ ] Videos de la galería en `galeria` de `js/config.js` (la "Prueba 360" se puede quitar cuando estén los reales).
