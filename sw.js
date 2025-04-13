const CACHE_NAME = 'mcbe-cache-v5';
     const ASSETS = [
       '/',
       '/index.html',
       '/manifest.json',
       '/icons/favicon.png',
       // Monaco Editor
       'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/loader.min.js',
       'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/base/worker/workerMain.js'
     ];

     self.addEventListener('install', (e) => {
       e.waitUntil(
         caches.open(CACHE_NAME)
           .then(cache => cache.addAll(ASSETS))
       );
     });

     self.addEventListener('fetch', (e) => {
       e.respondWith(
         caches.match(e.request)
           .then(res => res || fetch(e.request))
       );
     });