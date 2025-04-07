const CACHE_NAME = 'mcbe-editor-v3';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/js/main.js',
  '/icons/favicon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/loader.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/base/worker/workerMain.js',
  '/types/@minecraft/server/index.d.ts',
  '/types/@minecraft/server-ui/index.d.ts',
  '/types/@minecraft/server-gametest/index.d.ts'
];

// Precache todos los recursos esenciales
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_URLS)
          .then(() => {
            // Cache Monaco Editor chunks
            return cache.addAll([
              'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/base/browser/ui/codicons/codicon/codicon.ttf',
              'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.js',
              'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.css',
              'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/base/worker/workerMain.js',
              'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/language/typescript/tsWorker.js',
              'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/basic-languages/typescript/typescript.js'
            ]);
          });
      })
  );
});

// Estrategia: Cache First, con fallback a network
self.addEventListener('fetch', (event) => {
  // Manejar solicitudes de Monaco Editor
  if (event.request.url.includes('monaco-editor')) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => response || fetch(event.request))
    );
    return;
  }

  // Para otras solicitudes
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(event.request)
          .then((response) => {
            // Solo cacheamos respuestas exitosas y que sean de nuestro origen
            if (!response || response.status !== 200 || response.type !== 'basic' || 
                !event.request.url.startsWith(self.location.origin)) {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Si es una página, mostrar la página offline
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            return new Response('', { status: 503, statusText: 'Offline' });
          });
      })
  );
});

// Limpieza de cachés antiguos
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    // Posibilidad de enviar analytics o realizar otras acciones
});