const CACHE_NAME = 'mcbe-editor-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
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

// Instalación: Cachear recursos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
});

// Estrategia: Cache First
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// ======== NUEVO: Limpieza al desinstalar ========
self.addEventListener('unload', () => {
  caches.keys().then((cacheNames) => {
    cacheNames.forEach((name) => caches.delete(name));
  });
  indexedDB.databases().then((dbs) => {
    dbs.forEach((db) => indexedDB.deleteDatabase(db.name));
  });
});