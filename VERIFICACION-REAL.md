# Verificación real — 2026-11-01

Cámara Tapo C402 (prueba). Evidencia medida con 0.2.0-alpha.4 en Camera UI 2.3.0. La instalación de alpha.5 se documentará después de actualizar.

## Medios medidos

FFmpeg leyó durante 10.13 segundos el RTSP de Camera UI con copia de ambas pistas: 174 frames, sin error de recepción reportado. El encabezado H.264 informa 2304 × 1296, Main, 15 fps; audio PCM A-law mono 8000 Hz, 64 kbit/s. El promedio incluye el arranque/buffer, por lo que no usar 174/10.13 para afirmar otro FPS estable.

API de go2rtc local: productor formato tapo, conexión HTTP directa 192.168.110.24:8800. Receptor H264 id 359 y PCMA id 362; consumidor WebRTC usa esos mismos padres 359/362. Esto confirma reenvío de esas pistas sin recodificar en la reproducción Camera UI observada. El proceso FFmpeg del diagnóstico usó -c copy. No había proceso FFmpeg de transcodificación antes de la medición.

Corrección: las dimensiones anunciadas en el bitstream no prueban resolución óptica nativa, detalle efectivo ni una calidad superior a 1080p. El usuario identifica su C402 como 1920×1080 y ese es el requisito del producto. El valor 2304×1296 queda únicamente como discrepancia del transporte que requiere diagnóstico; no es una especificación confirmada de esta cámara ni su máximo real. No se ha establecido dónde se origina esa discrepancia ni si existe escalado previo. No afirmar que el reenvío sin recodificación de Camera UI demuestra ausencia de escalado en toda la cadena.

## Sensores visibles y exportación

Camera UI Online: batería Ready 100%; luz blanca apagada; privacidad apagada; LED encendido; habilitación de detección de movimiento/personas encendidas. Estos dos últimos son ajustes, no eventos de detección. Las escrituras físicas no se probaron en esta verificación.

Exportador instalado inspeccionado: HOMEKIT 4K 0.6.18. Código real mapea BatteryLevel, ChargingState y StatusLowBattery; también contempla Light. Switch/Problem no cuentan con soporte validado en esta versión. No se verificó en Apple Casa la aparición ni actualización de esta nueva cámara. No afirmar que la pista PCMA pueda pasar intacta a todos los clientes HomeKit: el exportador puede convertir audio, y la política de video debe comprobarse durante una sesión HomeKit real.

Pendiente para aceptación final: estado de carga/batería baja actual y cambios al retirar/restaurar corriente, controles con confirmación física, estabilidad prolongada y reconexión, batería sin reposo, exportación y actualización real en Apple Casa, sesión HomeKit con inspección de conversión. Movimiento/persona/PIR en vivo, sirena y talkback no demostrados. No está listo para declararse versión final de producción.

## Consulta directa del firmware: discrepancia confirmada

getVideoQualities devuelve resolution=1920*1080, true_resolution=2304*1296 e is_display_fake_resolution=1. getVideoCapability admite únicamente 1920*1080 para main y 640*360 para minor. H264, VBR, bitrate configurado 840; calidades admitidas 1/3/5, actual 5. Estos campos no prueban por sí solos resolución óptica del sensor. La cámara ya tiene seleccionada la opción 1080p. subtype=0 se traduce en HD en go2rtc; no hay en ese transporte un selector probado que fuerce frames 1920×1080. No se modificó firmware ni se recortó el bitstream ni se añadió escalado. Obtener frames exactamente 1920×1080 requiere una opción efectiva del firmware aún no encontrada o decodificar/escalar/recodificar. El worker ahora conserva ambos reportes del firmware como diagnóstico separado, una consulta por sesión. Cambio de código pendiente de despliegue; no afirmar que ya cambió el stream.

## Pruebas de alternativas de transporte

Se probaron selectores preview 1080P, FHD y 1920*1080 mediante streams temporales en go2rtc, sin obtener video válido en el plazo. Se eliminaron las entradas temporales. Decodificación de cuadros del stream principal con showinfo confirma dimensiones 2304×1296, no solo metadatos RTSP.

## Verificación más reciente de las dos propiedades

Camera UI sigue mostrando `Tapo C402 (prueba)`, fuente `c402_·_1080p`, online; la URL RTSP la genera Camera UI. Esto verifica su etiqueta/modelo como C402 1080p en la pantalla. En esa revisión la instalación activa era alpha4; alpha.5 empaqueta la identidad 1920×1080 en los metadatos visibles del modelo. La revisión tras instalarla se añadirá abajo.

Se volvió a leer un cuadro del RTSP vivo mediante FFmpeg con `-vf showinfo` y salida null, sin encoder: SPS y cuadro decodificado informan **2304×1296, 15 fps H.264 Main 5.1**. La pista sigue siendo PCMA mono 8 kHz. API de go2rtc: productor `tapo` en `192.168.110.24:8800`; productor y receptores consumidores de video comparten H.264, y audio PCMA. Eso confirma que el reenvío visto no recodifica el video. También confirma que el flujo actual NO cumple que el bitstream de Camera UI sea 1920×1080, aunque la C402 comercial sea 1080p y la fuente se etiquete así.

Validación local posterior al cambio de modelo: 17 pruebas Node y TypeScript typecheck pasan. Resultado verificable por separado: identidad comercial 1080p correcta; dimensiones del stream en vivo discrepantes; cero recodificación observada. La captura nativa directa alternativa sigue sin ser concluyente por el límite `-52405` de sesiones de la cámara. No se desplegó código nuevo.

Prueba aislada de normalización, sin modificar stream de producción: scale=1920:1080 + h264_videotoolbox + audio copy produjo H264 1920×1080 a 15fps y PCMA intacto. Esta vía sí recodifica video y requiere resolver advertencia de DTS no monótono observada en el ensayo antes de aceptación. Todavía no se integró ni desplegó: el requisito previo de no transcodificar sigue vigente y el usuario debe decidir si lo sustituye por salida exacta 1080p. No afirmar agotados todos los métodos posibles del firmware; solo los selectores probados.

## Auditoría de transporte independiente: pendiente

Se añadió scripts/audit-native-stream.py para capturar TS descifrado con pytapo antes de go2rtc, con secreto por stdin y medios temporales borrados. No añade codificación. La cámara rechazó preview con error -52405 (TOO_MANY_REQUEST). Incluso tras desactivar brevemente Hot mode/Preload en la cámara de prueba y observar Idle/0 conexiones, siguió rechazando. No hay captura nativa válida: no atribuir el fallo a resolución ni usarlo como prueba contra go2rtc. Hot mode y Preload se restauraron activados. Es necesario aislar las sesiones restantes de cámara antes de continuar. No se cambió Home Assistant.

Se detectó companion de audio FFmpeg registrado automáticamente por Camera UI, inactivo en la reproducción observada: audio pcma/opus/aac. El host crea esa alternativa en utils/camera.js/go2rtcStreamUrls. La garantía estricta de cero conversión para cualquier consumidor requiere una política del host que excluya esa alternativa y revisar el exportador HomeKit; no basta con no usar encoder en el plugin. No se ha parcheado el host.

## Instalación local alpha.5 en Camera UI — 2026-11-01

Se generó `0.2.0-alpha.5` desde esta copia del proyecto y se instaló encima de alpha.4 mediante el catálogo de Camera UI. El diálogo confirmó **Plugin installed successfully**; la ficha instalada muestra `v0.2.0-alpha.5`, el plugin está activado y el README/changelog cargados en la app son los nuevos. El paquete no se publicó en npm público. Se usó un registro temporal limitado a `127.0.0.1:18789`; al terminar se detuvo y se restauró `~/.npmrc` (la entrada temporal ya no está).

Después de la instalación, Camera UI conserva el perfil/prueba adoptado y su fuente está **Online**, con 2 conexiones, H.264 Main 5.1 y G.711 A-law 8 kHz. La URL RTSP sigue generada por Camera UI en `127.0.0.1:2101`; la fuente de entrada mostrada es `cui://127.0.0.1:3543/...`, no la URL `.147:62291` de Home Assistant. `Hot mode` y `Preload` están activos y `Mute audio` apagado. La medición anterior de cuadros se mantiene como **2304 × 1296 a 15 fps**; no se volvió a decodificar/medir dimensiones después de esta actualización. Alpha.5 no introduce transcodificación ni altera cuadros.

En **Cameras > Discovered**, el mismo plugin ahora devuelve `TP-Link · Tapo C402 · 1080p (1920 × 1080)`. La ficha de la cámara ya adoptada aún muestra `Tapo C402` porque Camera UI conserva la información capturada al adoptarla; no se desadoptó ni se re-adoptó, para preservar su identidad/configuración. La fuente sigue identificada `c402_·_1080p`. Camera UI continúa en versión 2.3.0. Esto comprueba que alpha.5 quedó instalada y anuncia el modelo oficial 1080p; no cambia el hallazgo independiente sobre las dimensiones observadas del bitstream. Sensores y su exportación HomeKit no se revalidaron en esta instalación.


## Instalación local alpha.7 y comprobación de cuadros — 2026-11-01

Se instaló `0.2.0-alpha.7` desde el catálogo local de Camera UI; la aplicación informó **Plugin installed successfully**. La ficha muestra `v0.2.0-alpha.7`, el plugin sigue activo y el perfil de prueba existente no se borró ni se volvió a adoptar. Se detuvo el registro temporal de loopback y se restauró `~/.npmrc` byte por byte; el puerto `127.0.0.1:18789` quedó cerrado.

En **Cameras > Tapo C402 (prueba) > Sources**, Camera UI muestra la fuente `c402_·_1080p` **Online**, 2 conexiones, H.264 Main 5.1 y G.711 A-law 8 kHz. `Mute audio` está apagado y `Hot mode`/`Preload` encendidos. El RTSP lo publica Camera UI en `127.0.0.1:2101`; la entrada configurada es `cui://127.0.0.1:3543/api/cameras/streams/...`, y no la URL del puente de Home Assistant `192.168.110.147:62291`. go2rtc identifica el productor de esta fuente como `tapo` y anuncia video H264 y audio PCMA/8000.

Para volver a medir el flujo vigente, se consultó el cuadro privado de go2rtc `/api/frame.jpeg` para esa fuente, sin guardar ni mostrar la imagen. El JPEG obtenido mide **2304 × 1296**. Esta medición corresponde al cuadro que sale actualmente del flujo; no cambia la especificación oficial comercial de la C402 (1920 × 1080). La transmisión H.264/PCMA se reenvía directamente por la ruta observada, sin recodificación de video en el plugin. La ficha/plugin identifica el modelo como 1080p, pero la dimensión exacta de cuadros `1920 × 1080` no está conseguida en el stream actual.

La consulta de firmware anterior ya daba `resolution=1920*1080` e `is_display_fake_resolution=1`; el campo `true_resolution` no se publica en el plugin. La bandera de visualización no altera por sí misma los cuadros H.264. El transporte go2rtc Tapo toma `subtype=0` como HD, que es el único selector probado con video en esta cámara. Reconstruir go2rtc sin cambiar el modo que entrega la cámara solo reenviaría los mismos cuadros. No se cambió Home Assistant ni el puente HomeKit. Batería/carga y exportación real a Apple Casa no se volvieron a validar en esta instalación.


## Rebuild desde cero — investigación inicial

El usuario confirmó que, si alpha.7 no satisface los requisitos, se debe rehacer el plugin/transporte desde cero. Se conserva alpha.7 instalada como línea base; esta reconstrucción comienza aislada en `rebuild/` y no modifica Home Assistant ni el puente HomeKit.

Se añadió `rebuild/tools/verify_native_output.py`, un verificador local de solo lectura. Consulta un cuadro JPEG de go2rtc sin guardarlo ni mostrarlo, y reporta productor y medios. Ejecutado contra la fuente activa, informa productor `tapo` en `192.168.110.24:8800`, H.264, PCMA/8000 y cuadro decodificado **2304×1296**. Resultado: passthrough directo confirmado; criterio de cuadros 1920×1080 exactos falla. `py_compile` pasó.

Prueba de puertos LAN: 8800 abierto; 554/RTSP y 2020/ONVIF cerrados o filtrados. El transporte disponible sigue siendo Tapo propietario. Ya se había consultado `resolution=1920*1080`, `is_display_fake_resolution=1`; los selectores alternativos probados no entregaron video. El siguiente cambio no se debe instalar hasta que una prueba nativa pase el criterio de 1920×1080 completo. Conservar explícitamente el requisito de cero transcodificación; si no existe salida nativa, la única vía conocida para escalar el cuadro completo es recodificar y requiere relajar ese requisito.


## Alpha 8 instalada — 2026-11-01

El paquete plugin `0.2.0-alpha.8` fue instalado en Camera UI 2.3.0. **No es un rebuild integral del transporte:** conserva módulos de telemetría de la fuente previa y entrega `tapo://` al go2rtc de Camera UI. El perfil/cámara de prueba se conservó. Estado observado: cámara Online; fuente `c402_·_1080p` Online con dos conexiones; H.264 Main 5.1; G.711 A-law/PCMA 8 kHz; audio activo; Hot mode y Preload activos; productor reportado `tapo` en `192.168.110.24:8800`. Camera UI publica el RTSP bajo su propio host/puerto. En esta prueba no se usa `rtsp://192.168.110.147:62291/tapo-c402` de Home Assistant.

Se ejecutó el verificador sobre el stream instalado: el cuadro JPEG de go2rtc decodifica a **2304×1296**, no a 1920×1080. La prueba termina `pass=false`. El plugin mantiene H.264 directo y cero transcodificación; no escala ni recorta el cuadro. Por tanto, alpha.8 sirve video/audio de forma independiente de la salida RTSP de HA, pero **no cumple** la dimensión estricta solicitada. La resolución oficial publicada de la C402 es 1920×1080 ([TP-Link](https://tapo.com/en/product/tapo-c402-security-camera/v1/specs)); la discrepancia entre ese dato de producto y el cuadro recibido sigue sin resolverse sin transcodificar. go2rtc documenta su selección Tapo `subtype=0` como HD y `subtype=1` como VGA ([código del cliente Tapo en go2rtc](https://github.com/AlexxIT/go2rtc/blob/master/pkg/tapo/client.go)); los selectores alternativos ensayados anteriormente no produjeron video válido.

En la página Sensors de Camera UI aparecieron: batería (`Batería C402`), detección de movimiento habilitada, detección de personas habilitada, LED indicador, luz blanca, privacidad y sobrecalentamiento de batería. El resumen mostraba batería Ready, 100%. Esto confirma exposición del plugin en Camera UI, no exportación verificada en Apple Casa, carga dinámica ni transición de alimentación. No se probaron setters sobre el hardware.

Build previo a la instalación: 3 pruebas Node aprobadas, typecheck aprobado y bundle CLI generado. El registro npm temporal está apagado, el puerto 18789 no escucha y `~/.npmrc` se restauró byte por byte. Home Assistant y el plugin HomeKit existente no se modificaron.
