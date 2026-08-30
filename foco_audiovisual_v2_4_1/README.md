# FOCO Audiovisual V2.4.1

FOCO es una web app de control para un concurso televisivo: un panel de producción, dos interfaces de concursante y una salida `/broadcast.html` pensada para entrar al switcher/VTR.

## Qué cambia en V2.4

### Duelo: puntos + pozo final

Con **Sistema de puntos** activado, el dinero deja de pertenecer a cada pregunta.

- Fácil: 1 punto (configurable)
- Medio: 2 puntos (configurable)
- Difícil: 3 puntos (configurable)
- Imposible: 5 puntos (configurable)
- Pozo por defecto: **$10.000.000** (configurable)

El ganador de la partida por puntos se lleva el pozo completo. Si la partida termina empatada, la pantalla final muestra el pozo como no adjudicado.

El modo legado con puntos desactivados sigue disponible por compatibilidad.

### Broadcast rediseñado para TV

`/broadcast.html` recibió una pasada visual completa:

- menos tarjetas/cajas de interfaz web;
- show bug y datos de ronda tratados como gráfica televisiva;
- pregunta y alternativas integradas como bandas gráficas;
- marcador inferior tipo lower-third;
- pozo del Duelo visible como elemento de programa;
- progresión de dificultad más discreta;
- reloj grande, centrado y sin apariencia de widget;
- resultados del Duelo y cambios de líder integrados en la composición;
- fondos y movimiento ambiental sutil.

La lógica del juego y el panel de producción se mantienen deliberadamente familiares.

### Pérdida de vidas menos invasiva

Se eliminó el modal/cuadro que tapaba gran parte de la emisión.

Ahora una vida perdida se comunica mediante:

- animación en los corazones del marcador;
- una banda breve integrada sobre el lower-third;
- tratamiento especial para **ÚLTIMA VIDA** y **SIN VIDAS**.

La pregunta permanece visible durante el evento.

### Motion para comodines

El **50/50** ahora genera un evento gráfico propio y las dos respuestas eliminadas desaparecen mediante una transición escalonada, en vez de volverse grises instantáneamente.

Pista y Cambiar pregunta también disparan una identificación breve de comodín en la emisión.

### Responsive serio

Se añadieron composiciones específicas para:

- 16:9 de estudio;
- notebook/desktop;
- tablet;
- tablet vertical;
- móvil horizontal;
- móvil vertical;
- ventanas pequeñas y pantalla dividida.

Broadcast nunca debería necesitar scroll. Los tamaños tipográficos se reducen de forma adaptativa cuando una pregunta o alternativa es especialmente larga.

El panel Host y la interfaz de concursantes también recibieron ajustes para evitar overflow, columnas demasiado estrechas y controles incómodos en móvil.

## Se conserva de V2.3

- Modo Clásico con vidas configurables.
- Dinero clásico como escalón alcanzado, no suma acumulativa.
- Continuar fuera de competencia opcional.
- Sistema de puntos del Duelo configurable.
- Regla de velocidad y diferencia de tiempo.
- Pool de 144 preguntas, 8 categorías y margen 6/6/4/2 por categoría.
- Selección aleatoria e historial antirrepetición.
- Elección de categoría en vivo.
- Temporizador configurable; urgencia desde 10 s y crítico desde 5 s.
- 50/50, Pista y Cambiar pregunta.
- Revelación progresiva.
- Resumen y cierre final.
- Comerciales.
- Correcciones de emergencia.
- PIN editable desde Configuración; default en instalaciones nuevas: `0000`.
- Exportar/importar JSON.

## Rutas

- `/host.html` — panel de producción
- `/broadcast.html` — salida al aire
- `/player.html?player=A`
- `/player.html?player=B`
- `/api/health`

## Uso local

Requiere Node.js 18+.

Windows: `INICIAR_APP.bat`

macOS/Linux: `./iniciar_mac_linux.sh`

Default local: `http://localhost:8765`

## Railway

La aplicación sigue escuchando `process.env.PORT`. Si tu servicio actual usa `PORT=8080` y Public Networking apunta a 8080, **no lo cambies**.

Para actualizar el servicio existente desde V2.3, usa `ACTUALIZAR_DESDE_V2_3.md`.

Si tienes un Volume montado en `/app/data`, mantenlo. La V2.4 acepta la configuración persistente de V2.3; si `duelPrizePot` todavía no existe, se añade automáticamente con valor $10.000.000.

## Pruebas

Ejecuta:

`npm test`

La suite comprueba, entre otras cosas, vidas, puntos, pool de preguntas, 50/50, cambio de pregunta, PIN, temporizador, Duelo por velocidad y que el ganador por puntos reciba el pozo completo.


## Correcciones V2.4.1

- Corrige el problema en que un dispositivo podía cargar HTML de V2.4 con CSS/JS de una versión anterior.
- Assets críticos ahora llevan versión explícita y se revalidan sin caché persistente del navegador.
- Service Worker nuevo (`foco-v241-shell-1`) elimina automáticamente caches anteriores y toma control al actualizar.
- El borde dorado de la respuesta elegida en modo Clásico ahora sigue toda la geometría hexagonal de la alternativa.
- No cambia reglas, preguntas ni mecánicas respecto de V2.4.
