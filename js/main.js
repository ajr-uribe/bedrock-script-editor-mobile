  // ===== [1. CONFIGURACIÓN GLOBAL] ===== //
    const APP_VERSION = '2.0.0';
    const MONACO_VERSION = '0.40.0';
    const MONACO_BASE_URL = `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/${MONACO_VERSION}/min`;
    const CACHE_NAME = `mcbe-${APP_VERSION}`;
    
    // Ejemplos completos de código
    const EXAMPLES = {
        server: `// @minecraft/server example
import { world, system } from '@minecraft/server';

// Evento cuando un jugador entra al mundo
world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    
    // Mensaje de bienvenida
    player.sendMessage("¡Bienvenido al mundo de Minecraft!");
    
    // Crear un reloj que muestra el tiempo cada segundo
    system.runInterval(() => {
        const time = world.getTime();
        player.onScreenDisplay.setTitle({\n            rawtext: [\n                { text: "Hora: " },\n                { text: time.toString() }\n            ]\n        });
    }, 20); // 20 ticks = 1 segundo
});`,

        'server-ui': `// @minecraft/server-ui example
import { ActionForm, MessageForm, ModalForm } from '@minecraft/server-ui';

// Función para mostrar un menú de acción
async function showMenu(player) {
    const form = new ActionForm()
        .title("Menú Principal")
        .body("Selecciona una opción:")
        .button("Opcion 1", "textures/items/diamond_sword")
        .button("Opcion 2", "textures/items/diamond_pickaxe")
        .button("Salir", "textures/blocks/barrier");
    
    const response = await form.show(player);
    
    if (response.selection === 0) {
        player.sendMessage("¡Elegiste la espada de diamante!");
    } else if (response.selection === 1) {
        player.sendMessage("¡Elegiste el pico de diamante!");
    }
}

// Llamar a la función cuando un jugador usa un comando
world.beforeEvents.chatSend.subscribe((event) => {
    if (event.message === "!menu") {
        event.cancel = true;
        showMenu(event.sender);
    }
});`,

        'server-gametest': `// @minecraft/server-gametest example
import * as gametest from '@minecraft/server-gametest';

// Prueba básica de GameTest
function simpleMobTest(test) {
    // Spawnear un zombi
    const zombie = test.spawn("zombie", { x: 0, y: 2, z: 0 });
    
    // Verificar que el zombi existe
    test.assert(zombie.isValid(), "El zombi debería existir");
    
    // Spawnear un jugador simulado
    const player = test.spawnSimulatedPlayer({ x: 0, y: 2, z: 2 });
    
    // Comprobar que el jugador puede ver al zombi
    test.succeedWhen(() => {
        const entities = player.getEntitiesFromViewDirection();
        test.assert(entities.length > 0, "El jugador debería ver al zombi");
    });
}

// Registrar la prueba
gametest.register("MobTests", "simpleMobTest", simpleMobTest)
    .maxTicks(300)  // 15 segundos máximo
    .structureName("test:mediumroom");`
    };

    // ===== [2. REGISTRO DEL SERVICE WORKER] ===== //
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registrado con éxito:', registration.scope);
                    
                    // Verificar actualizaciones cada hora
                    setInterval(() => {
                        registration.update().then(() => {
                            console.log('Buscando actualizaciones del Service Worker');
                        });
                    }, 60 * 60 * 1000);
                })
                .catch(error => {
                    console.error('Error al registrar el Service Worker:', error);
                    showToast('Error en el sistema offline', true);
                });
        } else {
            console.warn('Service Workers no soportados');
        }
    }

    // ===== [3. CONFIGURACIÓN MONACO EDITOR] ===== //
    function configureMonaco() {
        require.config({
            paths: { 
                'vs': `${MONACO_BASE_URL}/vs`
            },
            waitSeconds: 60,
            onNodeCreated: function(node, config, moduleName, url) {
                node.crossOrigin = 'anonymous';
            }
        });

        window.MonacoEnvironment = {
            getWorkerUrl: function(moduleId, label) {
                const workerScript = `
                    self.MonacoEnvironment = { 
                        baseUrl: '${MONACO_BASE_URL}',
                        getWorkerUrl: function(moduleId, label) {
                            return './vs/base/worker/workerMain.js';
                        }
                    };
                    
                    const loadFallback = async () => {
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
                    
                    try {
                        importScripts('${MONACO_BASE_URL}/vs/base/worker/workerMain.js');
                    } catch(e) {
                        console.log('Usando fallback de cache...');
                        loadFallback();
                    }
                `;
                return `data:text/javascript;base64,${btoa(workerScript)}`;
            }
        };
    }

    // ===== [4. SISTEMA DE TIPOS DE MINECRAFT] ===== //
    async function loadMinecraftTypes() {
        const typeDefinitions = {
            server: {
                path: '/types/@minecraft/server/index.d.ts',
                alias: 'file:///node_modules/@minecraft/server/index.d.ts'
            },
            serverUI: {
                path: '/types/@minecraft/server-ui/index.d.ts',
                alias: 'file:///node_modules/@minecraft/server-ui/index.d.ts'
            },
            serverGametest: {
                path: '/types/@minecraft/server-gametest/index.d.ts',
                alias: 'file:///node_modules/@minecraft/server-gametest/index.d.ts'
            }
        };

        try {
            // Configuración del compilador TypeScript
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
                target: monaco.languages.typescript.ScriptTarget.ES2020,
                allowNonTsExtensions: true,
                moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
                module: monaco.languages.typescript.ModuleKind.ES2015,
                typeRoots: ["file:///types"],
                paths: {
                    "@minecraft/server": ["node_modules/@minecraft/server"],
                    "@minecraft/server-ui": ["node_modules/@minecraft/server-ui"],
                    "@minecraft/server-gametest": ["node_modules/@minecraft/server-gametest"]
                },
                strict: true
            });

            // Cargar cada definición
            for (const [key, type] of Object.entries(typeDefinitions)) {
                try {
                    const content = await fetchTypeDefinition(type.path);
                    monaco.languages.typescript.typescriptDefaults.addExtraLib(content, type.alias);
                    console.log(`Tipo cargado: ${key}`);
                } catch (error) {
                    console.error(`Error cargando ${key}:`, error);
                    throw new Error(`Falta la definición de tipo: ${key}`);
                }
            }

            return true;
        } catch (error) {
            console.error('Error cargando definiciones:', error);
            showToast('Error cargando autocompletado de Minecraft', true);
            return false;
        }
    }

    async function fetchTypeDefinition(path) {
        try {
            // Intentar desde red primero
            const response = await fetch(path);
            if (response.ok) {
                const content = await response.text();
                
                // Actualizar cache en segundo plano
                caches.open(CACHE_NAME).then(cache => cache.put(path, response.clone()));
                
                return content;
            }
            throw new Error('Network response not OK');
        } catch (networkError) {
            console.warn(`Red fallida para ${path}, intentando desde cache...`);
            
            // Fallback a cache
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match(path);
            
            if (cachedResponse) {
                return await cachedResponse.text();
            }
            throw new Error('No disponible en cache');
        }
    }

    // ===== [5. INICIALIZACIÓN DEL EDITOR] ===== //
    async function initializeEditor() {
        return new Promise((resolve, reject) => {
            require(['vs/editor/editor.main'], () => {
                try {
                    const editor = monaco.editor.create(document.getElementById('monaco-editor'), {
                        value: '// Cargando editor de Minecraft...\n// Por favor espere',
                        language: 'javascript',
                        theme: 'vs-dark',
                        automaticLayout: true,
                        minimap: { enabled: true },
                        fontSize: 14,
                        lineHeight: 24,
                        scrollBeyondLastLine: false,
                        roundedSelection: true,
                        mouseWheelZoom: false
                    });

                    // Configuración inicial
                    setupEditorControls(editor);
                    resolve(editor);
                } catch (error) {
                    reject(new Error(`Error al crear el editor: ${error.message}`));
                }
            }, (error) => {
                reject(new Error(`Error al cargar Monaco: ${error.message}`));
            });
        });
    }

    function setupEditorControls(editor) {
        // Selector de módulos
        document.getElementById('module-select').addEventListener('change', (e) => {
            const module = e.target.value;
            editor.setValue(EXAMPLES[module] || '// Ejemplo no disponible');
            editor.focus();
        });

        // Botón de copiar
        document.getElementById('copy-btn').addEventListener('click', () => {
            const text = editor.getValue();
            navigator.clipboard.writeText(text)
                .then(() => showToast('Código copiado!'))
                .catch(() => showToast('Error al copiar', true));
        });

        // Botón de ejecutar (placeholder)
        document.getElementById('run-btn').addEventListener('click', () => {
            showToast('Función de ejecución en desarrollo');
        });
    }

    // ===== [6. MANEJO DE INSTALACIÓN PWA] ===== //
    function setupPWAInstall() {
        let deferredPrompt;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            updateInstallButton(true);
        });

        window.addEventListener('appinstalled', () => {
            deferredPrompt = null;
            updateInstallButton(false);
            showToast('¡App instalada correctamente!');
        });

        document.getElementById('install-btn').addEventListener('click', () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then(choice => {
                    if (choice.outcome === 'accepted') {
                        showToast('Instalación en progreso...');
                    }
                    deferredPrompt = null;
                });
            } else {
                showToast('Usa el menú de instalación del navegador');
            }
        });
    }

    function updateInstallButton(available) {
        const btn = document.getElementById('install-btn');
        if (!btn) return;

        if (window.matchMedia('(display-mode: standalone)').matches) {
            btn.classList.add('installed');
            btn.classList.remove('available');
            btn.textContent = "Instalada";
            btn.disabled = true;
        } else if (available) {
            btn.classList.add('available');
            btn.classList.remove('installed');
            btn.textContent = "Instalar";
            btn.disabled = false;
        } else {
            btn.classList.remove('available', 'installed');
            btn.textContent = "Instalar";
            btn.disabled = true;
        }
    }

    // ===== [7. MANEJO DE ERRORES] ===== //
    function showError(message, error) {
        const editorContainer = document.getElementById('monaco-editor');
        editorContainer.innerHTML = `
            <div class="error-container">
                <h3>${message}</h3>
                <p><small>${error.message}</small></p>
                <div class="error-actions">
                    <button onclick="window.location.reload()">Recargar</button>
                    <button onclick="initBasicEditor()">Continuar sin autocompletado</button>
                </div>
                ${!navigator.onLine ? '<p class="offline-warning">⚠️ Estás trabajando offline</p>' : ''}
            </div>
        `;
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

    // ===== [8. INICIALIZACIÓN COMPLETA] ===== //
    async function initializeApp() {
        try {
            showToast('Iniciando aplicación...');
            
            // 1. Registrar Service Worker
            registerServiceWorker();
            
            // 2. Configurar Monaco
            configureMonaco();
            
            // 3. Inicializar editor
            window.editor = await initializeEditor();
            
            // 4. Cargar tipos de Minecraft
            const typesLoaded = await loadMinecraftTypes();
            if (typesLoaded) {
                monaco.editor.setModelLanguage(editor.getModel(), 'typescript');
            }
            
            // 5. Configurar PWA
            setupPWAInstall();
            
            // 6. Actualizar interfaz
            document.getElementById('status-bar').textContent = 'Editor listo';
            showToast('Aplicación cargada correctamente');
            
        } catch (error) {
            showError('Error al iniciar la aplicación', error);
            console.error('Error en initializeApp:', error);
        }
    }

    // ===== [9. INICIO DE LA APLICACIÓN] ===== //
    document.addEventListener('DOMContentLoaded', () => {
        // Versión de fallback básica
        window.initBasicEditor = function() {
            const editorContainer = document.getElementById('monaco-editor');
            editorContainer.innerHTML = '<textarea id="fallback-editor" style="width:100%;height:100%;background:#1e1e1e;color:white;padding:10px;"></textarea>';
            document.getElementById('fallback-editor').value = EXAMPLES.server;
        };

        // Iniciar la aplicación completa
        initializeApp();
    });