const CORE_CACHE = "mcbe-core-v6.2";
const MONACO_CACHE = "mcbe-monaco-v6.2";

const CORE_ASSETS = [
	"/",
	"/index.html",
	"/manifest.json",
	"/styles.css",
	"/js/main.js",
	"/js/EditorClass.js",
	"/js/TabsManager.js",
	"/js/themes.js",
	"/icons/favicon.png"
];

const MONACO_ASSETS = [
	"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/loader.min.js",
	"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.js",
	"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/base/worker/workerMain.js",
	"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.nls.js",
	"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/editor/editor.main.css"
];

// Añadir timestamp para cache busting
const CACHE_TIMESTAMP = Date.now();

self.addEventListener("install", (e) => {
	console.log("Service Worker instalando...");
	e.waitUntil(
		Promise.all([
			caches.open(CORE_CACHE).then((cache) => {
				return cache.addAll(
					CORE_ASSETS.map((url) => `${url}?v=${CACHE_TIMESTAMP}`)
				);
			}),
			caches.open(MONACO_CACHE).then((cache) => {
				return cache.addAll(
					MONACO_ASSETS.map((url) => `${url}?v=${CACHE_TIMESTAMP}`)
				);
			})
		])
	);
	self.skipWaiting();
});

self.addEventListener("activate", (e) => {
	console.log("Service Worker activando...");
	e.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(
				keys.map((k) => {
					if (![CORE_CACHE, MONACO_CACHE].includes(k)) {
						console.log("Eliminando cache viejo:", k);
						return caches.delete(k);
					}
				})
			)
		)
	);
	self.clients.claim();
});

// Estrategia de fetch mejorada con verificación de actualizaciones
self.addEventListener("fetch", (e) => {
	// Para recursos externos (Monaco)
	if (e.request.url.includes("monaco-editor")) {
		e.respondWith(
			caches.open(MONACO_CACHE).then((cache) =>
				cache.match(e.request).then((cachedResponse) => {
					// Siempre hacer fetch en segundo plano para actualizar
					const fetchPromise = fetch(e.request)
						.then((networkResponse) => {
							// Actualizar cache con nueva versión
							cache.put(e.request, networkResponse.clone());
							return networkResponse;
						})
						.catch((err) => {
							console.log("Fetch falló, usando cache:", err);
							return cachedResponse;
						});

					// Devolver cache inmediatamente, pero actualizar en segundo plano
					return cachedResponse || fetchPromise;
				})
			)
		);
		return;
	}

	// Para recursos locales
	e.respondWith(
		caches.open(CORE_CACHE).then((cache) => {
			return cache.match(e.request).then((cachedResponse) => {
				// Hacer fetch para verificar actualizaciones
				const fetchPromise = fetch(e.request)
					.then((networkResponse) => {
						// Verificar si la respuesta es diferente
						if (
							!cachedResponse ||
							networkResponse.status !== 200 ||
							networkResponse.type !== "basic"
						) {
							return networkResponse;
						}

						// Comparar respuestas (simplificado)
						cache.put(e.request, networkResponse.clone());
						return networkResponse;
					})
					.catch((err) => {
						console.log("Fetch falló, usando cache:", err);
						return cachedResponse;
					});

				return cachedResponse || fetchPromise;
			});
		})
	);
});

// Nuevo: Mensaje para forzar actualización
self.addEventListener("message", (event) => {
	if (event.data === "skipWaiting") {
		self.skipWaiting();
	}
});