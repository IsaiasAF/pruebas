# Adaptador de portal para VIDAA

La aplicación VIDAA es HTML5 de navegador. No puede ejecutar los módulos Node.js del cliente webOS (`crypto`, `https`, `dns`, `net`) ni adjuntar cabeceras privadas al elemento HTML `<video>`. La integración se divide en:

- **VIDAA (`app.js`)**: interfaz, configuración de la URL HTTPS del servicio y reproducción.
- **Servicio Node (`backend/`)**: sesión del portal, solicitudes cifradas, resolución de pistas y proxy de reproducción.

## Configuración

1. Despliega `backend/` en un servicio Node.js persistente con Node 18 o superior.
2. Configura las variables de entorno `PORTAL_USER_ID` y `PORTAL_USER_TOKEN` en el panel privado del proveedor. No las guardes en archivos públicos.
3. En XuperTV abre **Ajustes → Servicio XuperTV**, introduce la URL HTTPS del servicio y pulsa **Guardar y probar**.

## Endpoints

- `GET /api/health`: estado básico del servicio.
- `GET /api/detail?id=CONTENT_ID`: ficha, episodios y temporadas.
- `GET /api/resolve?id=CONTENT_ID&seriesId=SERIES_ID`: resuelve la pista y devuelve una URL del proxy.
- `GET /proxy/:key?u=...`: retransmite el medio aplicando las cabeceras de autorización del portal.

El backend mantiene las cabeceras privadas en el servidor. El proxy limita el destino al mismo host CDN que devolvió el portal y reescribe las referencias de las listas HLS. Las URLs temporales de reproducción se guardan en memoria durante 30 minutos.

## Seguridad y compatibilidad

- Usa HTTPS en el servicio y valida certificados TLS; no desactives `rejectUnauthorized`.
- Mantén credenciales únicamente en variables de entorno privadas.
- El servicio debe permanecer activo: GitHub Pages solo publica la interfaz estática y GitHub Actions no mantiene un proceso Node permanente.
- El reproductor VIDAA debe aceptar el formato devuelto (MP4/H.264 o HLS según firmware). El soporte HLS varía por modelo.
- Las credenciales de sesión pueden caducar; si el portal las rechaza, habrá que renovarlas mediante un método de autenticación autorizado.

## Estado y límites

El repositorio contiene ahora el cliente Node y la API HTTP, pero eso no demuestra que el portal acepte la sesión ni que cada CDN/firmware sea compatible. Hace falta desplegar el backend en un host persistente y probar `/api/health`, `/api/detail` y una reproducción real desde el televisor.

GitHub Pages publica únicamente `index.html`, `app.js`, `style.css`, `assets/` y `data/`; no publica el código del backend como parte del sitio web.
