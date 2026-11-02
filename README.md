# Tapo C402 Cloud

Plugin experimental para Camera UI. Conecta varias Tapo C402 por LAN, sin Home Assistant. El nombre Cloud no implica acceso desde Internet. La resolución oficial de la C402 es 1080p (1920 × 1080); el plugin conserva H.264 y audio sin transcodificarlos.

## Estado

`0.2.0-alpha.7` retira los selectores experimentales que fallaron en la cámara probada y conserva únicamente la conexión directa HD. Camera UI confirma H.264 Main 5.1, audio G.711 A-law y productor Tapo en la IP local. La ficha del producto C402 es 1080p (1920 × 1080), pero el bitstream vivo medido anuncia 2304 × 1296. Esas son dos mediciones distintas: el plugin conserva el video original y no finge que sus cuadros ya midan 1920 × 1080. Consulta `VERIFICACION-REAL.md`.

## Requisitos

- Camera UI >= 2.3.0 con API compatible con SDK 1.4.1 y motor go2rtc que admita `tapo://`.
- Runtime Node.js >= 24; Windows, macOS o Linux, arm64/x64 son plataformas objetivo, todavía sin matriz de validación completa.
- El servidor o worker debe alcanzar la IP/host de la cámara por TCP 8800. No usa una IP fija de tu instalación.
- Contraseña de la cuenta TP-Link ID con la que inicias sesión en Tapo. En el formulario se escribe solo la contraseña, no el correo; no es la Camera Account de RTSP/ONVIF.
- Para sensores y controles: Python 3.11+ con `pytapo==3.4.30` y `python-kasa==0.12.0` en el mismo equipo/worker. Si vídeo usa hash, los sensores requieren además la contraseña original. Ver preparación del entorno en `SENSORES.md`.

## Uso previsto

1. Para esta prueba local, instala `0.2.0-alpha.7` desde el catálogo de plugins de Camera UI; no se publica en npm público.
2. En ajustes de Tapo C402 Cloud, el campo **Contraseña Tapo (la que usas con tu correo)** pide solo la contraseña de TP-Link ID/Tapo. No escribas el correo ni la contraseña local de Camera Account. Deja vacío el campo opcional de contraseña de sensores por ahora. Guarda el perfil. El ID devuelto permite editarlo sin recrear identidad.
3. Busca la cámara en Descubiertas y adóptala. El plugin devuelve una fuente interna; Camera UI gestiona RTSP y reproducción.
4. Asigna el puente HomeKit existente a esa cámara. Para un accesorio nuevo, usa su QR/PIN en Apple Casa.

En ajustes, configura Python 3.11+ con `pytapo==3.4.30` y `python-kasa==0.12.0`; consulta «Ver estado de sensores». Batería y carga se consultan cada 15 segundos por defecto. Los controles se publican únicamente si hay respuesta válida del dispositivo; no se acciona nada al iniciar ni al consultar. El exportador HomeKit instalado debe verificarse por separado antes de asignar la cámara.

El plugin usa `subtype=0` (HD), única selección comprobada con la C402 de prueba. No tiene selector para declarar 1080p sobre una fuente que entrega cuadros de 2304 × 1296. Para tener cuadros completos de 1920 × 1080 sin un selector nativo del firmware hará falta redimensionar y recodificar el video; el reenvío sin recodificación conserva las dimensiones recibidas.

Para migrar una cámara existente no la elimines: primero verificar cómo conservar registro, asignación e identidad en la versión instalada. No reemplazar su RTSP de producción hasta validar el nuevo transporte.

«Comprobar acceso» solo confirma el servicio; no valida contraseña ni frames. `hotMode` mantiene la conexión cuando el host ha podido sondear la fuente. El plugin no ejecuta órdenes de reposo ni cierra el stream al retirar corriente; el firmware y la energía disponible siguen determinando la continuidad física.

## Desarrollo

```sh
npm ci
npm run typecheck
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npm run build
```

El resultado se genera en `bundle/`. No contiene credenciales ni dispositivos preconfigurados. Las credenciales configuradas se guardan en el almacenamiento del host; no se afirma cifrado en reposo. Excluirlas de backups compartidos y diagnósticos.

## Dependencias y límites

El SDK es provisto por Camera UI; CLI, TypeScript y tipos son dependencias de desarrollo fijadas en lockfile. El transporte go2rtc pertenece al host: este paquete no instala servicios globales ni usa el contenedor `tapo-solar`. Si el motor del host no admite Tapo, no basta el plugin y habrá que añadir un transporte gestionado compatible.

La edición vuelve a registrar el handler de fuente; el efecto sobre una sesión ya abierta debe validarse en el host. Desasignar la cámara detiene seguimiento, proceso de telemetría y sensores activos; el host es propietario de sus sesiones de medios. Talkback y eventos nativos no están validados. El paquete no crea un segundo servidor HomeKit ni administra tus emparejamientos.
