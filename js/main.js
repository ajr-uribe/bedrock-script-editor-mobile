// ===== CONFIGURACIÓN GLOBAL =====
const APP_VERSION = '1.2.2-Preview';
const STORAGE_KEY = 'mcbe_editor_content_preview';
const STORAGE_FILENAME_KEY = 'mcbe_editor_filename_preview';
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

// Prefijos y mensajes para notificaciones
const PREFIX = {
  soon: ["👨‍💻 ",
    "🚀 ",
    "🔧 ",
    "⏳ "],
  error: ["⚠️ ",
    "❌ ",
    "💥 ",
    "🔴 "],
  success: ["✅ ",
    "👍 ",
    "✨ ",
    "🚀 "]
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

// ===== FUNCIÓN PRINCIPAL =====
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
  try {
    showStatusMessage('Initializing editor...');

    // 1. Registrar Service Worker
    registerServiceWorker();

    // 2. Configurar Monaco Editor
    await configureMonaco();

    // 3. Crear editor con contenido guardado o vacío
    editor = createEditor();

    // 4. Cargar tipos de Minecraft
    await loadTypeDefinitions();

    // 5. Configurar PWA
    setupPWA();

    // 6. Configurar controles
    setupControls();

    // 7. Configurar barra de estado
    setupStatusBar();

    // 8. Configurar guardado automático
    setupAutoSave();

    // 9. Ajustar altura para móvil
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
  const initialContent = loadSavedState();

  // Recuperar el estado del wrap del localStorage (true por defecto)
  const wrapEnabled = localStorage.getItem("wordWrapEnabled") !== "false";

  // Configurar el checkbox según el estado guardado
  const wrappingCheckbox = document.getElementById('wrapping');
  if (wrappingCheckbox) {
    wrappingCheckbox.checked = wrapEnabled;
    wrappingCheckbox.addEventListener('change', toggleWordWrap);
  }

  const editorInstance = monaco.editor.create(document.getElementById('monaco-editor'), {
    value: initialContent,
    language: 'javascript',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: {
      enabled: true
    },
    wordWrap: wrapEnabled ? 'on': 'off',
    fontSize: 12,
    lineHeight: 20,
    scrollBeyondLastLine: true,
    renderWhitespace: 'selection'
  });

  document.getElementById('theme-selector').addEventListener('change', (e) => {
    monaco.editor.setTheme(e.target.value);
  });
  setTimeout(() => editorInstance.focus(), 300);
  return editorInstance;
}

function toggleWordWrap() {
  if (!editor) return;

  const wrappingCheckbox = document.getElementById('wrapping');
  const isChecked = wrappingCheckbox.checked;

  // Actualizar la configuración del editor
  editor.updateOptions({
    wordWrap: isChecked ? 'on': 'off'
  });

  // Guardar preferencia
  localStorage.setItem("wordWrapEnabled", isChecked.toString());

  showToast(`Word Wrap ${isChecked ? 'enabled': 'disabled'}`);
}

// ===== CARGA DE TIPOS =====
async function loadTypeDefinitions() {
  try {
    showStatusMessage('Loading API definitions...');

    const [serverTypes,
      serverUiTypes,
      gameTestTypes] = await Promise.all([
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
    showStatusMessage('API definitions loaded');
    return true;
  } catch (error) {
    console.error("Error loading API types:", error);
    showToast(getRandomMessage('error'), true);
    showStatusMessage('Failed to load API definitions');
    return false;
  }
}

async function fetchTypeDefinition(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    console.error(`Error loading ${path}:`, error);
    throw error;
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
    const filename = filenameInput ? filenameInput.value || 'main': 'main';

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

    return savedContent || '';
  } catch (error) {
    console.error('Error loading saved state:', error);
    return '';
  }
}

function flashSaveIndicator() {
  const indicator = document.getElementById('save-status');
  if (indicator) {
    indicator.style.display = 'block';
    setTimeout(() => {
      indicator.style.display = 'none';
    }, 2000);
  }
}

// ===== FUNCIONES PWA =====
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('Service Worker registered:', reg.scope))
    .catch(err => console.error('Service Worker registration failed:', err));
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
    showToast('App installed successfully');
  });

  updateInstallButton();
}

function updateInstallButton() {
  const installBtn = document.getElementById('install-btn');
  if (!installBtn) return;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  if (isStandalone) {
    installBtn.classList.add('installed');
    installBtn.textContent = "✓ Installed";
    installBtn.disabled = true;
  } else if (deferredPrompt) {
    installBtn.classList.add('available');
    installBtn.textContent = "↓ Install";
    installBtn.disabled = false;
  } else {
    installBtn.classList.remove('available', 'installed');
    installBtn.textContent = "Install";
    installBtn.disabled = true;
  }
}

// ===== FUNCIONES DE INTERFAZ =====
function setupControls() {
  const moduleSelect = document.getElementById('module-select');
  if (moduleSelect) {
    moduleSelect.addEventListener('change', (e) => {
      if (!editor.getValue() || confirm('Loading an example will replace your current work. Continue?')) {
        const module = e.target.value;
        editor.setValue(EXAMPLES[module]);
        editor.focus();
      } else {
        e.target.value = moduleSelect.dataset.lastValue || 'server';
      }
    });
    moduleSelect.dataset.lastValue = moduleSelect.value;
  }

  document.getElementById('copy-btn')?.addEventListener('click',
    copyScript);
  document.getElementById('install-btn')?.addEventListener('click',
    installApp);
  document.getElementById('reset-btn')?.addEventListener('click',
    resetEditor);
  document.getElementById('filename-input')?.addEventListener('change',
    saveEditorState);
  document.getElementById('download-btn')?.addEventListener('click',
    downloadCode);
  document.getElementById('wrapping')?.addEventListener('change',
    toggleWordWrap);
}

function setupStatusBar() {
  if (!editor) return;

  editor.onDidChangeModelContent(() => {
    updateStatusBar();
  });

  editor.onDidChangeCursorPosition(updateStatusBar);
  updateStatusBar();
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
        showToast('Installation in progress...');
      }
      deferredPrompt = null;
      updateInstallButton();
    });
  }
}

async function copyScript() {
  try {
    await navigator.clipboard.writeText(editor.getValue());
    showToast('Code copied to clipboard');
  } catch (err) {
    console.error('Failed to copy:',
      err);
    showToast('Failed to copy code',
      true);
  }
}

async function downloadCode() {
  try {
    if (!editor || typeof editor.getValue !== 'function') {
      throw new Error('Editor not available');
    }

    const codeContent = editor.getValue();

    if (!codeContent.trim()) {
      showToast('Editor is empty', true);
      return;
    }

    const fileNameInput = document.getElementById('filename-input');
    let fileName = fileNameInput ? fileNameInput.value.trim(): 'script';

    fileName = fileName
    .replace(/[^a-z0-9\-_]/gi, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toLowerCase()
    .substring(0, 50) || 'script';

    const blob = new Blob([codeContent], {
      type: 'application/javascript;charset=utf-8'
    });
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

    showToast(`Downloaded: ${fileName}.js`);
  } catch (error) {
    console.error('Download error:', error);
    showToast('Download failed', true);
  }
}

function executeAction() {
  try {
    const message = getRandomMessage('soon');
    showToast(message, false, 5000);
  } catch(error) {
    console.error('Action failed:', error);
    showToast(getRandomMessage('error'), true, 5000);
  }
}

function minToolbar() {
  const header = document.getElementById("header");
  const minBtn = document.getElementById("min-btn");

  if (header && minBtn) {
    header.classList.toggle("min-toolbar");

    if (header.classList.contains("min-toolbar")) {
      minBtn.textContent = "🔽 Open Toolbar 🔽";
    } else {
      minBtn.textContent = "🔼 Close Toolbar 🔼";
    }
  }
}

// ===== FUNCIONES DE ESTADO Y NOTIFICACIONES =====
function updateStatusBar() {
  if (!editor) return;
  const statusBar = document.getElementById('status-bar');
  if (!statusBar) return;

  const position = editor.getPosition();
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  statusBar.textContent = `Ln ${position.lineNumber}, Col ${position.column} | ${isStandalone ? 'App': 'Web'} ${isMobile ? '| Mobile': '| Desktop'} | v${APP_VERSION}`;
}

function showStatusMessage(message) {
  console.log(`Status: ${message}`);
  const statusBar = document.getElementById('status-bar');
  if (statusBar) {
    statusBar.textContent = message;
  }
}

function showToast(message, isError = false, time = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.style.backgroundColor = isError ? '#d32f2f': '#007acc';
  toast.style.display = 'block';

  setTimeout(() => toast.style.display = 'none', time);
}

function showError(title, error) {
  const editorContainer = document.getElementById('monaco-editor');
  if (editorContainer) {
    editorContainer.innerHTML = `
    <div class="error-container">
    <h3>${title}</h3>
    <p>${error.message}</p>
    <button onclick="window.location.reload()">Try Again</button>
    </div>
    `;
  }
}

// ===== FUNCIONES UTILITARIAS =====
function adjustEditorHeightForMobilePWA() {
  const editorElement = document.getElementById('app');
  if (!editorElement) return;

  const viewportHeight = window.innerHeight;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  editorElement.style.height = isStandalone ? `${viewportHeight}px`: '93vh';
}

function getRandomMessage(type) {
  const prefixes = PREFIX[type] || [''];
  const messages = MESSAGES[type] || [type];

  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const message = messages[Math.floor(Math.random() * messages.length)];

  return `${prefix}${message}`;
}