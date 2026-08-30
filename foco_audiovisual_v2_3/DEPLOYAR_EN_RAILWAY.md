# Actualizar tu Railway de FOCO V2.2 a V2.3

Esta guía está pensada para el servicio de Railway que ya tienes funcionando. **No necesitas crear otro servicio ni otro dominio.**

## Resultado final en GitHub

Tu repositorio puede quedar así durante la transición:

```text
coad_millonario/
├── foco_audiovisual_v2_2/   ← respaldo
└── foco_audiovisual_v2_3/   ← versión nueva
```

## 1. Copia la carpeta V2.3 al repositorio local

Descomprime el ZIP de V2.3. Debes obtener una carpeta llamada:

`foco_audiovisual_v2_3`

Cópiala dentro de tu carpeta local `coad_millonario`, junto a `foco_audiovisual_v2_2`.

## 2. GitHub Desktop

Abre el repositorio `coad_millonario` en GitHub Desktop.

Debería detectar la carpeta V2.3 completa como archivos nuevos.

En **Summary** escribe por ejemplo:

`Add FOCO V2.3`

Pulsa:

`Commit to main`

Luego:

`Push origin`

## 3. Comprueba GitHub

En github.com deberías ver las dos carpetas:

- `foco_audiovisual_v2_2`
- `foco_audiovisual_v2_3`

No borres V2.2 todavía.

## 4. Cambia solo el Root Directory en Railway

En tu servicio de Railway:

**Settings → Source → Root Directory**

Cambia:

`/foco_audiovisual_v2_2`

por:

`/foco_audiovisual_v2_3`

Guarda. Railway debería generar automáticamente un nuevo deployment.

## 5. No cambies lo que ya funciona

Mantén:

- el mismo dominio público;
- el mismo Public Networking;
- el mismo Volume;
- el mismo `PORT`.

Si actualmente tienes:

`PORT=8080`

y el dominio apunta al puerto 8080, **no lo cambies**.

También puedes dejar temporalmente la variable `HOST_PIN` de Railway. V2.3 la usa como PIN inicial en una migración si todavía no existe un PIN guardado. Después puedes cambiar el PIN dentro de la propia app.

## 6. Espera a que el deployment esté Active / Online

Cuando termine, abre:

`/api/health`

Debe mostrar:

```json
{"ok":true,"version":"2.3.0"}
```

## 7. Prueba antes de borrar V2.2

Comprueba:

- `/host.html`
- `/broadcast.html`
- `/player.html?player=A`
- `/player.html?player=B`

Haz al menos:

1. una ronda Clásica correcta;
2. una ronda Clásica incorrecta y confirma la pérdida de una vida;
3. una ronda Duelo y confirma que aparecen puntos;
4. un comodín Cambiar;
5. una pausa comercial.

## 8. Rollback

Si algo sale mal, vuelve temporalmente a:

`/foco_audiovisual_v2_2`

en Root Directory, o usa un deployment anterior de Railway.

El dominio no cambia.
