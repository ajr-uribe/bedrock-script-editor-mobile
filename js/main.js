
    // ===== [1. CONFIGURACIÓN GLOBAL] ===== //
    const APP_VERSION = '1.1.0';
    const CACHE_NAME = `mcbe-types-${APP_VERSION}`;
    const TYPE_DEFINITIONS = {
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

    // ===== [2. FUNCIONES DE CACHE PARA TIPOS] ===== //
    async function cacheTypeDefinitions() {
        try {
            const cache = await caches.open(CACHE_NAME);
            await Promise.all(Object.values(TYPE_DEFINITIONS).map(async (type) => {
                try {
                    const response = await fetch(type.path);
                    if (response.ok) {
                        await cache.put(type.path, response.clone());
                        console.log(`Cached: ${type.path}`);
                    }
                } catch (error) {
                    console.warn(`Failed to cache ${type.path}:`, error);
                }
            });
        } catch (error) {
            console.error('Error initializing type cache:', error);
        }
    }

    async function getTypeDefinition(path) {
        try {
            // Intentar desde red primero
            const networkResponse = await fetch(path);
            if (networkResponse.ok) {
                const content = await networkResponse.text();
                await cacheTypeDefinition(path, content);
                return content;
            }
            throw new Error('Network request failed');
        } catch (networkError) {
            // Fallback a cache
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match(path);
            if (cachedResponse) {
                return await cachedResponse.text();
            }
            throw new Error('Not available in cache');
        }
    }

    // ===== [3. CARGA DE DEFINICIONES DE TIPO] ===== //
    async function loadMinecraftTypes() {
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
            for (const [key, type] of Object.entries(TYPE_DEFINITIONS)) {
                try {
                    const content = await getTypeDefinition(type.path);
                    monaco.languages.typescript.typescriptDefaults.addExtraLib(content, type.alias);
                    console.log(`Loaded: ${key}`);
                } catch (error) {
                    console.error(`Failed to load ${key}:`, error);
                    throw new Error(`Missing ${key} type definition`);
                }
            }

            return true;
        } catch (error) {
            console.error('Error loading type definitions:', error);
            showToast('Error loading Minecraft API definitions', true);
            return false;
        }
    }

    // ===== [4. INTEGRACIÓN CON MONACO] ===== //
    async function initializeEditorWithTypes() {
        try {
            // 1. Crear editor básico
            const editor = monaco.editor.create(document.getElementById('monaco-editor'), {
                value: '// Loading Minecraft API...\n// Please wait',
                language: 'javascript',
                theme: 'vs-dark'
            });

            // 2. Cargar tipos (con retroalimentación visual)
            editor.setValue('// Loading type definitions...');
            const typesLoaded = await loadMinecraftTypes();
            
            if (typesLoaded) {
                // 3. Configurar editor completo
                editor.setModel(monaco.editor.createModel(
                    EXAMPLES.server,
                    'typescript',
                    monaco.Uri.parse('file:///main.ts')
                ));
                
                // 4. Configurar eventos
                setupEditorEvents(editor);
                showToast('Minecraft API loaded successfully');
                return editor;
            } else {
                throw new Error('Type definitions failed to load');
            }
        } catch (error) {
            showError('Failed to initialize editor with types', error);
            throw error;
        }
    }

    // ===== [5. FUNCIONES AUXILIARES] ===== //
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

    function showError(title, error) {
        const editorContainer = document.getElementById('monaco-editor');
        editorContainer.innerHTML = `
            <div class="error-message">
                <h3>${title}</h3>
                <p>${error.message}</p>
                <div class="error-actions">
                    <button onclick="retryInitialization()">Reintentar</button>
                    <button onclick="loadBasicEditor()">Cargar sin autocompletado</button>
                </div>
            </div>
        `;
    }

    // ===== [6. INICIALIZACIÓN COMPLETA] ===== //
    async function initializeApp() {
        try {
            // 1. Cachear recursos iniciales
            showToast('Preparing offline support...');
            await cacheTypeDefinitions();
            
            // 2. Inicializar Monaco
            showToast('Loading editor...');
            await new Promise((resolve) => {
                require(['vs/editor/editor.main'], resolve);
            });
            
            // 3. Cargar editor con tipos
            window.editor = await initializeEditorWithTypes();
            
            // 4. Configuración adicional
            setupPWAEvents();
            updateInstallButton();
            
        } catch (error) {
            console.error('App initialization failed:', error);
            showError('Application failed to start', error);
        }
    }

    // ===== [7. MANEJO DE RECARGA] ===== //
    window.retryInitialization = function() {
        document.getElementById('monaco-editor').innerHTML = '';
        initializeApp();
    };

    window.loadBasicEditor = function() {
        document.getElementById('monaco-editor').innerHTML = '';
        initializeBasicEditor();
    };

    // ===== [8. INICIO DE LA APLICACIÓN] ===== //
    document.addEventListener('DOMContentLoaded', () => {
        // Configurar Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(() => console.log('SW registered'))
                .catch(err => console.error('SW registration failed:', err));
        }
        
        // Iniciar la aplicación
        initializeApp();
    });