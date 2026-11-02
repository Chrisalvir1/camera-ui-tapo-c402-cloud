# 1.0.0

- Autodescubrimiento automático por escaneo rápido de subred local en puerto 8800 (<500ms).
- Portabilidad completa para cualquier sistema operativo (Linux, macOS, Windows, Docker).
- Detección y auto-instalación de `pytapo==3.4.30` si no está presente en el entorno.
- Eliminación de rutas fijas de desarrollo y configuración limpia de esquemas.
- Integración de pipeline de publicación automatizada para npm mediante GitHub Actions.
- Control bidireccional estable de reflector de luz blanca, telemetría de batería y sobrecalentamiento.

# 0.3.0-alpha.8

- Permitida la orden de encendido/apagado de `whiteLight` (`Luz blanca`) independientemente de `exposeSwitches`, permitiendo que el reflector responda al control nativo en Apple Home.
- Purgados de la base de datos de Camera.UI los sensores huérfanos residuales (sirena no instantánea e interruptores secundarios) para limpiar la vista de accesorios en HomeKit.

# 0.3.0-alpha.7

- Limpieza de entidades en HomeKit: se retira `SirenControl` para evitar confusión ya que el hardware de la C402 no admite pánico manual instantáneo por LAN.
- Vista unificada en la app Casa: solo se registran nativamente la Batería (`BatteryInfo`) y el Reflector (`LightControl`) directamente en la tarjeta de la cámara.
- Nuevo parámetro `exposeSwitches` (desactivado por defecto) para que los interruptores de detección, LED y micrófono no abarroten HomeKit con accesorios sueltos, reservándolos para integración MQTT/Home Assistant.

# 0.3.0-alpha.6

- Auditoría completa y física de las alertas de alarma, sirena, luz, detección de mascotas, vehículos y audio.
- Registro de `Sirena / Alarma` (`SirenControl`), consumido de inmediato y publicado nativamente en HomeKit por `HOMEKIT 4K`.
- Registro de interruptores para `Detección de mascotas habilitada`, `Detección de vehículos habilitada` y `Micrófono de cámara` (`SwitchControl`).
- Lectura y escritura bidireccional física confirmada en la cámara real para todas las entidades.
- Diagnóstico de estado de alarma (`alarm_mode`, `alarm_volume`) y audio en telemetría.
- Gestión de renovación automática de sesión (`retryStok=True`) en pytapo para evitar desconexiones por caducidad de stok.

# 0.3.0-alpha.5

- Integración de telemetría y sensores reales (batería, sobrecalentamiento, reflector de luz blanca, privacidad, LED, detección de movimiento y personas).
- Declaración en contrato de `SensorType.Battery`, `SensorType.Light`, `SensorType.Switch`, `SensorType.Problem`.
- Vinculación exitosa en vivo con Camera.UI y `HOMEKIT 4K PLUGIN CUI`.

# 0.3.0-alpha.4

Publicación explícita de la entrada de alta manual al iniciar. Diagnóstico de cantidad de campos y entradas sin exponer credenciales.
