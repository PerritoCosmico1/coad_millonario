# Guía de operación — IRRUMPE

Cómo mantener el contenido al día y cómo dirigir el evento en vivo. No hace falta saber programar.

## 1. Cambiar el contenido (artistas, fotos, lugares, fechas)

1. Abrir **`panel.html`** del sitio publicado (en computador es más cómodo).
2. Editar. Todo queda como **borrador en ese navegador**; la sección *Revisión* avisa lo que falta.
3. **Ver página** y **Ver AR** muestran el borrador (con la marca "Borrador · sin publicar") sin que nadie más lo vea.
4. **Exportar (.zip)**: descomprimirlo dentro de la carpeta `irrumpe`, reemplazando archivos. Trae `js/config.js` y las fotos nuevas.
5. Si cambiaron artistas, fotos o lugares: abrir `tools/export-3d.html?borrador` (desde un servidor local o el sitio publicado), **Generar y descargar**, y reemplazar `assets/irrumpe.usdz`. Si no hay tiempo, en el panel → AR, desmarcar *Hay modelo del iPhone* (el iPhone usará cámara + giroscopio).
6. Subir la carpeta `irrumpe` a Netlify (Deploys → arrastrar la carpeta). La dirección no cambia.

## 2. Dirigir el evento en vivo

El director es quien marca **quién está tocando** y manda **avisos**. Todos los celulares con la página o la AR abiertas cambian al instante: el tótem se transforma para mostrar a ese artista, su faro se pone rojo, la landing lo destaca y aparece el aviso.

- Abrir **`director.html`** en el celular del director (con datos móviles, mejor).
- **Importar llave**: el archivo `irrumpe-llave-director.json`. Debe decir *✓ coincide con la del sitio*.
- Tocar el artista que empieza. "Avisar al público al cambiar" manda "Ahora: … en …".
- *Nadie tocando* entre sets; *Automático* vuelve a usar la `hora` de cada punto.
- **Aviso al público**: texto libre (hasta 140 caracteres), por ejemplo "Surdo empieza en 10 minutos".
- Dejar la página abierta: cada 30 s republica el estado (quien entra tarde lo recibe igual) y mantiene la pantalla encendida.

### La llave del director

- La **llave privada** (`irrumpe-llave-director.json`) es la que permite dirigir. **No va en el sitio ni en el repositorio**: guardarla en un lugar privado y compartirla solo con quien dirige.
- La **llave pública** está en `js/config.js` (`vivo.clave`). Sin la privada no sirve para nada.
- Si la privada se pierde o se filtra: en `director.html` → *Crear llave nueva*; pegar la pública nueva en el panel (*En vivo*), exportar y publicar.

### Si no hay conexión en vivo

La conexión usa servidores públicos de mensajes (HiveMQ y EMQX, en ese orden; se cambian en el panel). Si ninguno responde, la página funciona igual: el "en vivo" sale del horario (`hora` de cada punto) y no hay avisos ni reacciones compartidas. Algunas redes Wi-Fi bloquean estos puertos: con datos móviles funciona.

## 3. Antes del evento

- [ ] Panel → AR: desmarcar **Modo prototipo** (si no, la AR simula el show).
- [ ] Fechas, horas por punto y coordenadas exactas revisadas.
- [ ] Fotos y redes reales de cada artista (sin redes, los botones buscan su nombre).
- [ ] `assets/irrumpe.usdz` regenerado, o *Hay modelo del iPhone* desmarcado.
- [ ] Probar `director.html` con la llave y dos celulares mirando la AR.
- [ ] Videos de la galería probados en el celular con `probar-360.html`.
- [ ] Abrir la landing y la AR una vez con buena señal: después abren aunque no haya internet.

## 4. Qué funciona sin internet

Después de la primera visita: la landing, la AR (tótem, fichas, cámara, giroscopio, faros con GPS) y las fotos. Necesitan internet: en vivo (director, avisos, reacciones, conectados), la galería 360 y los links a redes.
