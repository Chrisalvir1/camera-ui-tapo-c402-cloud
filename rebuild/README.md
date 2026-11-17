# Tapo C402 Cloud

Plugin de Camera.UI para recibir el stream directo de las cámaras Tapo compatibles y publicar controles opcionales de telemetría. Los interruptores `SwitchControl` se pueden exportar desde Camera.UI a Home Assistant mediante MQTT.

## Alarmas

Activa **Exportar alarmas Tapo** en la configuración del plugin para publicar los controles de alarma disponibles en la C402 y en una C120 asignada al plugin. En Home Assistant aparecen como interruptores:

- **Alarma por detección**: arma o desarma la alerta automática por detección.
- **Modo alarma luz** y **Modo alarma sonido**: eligen los modos de alerta que conserva la cámara.
- **Alarma manual sin detección**: al encenderla envía la orden de inicio manual aunque la detección esté desarmada; al apagarla envía la orden de detener.

La alarma manual utiliza los modos luz/sonido que ya estén configurados en la cámara. Para que suene, activa el modo de sonido. El dispositivo suele terminar el aviso manual después de unos 30 segundos; el estado del interruptor se apaga al vencer ese tiempo. Este control no arma ni cambia la detección.

La compatibilidad de alarma en una C120 depende de que su firmware entregue la misma información de configuración Tapo. Para asociarla, completa su ID de Camera.UI y su IP en los ajustes del plugin. La luz blanca de la C120 sigue disponible independientemente de que sus controles de alarma sean compatibles.

## Controles de Camera.UI

La luz blanca se publica como control de luz. La batería, el sobrecalentamiento, los modos de alarma y otros interruptores disponibles dependen del modelo, del firmware y de las opciones activadas en el plugin. La opción **Exponer interruptores adicionales** publica los controles de privacidad, detección, LED y micrófono.

La contraseña Tapo se guarda en la configuración local de Camera.UI; no la incluyas en registros ni en automatizaciones MQTT.
