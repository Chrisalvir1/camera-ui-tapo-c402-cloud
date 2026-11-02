# Sensores y controles de Tapo C402 Cloud

## Evidencia de la cámara real

El 1 de noviembre de 2026 se autenticó una sesión local de diagnóstico exhaustivo con `pytapo 3.4.30`, usando de forma privada la configuración real de la cámara. Se auditaron tanto las consultas de estado como la escritura real con confirmación bidireccional de lectura.

La C402 respondió y confirmó físicamente:

- **Batería**: `battery_percent: 100`, `battery_charging: "NO"`, `low_battery: false`.
- **Estado de batería**: `power_mode: "BATTERY"`, `battery_voltage: 4223`, `battery_temperature: 39`.
- **Información básica**: `battery_overheated: false`, ahorro de batería desactivado.
- **Luz blanca**: `status: 0`. Control de encendido/apagado funcional mediante `reverseWhitelampStatus`.
- **Detección de movimiento**: `enabled: "on"`, sensibilidad configurada.
- **Detección de personas**: `enabled: "on"`, sensibilidad 60.
- **Detección de mascotas (`pet_detection`)**: `enabled: "on"`, sensibilidad 60. Soporte completo de lectura (`getPetDetection`) y cambio verificado (`setPetDetection`).
- **Detección de vehículos (`vehicle_detection`)**: `enabled: "on"`, sensibilidad 60. Soporte completo de lectura (`getVehicleDetection`) y cambio verificado (`setVehicleDetection`).
- **Alerta de alarma / Sirena**: En firmware C402, `getAlarm()` consulta `chn1_msg_alarm_info` (`enabled: "on"`, `alarm_mode: ["light"]`). Corresponde al armado de la alerta por detección y no a una sirena de pánico manual instantánea (`startManualAlarm` devuelve `-40106`). Para evitar confusión en HomeKit, se retiró la sirena como control accesible.
- **Micrófono y Audio**: `getAudioConfig()` confirma `record_audio: "on"`, micrófono `G711alaw`, `sampling_rate: 8`, `noise_cancelling: on`, `aec: on`, altavoz `system_volume: 100`.
- **Otras detecciones**: Paquetes, sabotaje (*tamper*), llanto de bebé, rotura de cristal y ladridos devuelven error `-40101` (parámetro inexistente en este modelo de hardware).

## Matriz de publicación (Alpha 7)

| Función | Tipo SDK | Camera UI | HomeKit (`HOMEKIT 4K`) | Modo de Integración |
|---|---|---|---|---|
| **Batería, carga, batería baja** | `BatteryInfo` | `Batería C402` | Mapeado nativo en la tarjeta de la cámara (`BatteryService`) | Directo en el contenedor |
| **Luz blanca (reflector)** | `LightControl` | `Luz blanca` | Botón de foco en el visor de vídeo (`LightbulbService`) | Directo en el reproductor |
| **Sobrecalentamiento** | `ProblemSensor` | `Sobrecalentamiento de batería` | Visible en Camera UI | Diagnóstico |
| **Interruptores de detección / hardware** | `SwitchControl` | Detección (mascotas, vehículos, personas, movimiento), Micro, LED, Privacidad | Condicionados por `exposeSwitches: false` para no saturar HomeKit | Reservados para MQTT / Home Assistant |

## Auditoría de Audio y Talkback (Hablar por la cámara)

1. **Audio hacia el usuario (Downstream)**:
   - La cámara envía audio mono G.711 A-law a 8 kHz integrado en el contenedor MPEG-TS sobre el puerto 8800.
   - El plugin ya extrae y sirve este flujo directo; en Camera UI y HomeKit el audio se escucha con total normalidad.
2. **Hablar hacia la cámara (Talkback / Two-way Audio)**:
   - La C402 cuenta físicamente con altavoz integrado (`device_speaker`, G.711 A-law/u-law, salida de 8 kHz / 16 kHz).
   - Para reproducir audio desde un cliente (HomeKit / navegador), la cámara requiere una sesión HTTP multipart bidireccional cifrada con clave AES propietaria en `POST /stream` (puerto 8800).
   - Ni el estándar ONVIF de audio bidireccional ni el backchannel RTSP estándar son soportados por el firmware cerrado de la cámara en LAN directa.
   - Ni `go2rtc` ni `pytapo` soportan actualmente inyección de audio de retorno (talkback) en tiempo real para flujos `tapo://`.
   - Por esta razón, el control de audio downstream está activo, pero la inyección de voz desde HomeKit/Camera.UI requiere desarrollo de protocolo en el pipeline de transporte.
