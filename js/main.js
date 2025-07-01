// ===== CONFIGURACIÓN GLOBAL =====
const APP_VERSION = '1.3.0';
const STORAGE_KEY = 'mcbe_editor_content';
const STORAGE_FILENAME_KEY = 'mcbe_editor_filename';
const STORAGE_MODULE_KEY = 'mcbe_editor_module';
const STORAGE_VERSION_KEY = 'mcbe_editor_version';
const SAVE_DEBOUNCE_TIME = 1000;
const AUTO_SAVE_INTERVAL = 30000;
const TYPE_CACHE_EXPIRY = 86400000; // 1 día en ms

let editor;
let deferredPrompt;
let saveTimeout;
let isLoadingTypes = false;
let typeCache = {};

// ===== EJEMPLOS DE CÓDIGO MEJORADOS =====
const EXAMPLES = {
    server: `// @minecraft/server example (v2.0.0)
import { world, system, Vector } from '@minecraft/server';

// Player spawn event
world.afterEvents.playerSpawn.subscribe((event) => {
    const { player } = event;
    
    // Welcome message with translation support
    player.sendMessage({
        translate: 'multiplayer.player.joined',
        with: [ player.name ]
    });
    
    // Repeating title display
    system.runInterval(() => {
        player.onScreenDisplay.setTitle({ 
            title: "¡Bienvenido!",
            subtitle: "Disfruta tu estancia",
            fadeInDuration: 10,
            fadeOutDuration: 10,
            stayDuration: 60
        });
    }, 20);
    
    // Give starter items
    player.getComponent('inventory').container.addItem('minecraft:diamond_sword');
    player.getComponent('inventory').container.addItem('minecraft:cooked_beef', 10);
});

// Chat command example
world.beforeEvents.chatSend.subscribe((event) => {
    const { message, sender } = event;
    
    if (message.startsWith('!tp')) {
        const target = message.split(' ')[1];
        const targetPlayer = [...world.getPlayers()].find(p => p.name === target);
        
        if (targetPlayer) {
            sender.teleport(targetPlayer.location);
            event.cancel = true;
        }
    }
});`,

    'server-ui': `// @minecraft/server-ui example (v1.2.0)
import { ActionForm, MessageForm, ModalForm } from '@minecraft/server-ui';
import { world } from '@minecraft/server';

/**
 * Shows an interactive form to the player
 * @param {import('@minecraft/server').Player} player 
 */
async function showForms(player) {
    // Simple message form
    const messageForm = new MessageForm()
        .title("Aviso Importante")
        .body("¡Bienvenido al servidor!\\n\\nPor favor acepta las reglas para continuar.")
        .button1("Aceptar")
        .button2("Cancelar");
    
    const messageResponse = await messageForm.show(player);
    
    if (messageResponse.selection === 0) {
        // Action form after acceptance
        const actionForm = new ActionForm()
            .title("Menú Principal")
            .body("Selecciona una opción:")
            .button("Teleport al Spawn", "textures/items/ender_pearl")
            .button("Kit de Inicio", "textures/items/chest")
            .button("Tienda", "textures/items/emerald")
            .button("Información", "textures/items/book_normal");
        
        const actionResponse = await actionForm.show(player);
        
        switch (actionResponse.selection) {
            case 0:
                player.teleport(world.getDefaultSpawnLocation());
                break;
            case 1:
                giveStarterKit(player);
                break;
            // Handle other cases...
        }
    }
}

function giveStarterKit(player) {
    const inventory = player.getComponent('inventory').container;
    inventory.addItem('minecraft:diamond_pickaxe');
    inventory.addItem('minecraft:diamond_sword');
    inventory.addItem('minecraft:cooked_beef', 16);
    inventory.addItem('minecraft:torch', 32);
    player.sendMessage("¡Has recibido tu kit de inicio!");
}`,

    'server-gametest': `// @minecraft/server-gametest example (v1.0.0)
import * as gametest from '@minecraft/server-gametest';
import { MinecraftEntityTypes, MinecraftItemTypes } from '@minecraft/vanilla-data';

/**
 * Advanced GameTest example with multiple assertions
 * @param {import('@minecraft/server-gametest').Test} test 
 */
function advancedMobTest(test) {
    const spawnPos = { x: 0, y: 2, z: 0 };
    
    // Spawn different mobs
    const zombie = test.spawn(MinecraftEntityTypes.Zombie, spawnPos);
    const skeleton = test.spawn(MinecraftEntityTypes.Skeleton, { x: 2, y: 2, z: 0 });
    
    // Give items to mobs
    zombie.getComponent('equippable').setEquipment(
        MinecraftItemTypes.DiamondSword,
        'mainhand'
    );
    
    skeleton.getComponent('equippable').setEquipment(
        MinecraftItemTypes.Bow,
        'mainhand'
    );
    
    // Test assertions
    test.assert(zombie.isValid(), "Zombie debería ser válido");
    test.assert(skeleton.isValid(), "Skeleton debería ser válido");
    test.assert(zombie.typeId === "minecraft:zombie", "Debería ser un zombie");
    test.assert(skeleton.typeId === "minecraft:skeleton", "Debería ser un skeleton");
    
    // Succeed when mobs move and interact
    test.succeedWhen(() => {
        const zombiePos = zombie.location;
        const skeletonPos = skeleton.location;
        
        test.assert(
            zombiePos.x !== spawnPos.x || 
            zombiePos.y !== spawnPos.y || 
            zombiePos.z !== spawnPos.z,
            "El zombie debería moverse"
        );
        
        test.assert(
            skeletonPos.x !== 2 || 
            skeletonPos.y !== 2 || 
            skeletonPos.z !== 0,
            "El skeleton debería moverse"
        );
        
        // Check distance between mobs
        const dx = zombiePos.x - skeletonPos.x;
        const dz = zombiePos.z - skeletonPos.z;
        const distance = Math.sqrt(dx*dx + dz*dz);
        
        test.assert(
            distance < 3,
            "Los mobs deberían acercarse entre sí"
        );
    }, 200); // Timeout after 200 ticks
}

// Register test suites
gametest.register("AdvancedMobTests", "advancedMobTest", advancedMobTest)
    .maxTicks(300)
    .structureName("test:medium_room")
    .tag("suite:combat");`
};

// ===== FUNCIÓN PRINCIPAL MEJORADA =====
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    try {
        showStatusMessage('Inicializando editor...');
        registerServiceWorker();
        await configureMonaco();
        editor = createEditor();
        setupControls();
        setupPWA();
        setupStatusBar();
        setupAutoSave();
        adjustEditorHeightForMobilePWA();
        
        // Cargar estado persistente
        loadPersistentState();
        
        // Configurar eventos
        window.addEventListener('resize', adjustEditorHeightForMobilePWA);
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOnlineStatus);
        
        showStatusMessage('Editor listo');
        showToast('Editor cargado correctamente', false);
    } catch (error) {
        console.error('Error inicializando la app:', error);
        showError('Error al iniciar el editor', error);
        showStatusMessage('Falló la inicialización');
    }
}

function loadPersistentState() {
    // Cargar el último módulo usado
    const lastModule = localStorage.getItem(STORAGE_MODULE_KEY) || 'server';
    const moduleSelect = document.getElementById('module-select');
    if (moduleSelect) {
        moduleSelect.value = lastModule;
    }
    
    // Cargar la última versión usada
    const lastVersion = localStorage.getItem(STORAGE_VERSION_KEY) || 
                       (lastModule === 'server' ? '2.0.0' : 
                        lastModule === 'server-ui' ? '1.2.0' : '1.0.0');
    
    const versionInput = document.getElementById('version-input');
    if (versionInput) {
        versionInput.value = lastVersion;
    }
    
    // Cargar tipos iniciales
    setTimeout(() => {
        loadTypeDefinitions().catch(console.error);
    }, 500);
}

function handleOnlineStatus() {
    const isOnline = navigator.onLine;
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        if (isOnline) {
            statusBar.classList.remove('offline');
        } else {
            statusBar.classList.add('offline');
            showToast('Estás desconectado. Algunas funciones pueden no estar disponibles', true);
        }
    }
}

// ===== CONFIGURAR MONACO EDITOR =====
function configureMonaco() {
    return new Promise((resolve, reject) => {
        if (window.monaco && window.monaco.editor) {
            return resolve();
        }

        const loaderScript = document.createElement('script');
        loaderScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/loader.min.js';
        loaderScript.onload = () => {
            require.config({
                paths: { 
                    'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs'
                },
                waitSeconds: 30
            });

            window.MonacoEnvironment = {
                getWorkerUrl: function(moduleId, label) {
                    return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
                        self.MonacoEnvironment = {
                            baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/'
                        };
                        importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/base/worker/workerMain.js');
                    `)}`;
                }
            };

            require(['vs/editor/editor.main'], resolve, reject);
        };
        loaderScript.onerror = reject;
        document.head.appendChild(loaderScript);
    });
}

// ===== CREAR EL EDITOR =====function createEditor() {
    // Cargar contenido guardado o usar cadena vacía
    const initialContent = loadSavedState() || '';
    
    // Configuración del editor
    const editorInstance = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: initialContent,
        language: 'typescript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: {
            enabled: true,
            maxColumn: 100
        },
        fontSize: 14,
        lineHeight: 24,
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
        roundedSelection: true,
        autoIndent: 'full',
        tabSize: 2,
        insertSpaces: true,
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        formatOnPaste: true,
        formatOnType: true,
        wordWrap: 'on',
        wrappingIndent: 'indent',
        fontFamily: "'Courier New', monospace",
        scrollBeyondLastColumn: 5,
        quickSuggestions: {
            other: true,
            comments: false,
            strings: true
        },
        suggestOnTriggerCharacters: true,
        wordBasedSuggestions: true
    });

    // Manejo especial de teclado para asegurar que el backspace funcione
    editorInstance.onKeyDown((e) => {
        const allowedKeys = [
            'Backspace', 'Delete', 
            'ArrowLeft', 'ArrowRight', 
            'ArrowUp', 'ArrowDown',
            'Home', 'End',
            'PageUp', 'PageDown'
        ];
        
        if (allowedKeys.includes(e.code)) {
            e.stopPropagation();
        }
    });

    // Enfocar el editor después de un pequeño retraso
    setTimeout(() => {
        editorInstance.focus();
        
        // Mover cursor al final si hay contenido
        if (initialContent.length > 0) {
            const lineCount = editorInstance.getModel().getLineCount();
            const lastLine = editorInstance.getModel().getLineContent(lineCount);
            editorInstance.setPosition({
                lineNumber: lineCount,
                column: lastLine.length + 1
            });
        }
    }, 300);

    return editorInstance;
}

// ===== CARGA DE TIPOS MEJORADA =====
async function loadTypeDefinitions() {
    if (isLoadingTypes) {
        showToast('Ya se están cargando tipos...', false);
        return false;
    }

    try {
        isLoadingTypes = true;
        showStatusMessage('Cargando definiciones de API...');
        
        const moduleSelect = document.getElementById('module-select');
        const versionInput = document.getElementById('version-input');
        
        if (!moduleSelect || !versionInput) {
            throw new Error('Elementos del formulario no encontrados');
        }
        
        const module = moduleSelect.value;
        const version = versionInput.value.trim();
        
        // Validar versión
        if (!/^\d+\.\d+\.\d+$/.test(version)) {
            throw new Error('Formato de versión inválido. Use X.X.X');
        }

        // Guardar estado actual
        localStorage.setItem(STORAGE_MODULE_KEY, module);
        localStorage.setItem(STORAGE_VERSION_KEY, version);

        // Actualizar UI
        const loadBtn = document.getElementById('load-types-btn');
        if (loadBtn) {
            loadBtn.disabled = true;
            loadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...';
        }

        // Determinar qué módulos cargar basado en la selección
        const modulesToLoad = getModulesToLoad(module);
        
        // Cargar todos los tipos en paralelo
        const typeDefinitions = await Promise.all(
            modulesToLoad.map(mod => 
                fetchTypeDefinition(mod, version)
                    .catch(e => {
                        console.warn(`No se pudo cargar ${mod}@${version}:`, e.message);
                        return null;
                    })
            )
        );

        // Configurar Monaco con los tipos cargados
        configureTypeScriptDefaults();
        
        // Limpiar y agregar nuevas definiciones
        monaco.languages.typescript.typescriptDefaults.setExtraLibs([]);
        
        typeDefinitions.forEach((content, index) => {
            if (content) {
                const libPath = `file:///node_modules/${modulesToLoad[index]}/index.d.ts`;
                monaco.languages.typescript.typescriptDefaults.addExtraLib(
                    content,
                    libPath
                );
            }
        });

        // Actualizar UI
        if (loadBtn) {
            loadBtn.innerHTML = '<i class="fas fa-check"></i> Tipos Cargados';
            setTimeout(() => {
                loadBtn.innerHTML = '<i class="fas fa-code"></i> Cargar Tipos';
                loadBtn.disabled = false;
            }, 2000);
        }
        
        showStatusMessage(`API ${module}@${version} cargada`);
        showToast(`Tipos para ${module}@${version} cargados`, false);
        return true;
    } catch (error) {
        console.error("Error cargando tipos de API:", error);
        const loadBtn = document.getElementById('load-types-btn');
        if (loadBtn) {
            loadBtn.innerHTML = '<i class="fas fa-times"></i> Error';
            setTimeout(() => {
                loadBtn.innerHTML = '<i class="fas fa-code"></i> Cargar Tipos';
                loadBtn.disabled = false;
            }, 2000);
        }
        
        showToast(`Error: ${error.message}`, true);
        showStatusMessage('Error cargando API');
        return false;
    } finally {
        isLoadingTypes = false;
    }
}

function getModulesToLoad(selectedModule) {
    const baseModules = [
        '@minecraft/server',
        '@minecraft/server-ui',
        '@minecraft/server-gametest',
        '@minecraft/vanilla-data'
    ];
    
    // Cargar módulos relacionados según selección
    switch (selectedModule) {
        case 'server':
            return [baseModules[0], baseModules[3]]; // server + vanilla-data
        case 'server-ui':
            return [baseModules[1]]; // solo server-ui
        case 'server-gametest':
            return [baseModules[2], baseModules[0], baseModules[3]]; // gametest + server + vanilla-data
        default:
            return baseModules; // todos los módulos
    }
}

function configureTypeScriptDefaults() {
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.CommonJS,
        strict: true,
        typeRoots: ["file:///node_modules/@types"],
        paths: {
            "@minecraft/*": ["file:///node_modules/@minecraft/*"]
        },
        jsx: monaco.languages.typescript.JsxEmit.Preserve,
        allowJs: true,
        checkJs: true,
        esModuleInterop: true
    });
}

// ===== FETCH MEJORADO CON CACHE Y RETRY =====
async function fetchTypeDefinition(module, version, retries = 2) {
    const cacheKey = `${module}@${version}`;
    
    try {
        // Verificar caché primero
        if (typeCache[cacheKey] && 
            typeCache[cacheKey].timestamp > Date.now() - TYPE_CACHE_EXPIRY) {
            console.debug(`Usando caché para ${cacheKey}`);
            return typeCache[cacheKey].content;
        }

        const url = `https://cdn.jsdelivr.net/npm/${module}@${version}/index.d.ts`;
        
        // Fetch con timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
            signal: controller.signal,
            cache: 'force-cache'
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} al cargar ${url}`);
        }

        let content = await response.text();
        
        // Normalizar rutas de importación
        content = content.replace(
            /from\s+['"]@minecraft\/(server|server-ui|server-gametest|vanilla-data)['"]/g,
            `from '@minecraft/$1'`
        );
        
        // Guardar en caché
        typeCache[cacheKey] = {
            content,
            timestamp: Date.now()
        };
        
        return content;
    } catch (error) {
        console.error(`Error cargando ${cacheKey}:`, error);
        
        if (retries > 0) {
            console.log(`Reintentando (${retries} intentos restantes)...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retries)));
            return fetchTypeDefinition(module, version, retries - 1);
        }
        
        throw error;
    }
}

// ===== MANEJO DE PWA =====
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => {
                console.log('Service Worker registrado:', reg.scope);
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showToast('Nueva versión disponible. Recarga para actualizar.', false, 5000);
                        }
                    });
                });
            })
            .catch(err => console.error('Fallo en registro Service Worker:', err));
    }
}

function setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        updateInstallButton();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        updateInstallButton();
        showToast('App instalada correctamente', false, 3000);
    });

    // Verificar si la app ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
        updateInstallButton();
    }
}

function updateInstallButton() {
    const installBtn = document.getElementById('install-btn');
    if (!installBtn) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isStandalone) {
        installBtn.innerHTML = '<i class="fas fa-check-circle"></i> Instalada';
        installBtn.classList.add('installed');
        installBtn.disabled = true;
    } else if (deferredPrompt) {
        installBtn.innerHTML = '<i class="fas fa-download"></i> Instalar App';
        installBtn.classList.add('available');
        installBtn.disabled = false;
    } else {
        installBtn.innerHTML = '<i class="fas fa-download"></i> Instalar';
        installBtn.classList.remove('available', 'installed');
        installBtn.disabled = true;
    }
}

// ===== MANEJO DE CONTROLES =====
function setupControls() {
    // Botón de minimizar toolbar
    const minBtn = document.getElementById('min-btn');
    if (minBtn) minBtn.addEventListener('click', minToolbar);

    // Selector de módulo
    const moduleSelect = document.getElementById('module-select');
    if (moduleSelect) {
        moduleSelect.addEventListener('change', handleModuleChange);
    }

    // Botón de cargar tipos
    const loadTypesBtn = document.getElementById('load-types-btn');
    if (loadTypesBtn) {
        loadTypesBtn.addEventListener('click', loadTypeDefinitions);
    }

    // Botón de copiar
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) copyBtn.addEventListener('click', copyScript);

    // Botón de reset
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetEditor);

    // Input de nombre de archivo
    const filenameInput = document.getElementById('filename-input');
    if (filenameInput) {
        filenameInput.addEventListener('change', saveEditorState);
    }

    // Botón de descarga
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadCode);

    // Botón de instalar
    const installBtn = document.getElementById('install-btn');
    if (installBtn) installBtn.addEventListener('click', installApp);

    // Botón de ejecutar
    const runBtn = document.getElementById('run-btn');
    if (runBtn) runBtn.addEventListener('click', executeAction);
}

function handleModuleChange() {
    const moduleSelect = document.getElementById('module-select');
    const module = moduleSelect.value;
    
    if (!editor.getValue() || confirm('¿Cargar ejemplo para este módulo? Esto reemplazará tu código actual.')) {
        editor.setValue(EXAMPLES[module] || '');
        editor.focus();
    }
    
    // Actualizar versión por defecto según módulo
    const versionInput = document.getElementById('version-input');
    if (versionInput) {
        versionInput.value = module === 'server' ? '2.0.0' : 
                           module === 'server-ui' ? '1.2.0' : '1.0.0';
    }
}

// ===== FUNCIONES DEL EDITOR =====
function loadSavedState() {
    try {
        const savedContent = localStorage.getItem(STORAGE_KEY);
        const savedFilename = localStorage.getItem(STORAGE_FILENAME_KEY);

        if (savedFilename && document.getElementById('filename-input')) {
            document.getElementById('filename-input').value = savedFilename;
        }

        return savedContent || '';
    } catch (error) {
        console.error('Error cargando estado:', error);
        return '';
    }
}

function saveEditorState() {
    try {
        if (!editor) return;
        
        const content = editor.getValue();
        const filenameInput = document.getElementById('filename-input');
        const filename = filenameInput ? filenameInput.value.trim() || 'main' : 'main';

        localStorage.setItem(STORAGE_KEY, content);
        localStorage.setItem(STORAGE_FILENAME_KEY, filename);

        console.debug('Estado guardado');
        flashSaveIndicator();
    } catch (error) {
        console.error('Error guardando:', error);
        showToast('Error guardando tu trabajo', true);
    }
}

function flashSaveIndicator() {
    const indicator = document.getElementById('save-status');
    if (indicator) {
        indicator.style.display = 'block';
        indicator.innerHTML = '<i class="fas fa-save"></i> Guardado';
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 2000);
    }
}

// ===== FUNCIONES DE ACCIÓN =====
async function copyScript() {
    try {
        if (!editor) throw new Error('Editor no disponible');
        
        const text = editor.getValue();
        if (!text.trim()) {
            showToast('Editor vacío, nada que copiar', true);
            return;
        }

        await navigator.clipboard.writeText(text);
        showToast('Código copiado al portapapeles', false);
    } catch (err) {
        console.error('Error copiando:', err);
        
        // Fallback para navegadores antiguos
        const textArea = document.createElement('textarea');
        textArea.value = editor.getValue();
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            showToast('Código copiado (método alternativo)', false);
        } catch (err2) {
            console.error('Falló el método alternativo:', err2);
            showToast('No se pudo copiar', true);
        } finally {
            document.body.removeChild(textArea);
        }
    }
}

function downloadCode() {
    try {
        if (!editor || typeof editor.getValue !== 'function') {
            throw new Error('Editor no disponible');
        }

        const codeContent = editor.getValue();
        if (!codeContent.trim()) {
            showToast('Editor vacío, nada que descargar', true);
            return;
        }

        const fileNameInput = document.getElementById('filename-input');
        let fileName = fileNameInput ? fileNameInput.value.trim() : 'script';

        // Sanitizar nombre de archivo
        fileName = fileName
            .replace(/[^a-z0-9\-_]/gi, '_')
            .replace(/^_+|_+$/g, '')
            .replace(/_+/g, '_')
            .toLowerCase()
            .substring(0, 50) || 'script';

        // Crear blob con BOM para UTF-8
        const blob = new Blob(["\uFEFF" + codeContent], { 
            type: 'text/javascript;charset=utf-8' 
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.js`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        // Limpiar
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        showToast(`Descargado: ${fileName}.js`, false);
    } catch (error) {
        console.error('Error en descarga:', error);
        showToast('Error al descargar: ' + error.message, true);
    }
}
function resetEditor() {
    if (!editor) return;
    
    if (confirm('Are you sure you want to reset the editor? All unsaved changes will be lost.')) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_FILENAME_KEY);
        editor.setValue('');
        if (document.getElementById('filename-input')) {
            document.getElementById('filename-input').value = 'main';
        }
        showToast('Editor reset. Starting with a clean file.');
    }
}

function installApp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(choice => {
            if (choice.outcome === 'accepted') {
                showToast('Instalación en progreso...', false, 3000);
            }
            deferredPrompt = null;
            updateInstallButton();
        });
    } else {
        showToast('La app ya está instalada o no se puede instalar', true);
    }
}

function executeAction() {
    try {
        const messages = [
            "Esta función estará disponible pronto",
            "Trabajando en características de ejecución",
            "La ejecución de scripts llegará en una actualización futura"
        ];
        const emojis = ["⌛", "⏳", "🚧", "👷", "🔜"];
        
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        
        showToast(`${randomEmoji} ${randomMessage}`, false, 5000);
    } catch(error) {
        console.error('Error ejecutando acción:', error);
        showToast('Error al ejecutar: ' + error.message, true, 5000);
    }
}

// ===== FUNCIONES DE UI =====
function minToolbar() {
    const header = document.getElementById('header');
    const toolbar = document.getElementById('toolbar');
    const minBtn = document.getElementById('min-btn');

    if (!header || !toolbar || !minBtn) return;

    if (header.classList.contains('min-toolbar')) {
        header.classList.remove('min-toolbar');
        toolbar.style.display = 'flex';
        minBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Ocultar Toolbar';
    } else {
        header.classList.add('min-toolbar');
        toolbar.style.display = 'none';
        minBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Mostrar Toolbar';
    }
}

function adjustEditorHeightForMobilePWA() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const app = document.getElementById('app');
    if (!app) return;

    if (isStandalone && isMobile) {
        const vh = window.innerHeight * 0.01;
        app.style.height = `${vh * 100}px`;
        app.style.marginTop = '0';
    } else {
        app.style.height = '93vh';
        app.style.marginTop = '50px'; // Para el botón de minimizar
    }
}

// ===== MANEJO DE MENSAJES =====
function showToast(message, isError = false, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.innerHTML = message;
    toast.style.backgroundColor = isError ? 'rgba(255, 59, 48, 0.9)' : 'rgba(0, 0, 0, 0.9)';
    toast.style.display = 'block';
    toast.style.opacity = '1';

    clearTimeout(toast.timeoutId);
    toast.timeoutId = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, duration);
}

function showStatusMessage(message) {
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        statusBar.textContent = message;
    }
}

function showError(message, error) {
    console.error(message, error);
    showToast(`${message}: ${error.message}`, true);
}

// ===== CONFIGURACIÓN DE AUTO-GUARDADO =====
function setupAutoSave() {
    if (!editor) return;
    
    showStatusMessage('Configurando auto-guardado...');
    
    editor.onDidChangeModelContent(() => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(saveEditorState, SAVE_DEBOUNCE_TIME);
    });

    setInterval(saveEditorState, AUTO_SAVE_INTERVAL);
    window.addEventListener('beforeunload', saveEditorState);
    showStatusMessage('Auto-guardado activo');
}

// ===== SETUP BARRA DE ESTADO =====
function setupStatusBar() {
    if (!editor) return;
    const statusBar = document.getElementById('status-bar');
    if (!statusBar) return;

    editor.onDidChangeModelContent(() => updateStatusBar());
    editor.onDidChangeCursorPosition(updateStatusBar);
    updateStatusBar();
}

function updateStatusBar() {
    if (!editor) return;
    const statusBar = document.getElementById('status-bar');
    if (!statusBar) return;

    const position = editor.getPosition();
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isOnline = navigator.onLine;

    let statusText = `Ln ${position.lineNumber}, Col ${position.column} | `;
    statusText += isStandalone ? 'App' : 'Web';
    statusText += isMobile ? ' Mobile' : ' Desktop';
    statusText += isOnline ? ' | Online' : ' | Offline';
    statusText += ` | v${APP_VERSION}`;

    statusBar.textContent = statusText;
    
    if (!isOnline) {
        statusBar.classList.add('offline');
    } else {
        statusBar.classList.remove('offline');
    }
}

// Inicializar el editor cuando se cargue el DOM
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initializeApp, 1);
} else {
    document.addEventListener('DOMContentLoaded', initializeApp);
}