// ===== CONFIGURACIÓN GLOBAL =====
const APP_VERSION = '1.2.1';
const STORAGE_KEY = 'mcbe_editor_content';
const STORAGE_FILENAME_KEY = 'mcbe_editor_filename';
const SAVE_DEBOUNCE_TIME = 1000; // 1 segundo
const AUTO_SAVE_INTERVAL = 30000; // 30 segundos

let editor;
let deferredPrompt;
let saveTimeout;

// ===== EJEMPLOS DE CÓDIGO =====
const EXAMPLES = {
    server: `// @minecraft/server example
import { world, system } from '@minecraft/server';

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    player.sendMessage("¡Bienvenido al mundo!");
    
    system.runInterval(() => {
        player.onScreenDisplay.setTitle("¡Hola Minecraft!");
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

// ===== PREFIJOS Y MENSAJES PARA TOAST =====
const PREFIX = {
    soon: ["⌛ ", "⏳ ", "⏰ "],
    error: ["❌ ", "⚠️ ", "🚫 "],
    success: ["✅ ", "🎉 ", "✔️ "]
};

const MESSAGES = {
    soon: [
        "Función en desarrollo...",
        "Esta función llegará pronto",
        "Estamos trabajando en ello"
    ],
    error: [
        "Algo salió mal",
        "Error detectado",
        "No se pudo completar la acción"
    ],
    success: [
        "¡Éxito! Cambios guardados",
        "Tu progreso está seguro",
        "Guardado automático completo"
    ]
};

// ===== FUNCION PRINCIPAL =====
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    try {
        showStatusMessage('Inicializando editor...');
        registerServiceWorker();
        await configureMonaco();
        editor = createEditor();
        await loadTypeDefinitions();
        setupPWA();
        setupControls();
        setupStatusBar();
        setupAutoSave();
        adjustEditorHeightForMobilePWA();
        window.addEventListener('resize', adjustEditorHeightForMobilePWA);
        showToast(getRandomMessage('success'), false);
        showStatusMessage('Editor listo');
    } catch (error) {
        console.error('Error inicializando la app:', error);
        showError('Error al iniciar el editor', error);
        showStatusMessage('Falló la inicialización');
    }
}

// ===== CONFIGURAR MONACO EDITOR =====
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

// ===== CREAR EL EDITOR =====
function createEditor() {
    const initialContent = loadSavedState();
    
    const editorInstance = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: initialContent,
        language: 'typescript',
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

// ===== CARGA DE DEFINICIONES DE TIPOS =====
async function loadTypeDefinitions() {
    try {
        showStatusMessage('Cargando definiciones de API...');
        
        const module = document.getElementById('module-select')?.value || 'server';
        const version = document.getElementById('version-input')?.value.trim() || '2.0.0';

        // URLs dinámicas para tipos
        const urls = {
            'server': `https://cdn.jsdelivr.net/npm/@minecraft/server@${version}/index.d.ts`,
            'server-ui': `https://cdn.jsdelivr.net/npm/@minecraft/server-ui@${version}/index.d.ts`,
            'server-gametest': `https://cdn.jsdelivr.net/npm/@minecraft/server-gametest@${version}/index.d.ts`
        };

        const promises = Object.entries(urls).map(async ([key, url]) => {
            const text = await fetchTypeDefinition(url);
            return { key, text, url };
        });

        const libs = await Promise.all(promises);

        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2020,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            strict: true
        });

        // Limpiar libs previas para evitar duplicados
        monaco.languages.typescript.typescriptDefaults.extraLibs = [];

        // Agregar libs al editor
        libs.forEach(lib => {
            monaco.languages.typescript.typescriptDefaults.addExtraLib(
                lib.text,
                lib.url
            );
        });

        monaco.editor.setModelLanguage(editor.getModel(), 'typescript');
        showStatusMessage('Definiciones API cargadas');
        return true;
    } catch (error) {
        console.error("Error cargando tipos de API:", error);
        showToast(getRandomMessage('error'), true);
        showStatusMessage('Error cargando definiciones API');
        return false;
    }
}

// ===== FETCH DEFINICIÓN DE TIPOS =====
async function fetchTypeDefinition(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} al cargar ${url}`);
        return await response.text();
    } catch (error) {
        console.error(`Error cargando ${url}:`, error);
        throw error;
    }
}

// ===== CONFIGURACIÓN PWA =====
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registrado:', reg.scope))
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
        showToast('App instalada correctamente');
    });

    updateInstallButton();
}

function updateInstallButton() {
    const installBtn = document.getElementById('install-btn');
    if (!installBtn) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (isStandalone) {
        installBtn.classList.add('installed');
        installBtn.textContent = "✔ Installed";
        installBtn.disabled = true;
    } else if (deferredPrompt) {
        installBtn.classList.add('available');
        installBtn.textContent = "⬇ Install";
        installBtn.disabled = false;
    } else {
        installBtn.classList.remove('available', 'installed');
        installBtn.textContent = "Install";
        installBtn.disabled = true;
    }
}

// ===== SETUP CONTROLES =====
// Handler para botones, selects, inputs
function setupControls() {
    const moduleSelect = document.getElementById('module-select');
    const versionInput = document.getElementById('version-input');
    const loadTypesBtn = document.getElementById('load-types-btn');
    const copyBtn = document.getElementById('copy-btn');
    const resetBtn = document.getElementById('reset-btn');
    const filenameInput = document.getElementById('filename-input');
    const downloadBtn = document.getElementById('download-btn');
    const installBtn = document.getElementById('install-btn');

    if (moduleSelect) {
        moduleSelect.addEventListener('change', () => {
            if (!editor.getValue() || confirm('Cargar un ejemplo reemplazará tu código actual. ¿Continuar?')) {
                const module = moduleSelect.value;
                editor.setValue(EXAMPLES[module] || '');
                editor.focus();
            } else {
                moduleSelect.value = moduleSelect.dataset.lastValue || 'server';
            }
            moduleSelect.dataset.lastValue = moduleSelect.value;
        });
    }

    if (loadTypesBtn) {
        loadTypesBtn.addEventListener('click', loadTypeDefinitions);
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', copyScript);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetEditor);
    }

    if (filenameInput) {
        filenameInput.addEventListener('change', saveEditorState);
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadCode);
    }

    if (installBtn) {
        installBtn.addEventListener('click', installApp);
    }
}

// ===== SETUP BARRA DE ESTADO =====
// Maneja actualización y posición del cursor
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

    statusBar.textContent = `Ln ${position.lineNumber}, Col ${position.column} | ${isStandalone ? 'App' : 'Web'} ${isMobile ? '| Mobile' : '| Desktop'} | v${APP_VERSION}`;
}

// ===== GUARDADO AUTOMÁTICO =====
// Detecta cambios y guarda con debounce + cada intervalo
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

// ===== GUARDAR ESTADO =====
function saveEditorState() {
    try {
        if (!editor) return;
        const content = editor.getValue();
        const filenameInput = document.getElementById('filename-input');
        const filename = filenameInput ? filenameInput.value || 'main' : 'main';

        localStorage.setItem(STORAGE_KEY, content);
        localStorage.setItem(STORAGE_FILENAME_KEY, filename);

        console.debug('Estado guardado');
        flashSaveIndicator();
    } catch (error) {
        console.error('Error guardando:', error);
        showToast('Error guardando tu trabajo', true);
    }
}

// ===== CARGAR ESTADO =====
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

// ===== INDICADOR DE GUARDADO =====
function flashSaveIndicator() {
    const indicator = document.getElementById('save-status');
    if (indicator) {
        indicator.style.display = 'block';
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 2000);
    }
}

// ===== COPIAR AL PORTAPAPELES =====
async function copyScript() {
    try {
        await navigator.clipboard.writeText(editor.getValue());
        showToast('Código copiado al portapapeles');
    } catch (err) {
        console.error('Error copiando:', err);
        showToast('No se pudo copiar', true);
    }
}

// ===== DESCARGAR CÓDIGO =====
function downloadCode() {
    try {
        if (!editor || typeof editor.getValue !== 'function') throw new Error('Editor no disponible');

        const codeContent = editor.getValue();

        if (!codeContent.trim()) {
            showToast('Editor vacío', true);
            return;
        }

        const fileNameInput = document.getElementById('filename-input');
        let fileName = fileNameInput ? fileNameInput.value.trim() : 'script';

        fileName = fileName
            .replace(/[^a-z0-9\-_]/gi, '_')
            .replace(/^_+|_+$/g, '')
            .replace(/_+/g, '_')
            .toLowerCase()
            .substring(0, 50) || 'script';

        const blob = new Blob([codeContent], { type: 'application/javascript;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.js`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        showToast(`Descargado: ${fileName}.js`);
    } catch (error) {
        console.error('Error en descarga:', error);
        showToast('Error al descargar', true);
    }
}

// ===== REINICIAR EDITOR =====
function resetEditor() {
    if (!editor) return;

    if (confirm('¿Seguro que quieres reiniciar el editor? Se perderán los cambios no guardados.')) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_FILENAME_KEY);
        editor.setValue('');
        if (document.getElementById('filename-input')) {
            document.getElementById('filename-input').value = 'main';
        }
        showToast('Editor reiniciado. Archivo limpio.');
    }
}

// ===== INSTALAR PWA =====
function installApp() {
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
}

// ===== EJECUTAR ACCIÓN (placeholder) =====
function executeAction() {
    try {
        const message = getRandomMessage('soon');
        showToast(message, false, 5000);
    } catch(error) {
        console.error('Error ejecutando acción:', error);
        showToast(getRandomMessage('error'), true, 5000);
    }
}

// ===== MINIMIZAR TOOLBAR =====
function minToolbar() {
    const header = document.getElementById('header');
    const toolbar = document.getElementById('toolbar');
    const minBtn = document.getElementById('min-btn');

    if (!header || !toolbar || !minBtn) return;

    if (header.classList.contains('min-toolbar')) {
        header.classList.remove('min-toolbar');
        toolbar.style.display = 'flex';
        minBtn.textContent = '🧩 Close Toolbar 🧩';
    } else {
        header.classList.add('min-toolbar');
        toolbar.style.display = 'none';
        minBtn.textContent = '🧩 Open Toolbar 🧩';
    }
}

// ===== AJUSTAR ALTURA PARA PWA MÓVIL =====
function adjustEditorHeightForMobilePWA() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const app = document.getElementById('app');
    if (!app) return;

    if (isStandalone && isMobile) {
        const vh = window.innerHeight * 0.01;
        app.style.height = `${vh * 100}px`;
    } else {
        app.style.height = '93vh';
    }
}

// ===== MENSAJES EN TOAST =====
function showToast(message, isError = false, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.style.backgroundColor = isError ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.7)';
    toast.style.display = 'block';

    clearTimeout(toast.timeoutId);
    toast.timeoutId = setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}

function getRandomMessage(type) {
    const list = MESSAGES[type] || [];
    const prefixList = PREFIX[type] || [''];
    if (list.length === 0) return '';

    const index = Math.floor(Math.random() * list.length);
    const prefix = prefixList[Math.floor(Math.random() * prefixList.length)];

    return prefix + list[index];
}

// ===== MENSAJES DE ESTADO =====
function showStatusMessage(message) {
    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        statusBar.textContent = message;
    }
}

function showError(message, error) {
    console.error(message, error);
    showToast(message, true);
}