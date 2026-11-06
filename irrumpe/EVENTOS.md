# Eventos y grabación en terreno

## Abrir un evento

Cada evento se abre con su link: agregar `?evento=<id>` a cualquier página.

| Evento | Landing | AR | Editor |
|---|---|---|---|
| IRRUMPE (principal, `js/config.js`) | `/` | `/ar/` | `/editar.html` |
| BalmaFest 06.11 (`js/eventos.js`) | `/?evento=balmafest` | `/ar/?evento=balmafest` | `/editar.html?evento=balmafest` |

El QR de un evento se genera con `qr.html?evento=<id>`.

Para agregar otro evento, copiar el bloque `balmafest` en `js/eventos.js` con otro id y cambiar fecha, lugar y artistas. Lo que no se defina ahí (compañía, logo, redes provisorias) se toma de `config.js`.

## Editor rápido (en el celular, en el lugar)

`editar.html?evento=<id>` permite, desde el teléfono y sin subir nada:

- **Usar mi ubicación**: deja el lugar exacto en el mapa del tótem (en un festival, para todos los artistas a la vez).
- **Foto** de cada artista (de la cámara o la galería; se achica sola).
- **Redes**: Instagram (`@usuario` o link), Spotify y YouTube. Las vacías buscan el nombre del artista.
- **En vivo ahora**: quién está tocando (si no, rota solo).
- Agregar o quitar artistas.

Los cambios quedan **solo en ese celular** y se ven al abrir la AR o la landing desde él. Para dejarlos fijos para todos: **Descargar respaldo** y pasar el archivo a quien mantiene el sitio. **Volver al original** borra los cambios del celular.

## Para grabar el video

En la AR:

- **Modo grabación** (ícono ◉ arriba): esconde los botones; las fichas igual se abren al tocar una tarjeta. Para volver, **mantener presionado** la pantalla.
- **Poca luz**: si a los 2–3 s no encuentra el piso aparecen **Colocar al frente** (lo deja delante, a la altura del piso) y **Sin anclar** (cámara + giroscopio: no necesita luz, sigue los giros del celular pero no los pasos). Si el tótem salta o se desliza, usar **Sin anclar**.
- **Música**: tocar el ícono de ondas *antes* de "Entrar" para que el tótem siga la música del lugar.

Checklist:

- [ ] Permiso del artista y del lugar para grabar y para mostrarlos en la app.
- [ ] En el lugar: `editar.html?evento=…` → Usar mi ubicación, fotos, redes, en vivo.
- [ ] Grabar en **Android con Chrome** (en iPhone, para eventos nuevos, la AR es cámara + giroscopio).
- [ ] Celular: No molestar, brillo al máximo, **sin ahorro de batería** (baja los cuadros por segundo), cargado. Grabación de pantalla con sonido "multimedia y micrófono".
- [ ] Abrir la AR con buena señal antes de entrar (adentro suele no haber) y no cerrar la pestaña.
- [ ] Apuntar a zonas iluminadas y con textura (escenario, piso con dibujo); mover el celular lento unos segundos antes de colocar el tótem. Si está muy oscuro, alguien ilumina el piso con la linterna solo mientras se coloca.
- [ ] Toma en tercera persona: un aplauso o un flash al comienzo, que quede en las dos grabaciones, para sincronizarlas al editar.
