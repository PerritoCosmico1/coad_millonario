# FOCO Audiovisual V2.1

Sistema web para controlar un concurso televisivo desde celulares/tablets y entregar una salida limpia 16:9 al switcher/VTR.

## Cambios principales de V2.1

- Duelo mucho más legible al aire:
  - Concursante A = cian.
  - Concursante B = magenta.
  - Si eligen respuestas distintas, cada alternativa muestra el color correspondiente.
  - Si eligen la misma, la misma alternativa muestra ambos colores.
  - Al resolver la ronda aparece un rótulo claro del ganador.
  - Si ambos acertaron en modo “más rápido”, se muestran los tiempos de A y B y la diferencia entre ambos.
- Cuenta atrás configurable:
  - Accesos rápidos: 10, 15, 20, 30, 45 y 60 segundos.
  - Tiempo personalizado entre 3 y 300 segundos.
  - Opción Sin límite.
  - El reloj parte al abrir respuestas.
  - Si llega a cero, la ronda se bloquea automáticamente.
- “Preparar” ahora muestra una presentación de apertura antes de la primera pregunta.
- Premio fácil cambiado a $250.000.
- Premios:
  - Fácil: $250.000
  - Medio: $500.000
  - Difícil: $1.000.000
  - Imposible: $10.000.000
- Comodín Cambiar pregunta corregido:
  - La pregunta descartada queda consumida.
  - El reemplazo debe ser otra pregunta sin usar de la misma dificultad.
  - Una pregunta ya consumida puede volver a mostrarse manualmente, pero no vuelve a entregar premio.
- Se mantiene el puntaje automático y la corrección manual solo como emergencia.

## Pantallas

- Inicio: `/`
- Control: `/host.html`
- Emisión 16:9: `/broadcast.html`
- Concursante A: `/player.html?player=A`
- Concursante B: `/player.html?player=B`

PIN inicial de producción: `2468`.

## Probar localmente

Necesitas Node.js 18+.

### Windows

Ejecuta `INICIAR_APP.bat`.

### macOS / Linux

Ejecuta:

```bash
./iniciar_mac_linux.sh
```

Luego abre:

```text
http://localhost:8765
```

## La forma recomendada para usarla en la U

Para el rodaje, **no dependas del localhost ni de que los dispositivos puedan verse entre sí dentro de la red de la universidad**.

Despliega la app antes del programa en un hosting público de Node.js. El proyecto viene preparado para Railway mediante `railway.json`.

Una vez desplegado tendrás una URL parecida a:

```text
https://foco-produccion.up.railway.app
```

Entonces puedes mandar por WhatsApp:

```text
Host
https://foco-produccion.up.railway.app/host.html

Concursante A
https://foco-produccion.up.railway.app/player.html?player=A

Concursante B
https://foco-produccion.up.railway.app/player.html?player=B

Salida al aire
https://foco-produccion.up.railway.app/broadcast.html
```

Los dispositivos ya no necesitan estar en la misma Wi-Fi. Pueden usar la Wi-Fi de la U, datos móviles o un hotspot, siempre que tengan acceso normal a internet.

### Despliegue rápido en Railway

Consulta `DEPLOYAR_EN_RAILWAY.md`.

El resumen es:

1. Sube esta carpeta a un repositorio de GitHub.
2. En Railway crea un proyecto desde ese repositorio.
3. En Variables configura:
   - `HOST_PIN`: PIN privado del control.
   - `ACCESS_CODE`: opcional; protege también los links públicos.
4. En Networking selecciona **Generate Domain**.
5. Abre la URL pública.
6. Desde el panel del host usa “Copiar TV”, “Link A” y “Link B”.

### Persistencia

Las preguntas y configuración se guardan como JSON.

Para conservar cambios incluso si el servicio se reinicia, en Railway puedes añadir un Volume montado en:

```text
/app/data
```

La app detecta automáticamente el volumen de Railway.

Aun así, antes del rodaje usa **Exportar JSON** y guarda el pack del programa en más de un dispositivo.

## Emisión / switcher

La página `/broadcast.html` está pensada para 16:9.

Recomendaciones:

- teléfono o tablet en horizontal;
- corriente conectada;
- brillo fijo;
- modo No molestar;
- bloqueo automático desactivado;
- conexión USB-C/Lightning a HDMI compatible con el dispositivo;
- abrir la salida en pantalla completa o instalar la PWA.

## Flujo recomendado — Clásico

1. Preparar → muestra apertura.
2. Mostrar primera pregunta.
3. Revelar alternativas.
4. Abrir respuestas → comienza reloj.
5. Bloquear respuestas (o esperar a que el reloj llegue a cero).
6. Revelar respuesta del concursante.
7. Revelar correcta → premio automático.
8. Siguiente pregunta.

## Flujo recomendado — Duelo

1. Preparar → apertura.
2. Mostrar pregunta y alternativas.
3. Abrir respuestas → comienza reloj.
4. A y B responden.
5. Bloquear.
6. Revelar A.
7. Revelar B.
8. Revelar correcta.
9. La pantalla marca ganador y, si ambos acertaron, muestra la diferencia de tiempo.

## Comodines

Modo Clásico:

- 50/50
- Pista
- Cambiar pregunta

El cambio de pregunta consume la pregunta original para impedir que pueda entregar el premio dos veces.

## Variables de entorno

- `PORT`: normalmente la define el hosting.
- `HOST_PIN`: PIN del panel de producción.
- `ACCESS_CODE`: código opcional para las interfaces públicas.
- `DATA_DIR`: ruta alternativa para guardar `questions.json` y `config.json`.

Si Railway tiene un Volume conectado, la app utiliza automáticamente `RAILWAY_VOLUME_MOUNT_PATH`.

## Docker

```bash
docker build -t foco-v21 .
docker run -p 8765:8765 -e HOST_PIN=8391 foco-v21
```

## Pruebas

```bash
npm test
```

Las pruebas verifican:

- presentación inicial;
- premio fácil de $250.000;
- que el puntaje no se duplique;
- que Cambiar pregunta descarte correctamente la original;
- que una pregunta descartada no pueda volver a pagar;
- Duelo por velocidad y cálculo de diferencia;
- bloqueo automático al terminar el temporizador.
