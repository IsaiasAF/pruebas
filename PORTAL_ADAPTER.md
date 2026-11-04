# Adaptador de portal para VIDAA

La aplicación VIDAA es HTML5 de navegador. No puede ejecutar los módulos Node.js usados por el cliente webOS (`crypto`, `https`, `dns`, `net`) ni añadir cabeceras arbitrarias al elemento HTML `<video>`. Por eso la integración se divide en dos partes:

- **VIDAA (`app.js`)**: interfaz, configuración HTTPS, petición de resolución y reproducción de la URL devuelta.
- **Servicio Node propio**: sesión autorizada, solicitudes al portal, cifrado, selección de pista y proxy de reproducción.

## Configuración

En XuperTV abre **Ajustes → Servicio XuperTV**, introduce la URL HTTPS del servicio y pulsa **Guardar y probar**.

## Contrato HTTP

Todos los endpoints devuelven JSON y deben habilitar CORS para el origen de la aplicación VIDAA.

- `GET /api/health` → `{"ok":true,"version":"1.0"}`
- `GET /api/detail?id=CONTENT_ID` → detalle y episodios autorizados.
- `GET /api/resolve?id=CONTENT_ID&seriesId=SERIES_ID` → `{"url":"https://.../playback-proxy/..." }`

**Importante:** el resolver webOS obtiene pistas y cabeceras de autorización (`Content-Auth`, `Content-License`, etc.). El navegador VIDAA no puede adjuntar esas cabeceras al `<video>`; por tanto, `/api/resolve` debe devolver una URL HTTPS de proxy de reproducción que aplique las cabeceras del portal en el servidor y retransmita el contenido compatible con el televisor. No devuelvas una URL CDN protegida directamente si requiere esas cabeceras.

## Autenticación y seguridad

El servicio debe crear y renovar una sesión propia mediante un método de acceso autorizado por el proveedor. No debe importar sesiones, `userToken` ni credenciales compartidas de repositorios públicos. Mantén claves y tokens exclusivamente en el servidor; nunca los incluyas en `app.js`, en el catálogo o en respuestas al navegador.

## Compatibilidad VIDAA

Prioriza MP4/H.264 cuando exista una pista compatible. HLS depende de la versión del firmware. El proxy debe gestionar redirecciones, errores de sesión, expiración de URLs y solicitudes de rango HTTP (`Range` / `206 Partial Content`) para permitir búsqueda dentro del vídeo.

## Estado actual

La interfaz ya permite guardar y probar una URL HTTPS y llama a `/api/resolve` cuando una ficha no tiene `streamUrl`. Este repositorio todavía no contiene el servicio Node ni una implementación de autenticación del portal; sin ese servicio no se generan enlaces reproducibles.
