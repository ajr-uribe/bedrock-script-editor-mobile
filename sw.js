const CACHE_NAME = 'mcbe-offline-v3';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/favicon.png',
  // Cachear Monaco Editor
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/loader.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/base/worker/workerMain.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.js',
  // Cachear tipos de definición
  '/types/@minecraft/server/index.d.ts',
  '/types/@minecraft/server-ui/index.d.ts',
  '/types/@minecraft/server-gametest/index.d.ts'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(OFFLINE_ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => {
        // Fallback para Monaco Editor
        if (event.request.url.includes('monaco-editor')) {
          return caches.match('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.js');
        }
      })
  );
});