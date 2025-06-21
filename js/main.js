// main.js
// ===== CONFIGURACIÓN GLOBAL =====
const APP_VERSION = '1.2.1';
const STORAGE_KEY = 'mcbe_editor_content';
const STORAGE_FILENAME_KEY = 'mcbe_editor_filename';
const SAVE_DEBOUNCE_TIME = 1000; // 1 segundo
const AUTO_SAVE_INTERVAL = 30000; // 30 segundos

let editor;
let deferredPrompt;
let saveTimeout;

// Ejemplos de código
const EXAMPLES = {
    server: `// @minecraft/server example
import { world, system } from '@minecraft/server';

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    player.sendMessage("隆Bienvenido al mundo!");
    
    system.runInterval(() => {
        player.onScreenDisplay.setTitle("隆Hola Minecraft!");
    }, 20);
});`,

    'server-ui': `// @minecraft/server-ui example
import { ActionForm } from '@minecraft/server-ui';

async function showForm(player) {
    const form = new ActionForm()
        .title("Menú de Acción")
        .body("Selecciona una opción:")
        .button("Opción 1")
        .button("Opción 2");
    
    const response = await form.show(player);
    if (response.selection === 0) {
        player.sendMessage("Seleccionaste el botón 1");
    }
}`,

    'server-gametest': `// @minecraft/server-gametest example
import * as gametest from '@minecraft/server-gametest';

function simpleTest(test) {
    const player = test.spawnSimulatedPlayer({ x: 0, y: 1, z: 0 });
    test.assert(player.isValid(), "El jugador debería ser válido");
    
    test.succeedWhen(() => {
        const block = test.getBlock({ x: 0, y: 0, z: 0 });
        test.assert(block.typeId === "minecraft:stone", "Debería haber piedra en (0,0,0)");
    });
}

gametest.register("TestSuite", "simpleTest", simpleTest)
    .maxTicks(100)
    .structureName("test:structure");`
};

// Prefijos y mensajes para notificaciones
const PREFIX = {
    soon: ["馃懆鈥嶐煉� ", "馃殌 ", "馃敡 ", "鈴� "],
    error: ["鈿狅笍 ", "鉂� ", "馃挜 ", "馃敶 "],
    success: ["鉁� ", "馃憤 ", "鉁� ", "馃殌 "]
};

const MESSAGES = {
    soon: [
        "Executing Function Soon",
        "This function is coming soon",
        "We are working on this function...",
        "This is not ready yet",
        "Please wait for this function",
        "This button isn't working yet",
        "Sorry for this, we still working on this function"
    ],
    error: [
        "Oops, something went wrong",
        "Hmmm, there's an error",
        "Hey, this failed",
        "Oh sh*t, a problem",
        "Nuh uh, this failed",
        "PANIC, PANIC, HERE'S AN ERROR"
    ],
    success: [
        "Success! Content saved",
        "Your work is safe with us",
        "Progress saved automatically",
        "Changes stored successfully"
    ]
};

// ===== FUNCIONES PRINCIPALES =====
document.addEventListener('DOMContentLoaded', initializeApp);

// Inicializa la aplicación y editor
async function initializeApp() {
    try {
        showStatusMessage('Initializing editor...');
        
        // Registrar Service Worker
        registerServiceWorker();

        // Configurar Monaco Editor
        await configureMonaco();

        // Crear editor con contenido guardado o vacío
        editor = createEditor();

        // Configurar PWA
        setupPWA();

        // Configurar controles UI
        setupControls();
        
        // Configurar barra de estado
        setupStatusBar();
        
        // Configurar guardado automático
        setupAutoSave();
        
        // Ajustar altura para móvil
        adjustEditorHeightForMobilePWA();
        window.addEventListener('resize', adjustEditorHeightForMobilePWA);

        showToast(getRandomMessage('success'), false);
        showStatusMessage('Editor ready');
    } catch (error) {
        console.error('Error initializing app:', error);
        showError('Error al iniciar el editor', error);
        showStatusMessage('Initialization failed');
    }
}

// ===== CONFIGURACIÓN DE MONACO =====
function configureMonaco() {
    return new Promise((resolve) => {
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

        require(['vs/editor/editor.main'], resolve);
    });
}

// Crea el editor Monaco en el contenedor y carga contenido guardado
function createEditor() {
    const initialContent = loadSavedState();
    
    const editorInstance = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: initialContent,
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 14,
        lineHeight: 24,
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection'
    });

    setTimeout(() => editorInstance.focus(), 300);
    return editorInstance;
}

// ===== CARGA DINÁMICA DE TIPOS =====

// Handler botón Cargar tipos
document.getElementById('load-types-btn').addEventListener('click', async () => {
    const moduleSelect = document.getElementById('module-select');
    const versionInput = document.getElementById('version-input');

    if (!moduleSelect || !versionInput) {
        showToast('Control de versión o módulo no encontrados', true);
        return;
    }

    const moduleName = moduleSelect.value; // ej: "@minecraft/server"
    const version = versionInput.value.trim();

    if (!version.match(/^\d+\.\d+\.\d+$/)) {
        showToast('Versión inválida. Usa formato x.y.z (ejemplo: 2.0.0)', true);
        return;
    }

    showStatusMessage(`Cargando tipos para ${moduleName}@${version}...`);

    try {
        await loadTypeDefinitions(moduleName, version);
        showToast(`Tipos para ${moduleName}@${version} cargados`, false);
        showStatusMessage(`Tipos cargados para ${moduleName}@${version}`);
    } catch (error) {
        console.error('Error cargando tipos:', error);
        showToast(`Error cargando tipos: ${error.message}`, true);
        showStatusMessage('Error al cargar tipos');
    }
});

// Función que carga el .d.ts desde CDN y agrega al Monaco
async function loadTypeDefinitions(moduleName, version) {
    if (!moduleName || !version) throw new Error('Módulo o versión no definidos');

    // Normalizar nombre para la URL (sin @)
    const baseName = moduleName.replace(/^@/, '').replace(/\//g, '/');

    // URL para el d.ts
    const url = `https://cdn.jsdelivr.net/npm/${baseName}@${version}/index.d.ts`;

    // Fetch de la definición
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error HTTP ${response.status}`);

    const content = await response.text();

    // Limpiar libs previas del módulo para no acumular libs viejas
    // NOTA: Monaco no tiene método oficial para remover libs, esto es un workaround:
    // Se crea un nuevo objeto libs vacío.
    monaco.languages.typescript.typescriptDefaults.getExtraLibs = () => ({});

    // Registrar la librería extra
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
        content,
        `file:///node_modules/${baseName}/index.d.ts`
    );

    // Cambiar el lenguaje a typescript para activar autocompletado con los nuevos tipos
    if (editor) {
        monaco.editor.setModelLanguage(editor.getModel(), 'typescript');
    }
}

// ===== FUNCIONES DE PERSISTENCIA =====
function setupAutoSave() {
    if (!editor) return;
    
    showStatusMessage('Setting up auto-save...');
    
    editor.onDidChangeModelContent(() => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveEditorState();
        }, SAVE_DEBOUNCE_TIME);
    });
    
    setInterval(saveEditorState, AUTO_SAVE_INTERVAL);
    window.addEventListener('beforeunload', saveEditorState);
    showStatusMessage('Auto-save configured');
}

function saveEditorState() {
    try {
        if (!editor) return;
        
        const content = editor.getValue();
        const filenameInput = document.getElementById('filename-input');
        const filename = filenameInput ? filenameInput.value || 'main' : 'main';
        
        localStorage.setItem(STORAGE_KEY, content);
        localStorage.setItem(STORAGE_FILENAME_KEY, filename);
        
        console.debug('Editor state saved');
        flashSaveIndicator();
    } catch (error) {
        console.error('Error saving editor state:', error);
        showToast('Error saving your work', true);
    }
}

function loadSavedState() {
    try {
        const savedContent = localStorage.getItem(STORAGE_KEY);
        const savedFilename = localStorage.getItem(STORAGE_FILENAME_KEY);
        
        if (savedFilename && document.getElementById('filename-input')) {
            document.getElementById('filename-input').value = savedFilename;
        }
        return savedContent || EXAMPLES.server;
    } catch {
        return EXAMPLES.server;
    }
}

// ===== FUNCIONES DE UI =====

// Muestra mensaje en barra de estado
function showStatusMessage(msg) {
    const statusBar = document.getElementById('status-bar');
    if (!statusBar) return;
    statusBar.textContent = msg;
}

// Muestra toast con mensaje, error o no
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.style.display = 'block';
    toast.style.background = isError ? 'rgba(204, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.7)';
    toast.textContent = msg;
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Muestra error en consola y toast
function showError(msg, error) {
    console.error(msg, error);
    showToast(msg + ': ' + (error?.message || ''), true);
}

// Flash visual para guardar
function flashSaveIndicator() {
    const saveStatus = document.getElementById('save-status');
    if (!saveStatus) return;
    saveStatus.style.display = 'block';
    setTimeout(() => {
        saveStatus.style.display = 'none';
    }, 1200);
}

// Setup botones y eventos UI
function setupControls() {
    // Handler botón copiar contenido
    document.getElementById('copy-btn').addEventListener('click', () => {
        if (!editor) return;
        navigator.clipboard.writeText(editor.getValue()).then(() => {
            showToast('Código copiado al portapapeles');
        });
    });

    // Handler botón descargar archivo
    document.getElementById('download-btn').addEventListener('click', () => {
        if (!editor) return;
        const filenameInput = document.getElementById('filename-input');
        let filename = filenameInput ? filenameInput.value.trim() : 'main';
        if (!filename.endsWith('.js')) filename += '.js';

        const blob = new Blob([editor.getValue()], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Archivo "${filename}" descargado`);
    });

    // Handler botón reset editor
    document.getElementById('reset-btn').addEventListener('click', () => {
        if (!editor) return;
        if (confirm('¿Seguro que quieres resetear el editor? Se perderán los cambios no guardados.')) {
            editor.setValue(EXAMPLES.server);
            saveEditorState();
            showToast('Editor reseteado');
        }
    });

    // Handler botón instalar (placeholder)
    document.getElementById('install-btn').addEventListener('click', () => {
        showToast('Función de instalación próximamente', true);
    });

    // Handler botón ejecutar (placeholder)
    document.getElementById('run-btn').addEventListener('click', () => {
        showToast(getRandomMessage('soon'), true);
    });

    // Handler botón minimizar toolbar
    document.getElementById('min-btn').addEventListener('click', () => {
        minToolbar();
    });
}

// Minimizar / restaurar toolbar
function minToolbar() {
    const header = document.getElementById('header');
    if (!header) return;
    header.classList.toggle('min-toolbar');
}

// Setup barra de estado
function setupStatusBar() {
    // Aquí podrías agregar info adicional, como líneas, columnas, errores, etc.
}

// Ajusta el editor para móvil PWA
function adjustEditorHeightForMobilePWA() {
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        const app = document.getElementById('app');
        if (app) {
            app.style.height = `calc(var(--vh, 1vh) * 93)`;
        }
    }
}

// Registra Service Worker PWA
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registrado'))
        .catch(console.error);
    }
}

// Setup PWA para prompt instalación
function setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtn = document.getElementById('install-btn');
        if (installBtn) {
            installBtn.style.display = 'inline-block';
            installBtn.classList.add('available');
            installBtn.addEventListener('click', async () => {
                installBtn.disabled = true;
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    showToast('App instalada', false);
                    installBtn.style.display = 'none';
                }
                deferredPrompt = null;
                installBtn.disabled = false;
            });
        }
    });
}

// Obtiene mensaje aleatorio según tipo
function getRandomMessage(type) {
    const arr = MESSAGES[type];
    if (!arr || arr.length === 0) return '';
    return PREFIX[type][Math.floor(Math.random() * PREFIX[type].length)] + arr[Math.floor(Math.random() * arr.length)];
}

// Ejecutar función placeholder
function executeAction() {
    showToast(getRandomMessage('soon'), true);
}