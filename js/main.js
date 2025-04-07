// Verificar estado de conexión
function updateOnlineStatus() {
    const statusBar = document.getElementById('status-bar');
    if (navigator.onLine) {
        statusBar.style.backgroundColor = '#007acc';
    } else {
        statusBar.style.backgroundColor = '#d32f2f';
        statusBar.textContent = 'Offline Mode - Using cached resources';
    }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// Configuración offline de Monaco
window.MonacoEnvironment = {
    getWorkerUrl: function(workerId, label) {
        // Usar CDN cuando esté online, local cuando esté offline
        if (navigator.onLine) {
            return `https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/base/worker/workerMain.js`;
        } else {
            // Cargar desde cache
            return URL.createObjectURL(new Blob([`
                importScripts('/vs/base/worker/workerMain.js');
            `], { type: 'application/javascript' }));
        }
    },
    getWorker: function(workerId, label) {
        // Cargar workers específicos para TypeScript
        if (label === 'typescript' || label === 'javascript') {
            return new Worker(
                navigator.onLine 
                    ? 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs/language/typescript/tsWorker.js'
                    : URL.createObjectURL(new Blob([`
                        importScripts('/vs/language/typescript/tsWorker.js');
                    `], { type: 'application/javascript' }))
            );
        }
        return null;
    }
};

// Configuración global de Monaco
require.config({
    paths: { 
        'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs'
    }
});

// Entorno para los workers
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

// Ejemplos de código para cada módulo
const EXAMPLES = {
    server: `// Ejemplo @minecraft/server
import { world, system } from '@minecraft/server';

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;
    player.sendMessage("¡Bienvenido al mundo!");
    
    system.runInterval(() => {
        player.onScreenDisplay.setTitle("¡Hola Minecraft!");
    }, 20);
});`,

    'server-ui': `// Ejemplo @minecraft/server-ui
import { ActionForm, MessageForm, ModalForm } from '@minecraft/server-ui';

async function showActionForm(player) {
    const form = new ActionForm()
        .title("Menú de Acción")
        .body("Selecciona una opción:")
        .button("Opción 1")
        .button("Opción 2");
    
    const response = await form.show(player);
    if (response.selection === 0) {
        player.sendMessage("Seleccionaste la opción 1");
    }
}`,

    'server-gametest': `// Ejemplo @minecraft/server-gametest
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

// Inicialización principal
require(['vs/editor/editor.main'], function() {
    // Verificar que Monaco se cargó
    if (typeof monaco === 'undefined') {
        document.getElementById('status-bar').textContent = "Error: No se pudo cargar Monaco Editor";
        return;
    }

    // Crear editor con configuración básica
    const editor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: EXAMPLES.server,
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 14,
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
        roundedSelection: true,
        autoIndent: 'full'
    });

    // Cargar tipos y configurar TypeScript
    loadTypeDefinitions().then(() => {
        monaco.editor.setModelLanguage(editor.getModel(), 'typescript');
        document.getElementById('status-bar').textContent = "Tipos cargados correctamente";
    }).catch(error => {
        console.error("Error cargando tipos:", error);
        document.getElementById('status-bar').textContent = "Advertencia: Tipos no cargados (ver consola)";
    });

    // Configurar selector de módulos
    document.getElementById('module-select').addEventListener('change', (e) => {
        const module = e.target.value;
        editor.setValue(EXAMPLES[module]);
    });

    // Configurar botón de ejecución (simulado)
    document.getElementById('run-btn').addEventListener('click', () => {
        const code = editor.getValue();
        document.getElementById('status-bar').textContent = "Ejecutando código (simulación)...";
        console.log("Código a ejecutar:", code);
        // Aquí iría la lógica real de ejecución
        setTimeout(() => {
            document.getElementById('status-bar').textContent = "Ejecución simulada completada (ver consola)";
        }, 1000);
    });
});

// Función para cargar los tipos de definición
async function loadTypeDefinitions() {
    try {
        // Cargar los tres archivos de tipos en paralelo
        const [serverTypes, serverUiTypes, gameTestTypes] = await Promise.all([
            fetch('./types/@minecraft/server/index.d.ts').then(r => r.text()),
            fetch('./types/@minecraft/server-ui/index.d.ts').then(r => r.text()),
            fetch('./types/@minecraft/server-gametest/index.d.ts').then(r => r.text())
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
            }
        });

        return true;
    } catch (error) {
        console.error("Error cargando tipos:", error);
        throw error;
    }
          }
