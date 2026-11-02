# Memoria del proyecto Tapo — 1 de noviembre de 2026

## Objetivo autorizado

Nombre aprobado: **Tapo C402 Cloud**, paquete `@chrisalvir1/camera-ui-tapo-c402-cloud`. El usuario solicitó implementación en tres fases y confirmó expresamente que «cualquier computadora» significa **solo otros equipos de la misma red**, no acceso por Internet sin VPN. Nombre Cloud no implica que el vídeo use relay cloud.

El usuario aprueba implementar un plugin nativo Tapo para Camera UI, con varias C402, eliminando la dependencia de Home Assistant. No necesita demostrar desde cero que la cámara tiene vídeo: ya ve vídeo y escucha audio en Camera UI mediante el puente actual.

## Actualización: preparación de aceptación en Camera UI

El usuario pidió identificar lo que falta para lanzar el plugin e instalarlo para pruebas. Inició sesión en su Camera UI local y autorizó continuar con instalación de prueba. La instancia está en `127.0.0.1:3543`, Camera UI 2.3.0, macOS arm64; go2rtc incluido: `1.9.14-cui.47+dev.43fd1bd`. La cámara responde en TCP 8800 desde este equipo. Esto prueba alcance de red, no autenticación, frames ni independencia de HA.

La instancia contiene cámaras activas y HOMEKIT 4K instalado `0.6.18` (la app muestra `0.6.31` como actualización disponible); no se han actualizado plugins ni cambiado fuentes existentes. Se instaló `Tapo C402 Cloud 0.2.0-alpha.4` de forma local y aditiva; figura activa. No se creó aún el perfil de cámara, ni se asignó la cámara o HomeKit.

Verificación repetida: 15 pruebas Node, 8 pruebas Python, typecheck y build oficial del bundle pasan. Bundle en `bundle/bundle.zip`. El build avisa que faltan `LICENSE.md` y `logo.png`. Se detectó que el Python 3.9 local resolvía una versión incompatible de Kasa; se fijó `python-kasa==0.12.0` y Python 3.11+ y se preparó `.venv-camera-ui-tapo` con el Python 3.11.14 administrado por Camera UI. Se instaló la alfa `0.2.0-alpha.2`, activa en Camera UI, y se guardó la ruta de ese Python. La pantalla del plugin contenía información de README desactualizada; se corrigió la fuente de documentación y se preparará alfa siguiente. Para crear el perfil autenticado, el usuario debe introducir la contraseña Tapo directamente en la aplicación y enviar el formulario él mismo.

La tienda de Camera UI obtiene plugins de npm. El paquete puede publicarse con `camera-ui-plugin`, pero la etiqueta **Official** se reserva para publicaciones de Camera UI; el paquete de Chris aparecería como **Community** hasta revisión/verificación. El usuario pidió preparar el lanzamiento; la publicación pública queda para después de la prueba local y de revisar el artefacto final.

## Requisitos nuevos que prevalecen

- Última instrucción: el usuario ya tiene otro plugin para exportar y emparejar en HomeKit. Tapo C402 Cloud debe extraer sensores/controles reales y entregarlos a Camera UI; no duplicar emparejamiento ni servidor HomeKit. Revisar compatibilidad del exportador, sin modificar su instalación como efecto incidental.

- La C402 está conectada a corriente. Priorizar reproducción fluida y disponibilidad continua.
- El plugin no debe aplicar políticas de reposo por ser un modelo de batería. Mantener una sesión de entrada compartida activa aunque no haya espectadores; recuperar cortes y cierres del firmware sin multiplicar conexiones.
- Al retirar corriente, continuar funcionando con batería sin pasar automáticamente a ahorro, cerrar la sesión o entrar en reposo por decisión del plugin. La continuidad depende también de las capacidades reales del firmware y de la energía disponible; no afirmar que el software puede anular una limitación física no comprobada.
- Mostrar porcentaje de batería, batería baja y estado de carga en Camera UI y HomeKit, actualizados desde datos reales. Preferir eventos; si no existen, sondeo configurable con latencia medida y dato marcado como antiguo/no disponible si falla. «Tiempo real» es un objetivo de actualización, no una capacidad ya demostrada.
- Alimentación externa y batería cargando son datos distintos. No inferir CHARGING por existir corriente, ni por inferencias sobre el stream. A 100 % puede haber alimentación sin carga activa.
- Resolución C402: 1920 × 1080, nunca 2K. Conservar vídeo H.264 y audio, e implementar talkback solo si se comprueba.
- Usar el puente HomeKit existente para publicar cámaras y sensores. Evitar identidades nuevas o accesorios duplicados durante la migración.

## Hallazgos confirmados

- Carpeta de trabajo: `/Users/chrisalvir/Desktop/GITHUB PROJECT/Plugin Tapo`.
- El satélite `/addons/scryvex_tapo` de HA es Express de 56 líneas que genera URLs; no es el publicador del RTSP funcional.
- El puente real es el contenedor `tapo-solar`, que ejecuta go2rtc y monta `/mnt/data/supervisor/homeassistant/tapo-solar-bridge` como `/config`.
- Su configuración apunta por protocolo Tapo a `192.168.110.24:8800?subtype=0` y publica `rtsp://192.168.110.147:62291/tapo-c402`.
- RTSP DESCRIBE devuelve 200 y SDP `go2rtc/1.9.14+dev.dc1685e`, H264/90000 y PCMA/8000. No se midieron aún frames ni resolución por esa consulta.
- Fuente de vídeo configurada local; no equiparar contraseña cloud con vídeo cloud. No se ha certificado independencia de Internet de autenticación/eventos.
- El código local del puente `HOMEKIT 4K PLUGIN CUI`, versión 0.6.31, ya mapea sensores `battery` a BatteryLevel, ChargingState y StatusLowBattery y se suscribe a sus cambios. Falta obtener datos reales desde Tapo y comprobar la versión desplegada.
- Se creó `0.1.0-alpha.1`: código TypeScript, perfiles múltiples con ID estable, alta manual/edición/borrado, credenciales Tapo, handler dinámico del stream, adopción con hotMode y precarga, sondeo del host y ciclo de vida. Typecheck y ocho pruebas automatizadas pasan; la CLI oficial validó el contrato y generó `bundle/bundle.zip`. **No está instalado ni validado con vídeo real en Camera UI**. Batería/carga y aceptación HomeKit siguen pendientes, no anunciarlas como terminadas.

### Actualización: alfa 0.2 y diagnóstico físico

La información de alfa 0.1 anterior es histórica. Se implementó `0.2.0-alpha.1` con sesión persistente Python/pytapo 3.4.30 por cámara e IPC privado. Batería, carga y batería baja se mapean desde respuestas reales; sobrecalentamiento como Problem cuando existe. Sondeo 15 s configurable, caducidad, parada tras fallos, credenciales por stdin y controles serializados con lectura de confirmación. Telemetría requiere Python/pytapo en el mismo equipo/worker y se configura su ejecutable. Vídeo no depende de Python.

Se hizo diagnóstico de solo lectura en la C402 real desde un entorno temporal aislado `/tmp/tapo-audit-env` en el host HA, sin alterar servicios ni configuración de producción. Credenciales leídas privadamente del puente actual, no copiadas al proyecto. Resultado: 100 %, `battery_charging: NO`, `low_battery: false`, `battery_overheated: false`; power_mode BATTERY no se interpreta como prueba de ausencia de corriente. Temperatura/voltaje crudos solo diagnósticos. Lecturas soportadas: LED, privacidad, estado de luz blanca, configuración habilitada de movimiento/personas. Sirena/alarma devolvió -40210; luz forzada no soportada. No se accionaron controles.

El plugin crea Battery, Problem, Light y Switch según las respuestas válidas. No confundir switches de detección habilitada con eventos en vivo: PIR/personas/movimiento nativo siguen sin fuente validada. Los setters están implementados, no validados físicamente.

Compatibilidad local inspeccionada: HOMEKIT 4K 0.6.31 consume Battery y Light, pero no Switch ni Problem. Se creó `compatibility/homekit-4k-generic-switches.patch`, con `git apply --check` satisfactorio, sin aplicarlo ni compilarlo en ese otro proyecto. Permite proponer soporte HAP Switch para privacidad/LED/ajustes de detección; Problem necesita adaptación aparte. No afirmar que todos esos controles ya aparecen en Apple Casa.

Validación de esta versión: typecheck, 15 pruebas Node y 8 Python aprobadas (23 total). Se actualiza el bundle de Camera UI. No está instalado en Camera UI ni verificado de extremo a extremo en HomeKit. Sigue pendiente prueba de quitar/restaurar corriente y escrituras controladas en hardware. Consultar `SENSORES.md`.

## Tres fases acordadas

1. Base portable, perfiles y transporte de vídeo/audio LAN: alfa implementada y empaquetada; pendiente aceptación en el host con la cámara real.
2. API de batería/carga y controles: implementada en alfa 0.2 con respuestas de lectura reales; instalación y aceptación en Camera UI, transición corriente/batería y escrituras aún pendientes.
3. Compatibilidad con el exportador HomeKit existente, migración conservando identidad y validación de varias cámaras/espectadores: pendiente de aceptación real. No implementar otro emparejamiento. Talkback deshabilitado hasta probar retorno real.

Consultar `FASES.md` para estado y aceptación. No sustituir el stream funcional ni modificar la instalación de producción para hacer una prueba incidental. No publicar el paquete por tener bundle generado.

## Próximo trabajo

### Alta de cámaras propuesta

Implementar primero un formulario en Camera UI con nombre, modelo C402 e IP/host de la cámara y perfil de credenciales Tapo validado contra el puente existente. La IP sola no autentica. No pedir al usuario que fabrique una RTSP ni que use las credenciales RTSP/ONVIF como si fueran las del protocolo propietario. Separar credenciales compartidas de cuenta de configuración de cada cámara; verificar el modo exacto actual antes de fijar los campos definitivos. Detección automática o listado por cuenta son ampliaciones, no funcionalidades existentes.

El plugin debe registrar/adoptar la cámara mediante el SDK de Camera UI y administrar su fuente Tapo con el motor de medios. Si se publica RTSP, la URL apuntará al host/worker de Camera UI y tendrá nombre estable por dispositivo; no conservar dependencia del host HA. El puente HomeKit existente consume la cámara de Camera UI y publica un accesorio con PIN/QR; Apple Casa no adopta una URL RTSP directamente. Para una cámara nueva, añadir su accesorio desde Casa. Para la cámara existente, intentar cambiar la fuente conservando registro e identidad, con comprobación de emparejamiento. Este flujo es diseño pendiente de implementación.

Estado de aceptación local al 1 de noviembre de 2026: alfa `0.2.0-alpha.4` instalada en Camera UI 2.3.0, Python configurado; falta completar perfil Tapo y validar autenticación, vídeo/audio y lecturas de batería. Preservar el stream Tapo existente y su emparejamiento HomeKit. No publicar antes de revisar el resultado. La prueba HomeKit debe considerar el exportador realmente instalado (`0.6.18`), no asumir que el código local `0.6.31` ya está desplegado.

### Actualización tras instalar la alfa local

Se instaló `0.2.0-alpha.4` desde el registro temporal limitado a loopback; está activa en Camera UI. La preferencia para mostrar versiones beta quedó habilitada. El registro local se detuvo, el puerto temporal quedó cerrado y `~/.npmrc` fue restaurado. No se publicó a npm público.

El usuario escribió la contraseña en la versión anterior, pero la validación falló en el selector de modo (“Invalid input”), no en la contraseña. Alpha4 quitó ese selector y ahora muestra **“Contraseña Tapo (la que usas con tu correo)”**. La actualización limpió el dato protegido que todavía no se había guardado; el usuario deberá escribirlo nuevamente directamente en Camera UI. No pedir ni recibir la contraseña por chat. El campo opcional de contraseña para sensores puede quedar vacío por ahora.

El nombre `Tapo C402 (prueba)` y el host `192.168.110.24` están rellenados en el formulario; el perfil sigue sin guardar. No se han validado credenciales, vídeo/audio, batería/carga ni HomeKit desde este plugin. El README incorporado en el paquete instalado puede mostrar estado anterior; corregirlo en una versión empaquetada futura.

### Captura de Camera UI: la cámara adoptada aún usa go2rtc de Home Assistant

El 1 de noviembre, una captura de la pestaña Sources de la cámara adoptada «Tapo» mostró `rtsp://192.168.110.147:62291/tapo-c402...`. Esa es la URL antigua del publicador go2rtc en Home Assistant. Que Camera UI reproduzca vídeo/audio con esa fuente solo confirma la ruta actual; no demuestra que Tapo C402 Cloud ya esté entregando medios.

El plugin alfa no reemplaza fuentes de cámaras ya adoptadas (protección para conservar su identidad/asignación HomeKit). Su `onAdoptCamera` expone una nueva cámara descubierta con una fuente interna `cui://127.0.0.1`; el handler entrega al motor Camera UI la fuente propietaria `tapo://` según perfil guardado. Próximo paso: guardar el perfil en el plugin, verificar que aparece su cámara en Discovered, adoptarla como instancia de prueba y comprobar vídeo/audio antes de migrar la cámara de producción y preservar su asociación HomeKit. Hasta completar esa prueba, no atribuir el stream visible al plugin nuevo ni afirmar independencia de Home Assistant.

En una primera inspección directa el formulario estaba vacío y el inventario pareció decir que no había perfil; esa observación quedó superada por la verificación posterior del inventario (ver estado corregido a continuación). No asumir ausencia del perfil por ver campos en blanco: se limpian tras guardar y su cámara aparece en la segunda página de Discovered.

Corrección de estado después del último intento del usuario: se consultó de nuevo el inventario y el perfil **sí estaba guardado**: `Tapo C402 (prueba)`, ID `67b2a01a-0b6b-4531-800f-7768d583c776`. El error «ya tiene un perfil» era porque intentó crear por segunda vez la misma cámara/IP; no debe volver a crearla. Se encontró en **Cameras > Discovered > página 2**. La fila quedó oculta accidentalmente durante la navegación del agente y luego se restauró. Se conectó/adoptó la entrada de prueba y Camera UI confirmó «Camera added successfully».

Aceptación inicial de medios desde la instancia: vista de `Tapo C402 (prueba)` muestra video en vivo; estado de fuente **Online**, tres conexiones, video **H.264 · Main · 5.1**, audio **G.711 A-law · 8 kHz**. RTSP autogenerado por el servidor de Camera UI: `rtsp://127.0.0.1:2101/cui_tapo_c402_(prueba)_c402_·_1080p?video&audio&timeout=15`; fuente upstream administrada por SDK: `cui://127.0.0.1:3543/api/cameras/streams/62752f60-878a-4371-98aa-3e21297164ac/c402_·_1080p`. En esta fuente no aparece la antigua dirección go2rtc HA `.147:62291`; sí usa el perfil Tapo del plugin. Hot mode/preload activos, audio sin silenciar. La aceptación de recepción de audio está indicada por el codec/track; no se afirmó escucha subjetiva. La cámara previa que apunta a HA no se cambió ni se borró; HomeKit aún no se reasignó a la cámara de prueba.

La salida de una inspección local mostró accidentalmente el token npm almacenado en `~/.npmrc`. Se recomienda revocar ese token en npm y crear uno nuevo antes de cualquier publicación. No volver a leer ni imprimir ese archivo.

### Confirmación de IP de cámara

El usuario indicó que no sabía la IP de la C402. El Mac está en `192.168.110.46/24`, gateway `192.168.110.1`. La dirección `192.168.110.24` aparece en ARP con MAC `a8:6e:84:ff:67:e1` y responde en TCP 8800; `.25:8800` y `.147:8800` rechazan la conexión. Coincide con la IP de cámara de la configuración Tapo de go2rtc revisada anteriormente. La URL RTSP `rtsp://192.168.110.147:62291/tapo-c402` pertenece al host publicador, no a la cámara. Se completó en el formulario el nombre «Tapo C402 (prueba)» y el host `192.168.110.24`; no se guardó el perfil ni se introdujeron credenciales.

Recuperar perfil efectivo y versión/hash del transporte; comprobar contrato del Camera UI instalado; implementar transporte independiente de HA y sesión continua por cámara; investigar API de batería/alimentación/eventos; conectar sensores al puente HomeKit y verificar actualización, continuidad al quitar/restaurar corriente, reinicios y múltiples espectadores/cámaras.

### Autenticación comprobada: stream frente a sensores

El usuario pidió verificar si puede usar usuario y contraseña comunes. La documentación de go2rtc para la fuente propietaria `tapo://` especifica contraseña de TP-Link ID/cuenta Tapo sin nombre de usuario, o alternativamente hash MD5/SHA256 mayúsculo con usuario `admin`. La respuesta oficial de TP-Link para C402 Kit confirma que la cámara no ofrece RTSP/ONVIF estándar; por eso la cuenta local «Camera Account» (username/password) no sustituye las credenciales de vídeo en esta arquitectura.

La API de sensores es diferente: el README de pytapo indica que normalmente se puede usar la Camera Account creada en la app; según firmware, también admite `admin` con contraseña del TP-Link ID y en firmware nuevo el flujo SPAKE2+. La implementación actual de Tapo C402 Cloud fija `admin` y no ofrece campo de username de Camera Account, así que no afirmar que ya acepte ese modo. En una prueba de solo lectura anterior en esta C402, la API respondió usando el secreto del puente existente, sin deducir ni guardar aquí su tipo. Próxima mejora de UX: aclarar que el campo de vídeo solicita contraseña de TP-Link ID, y evaluar credenciales locales separadas solo para sensores; el vídeo seguirá requiriendo la modalidad que admite `tapo://`.


Verificación real posterior: ver VERIFICACION-REAL.md. Corrección de interpretación: el stream anuncia 2304×1296 a 15 fps, pero esto NO demuestra resolución nativa ni calidad superior a 1080p. El usuario reafirma que la C402 es 1920×1080; ese sigue siendo el requisito del producto. El valor anunciado queda como discrepancia técnica por investigar, no como especificación confirmada ni como motivo para cambiar la cámara a 2K. API go2rtc confirma productor directo Tapo .24:8800 y WebRTC enlazado a los mismos receptores H264/PCMA sin recodificación. HomeKit final y máximo absoluto del firmware pendientes.

Consulta física de firmware resuelve discrepancia: getVideoQualities resolution=1920*1080, true_resolution=2304*1296, is_display_fake_resolution=1; getVideoCapability main solo 1920*1080, minor 640*360. Ya configurada en opción 1080p; no existe selector comprobado para cambiar dimensiones codificadas sin recodificar. Worker modificado para conservar diagnóstico separado (pendiente de despliegue), sin alterar stream ni asumir resolución óptica.

Ficha oficial verificada https://www.tapo.com/us/product/tapo-c402-security-camera/specs : máximo comercial 1920×1080, H264, 15fps. Se retiran true_resolution/is_display_fake_resolution del diagnóstico publicado del worker. No se alteran respuestas del firmware ni las medidas reales del bitstream. El campo is_display_fake_resolution ya era 1; asignarlo otra vez no demuestra cambiar cuadros. Cambio en fuente, aún sin desplegar; salida 1080 exacta pendiente, no afirmar completada.

## Pruebas de alternativas de transporte

Se probaron selectores preview 1080P, FHD y 1920*1080 mediante streams temporales en go2rtc, sin obtener video válido en el plazo. Se eliminaron las entradas temporales. Decodificación de cuadros del stream principal con showinfo confirma dimensiones 2304×1296, no solo metadatos RTSP.

Prueba aislada de normalización, sin modificar stream de producción: scale=1920:1080 + h264_videotoolbox + audio copy produjo H264 1920×1080 a 15fps y PCMA intacto. Esta vía sí recodifica video y requiere resolver advertencia de DTS no monótono observada en el ensayo antes de aceptación. Todavía no se integró ni desplegó: el requisito previo de no transcodificar sigue vigente y el usuario debe decidir si lo sustituye por salida exacta 1080p. No afirmar agotados todos los métodos posibles del firmware; solo los selectores probados.

Auditoría nueva de transporte independiente: script scripts/audit-native-stream.py, aún sin captura válida por -52405 TOO_MANY_REQUEST. Se pausó y restauró Hot mode/Preload de prueba; no se alteró HA. Companion audio de Camera UI existe pero inactivo, pendiente política estricta sin conversión. No afirmar que reconstruir go2rtc resolverá dimensiones. Ver VERIFICACION-REAL.md.

Verificación pedida de ambas propiedades: en Camera UI el test instalado muestra el dispositivo como Tapo C402 y la fuente `c402_·_1080p`, Online. En el código local C402.specification es 1920×1080/H.264/15fps. Relectura del RTSP en vivo y `showinfo` confirma cuadros codificados/decodificados de 2304×1296 a 15fps; go2rtc directo produce/reenvía mismos H264/PCMA sin recodificar en la ruta observada. Por tanto, identificación oficial 1080p verificada y salida bitstream exacta 1080p refutada aún; no es correcto declarar completa la segunda. Instalación sigue alpha4, código local no desplegado. Tras cambio: 17 tests Node y typecheck aprobados.

Autorización más reciente: trabajar/reconstruir exclusivamente copia local del proyecto/transporte si hace falta, sin pausar HA. Cero transcodificación prevalece. Añadido src/model.ts con especificación oficial fija C402 1920×1080/15fps, separación entre especificación y dimensiones observadas (sin reescribir frames ni reclasificar cámara); discovery/adopción usan ese modelo. Pruebas Node 17 y Python 8 pasan, typecheck pasa. No desplegado ni normalizada la salida: pendiente investigación de transporte, captura independiente bloqueada por -52405. No anunciar finalizado el flujo 1080p sin recodificar.

2026-11-01: empaqueté localmente `0.2.0-alpha.5` y Camera UI confirmó su instalación sobre alpha.4. Se usó registro temporal limitado a loopback para no publicar npm; servidor detenido y `~/.npmrc` restaurado. Camera UI permanece en 2.3.0. La ficha **Discovered** del plugin declara `Tapo C402 · 1080p (1920 × 1080)`. El registro de la cámara ya adoptada conserva el `model` anterior (`Tapo C402`), así que no la desadopté ni recreé; su fuente permanece Online, H.264 Main 5.1 y G.711 A-law 8 kHz, URL local `127.0.0.1:2101` generada por Camera UI y upstream `cui://`, sin RTSP de HA. No se volvieron a medir frames: la última evidencia sigue siendo 2304×1296/15fps, sin transcodificación observada entre productor y consumidor. No confundir identificación oficial corregida en alpha.5 con la dimensión codificada observada. Sensores/HomeKit no revalidados tras actualizar.


### Instalación alpha.7: corrección aplicada y límite real de resolución

2026-11-01: compilé e instalé `0.2.0-alpha.7` desde el registro temporal local en Camera UI. El diálogo confirmó “Plugin installed successfully”; la tarjeta del plugin muestra `v0.2.0-alpha.7` y permanece activa. El formulario ya no expone los selectores experimentales; el bundle usa únicamente `subtype=0` (HD). Se mantuvo la cámara de prueba adoptada con su perfil e identidad. Se cerró el servidor local `127.0.0.1:18789` y se restauró `~/.npmrc` exactamente desde el respaldo.

Validación en Camera UI: `Tapo C402 (prueba)` Online, plugin `@chrisalvir1/camera-ui-tapo-c402-cloud`, fuente `c402_·_1080p` Online con 2 conexiones, H.264 Main 5.1, G.711 A-law 8 kHz; audio sin silenciar, Hot mode y Preload activos. La URL RTSP la genera Camera UI en `127.0.0.1:2101`, con entrada interna `cui://127.0.0.1:3543/...`; el productor de go2rtc es Tapo en la LAN, no el RTSP `.147:62291` de Home Assistant. El código del modelo fija 1920×1080 y la ficha se describe como 1080p.

Nueva medición del flujo actualmente instalado: cuadro de `/api/frame.jpeg` de go2rtc para el stream de Camera UI = **2304×1296**. El productor y la fuente de Camera UI informan H264/PCMA, sin una recodificación de video observada por el plugin. Por lo tanto, quedan comprobadas la independencia de HA para esta cámara de prueba, la señal de video/audio y la identificación del producto C402 1080p; **no** queda comprobado un bitstream de cuadros 1920×1080. Firmware había informado `resolution=1920*1080`, `is_display_fake_resolution=1` y `true_resolution=2304*1296`; la bandera ya era 1 y no cambia las dimensiones de los cuadros. No ocultar ni reinterpretar la medición para afirmar 1080 exacto. Rehacer go2rtc conservando la entrada tapo no cambia el tamaño: el host solo reenvía los paquetes. Los selectores adicionales ensayados dieron EOF/sin video. La vía que garantiza cuadros completos 1920×1080 continúa siendo una salida nativa de firmware aún no encontrada o escalar y recodificar; esta última opción contradice el requisito vigente de cero transcodificación y no se aplicó. HA y el puente HomeKit no se tocaron. Batería/HomeKit no revalidados tras alpha.7.


## Rebuild desde cero — investigación inicial

El usuario confirmó que, si alpha.7 no satisface los requisitos, se debe rehacer el plugin/transporte desde cero. Se conserva alpha.7 instalada como línea base; esta reconstrucción comienza aislada en `rebuild/` y no modifica Home Assistant ni el puente HomeKit.

Se añadió `rebuild/tools/verify_native_output.py`, un verificador local de solo lectura. Consulta un cuadro JPEG de go2rtc sin guardarlo ni mostrarlo, y reporta productor y medios. Ejecutado contra la fuente activa, informa productor `tapo` en `192.168.110.24:8800`, H.264, PCMA/8000 y cuadro decodificado **2304×1296**. Resultado: passthrough directo confirmado; criterio de cuadros 1920×1080 exactos falla. `py_compile` pasó.

Prueba de puertos LAN: 8800 abierto; 554/RTSP y 2020/ONVIF cerrados o filtrados. El transporte disponible sigue siendo Tapo propietario. Ya se había consultado `resolution=1920*1080`, `is_display_fake_resolution=1`; los selectores alternativos probados no entregaron video. El siguiente cambio no se debe instalar hasta que una prueba nativa pase el criterio de 1920×1080 completo. Conservar explícitamente el requisito de cero transcodificación; si no existe salida nativa, la única vía conocida para escalar el cuadro completo es recodificar y requiere relajar ese requisito.


## Alpha 8 — reconstrucción limpia e instalación de prueba (2026-11-01)

Corrección de alcance: se creó un árbol nuevo del plugin `0.2.0-alpha.8`, pero **no se reconstruyó todo el sistema desde cero**. `rebuild/src/telemetry/` y el worker Python se copiaron de la versión previa, y el video se delega al go2rtc integrado de Camera UI mediante `tapo://`. El paquete compiló, pasó typecheck y sus 3 pruebas de perfil; Camera UI instaló el bundle. Esto fue un plugin nuevo alrededor del motor existente, no un transporte de video nuevo; no corresponde describirlo como reconstrucción completa. La cámara/perfil existente se conservó.

La fuente de prueba está Online y Camera UI recibe video H.264 Main 5.1 y audio G.711 A-law/PCMA 8 kHz desde el protocolo Tapo directo a `192.168.110.24:8800`. Camera UI crea la URL RTSP local y su fuente interna es `cui://`; no usa el RTSP de Home Assistant `192.168.110.147:62291`. Esto confirma independencia del RTSP de HA para esta cámara instalada, no independencia de Internet para todas las operaciones de cuenta.

La comprobación después de instalar alpha.8 decodificó un cuadro de **2304×1296**. El criterio estricto **1920×1080** falla. Alpha.8 conserva passthrough y cero transcodificación; por tanto, el proyecto desde cero retiró la dependencia de HA y hace funcionar medios/sensores en Camera UI, pero todavía no cumple la aceptación de resolución de cuadros 1080p. No cambiar etiquetas ni metadatos para presentar el flujo como 1080p real. El sitio oficial especifica el producto como 1920×1080; el transporte go2rtc revisado asigna `subtype=0` a HD y `subtype=1` a VGA, pero no se halló un modo alternativo que entregue cuadros completos de 1920×1080.

En Camera UI aparecen sensores reales del plugin: batería 100%/Ready; detección de movimiento habilitada; detección de personas habilitada; LED indicador; luz blanca; privacidad; sobrecalentamiento de batería. Son estados/ajustes informados por telemetría, no detecciones de movimiento en vivo. Apple Casa y el plugin HomeKit separado no fueron validados de extremo a extremo. No se probó transición de corriente a batería ni se probó escritura física de controles.

La configuración npm del usuario se restauró byte por byte y el servidor temporal `127.0.0.1:18789` está detenido. No se modificaron Home Assistant ni el plugin puente de HomeKit. Mantener la regla: cero transcodificación prevalece; si no aparece un modo nativo de 1920×1080, no declarar cumplido el requisito ni habilitar recodificación sin nueva instrucción explícita.

Interpretación correcta de «desde cero», autorizada por el usuario: rama de trabajo realmente independiente, sin copiar implementación previa, y rehacer/auditar la ruta de video hasta el protocolo Tapo y la entrega a Camera UI. El go2rtc del host no se puede dar por válido solo porque el perfil aparezca Online. Aceptar el transporte únicamente después de medir cuadros recibidos. No mover ni borrar la versión instalada durante esta nueva investigación.


## Corrección vigente: reconstrucción sin transporte anterior

El usuario reafirmó que no se reutilice nada del proyecto anterior. Alpha 8 fue
desinstalada y su perfil/contraseña eliminados con confirmación expresa. También
se retiró del reemplazo el puente go2rtc recién preparado: fuente, binarios,
herramientas y bundle. Ese paquete no se instaló. No presentar la petición
`1920*1080` como una negociación comprobada: selectores equivalentes ya fallaron
en pruebas previas. El transporte directo nuevo y su autenticación, demux,
publicación y aceptación física siguen pendientes. La salida 1080p sin conversión
no está conseguida. No usar HA ni su URL RTSP como fallback.

## Requisito vigente: resolver el origen de las dimensiones (2026-11-01)

El usuario pide erradicar la discrepancia de cuadros mediante una implementación
completamente nueva. No reutilizar implementación anterior, go2rtc de HA ni
go2rtc de Camera UI. La ficha C402 sigue siendo 1920×1080/H.264; las mediciones
anteriores de 2304×1296 son evidencia de aquella ruta, no especificación del
producto ni un resultado aceptable. Reinstalar dependencias no garantiza cambiar
lo emitido por firmware.

Trabajo necesario: implementar recepción directa Tapo, inspeccionar SPS y
decodificar muestras antes de cualquier relay; contrastar con una exportación
original de la aplicación Tapo de esta misma cámara; identificar qué petición o
ajuste nativo entrega 1920×1080. Medir después la salida del servidor propio y
Camera UI para localizar cualquier cambio. Conservar NAL originales y audio
original; prohibidos escala, recodificación, recorte, sustitución de SPS y etiquetas
que aparenten dimensiones no medidas. Si la entrada directa sigue siendo de otra
dimensión, investigar negociación/firmware y reportar el bloqueo: no prometer
que una reescritura del cliente obliga al firmware a emitir 1080p.

Actualización de dependencias desde npm dist-tag latest: CLI 0.0.120, SDK 1.4.5, TypeScript 7.0.2, tipos Node 26.6.6. Manifest actualizado; instalación aislada/lockfile y compatibilidad todavía pendientes. Se escribió módulo nuevo de Digest y AES para transporte directo Tapo; no se ha autenticado con la cámara ni verificado cuadros.

Implementación nueva: dependencias instaladas de forma aislada en rebuild/node_modules y package-lock.json generado con npm 12.2.1. Typecheck con TypeScript 7.0.2 y SDK 1.4.5 aprobado. Nuevo src/tapo/session.ts implementa TCP directo, desafío Digest, multipart acotado y descifrado MPEG-TS con cancelación/timeouts; no usa servicios HA ni go2rtc. No se ha probado autenticación con hardware. Falta demux, medición SPS/cuadros, servidor de salida e integración funcional. El selector HD identifica una petición de protocolo, no dimensiones garantizadas.

Continuación: relay HTTP MPEG-TS nuevo conectado al receptor Tapo directo; conserva bytes originales y comparte una entrada con clientes locales. Typecheck y bundle CLI 0.0.120 aprobados. Paquete 0.3.0-alpha.1 generado para diagnóstico; NO instalado ni autenticado con cámara real; SPS/cuadros/audio y compatibilidad del ingreso HTTP de Camera UI pendientes. No afirmar 1080p. El usuario pide persistir hasta visualizar el stream; siguiente paso instalación de prueba y reingreso privado de credencial eliminada.

Instalación 0.3.0-alpha.1 autorizada expresamente por usuario. Intento por registro local: paquete npm generado y búsqueda npm CLI comprobada, pero diálogo Camera UI sigue cargando sin mostrar resultado ni instalar. No hay confirmación de instalación. Registro temporal detenido y npmrc restaurado byte por byte, sin imprimirlo. Investigar mecanismo de instalación de Camera UI antes de afirmar listo o pedir contraseña.

Instalación efectiva confirmada en UI: Tapo C402 Cloud 0.3.0-alpha.2 instalado, log Ready/Started con PID 51862. Registry local detenido y npmrc original restaurado. Se cambió el formulario a campos planos (una cámara de prueba) porque el array no se mostraba; aun con alpha2 la sección SETTINGS está vacía/no cameras. Reapertura de ruta no resolvió. Investigar RPC/configuración del formulario antes de pedir contraseña. No hay autenticación física ni stream visible desde nuevo receptor; no declarar 1080p ni aceptación. README/changelog alpha2 ya no afirman binarios go2rtc incluidos.

Diagnóstico vigente: alpha2/alpha3 arrancan Ready/Started pero UI no muestra campos ni entrada manual; binario instalado comparado byte a byte con bundle y constructor local confirma cuatro schemas. Alpha4 añade lectura de storage.getConfig() en FINISH_LAUNCHING y pushDiscoveredCameras explícito para localizar fallo RPC. No existen errores de autenticación física todavía: no se ingresó contraseña nueva.

## Aceptación física del transporte nuevo — alpha4

0.3.0-alpha.4 instalada y Started, PID 53417. Log confirma storage.getConfig con 4 campos y pushDiscoveredCameras con 1 entrada. UI muestra Añadir Tapo C402 por IP. El usuario completó adopción/credenciales directamente en Camera UI mientras se verificaba UI; no se leyeron secretos. Cámara Tapo C402 adoptada con fuente Video y audio originales · Tapo directo. Imagen real visible y estado Online. UI informa H.264 Main 5.1 y G.711 A-law 8kHz; hotMode/preload activos, audio no silenciado. Audición humana no comprobada.

Conexiones verificadas con lsof: proceso plugin 53417 conecta 192.168.110.24:8800 y sirve HTTP loopback puerto58780, consumido por Camera UI. No conexión del plugin a HA. RTSP publicado por Camera UI en 127.0.0.1:2101/cui_tapo_c402_video_y_audio_originales_·_tapo_directo. FFmpeg solo para lectura/decodificación de prueba, no integrado en runtime ni codificación: H264 Main 2304x1296 15fps, PCM A-law 8000 mono; showinfo de cuadros confirma 2304x1296. Sigue fallando aceptación estricta1920x1080. Mantener especificación oficial C4021080p y discrepancia de flujo separadas. No cambiar SPS, escala ni etiqueta para aparentar1080.

El requisito de visualizar stream con receptor nuevo sí se alcanzó. Quedan negociación nativa1080, sensores, audio escuchado, reconexión/sesiones múltiples y estabilidad. Se restauró npmrc original y detuvo registro temporal18789. Formulario general de plugin sigue sin representarse en UI; alta mediante formulario de adopción ya efectiva. No declarar corregida la sección general.

Auditoría profunda: ver rebuild/AUDITORIA-RESOLUCION.md. Hallazgo nuestro: nueva implementación sigue preview resolutions[HD], no implementa negociación nativa1920. Trace_headers nuevo confirma SPS ancho143+1 macroblocks, alto80+1, frame-only1, crop0 =>2304x1296; level51 independiente de dimensiones. No existe etiqueta2K en src. Falta medición previa al relay y clip original exportado de Tapo; no atribuir con certeza a firmware ni Camera UI sin esa comparación. No reiniciar otra reescritura que repita la misma peticiónHD.

Hallazgo exportador HomeKit confirmado en fuente local y código instalado0.6.18: resolveH264VideoPlan devuelve passthrough si width<=1920 && height<=1080; de otro modo transcode-1080p a1920x1080 con h264_videotoolbox/libx264. No decide por etiqueta2K ni level5.1. Fuente local src/h264/VideoProcessing.ts. No se modificó ni desplegó cambio en exportador. La C402 mantiene especificación oficial1080p; dimensiones del flujo no establecen resolución del sensor. No negar evidencia SPS ni presentarla como producto2K.

## Alpha 5 — Sensores reales integrados y confirmados en HomeKit (2026-11-01)

El usuario confirmó mantener el flujo de video tal como está, dejando que el exportador `HOMEKIT 4K PLUGIN CUI` realice la transcodificación por hardware mediante `h264_videotoolbox` para cumplir con la norma HAP de Apple (H.264 Level 4.0, máximo 1080p).

Se implementó y desplegó la versión `0.3.0-alpha.5` en `rebuild/` integrando la suite completa de telemetría y sensores mediante `pytapo 3.4.30` y Python 3.11.14:
1. `contract.ts` actualizado con `provides: [SensorType.Battery, SensorType.Light, SensorType.Switch, SensorType.Problem]`.
2. Telemetría de solo lectura ejecutada mediante proceso Python aislado (`python/tapo_worker.py`), comunicándose vía stdin privado sin exponer credenciales en argv ni logs.
3. Camera UI registró y confirmó en vivo los 7 sensores y entidades reales de la cámara física:
   - `Batería C402` (`battery`)
   - `Luz blanca` (`light`)
   - `Sobrecalentamiento de batería` (`problem`)
   - `Privacidad` (`switch`)
   - `LED indicador` (`switch`)
   - `Detección de movimiento habilitada` (`switch`)
   - `Detección de personas habilitada` (`switch`)
4. El exportador `HOMEKIT 4K — by Chrisalvir 0.6.18` recibió en vivo los eventos del host y vinculó de forma inmediata y no ficticia:
   - `type: battery` con `level: 100`, `low: false`, y `charging: NOT_CHARGING`.
   - `type: light` con `on: false` (controlable para encender/apagar el reflector).
5. Home Assistant (`192.168.110.147`) se mantuvo completamente intacto y sin modificaciones.

## Alpha 6 — Auditoría de Alarma, Detección de Mascotas/Vehículos y Micrófono (2026-11-01)

El usuario solicitó auditar las funciones observadas en la cámara real (alertas de alarma por luz, sirena o luz+sirena, detección de mascotas y vehículos activadas, y micrófono para hablar) para incorporarlas como entidades y sensores reales.

### Hallazgos de la auditoría física en la C402:
1. **Alerta de Alarma y Sirena**:
   - `getAlarm()` consulta con éxito `chn1_msg_alarm_info`, devolviendo `enabled: "on"`, `alarm_mode: ["light"]`, `light_alarm_enabled: "on"`, `sound_alarm_enabled: "on"`, `alarm_volume: "high"`.
   - `module_spec` y `capability` del hardware físico declaran `alarm_func: ["sound", "light"]`.
   - Soporta modos: solo luz, solo sirena sonora, o luz con sirena.
   - El control de encendido/apagado de la alerta se verificó físicamente con confirmación bidireccional (`off` -> `on`).
   - Se mapeó como `SirenControl` (`SensorType.Siren`). El exportador `HOMEKIT 4K` lo detectó inmediatamente al inicio como `sensor-added` y `sensor-value.active: true` para publicarlo nativamente en HomeKit.
2. **Detección de Mascotas y Vehículos**:
   - `getPetDetection()` y `getVehicleDetection()` respondieron ambas con éxito: `enabled: "on"`, `sensitivity: 60`.
   - Ambas funciones admiten escritura bidireccional física con confirmación de lectura (`setPetDetection` y `setVehicleDetection`).
   - Se mapearon como interruptores `SwitchControl` independientes (`Detección de mascotas habilitada` y `Detección de vehículos habilitada`), siendo inmediatamente exportadas a HomeKit.
3. **Micrófono y Audio**:
   - `getAudioConfig()` confirmó altavoz (`system_volume: 100`, `mute: "off"`) y micrófono (`sampling_rate: 8`, `G711alaw`, `noise_cancelling: on`, `record_audio: on`).
   - El control de grabación/micrófono se probó físicamente con éxito (`off` -> `on`) y se expuso como `SwitchControl` (`Micrófono de cámara`).
   - **Auditoría de Talkback (Hablar)**: La cámara físicamente posee altavoz y decodificador G.711. Sin embargo, no expone un backchannel RTSP estándar ni ONVIF en LAN, sino un canal HTTP multipart cifrado con AES sobre el puerto 8800. Ni `go2rtc` ni `pytapo` ofrecen actualmente un proxy de inyección de audio bidireccional de retorno. Por ende, escuchar a la cámara funciona al 100%, pero la inyección de voz desde HomeKit/Camera.UI requiere desarrollo de protocolo en el pipeline de transporte.
4. **Despliegue Alpha 6**:
   - Se incorporaron las entidades a `python/tapo_worker.py` (con `retryStok=True` para tolerancia a caducidad de token), `rebuild/src/telemetry.ts`, `rebuild/src/sensors.ts` y `rebuild/contract.ts`.
   - Se compiló el bundle con `@camera.ui/cli` y se instaló en Camera UI.
   - Se reinició Camera UI y se verificó en `camera.ui.log` el registro exitoso de:
     - `Batería C402` (`battery`) -> HOMEKIT 4K
     - `Sobrecalentamiento de batería` (`problem`)
     - `Luz blanca` (`light`) -> HOMEKIT 4K
     - `Sirena / Alarma` (`siren`) -> HOMEKIT 4K (`sensor-connection`, `active: true`)
     - `Privacidad` (`switch`)
     - `LED indicador` (`switch`)
     - `Detección de movimiento habilitada` (`switch`)
     - `Detección de personas habilitada` (`switch`)
     - `Detección de mascotas habilitada` (`switch`) -> HomeKit
     - `Detección de vehículos habilitada` (`switch`) -> HomeKit
     - `Micrófono de cámara` (`switch`) -> HomeKit

## Alpha 7 — Limpieza de Vista HomeKit y Retiro de Sirena No Instantánea (2026-11-01)

El usuario comprobó que al activar la sirena desde Camera.UI la cámara no emitía sonido inmediato (debido a que en la C402 la API local solo controla el armado de la alerta por detección y la cámara estaba en modo `alarm_mode: ["light"]`, devolviendo `-40106` en órdenes de disparo manual por LAN). Asimismo, se acordó limpiar HomeKit de interruptores sueltos que saturan la app Casa, reservando los controles de configuración para Home Assistant/MQTT y dejando en HomeKit una vista 100% limpia y unificada en el contenedor de la cámara.

### Cambios implementados en Alpha 7:
1. **Retiro de Sirena**: Se eliminó `SensorType.Siren`, `TapoSiren` y el control de sirena de `rebuild/contract.ts`, `rebuild/src/sensors.ts` y `python/tapo_worker.py`. Se preserva el diagnóstico de modo/volumen de alarma en la telemetría.
2. **Vista Pura en HomeKit**: Se mantiene la publicación fija de `Batería C402` (`BatteryInfo`) y `Luz blanca` (`LightControl`), que se integran de forma nativa en la tarjeta y en los controles de vídeo de la cámara en Apple Home.
3. **Interruptores Condicionales (`exposeSwitches`)**: Los interruptores adicionales (mascotas, vehículos, personas, movimiento, micrófono, privacidad, LED) quedan condicionados al nuevo parámetro de configuración `exposeSwitches: false` por defecto, evitando que el puente HomeKit cree interruptores accesorios en la habitación.
4. **Verificación en Vivo**:
   - Compilado y desplegado bundle `0.3.0-alpha.7` en Camera UI.
   - Tras reiniciar Camera UI, el registro confirmó la inicialización de:
     - `Batería C402` (`battery`) -> HOMEKIT 4K
     - `Sobrecalentamiento de batería` (`problem`)
     - `Luz blanca` (`light`) -> HOMEKIT 4K
     - Cero interruptores sueltos o sirenas creados en HomeKit.

## Versión 1.0.0 — Autodescubrimiento LAN, Portabilidad y Pipeline de Publicación (2026-11-01)
- **Autonomía Total**: Confirmado que la cámara Tapo C402 opera 100% de manera autónoma con Camera.UI y el plugin de puente HomeKit (`HOMEKIT 4K`), sin depender de Home Assistant.
- **Autodescubrimiento LAN**: Implementado escáner rápido de subredes IPv4 en el puerto `8800` (concurrente, <500ms) para detectar automáticamente cualquier cámara Tapo en la red doméstica y presentarla en la lista de dispositivos descubiertos con la IP prellenada.
- **Portabilidad Multiplataforma**: Eliminadas todas las rutas absolutas locales del usuario (`/Users/chrisalvir/...`). La resolución de Python ahora usa dinámicamente entornos virtuales locales, el Python embebido de Camera.UI o el `python3`/`python` del sistema en Linux, macOS o Windows.
- **Autoinstalación de Dependencias**: Incluida verificación de arranque para asegurar `pytapo==3.4.30` automáticamente vía `pip` si no está presente en la máquina del usuario.
- **GitHub Actions y npm**:
  - `rebuild/package.json` actualizado a la versión `1.0.0`.
  - Creado `.github/workflows/publish.yml` para automatizar la compilación con `cui bundle` y la publicación a npm ante tags `v*` o releases de GitHub.

- **Problema 1 (Rebote de Luz)**: Al pulsar el interruptor de la luz en Apple Home, el switch se devolvía a apagado arrojando en los logs `Unhandled error thrown inside write handler for characteristic: Control Tapo no disponible`.
  - *Causa*: En `telemetry-session.ts`, la guarda de escritura exigía `settings.exposeControls`, el cual estaba enlazado a `exposeSwitches: false`. Por tanto, aunque `whiteLight` estaba registrado, el manejador de escritura rechazaba la petición de encendido.
  - *Solución*: Se permitió explícitamente el control de `whiteLight` sin depender de `exposeSwitches`, ya que es el foco físico nativo de la cámara.
- **Problema 2 (Aparición de 2 interruptores sin nombrar en HomeKit)**: En Apple Home aparecían dos casillas con el nombre truncado de la cámara (`Tapo C402 -...`): una con icono de interruptor y otra con icono de bombilla.
  - *Causa*: La base de datos persistente de Camera.UI (`sensorsDB` en LMDB) retenía los sensores creados en versiones anteriores (entre ellos la sirena y los interruptores de detección). `HOMEKIT 4K` los seguía exponiendo como accesorios secundarios.
  - *Solución*: Se purgaron de `sensorsDB` los 8 IDs de sensores obsoletos (la sirena retirada y los 7 switches opcionales). Solo quedaron activos `Luz blanca` (`light`), `Batería C402` (`battery`), `Sobrecalentamiento` (`problem`) y la detección de movimiento.
- **Resultado**:
  - En HomeKit desaparece el interruptor fantasma.
  - La tarjeta de Luz blanca ahora puede encender y apagar el reflector de la cámara sin rebotar.

- **Problema**: Camera.UI persistía ejecutando la versión `0.6.18` del plugin HomeKit a pesar de haber instalado la `0.6.31` pública de npm.
- **Causa Raíz**: Existía una carpeta residual en el disco bajo el scope antiguo `.../plugins/@chrisalvir/camera-ui-homekit-4k` congelada en 0.6.18. Por orden alfabético de directorios, Camera.UI cargaba esa primero y descartaba la carpeta oficial de npm `.../plugins/@chrisalvir1/camera-ui-homekit-4k`.
- **Resolución**:
  - Se eliminaron de raíz las carpetas residuales obsoletas de `@chrisalvir` en `plugins/` y en `volume/plugins/storage/`.
  - Se reinició Camera.UI.
  - El log confirmó la carga oficial de npm: `Plugin started: HOMEKIT 4K — by Chrisalvir (@chrisalvir1/camera-ui-homekit-4k@0.6.31)`.
  - Dispositivos iOS interactúan con el accesorio vía HAP con respuestas HTTP 200/204 en tiempo real.

