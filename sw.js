// Service Worker para Minecraft Bedrock Editor - v2.2
const CORE_CACHE = 'mcbe-core-v4-preview';
const TYPE_CACHE = 'mcbe-types-v3-preview';
const MONACO_CACHE = 'mcbe-monaco-v3-preview';

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

const MONACO_CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/loader.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.nls.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/base/worker/workerMain.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/basic-languages/javascript/javascript.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/language/typescript/tsMode.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/loader.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CORE_CACHE)
        .then(cache => cache.addAll(CORE_ASSETS)),
      caches.open(TYPE_CACHE)
        .then(cache => cache.addAll(TYPE_DEFINITIONS)),
      caches.open(MONACO_CACHE)
        .then(cache => cache.addAll(MONACO_CDN_ASSETS))
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (![CORE_CACHE, TYPE_CACHE, MONACO_CACHE].includes(cache)) {
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

  // Manejo de recursos de Monaco Editor
  if (MONACO_CDN_ASSETS.some(assetUrl => request.url === assetUrl)) {
    event.respondWith(
      caches.open(MONACO_CACHE).then(cache => {
        return cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(networkResponse => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          }).catch(() => cached);
          
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

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

  // Estrategia por defecto (Cache First, luego Network)
  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).then(response => {
        // No cacheamos solicitudes de terceros ni solicitudes no GET
        if (!request.url.startsWith('http') || 
            request.method !== 'GET' || 
            !response.ok) {
          return response;
        }

        // Cacheamos recursos importantes
        const responseToCache = response.clone();
        const cacheTarget = url.pathname.startsWith('/types/') ? TYPE_CACHE : CORE_CACHE;
        caches.open(cacheTarget).then(cache => cache.put(request, responseToCache));
        
        return response;
      }).catch(() => {
        // Solo devolvemos offline page para solicitudes HTML
        if (request.headers.get('accept').includes('text/html')) {
          return caches.match(OFFLINE_PAGE);
        }
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data.action === 'UPDATE_CACHE') {
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if ([CORE_CACHE, TYPE_CACHE, MONACO_CACHE].includes(cache)) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.skipWaiting());
  }
});