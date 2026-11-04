# XuperTV VIDAA — estado de adaptación 1.1.0

## Base y objetivo
Adaptación de prueba para Hisense 50A65NV, VIDAA U9. La versión anterior ya cargaba en el navegador de la TV. Esta rama mantiene el prototipo HTML5 y añade diagnóstico en el dispositivo real.

## Cambios
- `vidaa-bridge.js`: identifica de forma orientativa el navegador, mide viewport y detecta `canPlayType()` para MP4, HLS y DASH.
- Inserta un panel de diagnóstico en Ajustes cuando esa pantalla se abre.
- Expone callbacks opcionales de ciclo de vida sin sustituir implementaciones del fabricante.

## Pendiente
- Probar el panel en el Hisense y registrar valores reales.
- Probar reproducción con una URL de test autorizada y sin DRM, usando formatos compatibles.
- Adaptar por separado las llamadas de catálogo y reproducción; el servicio Luna/Node, proxy y FFmpeg de webOS no son ejecutables en un navegador VIDAA.
- Verificar el mecanismo oficial de instalación/hosting de VIDAA. Esta entrega no es un paquete firmado.

## Seguridad
No se incorporan credenciales, tokens ni sesiones compartidas. No se implementa evasión de autenticación, DRM, geobloqueos ni filtros del proveedor. Las condiciones de assets de terceros pueden diferir de la licencia del código.
