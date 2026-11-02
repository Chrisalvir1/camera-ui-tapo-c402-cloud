# Tapo C402 Cloud — implementación nueva

Estado: desarrollo; sin paquete instalable aceptado.

Se retiró el puente basado en go2rtc, su código fuente, sus binarios y el bundle
que lo incluía. El transporte nuevo debe implementarse directamente contra Tapo.
Los únicos componentes conservados en esta carpeta son código recién escrito
para perfiles, ciclo de vida y contrato del SDK Camera UI.

Aceptación: recibir H.264 directamente de la cámara, comprobar SPS y cuadros
1920×1080, conservar las unidades NAL originales y el audio con su codec real.
No escalar, recodificar, sustituir SPS ni deducir dimensiones desde el nombre del
modelo. Solicitar un modo de resolución no demuestra que el firmware lo acepte.

La contraseña guardada anteriormente fue eliminada con autorización del usuario.
Será necesario introducirla de nuevo directamente en Camera UI para autenticar
la prueba real; nunca en el chat.
