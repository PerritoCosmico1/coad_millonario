# Actualizar FOCO V2.4 → V2.4.1

1. Sube la carpeta `foco_audiovisual_v2_4_1` al mismo repositorio de GitHub donde están tus versiones anteriores.
2. Haz Commit y Push desde GitHub Desktop.
3. En Railway abre el servicio → Settings → Source → Root Directory.
4. Cambia `/foco_audiovisual_v2_4` por `/foco_audiovisual_v2_4_1`.
5. No cambies el dominio, Public Networking, Volume, `PORT=8080`, `HOST_PIN` ni `ACCESS_CODE`.
6. Espera a que el nuevo deployment figure Active/Online.
7. Abre Broadcast normalmente. La V2.4.1 fuerza la actualización del Service Worker y elimina caches viejos automáticamente.

En el primer acceso después del deployment puede ocurrir una sola recarga automática: es intencional y sirve para que el dispositivo quede controlado por el Service Worker nuevo.
