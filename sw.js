// service-worker.js - Service Worker para PWA con caché offline
const CACHE_NAME = "mcbeditor-v2.0.6.6";
const RUNTIME_CACHE = "mcbeditor-runtime-v1";
const TYPES_CACHE = "mcbeditor-types-v1";

// Archivos estáticos que siempre se deben cachear
const STATIC_ASSETS = [
	"/",
	"/index.html",
	"/assets/css/style.css",
	"/assets/js/main.js",
	"/assets/js/core/EditorManager.js",
	"/assets/js/utils/form-script.js",
	"/assets/js/utils/Toolbar.js",
	"/assets/js/utils/TypesManager.js",
	"/assets/js/utils/MinecraftStaticDebugger.js",
	"/assets/js/utils/StatusBarManager.js",
	"/assets/js/utils/SnippetsManager.js",
	"/assets/js/utils/ImportsManager.js",
	"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/loader.js",
	"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/editor/editor.main.js",
	"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/editor/editor.main.css"
];

// URLs que deben cachearse pero pueden fallar sin romper la app
const OPTIONAL_ASSETS = [
	"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/base/worker/workerMain.js",
	"https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs/basic-languages/javascript/javascript.js"
];

// Patrones de URLs que se deben cachear dinámicamente
const CACHEABLE_PATTERNS = [
	/^https:\/\/cdn\.jsdelivr\.net\/npm\/@minecraft\/.+\/index\.d\.ts$/,
	/^https:\/\/registry\.npmjs\.org\/@minecraft\//,
	/^https:\/\/raw\.githubusercontent\.com\/Mojang\/bedrock-samples\/main\/metadata\/json_schemas\/.+\.json$/
];

// Instalación del Service Worker
self.addEventListener("install", (event) => {
	console.log("[SW] Installing Service Worker...");

	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => {
				console.log("[SW] Caching static assets...");

				// Cachear archivos estáticos críticos
				return cache.addAll(STATIC_ASSETS).then(() => {
					// Intentar cachear archivos opcionales sin fallar
					return Promise.allSettled(
						OPTIONAL_ASSETS.map((url) =>
							cache.add(url).catch((err) => {
								console.warn(
									`[SW] Failed to cache optional asset: ${url}`,
									err
								);
								return null;
							})
						)
					);
				});
			})
			.then(() => {
				console.log("[SW] Installation complete");
				return self.skipWaiting(); // Activar inmediatamente
			})
	);
});

// Activación del Service Worker
self.addEventListener("activate", (event) => {
	console.log("[SW] Activating Service Worker...");

	event.waitUntil(
		caches
			.keys()
			.then((cacheNames) => {
				return Promise.all(
					cacheNames.map((cacheName) => {
						// Eliminar cachés antiguas
						if (
							cacheName !== CACHE_NAME &&
							cacheName !== RUNTIME_CACHE &&
							cacheName !== TYPES_CACHE
						) {
							console.log("[SW] Deleting old cache:", cacheName);
							return caches.delete(cacheName);
						}
					})
				);
			})
			.then(() => {
				console.log("[SW] Activation complete");
				return self.clients.claim(); // Tomar control inmediatamente
			})
	);
});

// Interceptar peticiones de red
self.addEventListener("fetch", (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Ignorar peticiones que no son GET
	if (request.method !== "GET") {
		return;
	}

	// Estrategia para definiciones TypeScript de Minecraft
	if (isMinecraftTypeDefinition(url)) {
		event.respondWith(handleTypeDefinition(request));
		return;
	}

	// Estrategia para assets de Monaco Editor
	if (isMonacoAsset(url)) {
		event.respondWith(handleMonacoAsset(request));
		return;
	}

	// Estrategia para archivos estáticos de la app
	if (isStaticAsset(url)) {
		event.respondWith(handleStaticAsset(request));
		return;
	}

	// Estrategia para API requests (npm registry)
	if (isAPIRequest(url)) {
		event.respondWith(handleAPIRequest(request));
		return;
	}

	// Para todo lo demás, intentar red primero
	event.respondWith(fetch(request).catch(() => caches.match(request)));
});

// Verificar si es una definición TypeScript de Minecraft
function isMinecraftTypeDefinition(url) {
	return CACHEABLE_PATTERNS[0].test(url.href);
}

// Verificar si es un asset de Monaco Editor
function isMonacoAsset(url) {
	return url.href.includes("cdnjs.cloudflare.com/ajax/libs/monaco-editor");
}

// Verificar si es un asset estático
function isStaticAsset(url) {
	return url.origin === self.location.origin;
}

// Verificar si es una petición a API
function isAPIRequest(url) {
	return url.href.includes("registry.npmjs.org");
}

// Manejar definiciones TypeScript - Cache First con Network Fallback
async function handleTypeDefinition(request) {
	const cache = await caches.open(TYPES_CACHE);

	// Intentar obtener de caché primero
	const cachedResponse = await cache.match(request);
	if (cachedResponse) {
		console.log("[SW] Serving type definition from cache:", request.url);

		// Actualizar en background
		fetch(request)
			.then((response) => {
				if (response && response.status === 200) {
					cache.put(request, response.clone());
				}
			})
			.catch(() => {});

		return cachedResponse;
	}

	// Si no está en caché, intentar red
	try {
		const response = await fetch(request);
		if (response && response.status === 200) {
			cache.put(request, response.clone());
			console.log("[SW] Cached new type definition:", request.url);
		}
		return response;
	} catch (error) {
		console.error("[SW] Failed to fetch type definition:", error);
		return new Response("Type definition unavailable offline", {
			status: 503,
			statusText: "Service Unavailable"
		});
	}
}

// Manejar assets de Monaco - Cache First
async function handleMonacoAsset(request) {
	const cache = await caches.open(CACHE_NAME);
	const cachedResponse = await cache.match(request);

	if (cachedResponse) {
		return cachedResponse;
	}

	try {
		const response = await fetch(request);
		if (response && response.status === 200) {
			cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		return new Response("Monaco asset unavailable offline", {
			status: 503,
			statusText: "Service Unavailable"
		});
	}
}

// Manejar assets estáticos - Cache First, Network Fallback
async function handleStaticAsset(request) {
	const cache = await caches.open(CACHE_NAME);
	const cachedResponse = await cache.match(request);

	if (cachedResponse) {
		// Actualizar en background si es posible
		fetch(request)
			.then((response) => {
				if (response && response.status === 200) {
					cache.put(request, response.clone());
				}
			})
			.catch(() => {});

		return cachedResponse;
	}

	try {
		const response = await fetch(request);
		if (response && response.status === 200) {
			cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		// Si falla, intentar servir index.html para SPA
		if (request.mode === "navigate") {
			return cache.match("/index.html");
		}
		throw error;
	}
}

// Manejar peticiones a API - Network First, Cache Fallback
async function handleAPIRequest(request) {
	const cache = await caches.open(RUNTIME_CACHE);

	try {
		const response = await fetch(request);
		if (response && response.status === 200) {
			cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		const cachedResponse = await cache.match(request);
		if (cachedResponse) {
			console.log(
				"[SW] Serving API response from cache (offline):",
				request.url
			);
			return cachedResponse;
		}
		throw error;
	}
}

// Escuchar mensajes del cliente
self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "SKIP_WAITING") {
		self.skipWaiting();
	}

	if (event.data && event.data.type === "CLEAR_CACHE") {
		event.waitUntil(
			caches
				.keys()
				.then((cacheNames) => {
					return Promise.all(
						cacheNames.map((cacheName) => caches.delete(cacheName))
					);
				})
				.then(() => {
					event.ports[0].postMessage({ success: true });
				})
		);
	}

	if (event.data && event.data.type === "CACHE_TYPES") {
		// Cachear definiciones TypeScript manualmente
		const urls = event.data.urls || [];
		event.waitUntil(
			caches
				.open(TYPES_CACHE)
				.then((cache) => {
					return Promise.allSettled(
						urls.map((url) =>
							cache.add(url).catch((err) => {
								console.warn(
									"[SW] Failed to cache type definition:",
									url,
									err
								);
							})
						)
					);
				})
				.then(() => {
					event.ports[0].postMessage({ success: true });
				})
		);
	}
});
