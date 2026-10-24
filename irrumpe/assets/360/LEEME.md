# Videos 360 propios

Aquí van los videos 360 de la galería que se alojan en el mismo sitio (sin YouTube).

## Para el pitch: `prototipo.mp4`

1. Copiar el archivo a esta carpeta con el nombre exacto **`prototipo.mp4`** (`irrumpe/assets/360/prototipo.mp4`). `js/config.js` ya lo tiene como "Prueba 360".
2. Revisarlo en `probar-360.html` → "Probar un archivo", en el computador y en el celular. Dice si es 360 (2:1), si el celular lo reproduce y si conviene achicarlo.
3. Volver a arrastrar la carpeta `irrumpe` a Netlify.

## Cómo debe ser el archivo

- **Equirectangular**, horizontal: el "rectángulo estirado" que exporta la app de la cámara 360 (Insta360 Studio, GoPro Player…). Si al abrirlo se ven **dos círculos**, todavía no está unido: exportarlo como "video 360" desde la app de la cámara.
- **2880×1440** (o 3840×1920 como máximo), **H.264**, 30 fps. Muchos celulares no pueden con 5.7K ni con H.265/HEVC.
- **Corto y liviano**: para la demo bastan 20–60 s; idealmente menos de 40 MB, para que cargue rápido con datos móviles.
- **"Optimizado para web"** (en inglés, *fast start*): así empieza a reproducirse antes de terminar de descargarse.

### Con HandBrake (gratis, Windows/Mac)

1. Abrir el video. En **Resumen**, marcar **Web Optimized** (optimizado para web).
2. **Dimensiones**: ancho 2880 y alto 1440 (sin recortes).
3. **Video**: códec H.264 (x264), velocidad de cuadros 30 constante, calidad RF 22.
4. **Audio**: AAC, 128 kbps.
5. Para dejar solo un tramo: en el rango, elegir segundos de inicio y fin.

### Con ffmpeg

```bash
ffmpeg -i original.mp4 -ss 0 -t 45 -vf scale=2880:1440 -r 30 \
  -c:v libx264 -preset slow -crf 22 -maxrate 10M -bufsize 20M -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart prototipo.mp4
```

## Videos largos (las intervenciones completas)

Un concierto completo en 360 pesa varios GB: no conviene subirlo a Netlify (es lento y el plan gratis tiene un tope de transferencia mensual). Para la galería definitiva, alojar los archivos en un almacenamiento para archivos grandes, por ejemplo **Cloudflare R2** (sin costo por transferencia) o **Bunny**, habilitar CORS para el dominio del sitio y poner el link completo en `video` (`https://…/azga.mp4`). Así no dependen de YouTube ni de bloqueos por derechos de la música.
