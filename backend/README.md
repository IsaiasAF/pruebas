# Adaptador XuperTV para VIDAA

Servicio Node.js independiente: el televisor VIDAA solo consume HTTPS y reproduce el proxy; el backend ejecuta el cliente del portal, cifra/descifra las peticiones y conserva las cabeceras de autorización fuera del navegador.

## Instalación

Requiere Node.js 18 o superior.

```sh
cd backend
cp .env.example .env
# Completa PORTAL_USER_ID / PORTAL_USER_TOKEN solo si son credenciales propias vigentes.
npm start
```

Publica el servicio detrás de un proxy HTTPS (por ejemplo Caddy o Nginx) y configura en Ajustes de VIDAA la URL HTTPS pública. No expongas el puerto directamente a Internet sin TLS.

## API

- `GET /api/health`
- `GET /api/detail?id=CONTENT_ID`
- `GET /api/resolve?id=CONTENT_ID&seriesId=SERIES_ID`
- `GET /proxy/:key?u=...` (interno; retransmite el vídeo con las cabeceras requeridas y reescribe playlists HLS)

El proxy conserva `Range` y respuestas `206` para búsqueda dentro del vídeo. Las URLs de proxy son temporales y viven en memoria durante 30 minutos.

## Seguridad

- Las credenciales solo se leen de variables de entorno y nunca se guardan en Git.
- Se eliminó el fallback que descargaba sesiones de terceros desde un archivo público.
- La verificación TLS está activada en las conexiones del cliente y DNS-over-HTTPS.
- El proxy solo acepta el host CDN exacto devuelto por el portal.
- Usa HTTPS, restringe el acceso al servicio y no compartas las credenciales.

## Nota

El cliente del portal se adaptó del proyecto webOS de referencia. El servicio aún necesita una prueba de extremo a extremo con una sesión válida y un título accesible; la creación de estos archivos no implica que el portal remoto haya aceptado la sesión ni que todos los formatos sean compatibles con cada firmware VIDAA.
