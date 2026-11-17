# Tapo C402 Cloud

Plugin de Camera.UI para recibir video y audio directo de cámaras Tapo compatibles y publicar controles de cámara. La luz, los interruptores y la telemetría se entregan a otras integraciones de Camera.UI; el puente HOMEKIT 4K puede exportar los interruptores a Home Assistant por MQTT.

## Alarma en Home Assistant

Activa **Exportar alarmas Tapo** en la configuración del plugin. Para la C402 se publican los controles que reporte el dispositivo. La C120 puede usar la misma función al asociar su ID de Camera.UI y su IP, siempre que su firmware entregue la configuración de alarma compatible.

- **Alarma por detección** arma o desarma la alerta automática.
- **Modo alarma luz** y **Modo alarma sonido** configuran las salidas que usa la cámara.
- **Alarma manual sin detección** inicia o detiene el aviso manual sin cambiar el estado de detección.

La alarma manual usa los modos que ya están configurados. Activa **Modo alarma sonido** si quieres oír la sirena. El firmware suele terminar el aviso después de unos 30 segundos y el switch vuelve a apagado; apagarlo antes envía la orden de detener. Este control no arma la detección.

Los controles de privacidad, movimiento, personas, mascotas, vehículos, LED y micrófono se publican por separado al activar **Exponer interruptores adicionales**.

## Configuración

Para leer controles Tapo se necesita la contraseña de la cuenta TP-Link ID guardada en Camera.UI, `pytapo==3.4.30` y Python compatible. El plugin no necesita publicar credenciales ni contraseñas en MQTT. Las lecturas por sí solas no accionan los controles.

## Desarrollo

El código activo se encuentra en `rebuild/`.

```sh
cd rebuild
npm install
npx tsc --noEmit -p tsconfig.json
npx cui bundle
```
