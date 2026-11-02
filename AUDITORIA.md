# Auditoría: Scryvex Satélite Tapo → Camera UI

Fecha: 1 de noviembre de 2026. Alcance: inspección de fuentes locales y del add-on instalado, contraste con documentación primaria y comprobaciones de conectividad sin autenticación. No se ha modificado, reiniciado ni sustituido el add-on. No se ha probado todavía una sesión de vídeo autenticada.

## Aclaración y evidencia de la conexión que ya funciona

### Origen localizado después de la primera inspección

Se identificó el contenedor **`tapo-solar`**, basado en `alpine:3.20`, cuyo proceso es `go2rtc`. Monta en solo lectura `/mnt/data/supervisor/homeassistant/tapo-solar-bridge` como `/config`. Ese directorio contiene `go2rtc` y `config.json`.

La configuración observada habilita los módulos `api`, `rtsp` y `tapo`, declara API en 62190 y RTSP en 62291, y configura `tapo-c402` con una fuente que apunta a **`192.168.110.24:8800?subtype=0`** mediante el protocolo Tapo. Se ocultaron las credenciales de la URL antes de mostrarla. La API 62190 rechaza conexiones desde el Mac; que figure en el archivo no demuestra que esté disponible en ejecución.

Este hallazgo identifica el puente real; el satélite Express `/addons/scryvex_tapo` no es el componente que publica el RTSP suministrado. La fuente de vídeo configurada apunta a la IP LAN de la cámara, no a un relay cloud. Esto no certifica funcionamiento sin Internet ni excluye dependencias cloud de autenticación, inventario o eventos. Usar una contraseña de la cuenta cloud no convierte por sí solo el transporte de vídeo en cloud.

La prioridad de implementación cambia: trasladar ese transporte probado al equipo de Camera UI, soportar varias cámaras y conservar la integración HomeKit existente. El resto del documento recoge la investigación inicial; las dudas sobre dónde se origina el RTSP quedan resueltas por este hallazgo.

El usuario confirma que la C402 ya funciona con vídeo y audio en Camera UI mediante `rtsp://192.168.110.147:62291/tapo-c402`. El objetivo es trasladar esa cadena existente al plugin, eliminando Home Assistant, no establecer desde cero si la cámara puede funcionar.

Se consultó esa URL con RTSP DESCRIBE, sin iniciar reproducción ni cambiar configuración. Respondió `RTSP/1.0 200 OK`; su SDP identifica `go2rtc/1.9.14+dev.dc1685e`, vídeo `H264/90000` y audio `PCMA/8000`. Esto confirma que el servidor RTSP es go2rtc y que anuncia ambas pistas; esta consulta no mide resolución ni verifica frames.

La instancia HTTP accesible en `192.168.110.147:1984/api/streams` no enumera `tapo-c402`. No debe asumirse que sea la misma instancia que publica el puerto 62291. Falta identificar el proceso/contenedor y la fuente exacta de esa instancia antes de replicar su configuración.

La URL actual apunta al equipo Home Assistant, no directamente a la cámara. El plugin debe resolver la conexión desde el equipo donde corre Camera UI y entregar la fuente a su motor de medios. Puede usar una URL interna administrada por Camera UI o un relay local si es necesario; no se debe fijar anticipadamente un nuevo puerto ni conservar la dependencia de `192.168.110.147:62291`.

## Dictamen

El add-on existe en Home Assistant, en `/addons/scryvex_tapo`. Es un add-on local, identificado por `local_scryvex_tapo`; no necesita existir en GitHub para estar instalado. El enlace de información es solamente metadato y apunta a `https://github.com/Chrisalvir1/Scryvex`, que devuelve 404 con el acceso actual. Esto no permite concluir si se eliminó, renombró o quedó fuera del acceso disponible. La lista de repositorios ofrecida por el conector no incluye Scryvex ni un repositorio Tapo.

La carpeta de trabajo «Plugin Tapo» estaba vacía. Se encontró otro módulo en `../Scryvex Pro/plugins/tapo`, pero es distinto: un plugin Scrypted de audio bidireccional, no el satélite de Home Assistant.

El satélite es un servidor Express de 56 líneas. Genera una URL `tapo://…` para otro componente. No implementa autenticación Tapo, descifrado de vídeo, descubrimiento real, snapshots ni transporte de medios. Por tanto, copiarlo tal cual a Camera UI no demuestra compatibilidad con la C402.

La ruta más razonable es un plugin nativo de Camera UI que gestione configuración, adopción y ciclo de vida, reutilizando el transporte Tapo de go2rtc si una prueba real confirma que funciona con este hardware y firmware. La cámara tiene el puerto 8800 abierto y responde HTTP 401 en `/stream`: es un indicio favorable, pero no demuestra que se pueda recibir y decodificar vídeo.

## Estructura encontrada en Home Assistant

```text
/addons/scryvex_tapo/
├── config.yaml
├── Dockerfile
├── package.json
├── package-lock.json
├── run.sh
├── run.sh.bak-options-20260619-204106
├── run.sh.bak-tapo-auth-20260614-160435
└── app/src/index.js
```

| Archivo | Función y observaciones |
|---|---|
| `config.yaml` | Nombre, versión 0.1.0, arquitecturas aarch64/amd64, arranque automático y `host_network: true`; formulario con IP, usuario y contraseña. Incluye valores sensibles predeterminados que no se reproducen aquí. |
| `Dockerfile` | Base `node:18-alpine`; instala curl y jq; copia package.json, ejecuta `npm install`, copia app y arranca `/run.sh`. No utiliza el lockfile para una instalación reproducible. |
| `package.json` | Paquete `scryvex-tapo-satellite` 1.0.0; dependencia Express `^4.22.2`; arranque con `node src/index.js`. La versión npm difiere de la versión del add-on. |
| `run.sh` | Declara `/data/options.json`, pero el archivo observado no lo lee. Exporta IP, usuario vacío y contraseña literal, y ejecuta `npm start`. |
| `app/src/index.js` | Express en `PORT` o 8563; toma variables de entorno; genera URL Tapo; ofrece `/cameras` y `/health`. |
| Copias `.bak` | Evidencia de modificaciones locales anteriores; podrían contener secretos. No se han copiado ni auditado íntegramente. |

### Comportamiento real

1. `generateStreamUrl()` comprueba únicamente que existan IP y contraseña.
2. Sin usuario produce `tapo://<contraseña>@<ip>`; con usuario produce `tapo://<usuario>:<contraseña>@<ip>`.
3. `/cameras` devuelve una única cámara fija: `tapo_camera_main`, nombre «Camara Tapo», codec declarado `h264`, estado declarado `online` y capacidades declaradas `live` y `snapshot`.
4. `/health` responde `ok` sin consultar la cámara.
5. El consumidor debe interpretar `tapo://` y obtener los medios. Ese consumidor no forma parte del satélite.

## Hallazgos por impacto

| Prioridad | Hallazgo | Consecuencia / corrección propuesta |
|---|---|---|
| Alta | Contraseñas literales en archivos fuente y configuración | No llevarlas a GitHub ni al nuevo paquete. Sustituirlas por configuración protegida; revisar las copias antiguas. La rotación corresponde al propietario de la cuenta. |
| Alta | `run.sh` no utiliza las opciones del formulario | Lo mostrado en Home Assistant puede no coincidir con lo usado por el proceso. El plugin debe tener una única fuente de configuración. |
| Alta | `online` y `health` no verifican conectividad ni vídeo | Un proceso «En ejecución» no equivale a una cámara funcional. Separar salud del plugin, autenticación y recepción de frames. |
| Alta | `/cameras` entrega una URL con credenciales y no hay autenticación en las rutas observadas | Evitar una API auxiliar abierta; limitar secretos al flujo interno de Camera UI y eliminar URLs sensibles de logs. |
| Alta | La URL con usuario trata como equivalentes credenciales locales y del protocolo Tapo | go2rtc distingue contraseña cloud sin usuario y `admin` con hash mayúsculo MD5/SHA256. Un usuario arbitrario y contraseña local no son equivalentes. |
| Media | `snapshot` y `h264` se declaran sin inspeccionar medios | Ofrecer solo capacidades comprobadas; extraer codec y dimensiones del stream. |
| Media | `.trim()` se aplica a la contraseña | Puede alterar una contraseña válida con espacios iniciales/finales. Conservarla exactamente. |
| Media | Identidad única fija y una sola IP | No escala a varias cámaras. Usar identidad estable por dispositivo y configuración por cámara. |
| Media | `npm install` sin copiar lockfile | Fijar versiones e instalar de forma reproducible. |

Las fuentes bajo `/addons` se inspeccionaron desde la terminal de Home Assistant. No se ha comparado su hash con el contenido de la imagen en ejecución; una imagen construida antes de los últimos cambios podría diferir.

## C402: resolución y protocolos

La ficha oficial especifica **1080p, 1920 × 1080, hasta 15 fps, H.264**. El perfil del nuevo plugin debe llamarse «Tapo C402 · 1080p», sin reescalado a una resolución superior. Las dimensiones efectivas deben confirmarse con frames recibidos.

En `app/src/index.js` y `config.yaml` del satélite no se encontraron referencias a `2K`, `2560`, `1920`, `1080` o `C402`. No hay en esos dos archivos una etiqueta 2K que corregir. Queda por localizar cualquier etiqueta en consumidores, configuración persistida o interfaces de otros proyectos. No corresponde sustituir «2K» globalmente en módulos de otros modelos.

TP-Link afirma específicamente para la C402 que no ofrece RTSP/ONVIF. Esto no prueba la ausencia de un protocolo propietario utilizable, pero impide asumir que bastará con `rtsp://…/stream1` o el plugin ONVIF.

Comprobaciones desde este Mac contra la IP configurada, sin contraseñas:

| Puerto / solicitud | Resultado |
|---|---|
| TCP 443 | Abierto |
| TCP 554 (RTSP habitual) | Conexión rechazada |
| TCP 2020 (ONVIF habitual de Tapo) | Conexión rechazada |
| TCP 8800 | Abierto |
| POST HTTP `/stream` en 8800, sin autorización | HTTP 401 |

No se identificó hardware/firmware mediante protocolo ni se completó autenticación. Estos resultados describen la IP configurada, no certifican por sí solos su identidad o capacidad de vídeo.

## Qué reutilizar

Del satélite: la idea de separar metadatos/configuración del transporte y el uso de `tapo://` como candidato. Su implementación es pequeña y conviene reemplazarla.

Del módulo `Scryvex Pro/plugins/tapo`: hay referencias útiles de Digest, puerto 8800 y encapsulado de audio PCMA en MPEG-TS. Está acoplado al SDK Scrypted y a utilidades de otros directorios. Su README dice expresamente que no importa cámaras y requiere ONVIF para importarlas. No constituye soporte C402. Antes de reutilizar código hay que verificar licencias y procedencia de cada archivo.

De go2rtc: ya existe implementación de transporte Tapo con autenticación, descifrado y demultiplexado. La documentación no certifica aquí la C402: se propone comprobarlo, no darla por compatible.

Del proyecto local Vimtag para Camera UI: sirve como referencia del contrato real instalado: SDK 1.4.0, `BasePlugin`, `CameraController`, `DiscoveryProvider`, adopción y `camera.implement({ streamUrl })`. Es referencia técnica local, no prueba de la versión de Camera UI que se vaya a usar.

## Propuesta para Camera UI

```text
Interfaz de Camera UI
        ↓ configuración y adopción
camera-ui-tapo (TypeScript, SDK Camera UI)
        ↓ URL interna / gestión de sesión
Transporte Tapo de go2rtc compatible con el host
        ↓ protocolo propietario, TCP 8800
Tapo C402 → frames H.264 1920 × 1080
```

Home Assistant no sería necesario en esta arquitectura. Debe verificarse primero si la versión instalada de Camera UI acepta el esquema Tapo con su motor de medios. Si no lo acepta, estudiar un transporte integrado o proceso auxiliar gestionado por el plugin; no depender del add-on go2rtc que actualmente corre en Home Assistant.

Estructura propuesta, todavía no implementada:

```text
camera-ui-tapo/
├── package.json
├── cameraui.config.ts
├── contract.ts
├── src/index.ts             # ciclo de vida y adopción
├── src/settings.ts          # validación y configuración por cámara
├── src/tapo/credentials.ts  # modos de autenticación, sin secretos literales
├── src/tapo/transport.ts    # integración con motor de medios
├── src/tapo/probe.ts        # autenticación, codecs, dimensiones y frames
└── src/tapo/session.ts      # apertura bajo demanda, cierre y reintentos
```

Fases y criterios de aceptación:

1. **Prueba de transporte:** identificar hardware/firmware, usar credenciales correctas y comprobar vídeo real a través de Tapo/go2rtc. No repetir intentos de credenciales a ciegas. Éxito: frames decodificables y dimensiones medidas; un 401 o una lista de cámaras no bastan.
2. **Plugin mínimo:** alta manual por IP, perfil C402 1080p, prueba de conexión, adopción, reproducción bajo demanda y limpieza al detenerlo. Evitar precarga y conexiones permanentes inicialmente por tratarse de batería.
3. **Pruebas funcionales:** reinicio de Camera UI, reposo/despertar, interrupción Wi-Fi, apertura/cierre repetido y dos espectadores sin abrir sesiones innecesarias. Medir impacto en batería.
4. **Capacidades adicionales:** snapshots a partir de vídeo si funciona; audio, micrófono, eventos, batería y grabaciones solo tras comprobar sus rutas concretas. No anunciar movimiento nativo ni grabación continua anticipadamente.
5. **Si falla el transporte:** capturar y estudiar el intercambio de la aplicación Tapo con la cámara propia, determinar si usa acceso local, nube o relay y aislar el protocolo necesario. Un plugin por sí solo no elimina una dependencia cloud del firmware.

No se ha creado todavía un plugin instalable, ni copiado una supuesta implementación funcional, ni corregido configuración de producción: esta entrega es la auditoría previa solicitada.

## Fuentes primarias

- C402, especificaciones: https://tapo.com/en/product/tapo-c402-security-camera/v1/specs
- Respuesta oficial sobre C402 y RTSP/ONVIF: https://community.tp-link.com/en/smart-home/forum/topic/834330?moduleId=613
- Protocolo Tapo de go2rtc y formatos de credenciales: https://go2rtc.org/internal/tapo/
- Implementación go2rtc: https://github.com/AlexxIT/go2rtc/blob/master/pkg/tapo/client.go
- Plugins Camera UI: https://docs.cameraui.com/plugins/
- Fuentes locales inspeccionadas: `/addons/scryvex_tapo` (Home Assistant), `../Scryvex Pro/plugins/tapo`, `../VIMTAG PLUGIN/camera-ui-vimtag` y sus declaraciones del SDK.
