# FOCO Audiovisual V2.3

Sistema web para controlar un concurso televisivo desde móviles/tablets y enviar una salida 16:9 limpia al switcher/VTR.

## Cambios principales de V2.3

### Modo Clásico: vidas + escalera de premio

- Sistema de vidas **activable/desactivable**.
- Default: **3 vidas**.
- Cantidad inicial configurable entre 1 y 10.
- Cada error consume una vida al revelar la respuesta correcta.
- La pérdida de vida tiene un tratamiento visual dedicado en emisión; la última vida y quedarse en 0 se distinguen claramente.
- Al llegar a 0 puedes elegir desde Configuración:
  - **terminar la partida**;
  - **continuar fuera de competencia**, útil para no acortar un programa de TV.
- El dinero ya no se suma pregunta por pregunta. Representa el **escalón más alto alcanzado**:
  - Fácil: $250.000
  - Medio: $500.000
  - Difícil: $1.000.000
  - Imposible: $10.000.000
- Un jugador fuera de competencia puede seguir respondiendo si producción eligió continuar, pero no puede ganar nuevos premios ni usar comodines.

### Modo Duelo: puntos

- Sistema de puntos **activable/desactivable**.
- Default:
  - Fácil: **1 punto**
  - Medio: **2 puntos**
  - Difícil: **3 puntos**
  - Imposible: **5 puntos**
- Cada valor puede editarse individualmente.
- Con puntos activos, el dinero sigue apareciendo como valor dramático de la pregunta, pero **el ganador se determina por puntos**.
- La UI muestra el marcador de ambos concursantes, el incremento de puntos de cada ronda y un aviso discreto cuando cambia el líder.
- Se conserva la regla de velocidad y el delta temporal cuando ambos aciertan.
- Si desactivas puntos, el modo Duelo vuelve al sistema de premios acumulados de versiones anteriores.

### Pool de preguntas

V2.3 incluye **144 preguntas** distribuidas de forma uniforme entre 8 categorías:

- Cámara
- Sonido
- Montaje
- Fotografía
- Guion
- Producción
- Cine
- Postproducción

Cada categoría incluye al menos:

- 6 fáciles
- 6 medias
- 4 difíciles
- 2 imposibles

El comodín **Cambiar pregunta** ahora busca primero otra pregunta no usada de la **misma categoría y dificultad**. Ya no depende de que cada pregunta tenga una alternativa emparejada.

La cantidad de rondas configurable se adapta al banco real disponible. La interfaz muestra el máximo disponible y un inventario por categoría/dificultad.

### PIN del anfitrión

- Instalaciones nuevas usan por defecto: **0000**.
- El panel de acceso lo indica explícitamente.
- El PIN puede cambiarse desde **Configuración → Seguridad del anfitrión**, sin entrar a Railway.
- En una actualización desde V2.2, si todavía tienes `HOST_PIN` en Railway y tu archivo persistente no contiene PIN, V2.3 lo toma como PIN inicial para no bloquearte. Una vez guardado desde la app, el PIN queda persistido en la configuración.
- El PIN no se incluye en las exportaciones JSON del programa.

## Se conserva de V2.2

- Host móvil separado de la salida al aire.
- `/broadcast.html` en 16:9.
- Concursantes A/B desde celulares.
- Sincronización en tiempo real.
- Pool aleatoria e historial antirrepetición.
- Elección de categoría en vivo opcional.
- Temporizador configurable, urgencia desde 10 s y estado crítico desde 5 s.
- Comodines protegidos por estado.
- Revelación progresiva de alternativas y respuestas.
- Marcas por color/inicial en Duelo.
- Pantalla comercial.
- Resumen final + cierre definitivo.
- Correcciones de emergencia.
- Exportar/importar pack JSON.

## Rutas

- `/host.html` — producción
- `/broadcast.html` — salida al aire
- `/player.html?player=A`
- `/player.html?player=B`
- `/api/health` — estado/version del servidor

## Probar localmente

Requiere Node.js 18+.

Windows:

`INICIAR_APP.bat`

macOS/Linux:

`./iniciar_mac_linux.sh`

Default local:

`http://localhost:8765`

PIN de una instalación nueva:

`0000`

## Railway

V2.3 sigue usando `process.env.PORT`, por lo que **no cambies tu puerto de Railway si el deployment actual funciona**. En la instalación que ya configuraste con `PORT=8080` y Public Networking apuntando al 8080, déjalo así.

Si tienes un Railway Volume montado en `/app/data`, consérvalo. La app migra configuración/preguntas anteriores y añade las nuevas preguntas del seed sin borrar tu banco existente.

Para pasar de una carpeta `foco_audiovisual_v2_2` a `foco_audiovisual_v2_3`, consulta `ACTUALIZAR_DESDE_V2_2.md`.

## Pruebas

`npm test`

La suite de V2.3 comprueba, entre otras cosas:

- PIN por defecto y cambio desde Configuración;
- pool de 144 preguntas y capacidad 6/6/4/2 por categoría;
- selección de categoría;
- Cambiar pregunta desde la pool;
- dinero como escalón, no suma acumulativa;
- pérdida de vidas, última vida y eliminación;
- continuar fuera de competencia;
- vidas activables/desactivables;
- puntos de Duelo y valores personalizados;
- que 1+2+3 puntos superen una Imposible de 5;
- Duelo por velocidad y delta;
- puntos activables/desactivables;
- protección de comodines;
- temporizador automático.
