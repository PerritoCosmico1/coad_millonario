# IRRUMPE — landing

Landing de **IRRUMPE**, la intervención musical de La Única Compañía en cuatro puntos de Concepción.

Es un sitio estático: HTML, CSS y JS planos, sin build ni dependencias que instalar. Es independiente del resto de este repositorio (la app del concurso que vive en la raíz).

## Qué hay en la página

- **Mapa estilizado de Concepción**: la costa, la bahía, el río Biobío y las lagunas dibujados como una grilla de puntos (datos reales de OpenStreetMap). En escritorio el cursor funciona como linterna y revela el terreno.
- **Cuatro puntos rojos** (Parque Ecuador, Plaza de la Independencia, Plaza Bicentenario y UdeC) que tiemblan y emiten ondas. Al pasar el mouse (o tocar en celular) muestran: lugar, foto y nombre del artista, y un link "Cómo llegar"; también hora, género, bio, un tema y redes cuando estén cargados. Con un clic la tarjeta queda fija; si el artista tiene un link de Spotify o YouTube en `musica.embed`, en ese momento se carga el reproductor.
- **Los cuatro puntos siempre están a la vista**: la tarjeta nunca tapa un punto. En escritorio se ubica al costado del grupo de puntos (y si no cabe, el mapa se desliza para hacerle lugar). En celular es una hoja inferior compacta: la cuenta regresiva se achica y el mapa se reencuadra arriba de la hoja. Nada de la página necesita scroll, ni en celular horizontal.
- **Cuenta regresiva** grande hasta el inicio, con el nombre y logo de La Única Compañía. Durante el evento cambia a "EN VIVO" y al terminar a "YA IRRUMPIÓ".
- **Acceso AR**: botón arriba a la derecha. Abre un panel con el estado del acceso y, en escritorio, un QR para abrirlo en el celular. Lleva a `ar/`, que está preparada para montar la experiencia de realidad aumentada más adelante (ver [`ar/README.md`](ar/README.md)).
- Una intro corta tipo "acceso concedido" (se salta con un clic, en la segunda visita y con movimiento reducido).

## Editar el contenido

Todo se cambia en **[`js/config.js`](js/config.js)**: fecha y hora, nombre de la compañía y logo, y los puntos (lugar, coordenadas, hora, artista, foto, música, redes). Lo marcado con `[PENDIENTE]` falta confirmarlo; los campos vacíos no se muestran.

- **Logo**: `assets/logo-la-unica-compania.png` (blanco sobre transparente). Para cambiarlo, reemplazar el archivo o apuntar `compania.logo` a otro.
- **Fotos de artistas**: en `assets/artistas/` (cuadradas o verticales); la ruta va en `artista.foto`. Se muestran en blanco y negro con un tinte rojo para que todas se vean parejas. La de Yuri salió de una captura de la web y es de baja resolución: conviene reemplazarla por el original.
- **Coordenadas**: en Google Maps, clic derecho sobre el lugar → el primer ítem son `lat, lng`.
- **Puntos**: pueden ser más o menos de cuatro; el mapa se encuadra solo.
- **Colores y tipografías**: variables al inicio de [`styles.css`](styles.css). El rojo (`--red`) es el de la web de La Única Compañía. Las fuentes son *Archivo* (cuenta regresiva y títulos) y *JetBrains Mono* (todo lo demás), desde Google Fonts.
- **Imagen para compartir** (`assets/og.jpg`, 1200×630): captura con la fecha del 1 de febrero de 2027; si la fecha cambia, hay que rehacerla. Algunos sitios (WhatsApp, Facebook) exigen que `og:image` en `index.html` sea una URL absoluta: cambiarla al publicar.

## Verla en local

Se puede abrir `index.html` directo desde el disco. Para probar la cámara de `ar/` hace falta servirla por HTTP:

```bash
npx serve irrumpe
# o
python3 -m http.server 8080 --directory irrumpe
```

## Publicar

Cualquier hosting estático sirve (GitHub Pages, Netlify, Vercel, Cloudflare Pages): publicar el contenido de esta carpeta tal cual. Tiene que ser **HTTPS** para que el acceso AR pueda usar la cámara.

## Mapa

`js/concepcion-geo.js` se genera con [`tools/build-geo.py`](tools/build-geo.py) a partir de [@geo-maps](https://github.com/simonepri/geo-maps) (OpenStreetMap, licencia ODbL; por eso el crédito en la esquina). Solo hace falta volver a correrlo si se quiere cubrir otra zona:

```bash
python3 irrumpe/tools/build-geo.py
```

Los datos de origen son simplificados; la página los suaviza al dibujarlos. Las ubicaciones exactas de los puntos salen de `config.js`, no del mapa.

## Archivos

```text
index.html              estructura de la página
styles.css              estilos (tokens de color/tipografía al inicio)
js/config.js            ← contenido editable
js/app.js               mapa, puntos, tarjeta, cuenta regresiva, panel AR
js/concepcion-geo.js    costa y agua (generado)
ar/                     acceso AR (andamiaje para la experiencia futura)
assets/                 logo, favicon, íconos, imagen para compartir, fotos
vendor/qrcode.js        generador de QR (MIT, Kazuhiko Arase)
tools/build-geo.py      genera js/concepcion-geo.js
manifest.webmanifest    permite "agregar a pantalla de inicio"
```
