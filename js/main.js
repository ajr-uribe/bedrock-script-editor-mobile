    // ===== [1. CONFIGURACIÓN GLOBAL] ===== //
    const APP_VERSION = '1.0.0';
    const MONACO_VERSION = '0.40.0';
    const MONACO_BASE_URL = `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${MONACO_VERSION}/min`;
    const CACHE_NAME = `mcbe-${APP_VERSION}`;

    // ===== [2. CONFIGURACIÓN MONACO EDITOR] ===== //
    require.config({
        paths: { 
            'vs': `${MONACO_BASE_URL}/vs`
        },
        waitSeconds: 60,
        onNodeCreated: function(node, config, moduleName, url) {
            node.crossOrigin = 'anonymous';
        }
    });

    // ===== [3. WORKER OFFLINE CON FALLBACKS] ===== //
    window.MonacoEnvironment = {
        getWorkerUrl: function(moduleId, label) {
            const workerScript = `
                // Configuración base
                self.MonacoEnvironment = { 
                    baseUrl: '${MONACO_BASE_URL}',
                    getWorkerUrl: function(moduleId, label) {
                        return './vs/base/worker/workerMain.js';
                    }
                };
                
                // Estrategia de fallback
                const loadFromCache = async () => {
                    try {
                        const cache = await caches.open('${CACHE_NAME}');
                        const response = await cache.match('${MONACO_BASE_URL}/vs/base/worker/workerMain.js');
                        if (response) {
                            const js = await response.text();
                            try {
                                importScripts('blob:' + URL.createObjectURL(new Blob([js])));
                                return;
                            } catch(e) {
                                console.error('Fallback cache error:', e);
                            }
                        }
                        importScripts('${MONACO_BASE_URL}/vs/base/worker/workerMain.js');
                    } catch(e) {
                        console.error('Error loading worker:', e);
                    }
                };
                
                // Intentar carga normal primero
                try {
                    importScripts('${MONACO_BASE_URL}/vs/base/worker/workerMain.js');
                } catch(e) {
                    console.log('Usando fallback de cache...');
                    loadFromCache();
                }
            `;
            return `data:text/javascript;base64,${btoa(workerScript)}`;
        }
    };

    // ===== [4. VARIABLES GLOBALES] ===== //
    let editor;
    let deferredPrompt;
    const EXAMPLES = {
        server: `// @minecraft/server example\nimport { world } from '@minecraft/server';\n\nworld.afterEvents.playerSpawn.subscribe(() => {\n  // Tu código aquí\n});`,
        'server-ui': `// @minecraft/server-ui example\nimport { ActionForm } from '@minecraft/server-ui';\n\n// Código de ejemplo UI`,
        'server-gametest': `// @minecraft/server-gametest example\nimport * as gametest from '@minecraft/server-gametest';\n\n// Código de ejemplo Gametest`
    };

    // ===== [5. FUNCIONES DE CACHE OFFLINE] ===== //
    async function cacheCriticalAssets() {
        const assets = [
            '/',
            '/index.html',
            '/manifest.json',
            '/icons/favicon.png',
            '/offline.html',
            `${MONACO_BASE_URL}/vs/loader.min.js`,
            `${MONACO_BASE_URL}/vs/base/worker/workerMain.js`,
            `${MONACO_BASE_URL}/vs/editor/editor.main.js`,
            `${MONACO_BASE_URL}/vs/basic-languages/javascript/javascript.js`,
            '/types/@minecraft/server/index.d.ts',
            '/types/@minecraft/server-ui/index.d.ts',
            '/types/@minecraft/server-gametest/index.d.ts'
        ];

        try {
            const cache = await caches.open(CACHE_NAME);
            await Promise.all(assets.map(asset => {
                return cache.add(asset).catch(err => {
                    console.warn(`No se pudo cachear ${asset}:`, err);
                });
            }));
            console.log('Assets críticos cacheados');
            return true;
        } catch (error) {
            console.error('Error cacheando assets:', error);
            return false;
        }
    }

    // ===== [6. INICIALIZACIÓN DEL EDITOR] ===== //
    async function initializeEditor() {
        return new Promise((resolve, reject) => {
            // Verificar si Monaco ya está cargado
            if (window.monaco) {
                resolve(window.monaco);
                return;
            }

            // Cargar Monaco con manejo de errores
            require(['vs/editor/editor.main'], () => {
                try {
                    const editorInstance = monaco.editor.create(document.getElementById('monaco-editor'), {
                        value: '// Cargando editor...\n// Espera un momento por favor',
                        language: 'javascript',
                        theme: 'vs-dark',
                        automaticLayout: true,
                        minimap: { enabled: true },
                        fontSize: 14,
                        lineHeight: 24
                    });
                    resolve(editorInstance);
                } catch (e) {
                    reject(new Error(`Error creando editor: ${e.message}`));
                }
            }, (err) => {
                reject(new Error(`Error cargando Monaco: ${err.requireModules || err.message}`));
            });
        });
    }

    // ===== [7. CARGA DE TIPOS] ===== //
    async function loadTypeDefinitions() {
        const typeFiles = {
            server: '/types/@minecraft/server/index.d.ts',
            'server-ui': '/types/@minecraft/server-ui/index.d.ts',
            'server-gametest': '/types/@minecraft/server-gametest/index.d.ts'
        };

        try {
            const cache = await caches.open(CACHE_NAME);

            for (const [module, path] of Object.entries(typeFiles)) {
                try {
                    // Intentar desde red primero
                    const response = await fetch(path);
                    if (!response.ok) throw new Error('Network response not OK');

                    const content = await response.text();
                    monaco.languages.typescript.typescriptDefaults.addExtraLib(
                        content,
                        `file:///node_modules/@minecraft/${module}/index.d.ts`
                    );

                    // Guardar en cache
                    await cache.put(path, new Response(content));
                } catch (networkError) {
                    console.log(`Usando cache para ${module}...`);

                    // Fallback a cache
                    const cached = await cache.match(path);
                    if (cached) {
                        const content = await cached.text();
                        monaco.languages.typescript.typescriptDefaults.addExtraLib(
                            content,
                            `file:///node_modules/@minecraft/${module}/index.d.ts`
                        );
                    }
                }
            }

            // Configurar TypeScript
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ES2020,
                allowNonTsExtensions: true,
                moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                module: monaco.languages.typescript.ModuleKind.CommonJS,
                typeRoots: ["file:///types"],
                paths: {
                    "@minecraft/server": ["/@minecraft/server"],
                    "@minecraft/server-ui": ["/@minecraft/server-ui"],
                    "@minecraft/server-gametest": ["/@minecraft/server-gametest"]
                }
            });

            return true;
        } catch (error) {
            console.error('Error cargando tipos:', error);
            throw error;
        }
    }

    // ===== [8. MANEJO DE INSTALACIÓN PWA] ===== //
    function updateInstallButton() {
        const installBtn = document.getElementById('install-btn');
        if (!installBtn) return;

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

        if (isStandalone) {
            installBtn.classList.add('installed');
            installBtn.classList.remove('available');
            installBtn.textContent = "Instalada";
            installBtn.disabled = true;
        } else if (deferredPrompt) {
            installBtn.classList.add('available');
            installBtn.classList.remove('installed');
            installBtn.textContent = "Instalar";
            installBtn.disabled = false;
        } else {
            installBtn.classList.remove('available', 'installed');
            installBtn.textContent = "Instalar";
            installBtn.disabled = true;
        }
    }

    function setupPWAEvents() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            updateInstallButton();

            // Para iOS que no soporta beforeinstallprompt
            if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                document.getElementById('ios-install-help').style.display = 'block';
            }
        });

        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            showToast('¡Aplicación instalada correctamente!');
            updateInstallButton();
        });

        document.getElementById('install-btn')?.addEventListener('click', () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(choice => {
                    if (choice.outcome === 'accepted') {
                        showToast('Instalación en progreso...');
                    }
                    deferredPrompt = null;
                    updateInstallButton();
                });
            }
        });
    }

    // ===== [9. MANEJO DE ERRORES] ===== //
    function showError(message, error) {
        console.error(message, error);
        const errorHtml = `
            <div class="error-container">
                <h3>Error de inicialización</h3>
                <p>${message}</p>
                <p><small>${error?.message || ''}</small></p>
                <button onclick="window.location.reload()">Reintentar</button>
                ${!navigator.onLine ? '<p class="offline-warning">Estás trabajando offline</p>' : ''}
            </div>
        `;
        document.getElementById('monaco-editor').innerHTML = errorHtml;
    }

    function showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.style.backgroundColor = isError ? '#d32f2f' : '#007acc';
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    // ===== [10. INICIALIZACIÓN PRINCIPAL] ===== //
    async function initializeApp() {
        try {
            // Paso 1: Cachear assets críticos
            showToast('Preparando aplicación...');
            await cacheCriticalAssets();

            // Paso 2: Inicializar editor
            showToast('Cargando editor...');
            editor = await initializeEditor();

            // Paso 3: Cargar tipos
            showToast('Cargando autocompletado...');
            await loadTypeDefinitions();
            monaco.editor.setModelLanguage(editor.getModel(), 'typescript');

            // Paso 4: Configurar ejemplos
            document.getElementById('module-select').addEventListener('change', (e) => {
                const module = e.target.value;
                editor.setValue(EXAMPLES[module] || '// Selecciona un módulo');
            });

            // Paso 5: Configurar PWA
            setupPWAEvents();
            updateInstallButton();

            // Paso 6: Configurar eventos del editor
            editor.onDidChangeModelContent(() => {
                const position = editor.getPosition();
                document.getElementById('status-bar').textContent = 
                    `Línea ${position.lineNumber}, Col ${position.column} | ${editor.getModel().getLineCount()} líneas`;
            });

            showToast('¡Editor listo!');
            console.log('Aplicación inicializada correctamente');

        } catch (error) {
            showError('No se pudo iniciar el editor', error);
            throw error;
        }
    }

    // ===== [11. EVENTOS DE CONEXIÓN] ===== //
    function handleConnectionChange() {
        if (navigator.onLine) {
            showToast('Conexión restablecida');
            if (!editor) initializeApp();
        } else {
            showToast('Modo offline activado', true);
        }
    }

    // ===== [12. INICIO DE LA APLICACIÓN] ===== //
    document.addEventListener('DOMContentLoaded', () => {
        // Verificar estado de conexión
        window.addEventListener('online', handleConnectionChange);
        window.addEventListener('offline', handleConnectionChange);

        // Iniciar la aplicación
        initializeApp().catch(e => console.error('Error crítico:', e));
    });

    // ===== [13. FUNCIONES AUXILIARES GLOBALES] ===== //
    async function copyScript() {
        try {
            const text = editor?.getValue() || '';
            await navigator.clipboard.writeText(text);
            showToast('Código copiado al portapapeles');
        } catch (err) {
            showToast('Error al copiar el código', true);
            console.error('Error al copiar:', err);
        }
    }

    // Exponer funciones globales necesarias
    window.InstallApp = function() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
        } else {
            showToast('Usa el menú de instalación del navegador');
        }
    };

    window.copyScript = copyScript;