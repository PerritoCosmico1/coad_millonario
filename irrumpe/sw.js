/*
 * IRRUMPE — funciona sin señal (service worker).
 *
 * En un evento la señal suele ser mala: después de la primera visita, la
 * landing y la AR abren aunque no haya internet.
 *
 * - Páginas, estilos, código y config.js: primero la red (para ver siempre lo
 *   último publicado); si no responde en 4 s o no hay señal, la copia guardada.
 * - Imágenes, íconos, three.js y fuentes: la copia guardada al tiro, y se
 *   actualiza por detrás para la próxima vez.
 * - Videos y el modelo del iPhone: siempre directo (son pesados y piden por partes).
 * Lo que necesita internet (en vivo, YouTube) se reconecta solo al volver la señal.
 */
const CACHE = 'irrumpe-v3';

// Las fotos y el logo salen de config.js (que escribe en window.IRRUMPE_CONFIG).
self.window = self;
try { importScripts('js/config.js'); } catch (e) { /* sin config: solo lo básico */ }
const C = self.IRRUMPE_CONFIG || {};

const CORE = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/config.js', 'js/app.js', 'js/vivo.js', 'js/borrador.js', 'js/concepcion-geo.js',
  'vendor/qrcode.js', 'vendor/three.min.js',
  'assets/favicon.svg', 'assets/icon-192.png',
  'ar/', 'ar/index.html', 'ar/ar.css', 'ar/ar.js', 'ar/hologram.js', 'ar/sessions.js',
  'ar/audio.js', 'ar/video360.js', 'ar/ritmo.js', 'ar/escenario.js', 'ar/cielo.js',
  // POLEA · Primer vuelo (la tocata).
  'polea/', 'polea/index.html', 'polea/polea.css', 'polea/polea.js', 'polea/config.js',
  'polea/img/polea.webp', 'polea/img/primer-vuelo.webp',
  ...['proyectada', 'misigno', 'engrama', 'oto', 'belle-troquet', 'navarino'].map((b) => 'polea/img/' + b + '.webp'),
  '404.html',
  (C.compania || {}).logo,
  ...(C.puntos || []).map((p) => p.artista && p.artista.foto),
].filter((u) => u && !/^(data:|https?:)/.test(u));

self.addEventListener('install', (e) => {
  // Una foto que falte no impide guardar el resto.
  e.waitUntil(caches.open(CACHE)
    .then((cache) => Promise.allSettled(CORE.map((u) => cache.add(new Request(u, { cache: 'reload' })))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('irrumpe-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);
  const fonts = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== self.location.origin && !fonts) return;
  if (/\.(mp4|webm|mov|usdz)$/i.test(url.pathname)) return;
  if (fonts) e.respondWith(cacheFirst(req));
  else if (/\/(assets|vendor)\//.test(url.pathname)) e.respondWith(staleWhileRevalidate(req, e));
  else e.respondWith(networkFirst(req, e));
});

async function networkFirst(req, e) {
  const cache = await caches.open(CACHE);
  const net = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  e.waitUntil(net.then(() => {}, () => {}));
  try {
    return await Promise.race([net, new Promise((resolve, reject) => setTimeout(() => reject(new Error('lento')), 4000))]);
  } catch (err) {
    // Sin señal o muy lenta: la copia (sin importar ?preview, ?borrador…).
    const hit = (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
    if (hit) return hit;
    // Una página que no estaba guardada: en vez del error del navegador, la de inicio.
    if (req.mode === 'navigate') {
      try { return await net; } catch (e) { return (await cache.match('./')) || Response.error(); }
    }
    return net;
  }
}

async function staleWhileRevalidate(req, e) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  if (hit) {
    e.waitUntil(net.then(() => {}, () => {}));
    return hit;
  }
  return net;
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
