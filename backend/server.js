'use strict';
require('dotenv').config();
const http = require('http');
const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');
const portal = require('./magis');

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '0.0.0.0';
const STREAMS = new Map();
const STREAM_TTL = 30 * 60 * 1000;

function json(res, status, data) {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type'
  });
  res.end(body);
}
function callPortal(fn, ...args) {
  return new Promise((resolve, reject) => fn(...args, (err, data) => err ? reject(err) : resolve(data)));
}
function cleanError(err) {
  return (err && err.message ? err.message : 'Error del portal').slice(0, 300);
}
function saveStream(info) {
  const key = crypto.randomBytes(18).toString('hex');
  STREAMS.set(key, { info, at: Date.now() });
  return key;
}
function streamFor(key) {
  const entry = STREAMS.get(key);
  if (!entry || Date.now() - entry.at > STREAM_TTL) {
    STREAMS.delete(key);
    return null;
  }
  return entry.info;
}
function proxyUrl(key, target) {
  return '/proxy/' + key + '?u=' + encodeURIComponent(Buffer.from(target).toString('base64url'));
}
function decodeTarget(value) {
  try { return Buffer.from(value || '', 'base64url').toString('utf8'); } catch (_) { return ''; }
}
function allowedTarget(target, info) {
  let u;
  try { u = new URL(target); } catch (_) { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  let original;
  try { original = new URL(info.url); } catch (_) { return false; }
  // Keep the proxy scoped to the CDN host returned by the portal.
  return u.hostname === original.hostname && !u.username && !u.password;
}
function requestUpstream(target, headers, onResponse, onError) {
  const u = new URL(target);
  const transport = u.protocol === 'https:' ? https : http;
  const req = transport.request({
    protocol: u.protocol, hostname: u.hostname, port: u.port || undefined,
    path: u.pathname + u.search, method: 'GET', headers,
    rejectUnauthorized: true
  }, onResponse);
  req.on('error', onError);
  req.end();
}
function rewritePlaylist(text, key, baseUrl) {
  const base = new URL(baseUrl);
  return text.split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;
    if (trimmed[0] === '#') {
      return line.replace(/URI="([^"]+)"/g, (all, uri) => {
        try { return 'URI="' + proxyUrl(key, new URL(uri, base).toString()) + '"'; } catch (_) { return all; }
      });
    }
    try { return proxyUrl(key, new URL(trimmed, base).toString()); } catch (_) { return line; }
  }).join('\n');
}
async function handle(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type', 'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }
  const u = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET') return json(res, 405, { error: 'Método no permitido' });
  try {
    if (u.pathname === '/api/health') {
      return json(res, 200, { ok: true, version: 'vidaa-adapter-1.0', session: 'server-managed' });
    }
    if (u.pathname === '/api/detail') {
      const id = u.searchParams.get('id');
      if (!id) return json(res, 400, { error: 'Falta id' });
      const data = await callPortal(portal.detail, id);
      return json(res, 200, data);
    }
    if (u.pathname === '/api/resolve') {
      const id = u.searchParams.get('id');
      const seriesId = u.searchParams.get('seriesId') || '';
      if (!id) return json(res, 400, { error: 'Falta id' });
      const info = await callPortal(portal.resolve, id, seriesId);
      const key = saveStream(info);
      return json(res, 200, {
        url: '/proxy/' + key + '?u=' + encodeURIComponent(Buffer.from(info.url).toString('base64url')),
        mime: info.mime, quality: info.quality, duration: info.duration,
        name: info.name, subtitles: info.subtitles || []
      });
    }
    if (u.pathname.indexOf('/proxy/') === 0) {
      const key = u.pathname.split('/')[2];
      const info = streamFor(key);
      const target = decodeTarget(u.searchParams.get('u'));
      if (!info || !allowedTarget(target, info)) return json(res, 403, { error: 'URL de proxy no válida o expirada' });
      const headers = Object.assign({}, info.headers || {}, {
        'User-Agent': (info.headers && info.headers['User-Agent']) || 'Ranger/4.9.4-17294ac0',
        'Accept': '*/*'
      });
      if (req.headers.range) headers.Range = req.headers.range;
      return requestUpstream(target, headers, upstream => {
        const contentType = String(upstream.headers['content-type'] || '');
        const isPlaylist = /mpegurl|\.m3u8/i.test(contentType + ' ' + target);
        const outHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
          'Content-Type': isPlaylist ? 'application/vnd.apple.mpegurl' : (contentType || info.mime || 'application/octet-stream')
        };
        ['content-range','accept-ranges'].forEach(k => {
          if (upstream.headers[k]) outHeaders[k] = upstream.headers[k];
        });
        if (!isPlaylist && upstream.headers['content-length']) outHeaders['Content-Length'] = upstream.headers['content-length'];
        if (upstream.statusCode === 206) res.writeHead(206, outHeaders);
        else res.writeHead(upstream.statusCode || 502, outHeaders);
        if (isPlaylist) {
          const chunks = [];
          upstream.on('data', c => chunks.push(c));
          upstream.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            const rewritten = rewritePlaylist(raw, key, target);
            res.end(rewritten);
          });
        } else {
          upstream.pipe(res);
        }
      }, err => {
        if (!res.headersSent) json(res, 502, { error: cleanError(err) });
        else res.destroy(err);
      });
    }
    return json(res, 404, { error: 'Ruta no encontrada' });
  } catch (err) {
    return json(res, 502, { error: cleanError(err) });
  }
}
const server = http.createServer((req, res) => handle(req, res));
server.listen(PORT, HOST, () => {
  console.log('XuperTV VIDAA adapter escuchando en ' + HOST + ':' + PORT);
  console.log('Sesión configurada por entorno: ' + (!!(process.env.PORTAL_USER_ID && process.env.PORTAL_USER_TOKEN)));
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
