// Service Worker para MCBE Script Editor - Versión 2.0
const CORE_CACHE = 'mcbe-core-v3';
const TYPE_CACHE = 'mcbe-types-v2';
const MONACO_CACHE = 'mcbe-monaco-v2';

// Archivos críticos para funcionamiento básico
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/favicon.png',
  '/offline.html',
  '/styles/main.css'
];

// Definiciones de tipos de Minecraft
const TYPE_DEFINITIONS = [
  '/types/@minecraft/server/index.d.ts',
  '/types/@minecraft/server-ui/index.d.ts',
  '/types/@minecraft/server-gametest/index.d.ts'
];

// Recursos de Monaco Editor
const MONACO_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/loader.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/base/worker/workerMain.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/basic-languages/javascript/javascript.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/language/typescript/tsMode.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CORE_CACHE)
        .then(cache => cache.addAll(CORE_ASSETS)),
      caches.open(TYPE_CACHE)
        .then(cache => cache.addAll(TYPE_DEFINITIONS)),
      caches.open(MONACO_CACHE)
        .then(cache => cache.addAll(MONACO_ASSETS))
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
  const requestUrl = new URL(event.request.url);

  // Estrategia para tipos de Minecraft
  if (TYPE_DEFINITIONS.some(path => requestUrl.pathname.endsWith(path))) {
    event.respondWith(
      caches.open(TYPE_CACHE).then(cache => {
        return cache.match(event.request).then(response => {
          return response || fetch(event.request).then(networkResponse => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Estrategia para recursos de Monaco
  if (MONACO_ASSETS.some(url => requestUrl.href.includes(url))) {
    event.respondWith(
      caches.open(MONACO_CACHE).then(cache => {
        return cache.match(event.request).then(response => {
          return response || fetch(event.request).then(networkResponse => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Estrategia para navegación (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cachear nuevas páginas HTML
          const clone = response.clone();
          caches.open(CORE_CACHE).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }

  // Estrategia por defecto: Cache primero, luego red
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'UPDATE_TYPES') {
    caches.open(TYPE_CACHE).then(cache => {
      fetch(event.data.path)
        .then(response => cache.put(event.data.path, response))
        .catch(console.error);
    });
  }
});