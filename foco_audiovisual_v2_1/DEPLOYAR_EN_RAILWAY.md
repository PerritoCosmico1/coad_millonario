# Desplegar FOCO V2.1 en Railway

Esta es la opción recomendada para poder mandar la app por WhatsApp y usarla desde teléfonos sin depender de la red local de la U.

## 1. Sube el proyecto a GitHub

Crea un repositorio y sube **el contenido de esta carpeta**.

El archivo `railway.json` ya incluye el healthcheck `/api/health`.

## 2. Crea el servicio

En Railway:

1. New Project.
2. Deploy from GitHub Repo.
3. Selecciona el repositorio de FOCO.
4. Espera a que termine el deploy.

Railway detecta el `package.json` y ejecuta `npm start`.

## 3. Variables

En la pestaña Variables añade, por ejemplo:

```text
HOST_PIN=8391
ACCESS_CODE=rodaje26
```

`ACCESS_CODE` es opcional.

Si lo usas, los links compartidos deben llevar `?code=rodaje26`. El panel de control lo conserva automáticamente cuando copias los links.

## 4. Genera una URL pública

En:

**Settings → Networking → Public Networking → Generate Domain**

Obtendrás una dirección `*.up.railway.app`.

Ejemplo:

```text
https://foco-produccion.up.railway.app
```

A partir de ahí ya puedes compartir la app como cualquier página web.

## 5. Persistencia recomendada

Añade un Railway Volume al servicio y usa como Mount Path:

```text
/app/data
```

FOCO detecta automáticamente la ruta del volumen.

Esto permite que las preguntas/configuración editadas desde el panel sobrevivan reinicios y despliegues.

## 6. Antes de transmitir

- Abre el host, A, B y broadcast.
- Comprueba que todos actualizan en tiempo real.
- Haz una ronda completa.
- Exporta el JSON final.
- No hagas deploys ni cambios de infraestructura durante el programa.
- Si la Wi-Fi de la U es inestable, usa datos móviles o un hotspot.
- El dispositivo que alimenta el switcher debe tener una conexión estable y estar conectado a corriente.

## Links

Con una URL base `https://foco-produccion.up.railway.app`:

```text
/host.html
/broadcast.html
/player.html?player=A
/player.html?player=B
```
