// Configuración global de Monaco
require.config({ 
    paths: { 
        'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs'
    },
    waitSeconds: 30
});

window.MonacoEnvironment = {
    getWorkerUrl: function(workerId, label) {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
            self.MonacoEnvironment = {
                baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/'
            };
            importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/base/worker/workerMain.js');
        `)}`;
    }
};

// Variables globales
let deferredPrompt;
let editor;
let isInstalled = false;

// Elementos UI
const installBtn = document.getElementById('install-btn');
const installText = document.getElementById('install-text');
const installSpinner = document.getElementById('install-spinner');

// Ejemplos de código para cada módulo
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

// Función para cargar los tipos de definición
async function loadTypeDefinitions() {
    try {
        const [serverTypes, serverUiTypes, gameTestTypes] = await Promise.all([
            fetch('/types/@minecraft/server/index.d.ts').then(r => r.text()),
            fetch('/types/@minecraft/server-ui/index.d.ts').then(r => r.text()),
            fetch('/types/@minecraft/server-gametest/index.d.ts').then(r => r.text())
        ]);

        // Configurar los tipos en Monaco
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
            serverTypes,
            'file:///node_modules/@minecraft/server/index.d.ts'
        );
        
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
            serverUiTypes,
            'file:///node_modules/@minecraft/server-ui/index.d.ts'
        );
        
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
            gameTestTypes,
            'file:///node_modules/@minecraft/server-gametest/index.d.ts'
        );

        // Configuración del compilador TypeScript
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2020,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            typeRoots: ["file:///types"],
            baseUrl: "file:///",
            paths: {
                "@minecraft/server": ["node_modules/@minecraft/server"],
                "@minecraft/server-ui": ["node_modules/@minecraft/server-ui"],
                "@minecraft/server-gametest": ["node_modules/@minecraft/server-gametest"]
            },
            strict: true
        });

        return true;
    } catch (error) {
        console.error("Error cargando tipos:", error);
        showToast('Error loading API definitions', true);
        return false;
    }
}

// Función para mostrar notificación toast
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.backgroundColor = isError ? '#d32f2f' : '#007acc';
    toast.style.display = 'block';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Función para copiar el contenido del editor
async function copyScript() {
    try {
        const text = editor.getValue();
        await navigator.clipboard.writeText(text);
        showToast('Code copied to clipboard!');
    } catch (err) {
        console.error('Error al copiar:', err);
        showToast('Error copying code', true);
    }
}

// Función para actualizar la barra de estado
function updateStatusBar() {
    if (!editor) return;
    const statusBar = document.getElementById('status-bar');
    const lineCount = editor.getModel().getLineCount();
    const position = editor.getPosition();
    statusBar.textContent = `Line ${position.lineNumber}, Col ${position.column} | ${lineCount} lines | ${isInstalled ? 'PWA' : 'Web'}`;
}

// Función para crear/recrear el editor
function createEditor() {
    // Limpiar contenedor si ya existe un editor
    if (editor) {
        editor.dispose();
        document.getElementById('monaco-editor').innerHTML = '';
    }

    // Crear nuevo editor
    editor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: EXAMPLES.server,
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        readOnly: false,
        fontSize: 16,
        lineHeight: 24,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        roundedSelection: true,
        mouseWheelZoom: false
    });

    // Forzar foco y asegurar que no esté en modo solo lectura
    setTimeout(() => {
        editor.focus();
        editor.updateOptions({ readOnly: false });
        console.log("Editor creado. Modo solo lectura:", editor.getOption(monaco.editor.EditorOption.readOnly));
    }, 100);

    return editor;
}

// ==================== LÓGICA DE INSTALACIÓN PWA ====================

function refreshInstallButton() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInstalled = document.referrer.includes('android-app://') || isStandalone;
    
    if (isInstalled) {
        installBtn.style.display = 'none';
        return;
    }

    if (deferredPrompt) {
        installBtn.style.display = 'inline-block';
    } else {
        installBtn.style.display = 'none';
    }
}

function resetInstallButton() {
    installBtn.classList.remove('installing');
    installText.textContent = 'Install App';
    installSpinner.style.display = 'none';
}

// Evento para capturar la instalación PWA
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    refreshInstallButton();
    
    // Mostrar sugerencia después de 30s
    setTimeout(() => {
        if (deferredPrompt) {
            showToast('Install the app for better experience!');
        }
    }, 30000);
});

// Evento cuando la app ya está instalada
window.addEventListener('appinstalled', () => {
    isInstalled = true;
    deferredPrompt = null;
    installBtn.classList.add('installed');
    installText.textContent = 'Installed!';
    installSpinner.style.display = 'none';
    showToast('App installed successfully!');
    updateStatusBar();
    
    setTimeout(() => {
        installBtn.style.display = 'none';
    }, 3000);
});

// Manejador del clic en el botón de instalación
installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    // Estado "instalando"
    installBtn.classList.add('installing');
    installText.textContent = 'Installing...';
    installSpinner.style.display = 'inline';
    
    try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            installText.textContent = 'Installed!';
            showToast('Installation started...');
        } else {
            resetInstallButton();
            showToast('Installation canceled', true);
        }
    } catch (error) {
        console.error('Install error:', error);
        resetInstallButton();
        showToast('Installation failed', true);
    }
});

// ==================== INICIALIZACIÓN DE LA APLICACIÓN ====================

async function initializeApp() {
    try {
        // Registrar Service Worker para PWA
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/sw.js');
                console.log('Service Worker registrado');
            } catch (swError) {
                console.log('Service Worker registration failed:', swError);
            }
        }

        // Inicializar Monaco Editor
        await new Promise((resolve) => {
            require(['vs/editor/editor.main'], resolve);
        });

        // Crear editor inicial
        createEditor();

        // Cargar tipos y cambiar a TypeScript
        const typesLoaded = await loadTypeDefinitions();
        if (typesLoaded) {
            monaco.editor.setModelLanguage(editor.getModel(), 'typescript');
            showToast('API autocomplete loaded!');
        }

        // Configurar eventos del editor
        editor.onDidChangeModelContent(updateStatusBar);
        editor.onDidChangeCursorPosition(updateStatusBar);

        // Configurar selector de módulos
        document.getElementById('module-select').addEventListener('change', (e) => {
            const module = e.target.value;
            editor.setValue(EXAMPLES[module]);
            editor.focus();
        });

        // Configurar botones
        document.getElementById('copy-btn').addEventListener('click', copyScript);
        document.getElementById('run-btn').addEventListener('click', () => {
            showToast('Execution feature coming soon!');
        });

        // Ajustes iniciales
        updateStatusBar();
        refreshInstallButton();

        // Bloqueo de zoom no deseado
        document.addEventListener('wheel', e => {
            if (e.ctrlKey) e.preventDefault();
        }, { passive: false });

    } catch (error) {
        console.error("Error inicializando la aplicación:", error);
        showToast('Failed to initialize editor', true);
    }
}

// Iniciar la aplicación cuando el DOM esté listo
if (document.readyState === 'complete') {
    initializeApp();
} else {
    window.addEventListener('DOMContentLoaded', initializeApp);
}

// Verificar cambios en la visibilidad de la página
document.addEventListener('visibilitychange', refreshInstallButton);