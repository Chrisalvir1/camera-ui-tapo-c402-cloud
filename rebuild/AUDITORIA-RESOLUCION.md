# Auditoría de discrepancia de resolución — 2026-11-01

## Resultado y alcance

El producto sigue identificado como Tapo C402, especificación oficial 1920×1080, H.264,15fps. El stream de la prueba actual contiene SPS que describe2304×1296. Esta medida no establece la resolución óptica del sensor ni autoriza llamar al producto2K. La discrepancia no está resuelta. No se cambió firmware ni configuración de cámara durante esta auditoría.

## Hallazgo en nuestro cliente nuevo

`src/tapo/session.ts` solicita preview con channels[0], audio default y resolutions[HD]. Reescribir TCP/Digest/AES no cambió esa negociación respecto al transporte anterior. No existe implementación de control de calidad que negocie explícitamente un modo nativo1920×1080, ni evidencia de equivalencia de HD con la selección1080p de la app. Este es el error de alcance de las reescrituras previas: se cambió el transporte, pero se esperaba que eso cambiara el encoder remoto.

`src/media-bridge.ts` publica cada Buffer recibido mediante client.write(packet). No importa ni lanza FFmpeg, no tiene encoder, scale, crop ni reescritura SPS. El resultado descifrado se reenvía como MPEG-TS por HTTP loopback. Camera UI continúa usando su motor genérico para consumir y publicar medios; el protocolo Tapo y su autenticación están implementados por el plugin. No confundir independencia del transporte Tapo con reemplazar el reproductor completo de Camera UI.

## Evidencia medida de nuevo

Inspección del RTSP actual mediante FFmpeg trace_headers, video copy a null: profile_idc77(Main), level_idc51(5.1), pic_width_in_mbs_minus1143, pic_height_in_map_units_minus180, frame_mbs_only_flag1, frame_cropping_flag0. Ancho=(143+1)*16=2304; alto=(80+1)*16=1296. No es una etiqueta del formulario ni una inferencia del level. Lectura anterior de cuadros decodificados confirmó las mismas dimensiones. Esta prueba no escala ni recodifica la fuente.

El level5.1 es un parámetro independiente del tamaño y no demuestra por sí solo2K. El SPS proporciona las dimensiones. No corregirlo sustituyendo números: eso no reescala los bloques codificados y puede producir decodificación incorrecta.

Búsqueda en src nuevo: no aparece etiqueta2K ni constantes2304/1296. El único1920 es especificación del producto en model.ts; no controla el encoder ni convierte cuadros.

## Qué aún no está demostrado

1. Falta medir SPS/NAL dentro del receptor inmediatamente después de AES y antes del relay: la medición física actual procede del RTSP de salida de Camera UI. El código respalda passthrough del plugin, pero la comparación binaria entre etapas todavía no se hizo.
2. Falta un archivo original exportado desde la app Tapo de esta misma cámara, con calidad1080p seleccionada. La etiqueta de la app no sustituye la inspección de ese archivo.
3. No se conoce aún si la app usa otro selector/stream, aplica una conversión o muestra el nombre comercial. Son hipótesis, no conclusiones.
4. Las lecturas históricas resolution1920*1080, true_resolution2304*1296 e is_display_fake_resolution1 no se volvieron a consultar en esta auditoría. No usar esas banderas como una instrucción documentada de conversión ni modificar parámetros internos a ciegas.

## Acción que discrimina la causa

Comparar una muestra original Tapo y una muestra directa previa al relay: dimensiones SPS, crop, codec, perfil/level, fps y NAL. Si Tapo entrega1920×1080, localizar la petición nativa diferente y reproducir esa negociación. Si ambos flujos contienen el mismo SPS2304×1296, investigar el comportamiento del firmware frente al nombre mostrado. Si el receptor tiene1920×1080 pero la salida cambia, corregir Camera UI. Conservar el stream visible actual durante las pruebas y evitar conexiones Tapo simultáneas. Otra reescritura completa con la misma peticiónHD repetiría la prueba sin resolver esa pregunta.

## Fuentes primarias

- TP-Link C402: https://www.tp-link.com/us/home-networking/cloud-camera/tapo-c402/
- TP-Link C402 V2: https://www.tp-link.com/us/document/107338/?app=t
- H.264: https://www.itu.int/rec/T-REC-H.264
- Código nuevo local en rebuild/src.

## Causa concreta de transcodificación HomeKit

Inspeccionados fuente local HOMEKIT4K0.6.31 e instalado0.6.18. Ambos contienen resolveH264VideoPlan: width<=1920 y height<=1080 =>passthrough; dimensiones superiores =>transcode-1080p. La rama selecciona1920×1080 y h264_videotoolbox/libx264, con filtro scale+pad. No usa etiqueta2K ni level5.1 para esa decisión. No se modificó el exportador. Desactivar la rama sin conseguir una entrada aceptada no garantiza reproducción compatible en HomeKit.
