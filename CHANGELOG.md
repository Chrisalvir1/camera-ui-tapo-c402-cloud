# Cambios

## 0.2.0-alpha.7

- Quita los selectores de vídeo experimentales que dejaron sin imagen a la C402 real.
- Fija la fuente en el único selector probado (`subtype=0`, HD); conserva las pistas originales H.264 y PCMA sin recodificarlas.
- Documenta por separado la ficha oficial 1080p y los 2304 × 1296 que anuncia el bitstream medido. Esta versión no disfraza esa diferencia ni recorta la imagen.

## 0.2.0-alpha.6

- Añade un selector nativo experimental para probar variantes de resolución aceptadas por el firmware, sin escalado ni transcodificación.
- Mantiene HD como valor seguro; VGA y variantes 1080p/FHD se envían literalmente al protocolo Tapo y se deben validar en la cámara.
- Al cambiar selector, reconecta las fuentes adoptadas con la selección nueva.

## 0.2.0-alpha.5

- Identifica en Camera UI el modelo como Tapo C402 1080p (1920 × 1080), según la ficha oficial.
- Mantiene H.264 y audio directos, sin transcodificación en el plugin.
- Conserva separadas la especificación comercial y las dimensiones observadas en el stream; no falsifica ni reescribe cuadros.

## 0.2.0-alpha.4

- Quita el selector de autenticación que Camera UI marcaba inválido y simplifica el alta al modo de contraseña Tapo.
- Aclara que se usa la contraseña del TP-Link ID con la que se inicia sesión con correo; no la Camera Account ni credenciales RTSP/ONVIF.

## 0.2.0-alpha.3

- Actualiza el estado de aceptación: plugin instalado en Camera UI; autenticación y pruebas de medios aún pendientes.
- Corrige la documentación visible del paquete para reflejar Python 3.11+, las dependencias fijadas y la instalación local.

## 0.2.0-alpha.2

- Dependencia Kasa compatible fijada y validación del entorno de telemetría Python 3.11+.

## 0.2.0-alpha.1

- Batería, carga, batería baja y sobrecalentamiento con API local; esquema contrastado con C402 real.
- Sesión Python/pytapo persistente por cámara, IPC privado, caducidad y parada de reintentos.
- Controles de privacidad, LED, habilitación de detección y luz blanca con confirmación posterior.
- Sin publicación de falsas detecciones ni sirena no soportada.
- Matriz de compatibilidad con exportador HomeKit existente y parche Switch separado, no aplicado.
- Pendiente de instalación y aceptación real en Camera UI/HomeKit; escrituras no accionadas en hardware.

## 0.1.0-alpha.1

- Base Tapo C402 Cloud para Camera UI y alta manual de varias cámaras por LAN.
- Fuente Tapo dinámica, credenciales conservadas exactamente y política continua.
- Comprobación de servicio, sondeo mediante el host y limpieza del ciclo de vida.
- Pruebas automatizadas y paquete experimental; sensores/HomeKit real pendientes.
