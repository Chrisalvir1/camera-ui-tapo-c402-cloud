# Tapo C402 Cloud v1.0.6

- Actualiza CLI Camera.UI a 0.1.9, SDK a 1.4.11 y TypeScript a 7.0.2 en los dos manifiestos.
- Actualiza pytapo a 3.4.31 y regenera el worker embebido; mantiene python-kasa 0.12.0.
- Alinea los manifiestos y la publicación con Node 26.13.1 LTS y npm 12.2.3.

## Verificación

20 pruebas Node y 9 Python correctas; tipos, instalación limpia de ambos lockfiles y bundle correctos.

Esta actualización requiere Node >=26.13.1 y <27 en el host Camera.UI. Actualizar el plugin no cambia la versión de Node del host.

Las pruebas locales no sustituyen la validación de dispositivos físicos, audio/iCloud ni una instalación de producción.
