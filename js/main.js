    // ===== CONFIGURACIÓN GLOBAL =====
    const APP_VERSION = '1.2.0';
    let editor;
    let deferredPrompt;

    // Ejemplos de código
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

    // ===== FUNCIÓN PRINCIPAL =====
    async function initializeApp() {
        try {
            // 1. Registrar Service Worker
            registerServiceWorker();

            // 2. Configurar Monaco Editor
            await configureMonaco();

            // 3. Crear editor
            editor = createEditor();

            // 4. Cargar tipos de Minecraft
            await loadTypeDefinitions();

            // 5. Configurar PWA
            setupPWA();

            // 6. Configurar controles
            setupControls();
            
            // 7. Barra de estado
            editor.onDidChangeModelContent(updateStatusBar);
                 editor.onDidChangeCursorPosition(updateStatusBar);
            //8. Actualizar a móvil:

// Llamar a la función al inicializar
adjustEditorHeightForMobilePWA();

// Escuchar cambios en la orientación/resize
window.addEventListener('resize', adjustEditorHeightForMobilePWA);

            //9. Auto save

            //10. Notificación de editor iniciado

            showToast('Editor listo', false);
        } catch (error) {
            console.error('Error inicializando app:', error);
            showError('Error al iniciar el editor', error);
        }
    }

    // ===== FUNCIONES DE MONACO =====
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

    function createEditor() {
        return monaco.editor.create(document.getElementById('monaco-editor'), {
            value: EXAMPLES.server,
            language: 'javascript',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: true },
            fontSize: 14,
            lineHeight: 24
        });
    }

    function setupAutoSave() {
    if (!editor) return;

    // Guarda el contenido del editor automáticamente en localStorage
    editor.onDidChangeModelContent(() => {
        const content = editor.getValue();
        localStorage.setItem('editorContent', content);
    });

    // Carga el contenido guardado de localStorage (si existe)
    const savedContent = localStorage.getItem('editorContent');
    if (savedContent) {
        editor.setValue(savedContent);
    }
}
    function resetEditor() {
    if (!editor) return;

    // Resetear al contenido de ejemplo
    editor.setValue(EXAMPLES.server);

    // Limpiar localStorage
    localStorage.removeItem('editorContent');

    showToast('Editor reseteado a los valores predeterminados.');
}
    // ===== CARGA DE TIPOS =====
    async function loadTypeDefinitions() {
        try {
            const [serverTypes, serverUiTypes, gameTestTypes] = await Promise.all([
                fetchTypeDefinition('/types/@minecraft/server/index.d.ts'),
                fetchTypeDefinition('/types/@minecraft/server-ui/index.d.ts'),
                fetchTypeDefinition('/types/@minecraft/server-gametest/index.d.ts')
            ]);

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

            monaco.editor.setModelLanguage(editor.getModel(), 'typescript');
            return true;
        } catch (error) {
            console.error("Error cargando tipos:", error);
            showToast('Error loading API definitions', true);
            return false;
        }
    }

    async function fetchTypeDefinition(path) {
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (error) {
            console.error(`Error cargando ${path}:`, error);
            throw error;
        }
    }

    // ===== FUNCIONES PWA =====
    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('SW registrado:', reg.scope))
                .catch(err => console.error('Error SW:', err));
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
            installBtn.textContent = "Instalada";
            installBtn.disabled = true;
        } else if (deferredPrompt) {
            installBtn.classList.add('available');
            installBtn.textContent = "Instalar";
            installBtn.disabled = false;
        } else {
            installBtn.classList.remove('available', 'installed');
            installBtn.textContent = "Instalar";
            installBtn.disabled = true;
        }
    }

    // ===== FUNCIONES DE INTERFAZ =====
    function setupControls() {
        document.getElementById('module-select').addEventListener('change', (e) => {
            const module = e.target.value;
            editor.setValue(EXAMPLES[module]);
            editor.focus();
        });
        document.getElementById('copy-btn').addEventListener('click', copyScript);
        document.getElementById('install-btn').addEventListener('click', installApp);

document.getElementById('reset-btn').addEventListener('click', resetEditor);
    }
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

    async function copyScript() {
        try {
            await navigator.clipboard.writeText(editor.getValue());
            showToast('Código copiado');
        } catch (err) {
            showToast('Error al copiar', true);
            console.error('Error copiando:', err);
        }
    }

   

    // ===== FUNCIÓN DE DESCARGA MEJORADA =====
async function downloadCode() {
    try {
        // 1. Verificar si el editor está disponible (misma comprobación que copyCode)
        if (!editor || typeof editor.getValue !== 'function') {
            throw new Error('Editor no disponible o no inicializado');
        }

        // 2. Obtener contenido del editor (igual que copyCode)
        const codeContent = editor.getValue();
        
        // 3. Validar contenido (añadiendo trim como buena práctica)
        if (!codeContent.trim()) {
            showToast('El editor está vacío', true);
            return;
        }
        
        // 4. Obtener nombre del archivo con validación robusta
        const fileNameInput = document.getElementById('filename-input');
        let fileName = fileNameInput ? fileNameInput.value.trim() : 'script';
        
        // Limpieza del nombre de archivo
        fileName = fileName
            .replace(/[^a-z0-9\-_]/gi, '_') // Reemplazar caracteres inválidos
            .replace(/^_+|_+$/g, '')          // Eliminar _ al inicio/final
            .replace(/_+/g, '_')             // Reemplazar múltiples _ por uno
            .toLowerCase()
            .substring(0, 50)                // Limitar longitud
            || 'script';                      // Valor por defecto
        
        // 5. Crear y descargar el archivo (con manejo de recursos)
        const blob = new Blob([codeContent], { type: 'application/javascript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        try {
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.js`;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            
            showToast(`Descargado: ${fileName}.js`);
        } finally {
            // Limpieza segura incluso si hay errores
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        }
        
    } catch (error) {
        console.error('Error en downloadCode:', error);
        showToast('Error on downloading:', true);
        
        // Mensaje detallado en consola para desarrollo
        if (error instanceof Error) {
            console.error('Detalles del error:', {
                message: error.message,
                stack: error.stack,
                editorState: {
                    available: !!editor,
                    hasGetValue: editor && typeof editor.getValue === 'function',
                    contentLength: editor ? editor.getValue().length : 0
                }
            });
        }
    }
}

    function updateStatusBar() {
    if (!editor) return;
    const statusBar = document.getElementById('status-bar');
    if (!statusBar) return;
    
    const lineCount = editor.getModel().getLineCount();
    const position = editor.getPosition();
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    statusBar.textContent = `Line ${position.lineNumber}, Col ${position.column} | ${lineCount} lines | ${isStandalone ? 'App' : 'Web'} ${isMobile ? '| Mobile' : '| Desktop'} | V :  ${APP_VERSION}`;
}

    function showToast(message, isError = false, time = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.style.backgroundColor = isError ? '#d32f2f' : '#007acc';
        toast.style.display = 'block';
        
        setTimeout(() => toast.style.display = 'none', time);
    }

    function showError(title, error) {
        const editorContainer = document.getElementById('monaco-editor');
        editorContainer.innerHTML = `
            <div class="error-container">
                <h3>${title}</h3>
                <p>${error.message}</p>
                <button onclick="window.location.reload()">Reintentar</button>
            </div>
        `;
    }

    // Ajustar altura del editor para PWA móvil
function adjustEditorHeightForMobilePWA() {
    const editorElement = document.getElementById('app');
    const viewportHeight = window.innerHeight;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (isStandalone) {
        editorElement.style.height = `${viewportHeight}px`;
    } else {
        editorElement.style.height = '93vh';
    }
}

    const PREFIX = {
    soon: ["👨‍💻 ", "🚀 ", "🔧 ", "⏳ "],
    error: ["⚠️ ", "❌ ", "💥 ", "🔴 "]
};

function getRandomPrefix(type) {
    const prefixes = PREFIX[type];
    return prefixes[Math.floor(Math.random() * prefixes.length)];
}

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
    ]
};

// Función para obtener mensaje con prefijo
function getPrefixedMessage(type) {
    return `${getRandomPrefix(type)}${MESSAGES[type][Math.floor(Math.random() * MESSAGES[type].length)]}`;
}

// Implementación en executeAction
function executeAction() {
    try {
        
        const message = getPrefixedMessage('soon');
        showToast(message, false, 5000);
        
    } catch(error) {
        const message = getPrefixedMessage('error');
        console.error(`${message}:`, error);
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        showToast(
            isMobile ? message : `${message} (Ver consola para detalles)`,
            true,
            5000
        );
    }
}

function minToolbar() {
  const toolBar = document.getElementById("header");
  toolBar.classList.toggle("min-toolbar");
  
  // Opcional: Cambiar el ícono/texto del botón según el estado
  const minBtn = document.getElementById("min-btn"); // Asegúrate de tener este ID
  if (toolBar.classList.contains("min-toolbar")) {
    minBtn.textContent = "🔽 Open Toolbar 🔽";
  } else {
    minBtn.textContent = "🔼 Close Toolbar 🔼";
  }
}

    // ===== INICIALIZACIÓN =====
    document.addEventListener('DOMContentLoaded', initializeApp);