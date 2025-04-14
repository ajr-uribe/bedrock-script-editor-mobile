// Service Worker para Minecraft Bedrock Editor - v2.1
const CORE_CACHE = 'mcbe-core-v4';
const TYPE_CACHE = 'mcbe-types-v3';

const OFFLINE_PAGE = '/offline.html';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/favicon.png',
  OFFLINE_PAGE
];

const TYPE_DEFINITIONS = [
  '/types/@minecraft/server/index.d.ts',
  '/types/@minecraft/server-ui/index.d.ts',
  '/types/@minecraft/server-gametest/index.d.ts'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CORE_CACHE)
        .then(cache => cache.addAll(CORE_ASSETS)),
      caches.open(TYPE_CACHE)
        .then(cache => cache.addAll(TYPE_DEFINITIONS))
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (![CORE_CACHE, TYPE_CACHE].includes(cache)) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Manejo de tipos de Minecraft
  if (TYPE_DEFINITIONS.some(path => url.pathname === path)) {
    event.respondWith(
      caches.open(TYPE_CACHE).then(cache => {
        return cache.match(request).then(cached => {
          return cached || fetch(request).then(networkResponse => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Manejo de navegación
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CORE_CACHE).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(OFFLINE_PAGE))
    );
    return;
  }

  // Estrategia por defecto
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});