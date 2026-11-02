# Tapo C402 Cloud — tres fases

El usuario confirmó que el alcance es otros equipos de la misma red. «Cloud» es el nombre elegido; esta versión usa el protocolo Tapo por LAN y no anuncia acceso directo por Internet.

## Fase 1 — Plugin portable y vídeo/audio

Implementación inicial: paquete SDK Camera UI, alta/edición/borrado de perfiles, IDs persistentes, varios dispositivos, contraseña o hash Tapo, prueba de acceso sin credenciales y adopción. El host obtiene dinámicamente la fuente, crea RTSP y mantiene una entrada compartida con `hotMode` y precarga. Estado basado en sondeo de medios, reintentos con espera creciente y limpieza de temporizadores. Sin dependencias de direcciones, Docker o rutas de Home Assistant.

Verificación de desarrollo: typecheck, 17 pruebas Node, 8 pruebas Python y bundle mediante CLI oficial pasaban antes de alpha.5; la compilación alpha.5 también completó correctamente. La alpha.5 actualiza la identidad de descubrimiento de C402 a 1080p (1920 × 1080) según ficha oficial. Instalada y activa en Camera UI 2.3.0/macOS arm64, go2rtc 1.9.14-cui.47+dev.43fd1bd. El perfil `Tapo C402 (prueba)` sigue guardado/adoptado. Después de actualizar, Camera UI mostró la fuente Online, H.264 Main 5.1 y audio G.711 A-law 8 kHz en la fuente del plugin; RTSP generado por Camera UI en `127.0.0.1:2101`, upstream `cui://`, sin URL HA `.147:62291`. Hot mode y preload activos; audio sin silenciar. La última medición de cuadros (anterior a alpha.5) fue 2304 × 1296 a 15 fps y no se repitió tras instalar; no afirmar salida exacta 1920 × 1080. El plugin no recodifica ni cambia cuadros. El descubrimiento muestra el modelo nuevo; la ficha ya adoptada conserva la cadena anterior `Tapo C402` porque Camera UI guarda los metadatos de adopción. No se desadoptó ni recreó para preservar identidad/configuración. Falta validar continuidad prolongada, desconexión/corriente, telemetría en estados cambiantes y exportación HomeKit. La cámara ni asignación HomeKit anteriores se modificaron.

## Fase 2 — Telemetría y funcionamiento continuo

Implementada en alfa 0.2: sesión persistente de control con pytapo 3.4.30; batería, carga y batería baja con datos reales; sobrecalentamiento como Problem cuando existe; timestamp/frescura y sondeo configurable. Se confirmó el esquema mediante consulta de la C402 real. También se publican los controles soportados por lectura: privacidad, LED, configuración de detección y luz blanca. Python 3.11+, pytapo 3.4.30 y python-kasa 0.12.0 quedaron configurados en Camera UI. Falta validar lectura desde la instancia y sensores en el exportador. Setters implementados, aún no probados en hardware. Python/pytapo son dependencia runtime de telemetría, no del stream.

Validar desconectar/restaurar corriente, estabilidad del stream y recuperación de cierres del firmware. No enviar reposo ni inferir carga por estar alimentada. No publicar sensores con lecturas inventadas. La política continua ya está configurada en fase 1; su funcionamiento físico debe medirse.

## Fase 3 — HomeKit, migración y distribución

El usuario confirmó que exportación y emparejamiento son responsabilidad de su otro plugin. Tapo entrega fuentes y sensores de tipos SDK; no crea ni sustituye el puente HomeKit. Pendiente: verificar sensores y medios con ese exportador, conservación de identidad, HKSV/eventos y talkback cuando exista canal real. Se preparó un parche opcional para el soporte Switch del exportador local, sin aplicarlo. La instancia local tiene HOMEKIT 4K `0.6.18`; el código local inspeccionado es `0.6.31`, por lo que hay que validar el contrato desplegado. El micrófono de retorno permanece desactivado; escuchar audio sigue habilitado.

Probar plataforma/arquitectura y versiones soportadas, segunda cámara independiente, varios espectadores y reinicios. Revisar licencia, logo, diagnóstico, empaquetado y documentación. Para la tienda, publicar en npm; el trust badge inicial será Community y la verificación la decide Camera UI. La publicación pública requiere aceptar el resultado local.

## Criterio para terminar

Las tres fases solo se considerarán completas con evidencia de ejecución real en Camera UI/HomeKit. Una compilación o una pista anunciada por SDP no sustituye esa evidencia. El paquete actual es experimental y no promete sensores o funciones que siguen pendientes.


## Actualización de aceptación local — 2026-11-01, alpha.7

La instalación de alpha.7 terminó correctamente y la cámara de prueba permaneció adoptada y Online. Camera UI informa H.264 Main 5.1 y G.711 A-law 8 kHz, y muestra la fuente RTSP generada por Camera UI con upstream `cui://`; el productor Tapo está en la LAN. Esto valida la Fase 1 respecto a la independencia del RTSP de Home Assistant en la cámara de prueba.

El modelo está descrito como 1080p según la ficha oficial, pero una captura de cuadro del stream vivo mide 2304×1296. El passthrough directo no recodifica ni convierte dimensiones. Por ello la Fase 1 **no** satisface todavía el requisito de frames 1920×1080 exactos con cero transcodificación. La cámara ya reporta `resolution=1920*1080` e `is_display_fake_resolution=1`; esa bandera no corrige el tamaño codificado. No declarar completas las tres fases ni la resolución del stream hasta encontrar una salida nativa de firmware que dé cuadros 1920×1080. Rehacer el relay sin cambiar el stream de entrada no resolvería la discrepancia.


## Rebuild desde cero — investigación inicial

Se abrió la reconstrucción en `rebuild/` sin reemplazar alpha.7. El verificador local confirma Tapo/H.264/PCMA directos, pero el cuadro actual es 2304×1296 y no pasa el requisito estricto 1920×1080. TCP 8800 responde; 554 y 2020 no. No se instalará una nueva versión hasta que una implementación nativa supere ese criterio.


## Estado actualizado — Alpha 8 (2026-11-01)

Se creó e instaló `0.2.0-alpha.8`, pero **no fue una reconstrucción completa desde cero**: reutiliza módulos de telemetría anteriores y usa el go2rtc integrado con `tapo://`. Fase 1 confirma que Camera UI recibe H.264 Main 5.1 y PCMA/8 kHz sin el RTSP de HA; no prueba un motor independiente. El cuadro medido es **2304×1296**, así que tampoco satisface la salida exacta de 1920×1080 con cero transcodificación. La etiqueta 1080p del modelo no es prueba del tamaño del cuadro.

Fase 2: batería y los ajustes/controles soportados aparecen como sensores en Camera UI. Falta validar cambio red eléctrica↔batería, carga en tiempo real y escrituras físicas. Fase 3: sigue pendiente validar exportación y actualización de esos sensores en Apple Casa mediante el plugin HomeKit ya existente; no se creó otro puente.

**No lanzar como versión lista/oficial todavía.** La salida exacta 1080p, estabilidad prolongada, varias C402, operación en otras máquinas de la misma LAN y HomeKit siguen pendientes de aceptación real.

Alcance de la nueva reconstrucción autorizado: partir de fuente aislada y no portar módulos de la implementación previa; estudiar y reemplazar el transporte de video que ahora depende del go2rtc del host; conectar ese transporte a Camera UI y aceptar únicamente después de verificar cuadros decodificados. No presentar la alpha.8 instalada como esa reconstrucción.
