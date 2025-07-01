const CORE_CACHE = 'mcbe-core-v6';
const MONACO_CACHE = 'mcbe-monaco-v6';

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles.css',
  '/js/main.js',
  '/icons/favicon.png'
];

const MONACO_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/loader.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/base/worker/workerMain.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.nls.js',
  'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.css'
];

self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      caches.open(CORE_CACHE).then(c => c.addAll(CORE_ASSETS)),
      caches.open(MONACO_CACHE).then(c => c.addAll(MONACO_ASSETS))
    ])
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => {
        if (![CORE_CACHE, MONACO_CACHE].includes(k)) return caches.delete(k);
      }))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('monaco-editor')) {
    e.respondWith(
      caches.open(MONACO_CACHE).then(cache =>
        cache.match(e.request).then(resp => resp || fetch(e.request).then(net => {
          cache.put(e.request, net.clone());
          return net;
        }))
      )
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request).then(net => {
      if (e.request.method === 'GET') {
        const clone = net.clone();
        caches.open(CORE_CACHE).then(cache => cache.put(e.request, clone));
      }
      return net;
    }))
  );
});