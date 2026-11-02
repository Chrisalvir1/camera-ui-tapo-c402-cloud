# Tapo C402 Cloud para Camera UI

Estado actual: alfa `0.2.0-alpha.1`, fases 1/2 implementadas en código; lectura física de batería/carga y capacidades comprobada, 23 pruebas de desarrollo aprobadas. Sin instalación en Camera UI, validación física de escrituras ni aceptación HomeKit. El usuario ya tiene exportador/emparejamiento: Tapo solo entrega fuentes, sensores y controles. Fecha: 1 de noviembre de 2026. Portabilidad a otros equipos de la misma red, no transporte cloud fuera de la LAN. Ver `FASES.md` y `SENSORES.md`.

## Objetivo

Añadir una o varias Tapo C402 directamente a Camera UI, con vídeo 1080p y audio, sin depender del host Home Assistant ni de su contenedor `tapo-solar`. Reutilizar la publicación HomeKit ya existente para evitar accesorios duplicados.

Actualización aprobada por el usuario: cámara alimentada por corriente, disponibilidad continua y sin política de reposo del plugin, incluso al pasar a batería. Mostrar batería y carga con datos reales actualizados en Camera UI/HomeKit. Ver `MEMORIA.md` para los acuerdos persistentes.

## Mecanismo que ya funciona

```text
C402 LAN:8800
  → protocolo Tapo, fuente principal subtype=0
  → go2rtc del contenedor tapo-solar
  → RTSP del host HA:62291/tapo-c402
  → Camera UI
```

El plugin sustituirá la gestión y ubicación del puente, no intentará hacer que la cámara implemente RTSP nativo. Las credenciales y el transporte deben conservar exactamente la semántica que funciona; no reutilizar automáticamente los valores del satélite Express, que es otro componente.

## Arquitectura prevista

```text
Configuración/adopción de cámaras en Camera UI
  → camera-ui-tapo: identidad, credenciales, sesiones y capacidades
  → motor Tapo de go2rtc en el mismo host o worker
  → fuente de vídeo y audio administrada por Camera UI
  → plugin HomeKit seleccionado
  → accesorios y servicios compatibles de Apple Home
```

Preferir el motor de medios de Camera UI si su versión admite el protocolo Tapo necesario. Si no lo admite, el plugin deberá gestionar un proceso auxiliar de go2rtc, con versión fijada y ciclo de vida completo. No lanzar Docker ni asumir que existe Home Assistant. El binario dev del puente actual puede contener diferencias: registrar versión y hash y comprobar equivalencia antes de sustituirlo por una versión publicada.

No prometer un puerto RTSP concreto. Una salida RTSP externa será opcional; para Camera UI se usará su contrato de fuentes. Si se necesita relay propio, publicar en loopback por defecto y permitir una configuración explícita para otros consumidores. En workers, loopback es el del worker, no el del servidor principal.

## Alta y gestión de varias cámaras

Flujo inicial propuesto: abrir Tapo en Camera UI → «Añadir cámara» → introducir nombre, modelo e IP/host → seleccionar/configurar credenciales Tapo → probar conexión → adoptar la cámara → asignar el puente HomeKit existente → emparejar con su PIN/QR en Apple Casa si es nueva. El formulario exacto depende del contrato instalado. La IP no sustituye la autenticación; el modo de credenciales se verificará con el puente funcional antes de implementarlo.

El plugin construye la fuente y gestiona el relay, si lo necesita. El usuario no escribe una RTSP de HA. HomeKit recibe un accesorio publicado por el puente, no adopta RTSP directamente. Para migrar la cámara existente, conservar su registro e identidad siempre que el host lo admita y comprobar el emparejamiento antes de eliminar la ruta anterior.

- Permitir alta manual por IP y credenciales del protocolo, sin depender de descubrimiento cloud para el primer soporte C402.
- Separar credenciales de cuenta y configuración de dispositivo. Un login cloud o listado automático de cuenta será una capacidad posterior que requiere su API real.
- Asignar identidad estable por dispositivo: preferir identificador de hardware; si no está disponible, generar y persistir UUID. No usar nombre ni IP como única identidad.
- Cada cámara tendrá su fuente, nombre editable, estado, última conexión, capacidades y sesiones propias. Renombrar o cambiar IP no debe recrearla.
- Una conexión de entrada compartida por cámara cuando existan varios espectadores; aislamiento de fallos entre cámaras y límites de sesiones.
- Tras borrar una cámara, cerrar sus recursos y eliminar sus secretos, sin afectar las restantes. Si se vuelve a añadir, gestionar explícitamente la identidad y sus asociaciones; no prometer conservar un emparejamiento HomeKit después de eliminar su accesorio.

## Funciones y criterio de publicación

| Función | Implementación / condición |
|---|---|
| Vídeo | C402 1920 × 1080; inspeccionar medios y conservar H.264 cuando sea compatible. Nunca anunciar 2K. |
| Escuchar audio | La salida existente anuncia PCMA/8000. Dejar al motor/puente negociar o convertir al formato requerido por el cliente HomeKit. |
| Hablar a la cámara | Requiere canal de retorno comprobado de extremo a extremo; escuchar audio no demuestra talkback. |
| Snapshot | Obtener de una sesión válida; usar caché con fecha y límites de refresco para evitar despertares continuos. |
| Movimiento/persona | Exponer eventos nativos solo si se obtiene una fuente real. La detección por análisis de vídeo de Camera UI es una alternativa distinta y necesita vídeo activo. |
| Batería/carga | Consultar una API comprobada; conservar «desconocido/no disponible» si no hay lectura. No inventar porcentaje. |
| Privacidad, luz o sirena | Publicar solo controles implementados y confirmados por el dispositivo. |
| Disponibilidad | Mantener conexión activa tanto con corriente como con batería; distinguir desconexión, cierre del firmware y fallo de autenticación. No aplicar reposo automático. |
| HomeKit | Publicar mediante el plugin HomeKit elegido; mapear solo sensores/controles que ese puente soporte. |
| HKSV | Validar triggers, ruta de grabación y disponibilidad de vídeo. El búfer previo requiere mantener vídeo y tiene coste de batería. |

En HomeKit no existe una equivalencia universal para cada entidad. El plugin Tapo crea las capacidades de Camera UI y el puente HomeKit decide qué servicios puede representar. No añadir otro servidor HAP dentro de Tapo ni publicar la cámara con dos puentes simultáneamente.

El repositorio local `HOMEKIT 4K PLUGIN CUI` contiene la versión 0.6.31 y SDK 1.4.1. Se utilizará como referencia del puente del usuario; su presencia local no confirma qué versión está instalada en ejecución. No requiere cambiar una cámara C402 a 4K: el nombre del plugin no determina la resolución de la fuente.

## Batería y sesiones

Estado por cámara: sin configurar → conectando → transmitiendo continuamente; reconectando, autenticación fallida y desconectada son estados diferenciados. Mantener una única sesión de entrada por cámara y distribuirla entre consumidores. El último espectador no cierra esa sesión. Configurar precarga/mantenimiento de conexión en el motor elegido, con reintentos limitados y espera creciente al fallar, y cancelación al apagar explícitamente o eliminar la cámara. No enviar comandos de reposo ni activar ahorro por pasar a batería. Medir estabilidad y latencia sin prometer que se pueden anular restricciones internas del firmware.

El estado de alimentación no controla el cierre del stream. Debe seguir disponible después de retirar corriente, mientras la batería y el firmware lo permitan, y recuperarse ante cierres forzados sin crear sesiones competidoras.

Batería: implementar el sensor nativo de Camera UI con `level`, `charging` y `low`, por cámara y con fecha de última lectura. Usar eventos si existen; en su defecto, sondeo configurable y actualización en cambios. Establecer la frecuencia después de medir límites y respuestas del dispositivo. No anunciar porcentaje o carga no obtenidos. Separar alimentación externa de carga activa y representar lecturas antiguas o fallidas como no disponibles según los mecanismos reales del host.

Se verificó que el puente HomeKit local ya crea un servicio Battery y mapea `BatteryLevel`, `ChargingState` y `StatusLowBattery`, con suscripción a cambios de propiedades. Falta implementar y comprobar la fuente Tapo de esas propiedades y confirmar el puente desplegado. La representación visual final depende de Apple Casa; no prometer una etiqueta separada de alimentación si el servicio no la representa.

La dependencia de Internet debe comprobarse por separado para vídeo, autenticación, eventos e inventario. Eliminar Home Assistant no implica eliminar la nube Tapo. No modificar la red doméstica para probarlo sin una prueba controlada acordada.

## Dependencias y distribución

- SDK y CLI compatibles con la versión instalada de Camera UI; fijar versiones y lockfile.
- go2rtc del host si cumple los requisitos; si es auxiliar, empaquetar/obtener binarios por plataforma y arquitectura con versión, hash, licencia y verificación de integridad.
- Reutilizar las herramientas de medios del host para snapshots y conversiones cuando sea posible. Documentar dependencias externas y fallar con un diagnóstico claro si faltan.
- Credenciales en el almacenamiento previsto por el host; evaluar sus garantías reales antes de afirmar que están cifradas. Sin secretos literales, en URLs de logs o en exportaciones de diagnóstico.
- Instalar/desinstalar y actualizar sin procesos huérfanos, puertos fijos en conflicto o cambios a otros plugins.

## Orden de ejecución y aceptación

1. Recuperar de forma privada el perfil efectivo del puente y registrar el binario exacto. Comparar con el proceso real; no basta el archivo montado.
2. Confirmar versión y contrato del Camera UI donde se instalará. Resolver si su motor ya admite Tapo o necesita proceso auxiliar.
3. Crear plugin mínimo con alta manual, una cámara, fuente 1080p y audio, usando la ruta ya funcional. Probar sin utilizar el RTSP de HA.
4. Añadir gestión de varias cámaras, edición, borrado, restauración tras reinicio y sesiones compartidas.
5. Integrar sensores y controles comprobados; verificar cada uno desde Camera UI hasta HomeKit. No declarar todos los sensores desde el principio.
6. Migrar la cámara existente conservando el registro de Camera UI cuando el host lo permita, y comprobar identidad/emparejamiento. Mantener la ruta anterior disponible hasta completar la comparación.

Pruebas necesarias: vídeo y audio desde Camera UI y Apple Home; talkback si se anuncia; dos consumidores compartiendo entrada; segunda cámara independiente; reinicio; pérdida de red; contraseña incorrecta sin bucle de intentos; mantener stream sin espectadores; quitar/restaurar corriente sin pasar a reposo por decisión del plugin; comprobar porcentaje/carga/batería baja y latencia de actualización en HomeKit, incluida batería llena con alimentación externa; borrado selectivo; snapshots y eventos sin datos falsos; ausencia de tráfico hacia el host HA durante el funcionamiento del nuevo plugin. Documentar latencia y batería; no prometer cifras antes de medirlas.

## Fuentes y evidencia

- Auditoría y origen del puente: `AUDITORIA.md` de esta carpeta.
- HomeKit de Camera UI: https://docs.cameraui.com/plugins/homekit
- Configuración de sensores: https://docs.cameraui.com/sensors/setup
- Protocolo Tapo de go2rtc: https://go2rtc.org/internal/tapo/
- Referencia local de SDK y plugin HomeKit del usuario, inspeccionada sin cambios.
