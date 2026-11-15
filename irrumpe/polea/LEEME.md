# POLEA · Primer vuelo — AR de la tocata

`/polea/` es la versión de IRRUMPE para esta tocata (15 nov, Monarca, Aníbal Pinto 143), con su propio estilo y sus bandas.

## La idea: escenario aumentado

Monarca no tiene la producción de un festival; por la cámara del celular, sí. Se apunta al escenario y, **alrededor de la banda, sin taparla**, se enciende un show de luces que sigue la música en vivo (por el micrófono):

- truss (estructura) que enmarca el escenario, focos con haces de luz, luces cinéticas colgando que suben y bajan, columnas LED a los costados (graves y agudos), candilejas y humo bajo;
- en las partes fuertes de cada canción: láseres hacia el público (en abanico sobre las cabezas o en túnel alrededor de quien mira), ondas que salen de la banda y chispas en las esquinas. En las partes tranquilas, todo se calma;
- cada banda tiene sus colores y su estilo (`config.js` → `show`); al cambiar de banda hay un apagón y se enciende con los suyos, con su nombre arriba unos segundos.

Además:

- **Mirar hacia arriba**: el techo se abre. Cielo nocturno, estrellas, aurora con los colores de la banda y aviones de papel ("Primer vuelo").
- **Mirar hacia abajo**: el line-up. Tocar una banda la marca como la que está tocando (si hay atrasos).
- **Tocar la pantalla**: fuegos artificiales sobre el escenario, o en el cielo si se mira hacia arriba.
- **Abajo**: botón grande para seguir a la banda en Instagram (abre su perfil) y sus otras redes.

## Cómo se usa

1. Abrir `https://<sitio>/polea/` → **Abrir AR** (permite cámara y micrófono).
2. Encuadrar el escenario con el contorno blanco (con dos dedos se agranda o achica) → **Fijar aquí** o tocar la pantalla. Se enciende luz por luz.
3. Arriba: × salir · ondas (micrófono) · ◉ modo grabación (sin botones; mantener presionado para volver) · ⛶ volver a encuadrar.

Quién toca sale del horario del afiche. Si hay atrasos: mirar abajo y tocar la banda, o en el lanzador tocar la banda → **Está tocando ahora** ("Volver al horario" lo deshace). Queda guardado en ese celular.

Sin micrófono (o si se apaga con el botón de ondas), las luces siguen una canción de demostración. En una pieza en silencio las luces quedan tranquilas: para probar en casa, poner música fuerte o apagar el micrófono.

Usa cámara + giroscopio: no necesita ver el piso ni luz. Chrome, Firefox, Samsung Internet y Safari. Después de abrirla una vez con señal, abre sin internet.

Para probar antes: `?hora=17:30` simula la hora; en computador, `?preview` deja entrar (se mira arrastrando).

## Para grabar el video

- Abrir `/polea/` con buena señal antes de entrar al local; no cerrar la pestaña.
- Celular: No molestar, brillo al máximo, **sin ahorro de batería**, grabación de pantalla **con sonido**.
- Encuadrar el escenario completo con el contorno → **Fijar aquí**. Si se corre, ⛶ y encuadrar de nuevo.
- **◉ modo grabación** para la toma limpia.
- Tomas que se ven bien:
  - el encendido (fijar y que se prendan las luces una por una);
  - una parte fuerte de una canción (láseres y chispas);
  - levantar el celular y que se abra el techo;
  - tocar para lanzar fuegos;
  - mirar abajo al line-up;
  - tocar el @ y que abra Instagram;
  - el cambio de banda (apagón y nuevos colores).
- Toma en tercera persona: desde atrás y un poco al lado, que se vean la pantalla y la banda. Un aplauso al empezar para sincronizar las dos grabaciones.

## Archivos

`config.js` (bandas, horas, redes, colores y estilo de cada una) · `polea.js` (la experiencia) · `polea.css` · `img/` (cintas recortadas del afiche).
El motor es de IRRUMPE y sirve para cualquier evento: `../ar/escenario.js` (luces), `../ar/cielo.js` (cielo), `../ar/ritmo.js` (lectura de la música).
