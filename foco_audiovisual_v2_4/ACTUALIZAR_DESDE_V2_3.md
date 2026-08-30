# Actualizar FOCO V2.3 → V2.4 en Railway

No necesitas crear otro servicio, dominio, Volume ni Public Networking.

## 1. Mantén ambas carpetas por seguridad

Tu repositorio puede quedar temporalmente así:

```text
coad_millonario/
├── foco_audiovisual_v2_3/   ← respaldo
└── foco_audiovisual_v2_4/   ← nueva versión
```

## 2. Copia V2.4 al repositorio local

Descomprime el ZIP. Copia la carpeta completa `foco_audiovisual_v2_4` dentro de `coad_millonario`, al lado de V2.3.

## 3. GitHub Desktop

Abre `coad_millonario`.

GitHub Desktop detectará la nueva carpeta. En **Summary** puedes escribir:

`Add FOCO V2.4`

Luego:

1. `Commit to main`
2. `Push origin`

## 4. Comprueba GitHub

En github.com deben aparecer:

- `foco_audiovisual_v2_3`
- `foco_audiovisual_v2_4`

## 5. Cambia solo Root Directory en Railway

En el servicio `coad_millonario`:

**Settings → Source → Root Directory**

Cambia:

`/foco_audiovisual_v2_3`

por:

`/foco_audiovisual_v2_4`

Guarda y espera el deployment.

## 6. No cambies la infraestructura que ya funciona

Mantén:

- el mismo dominio;
- Public Networking;
- el mismo Volume;
- tus Variables;
- el mismo puerto.

Si actualmente tienes `PORT=8080` y el dominio apunta al 8080, déjalo exactamente así.

## 7. Confirma la versión

Cuando Railway esté Online, abre:

`/api/health`

Debe responder:

```json
{"ok":true,"version":"2.4.0"}
```

## 8. Prueba rápida antes del set

Comprueba:

1. Host abre con tu PIN actual.
2. Broadcast carga en un dispositivo horizontal y uno vertical.
3. En Duelo aparece el **pozo total**, no dinero por pregunta.
4. Una ronda de Duelo suma puntos.
5. Un 50/50 elimina dos alternativas con transición.
6. En Clásico, una respuesta incorrecta muestra la pérdida de vida sin tapar la pregunta.
7. Comercial sigue centrado.
8. Host, A, B y Broadcast siguen sincronizados.

## Rollback

Si V2.4 tiene cualquier problema durante una prueba, vuelve Root Directory temporalmente a:

`/foco_audiovisual_v2_3`

Tu dominio no cambia.
