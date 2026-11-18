# Actualización de dependencias — camera-ui-tapo-c402-cloud

Estado: cambios incorporados a la candidata v1.0.6, con publicación por GitHub Actions al crear el tag. Base: 0f35e7148e3d9b78f8610ba37becd5c053d6b529

## Cambios

Manifiestos raíz y rebuild alineados en versión existente1.0.5, CLI0.1.9, SDK1.4.11, TypeScript 7.0.2 y tipos Node 26.6.6. Node 26.13.1; pytapo3.4.31 con python-kasa0.12.0. Se actualizaron requisitos y comprobaciones del worker y se regeneraron sus dos fuentes embebidas. Script de pruebas emite JS para resolver imports .js de fuentes TS.

## Validación

Tipos de raíz/rebuild y bundle correctos;20 pruebas Node y9 Python correctas, Python3.14.10. npm ci de raíz y rebuild correcto. Sin conexión/escritura en cámaras físicas.

## Manifiestos modificados

| Archivo | Grupo | Dependencia | Antes | Ahora |
|---|---|---|---|---|
| `package.json` | devDependencies | @camera.ui/cli | `0.0.116` | `0.1.9` |
| `package.json` | devDependencies | @camera.ui/sdk | `1.4.1` | `1.4.11` |
| `package.json` | devDependencies | @types/node | `24.10.0` | `26.6.6` |
| `package.json` | devDependencies | typescript | `5.9.3` | `7.0.2` |
| `package.json` | engines | node | `>=24.0.0` | `>=26.13.1 <27` |
| `rebuild/package.json` | devDependencies | @camera.ui/cli | `0.0.120` | `0.1.9` |
| `rebuild/package.json` | devDependencies | @camera.ui/sdk | `1.4.5` | `1.4.11` |
| `rebuild/package.json` | engines | node | `>=24.0.0` | `>=26.13.1 <27` |

## Alcance

No se modificaron Chrisalvir Pro, Omni Broadlink, Fan BLE Home ni brands. No se actualizó el Node del host Camera.UI ni se modificaron instalaciones de producción. Los plugins requieren que su host cumpla Node>=26.13.1<27 antes de instalar esta actualización.
