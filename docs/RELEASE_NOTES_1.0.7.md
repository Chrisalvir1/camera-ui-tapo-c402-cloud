# Tapo C402 Cloud v1.0.7

- Actualiza PyTapo de 3.4.31 a 3.4.32.
- Mantiene sin migración el esquema de configuración de v1.0.6: perfiles, IDs de cámara, nombres, host, puertos, modo de autenticación, credenciales, `controlSecret`, telemetría, ruta de Python, intervalo de sondeo y exposición de controles.
- No cambia la fuente de vídeo, `nativeId`, adopción de cámaras, servicios exportados ni configuración de HomeKit.
- Añade CI para pull requests y una prueba explícita de compatibilidad de actualización para verificar que cargar la configuración existente no la reescribe.

## Motivo de PyTapo 3.4.32

El cambio upstream endurece el manejo de rutas y las llamadas a FFmpeg dentro de las utilidades de descarga/conversión multimedia de PyTapo. Tapo C402 Cloud no usa esas rutas para su vídeo ni para la telemetría; sus APIs de batería, controles y alarma permanecen iguales.

## Verificación requerida antes de publicar

- TypeScript y pruebas Node.
- Pruebas Python con PyTapo 3.4.32.
- Prueba de compatibilidad de configuración v1.0.6 → v1.0.7.
- Bundle Camera.UI.
- Instalación limpia con los lockfiles versionados.

Actualizar el plugin no cambia Node del host ni elimina o vuelve a crear cámaras existentes.
