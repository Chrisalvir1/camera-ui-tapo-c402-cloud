# Tapo C402 Cloud v1.0.8

Esta versión sustituye a v1.0.7 como distribución recomendada.

## Corrección

v1.0.7 actualizó la dependencia fuente a PyTapo 3.4.32, pero el árbol que Camera.UI empaqueta (`rebuild/src`) todavía aprovisionaba PyTapo 3.4.31. v1.0.8 alinea todas las rutas activas con **PyTapo 3.4.32**.

## Actualización no destructiva

- No cambia el esquema de perfiles ni la clave de almacenamiento.
- No cambia `nativeId`, IDs de cámara, nombres, host, puertos, credenciales ni `controlSecret`.
- No vuelve a adoptar cámaras ni crea accesorios HomeKit nuevos.
- No cambia la fuente de vídeo ni los servicios/sensores exportados.
- Conserva las preferencias de telemetría, sondeo y exposición de controles.
- La dependencia Python se aprovisiona en un directorio privado nuevo: `pytapo-3.4.32-kasa-0.12.0`. La carpeta privada de 3.4.31 no se sobrescribe.

## Verificación

La publicación debe pasar typecheck, pruebas Node, pruebas Python, compatibilidad de configuración 1.0.6 → versión actual, contrato de dependencias del bundle activo y generación del bundle Camera.UI. El workflow además verifica que ninguna de las rutas activas siga declarando PyTapo 3.4.31.

Actualizar el plugin no cambia la versión de Node del host ni modifica configuraciones existentes.
