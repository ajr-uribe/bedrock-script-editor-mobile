const CACHE_NAME = 'mcbe-editor-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/icons/favicon.png',
  '/types/@minecraft/server/index.d.ts',
  '/types/@minecraft/server-ui/index.d.ts',
  '/types/@minecraft/server-gametest/index.d.ts',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/loader.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/base/worker/workerMain.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.nls.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/basic-languages/javascript/javascript.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/language/typescript/tsMode.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/language/typescript/tsWorker.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});