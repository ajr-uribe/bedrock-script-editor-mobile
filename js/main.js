const APP_VERSION = '1.3.0';
const STORAGE_KEY = 'mcbe_editor_content';
const STORAGE_FILENAME_KEY = 'mcbe_editor_filename';
const STORAGE_TYPES_KEY = 'mcbe_types_cache';

let editor;
let saveTimeout;
let deferredPrompt;

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
  try {
    registerServiceWorker();
    await configureMonaco();
    editor = createEditor();
    setupControls();
    setupAutoSave();
    updateStatusBar();
    loadSavedTypes();
  } catch (err) {
    showError('Error loading editor', err);
  }
}

// ========== Monaco ==========

function configureMonaco() {
  return new Promise(resolve => {
    require.config({
      paths: {
        vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.40.0/min/vs'
      }
    });

    window.MonacoEnvironment = {
      getWorkerUrl: function (_, label) {
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
  const initialContent = localStorage.getItem(STORAGE_KEY) || '';

  const ed = monaco.editor.create(document.getElementById('monaco-editor'), {
    value: initialContent,
    language: 'typescript',
    theme: 'vs-dark',
    fontSize: 14,
    lineHeight: 22,
    minimap: { enabled: true },
    automaticLayout: true
  });

  return ed;
}

// ========== Tipo Dinámico ==========

function setupControls() {
  document.getElementById('load-types-btn')?.addEventListener('click', loadSelectedTypes);
  document.getElementById('copy-btn')?.addEventListener('click', copyScript);
  document.getElementById('reset-btn')?.addEventListener('click', resetEditor);
  document.getElementById('filename-input')?.addEventListener('change', saveEditorState);
}

async function loadSelectedTypes() {
  const module = document.getElementById('module-select').value;
  const version = document.getElementById('version-input').value;

  if (!module || !version) return showToast('Falta seleccionar módulo o versión', true);

  const moduleMap = {
    'server': '@minecraft/server',
    'server-ui': '@minecraft/server-ui',
    'server-gametest': '@minecraft/server-gametest'
  };

  const pkg = moduleMap[module] || module;
  const url = `https://cdn.jsdelivr.net/npm/${pkg}@${version}/index.d.ts`;

  try {
    showStatusMessage(`Cargando tipos desde ${url}...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Error al cargar tipos: ${res.statusText}`);

    const types = await res.text();
    monaco.languages.typescript.typescriptDefaults.addExtraLib(types, `file:///node_modules/${pkg}/index.d.ts`);

    localStorage.setItem(STORAGE_TYPES_KEY, JSON.stringify({ url, content: types }));
    showToast(`Tipos cargados para ${pkg}@${version}`);
  } catch (err) {
    showToast('Error cargando tipos', true);
    console.error(err);
  }
}

function loadSavedTypes() {
  const cached = localStorage.getItem(STORAGE_TYPES_KEY);
  if (!cached) return;
  try {
    const { url, content } = JSON.parse(cached);
    monaco.languages.typescript.typescriptDefaults.addExtraLib(content, url);
    showToast('Tipos cargados desde caché');
  } catch (err) {
    console.error('Error al cargar tipos desde caché:', err);
  }
}
// ========== Guardado ==========

function setupAutoSave() {
  if (!editor) return;
  editor.onDidChangeModelContent(() => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveEditorState, 1000);
  });
  setInterval(saveEditorState, 30000);
  window.addEventListener('beforeunload', saveEditorState);
}

function saveEditorState() {
  if (!editor) return;
  const content = editor.getValue();
  const filename = document.getElementById('filename-input')?.value || 'main';
  localStorage.setItem(STORAGE_KEY, content);
  localStorage.setItem(STORAGE_FILENAME_KEY, filename);
  flashSaveIndicator();
}

function flashSaveIndicator() {
  const indicator = document.getElementById('save-status');
  if (!indicator) return;
  indicator.style.display = 'block';
  setTimeout(() => indicator.style.display = 'none', 2000);
}

// ========== Barra de Estado y PWA ==========

function updateStatusBar() {
  const statusBar = document.getElementById('status-bar');
  if (!statusBar || !editor) return;
  const pos = editor.getPosition();
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  statusBar.textContent = `Ln ${pos.lineNumber}, Col ${pos.column} | ${standalone ? 'App' : 'Web'} ${mobile ? '| Mobile' : '| Desktop'} | v${APP_VERSION}`;
}

// ========== Funciones UI ==========

function showToast(msg, error = false, time = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.backgroundColor = error ? '#d32f2f' : '#007acc';
  toast.style.display = 'block';
  setTimeout(() => (toast.style.display = 'none'), time);
}

function showStatusMessage(msg) {
  const status = document.getElementById('status-bar');
  if (status) status.textContent = msg;
}

function showError(title, err) {
  const container = document.getElementById('monaco-editor');
  if (container) {
    container.innerHTML = `<div class="error"><h3>${title}</h3><p>${err.message}</p><button onclick="location.reload()">Recargar</button></div>`;
  }
}

// ========== Botones ==========

// Botón "Copiar"
async function copyScript() {
  try {
    await navigator.clipboard.writeText(editor.getValue());
    showToast('Código copiado');
  } catch (err) {
    showToast('No se pudo copiar', true);
  }
}

// Botón "Reset"
function resetEditor() {
  if (!editor) return;
  if (confirm('¿Reiniciar el editor? Se perderán los cambios.')) {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_FILENAME_KEY);
    editor.setValue('');
    document.getElementById('filename-input').value = 'main';
  }
}

// Botón "Descargar"
function downloadCode() {
  const content = editor.getValue();
  if (!content.trim()) return showToast('Editor vacío', true);
  let filename = document.getElementById('filename-input').value || 'script';
  filename = filename.replace(/[^\w-]/g, '_').toLowerCase().substring(0, 50);
  const blob = new Blob([content], { type: 'application/javascript' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.js`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    document.body.removeChild(a);
  }, 100);
}

// Botón "Instalar"
function InstallApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(choice => {
      if (choice.outcome === 'accepted') {
        showToast('Instalación en progreso...');
      }
      deferredPrompt = null;
    });
  }
}

// Botón "Execute"
function executeAction() {
  showToast('Función en desarrollo 🚧', false, 3000);
}

// Botón "Toolbar"
function minToolbar() {
  const header = document.getElementById('header');
  const minBtn = document.getElementById('min-btn');
  header.classList.toggle('min-toolbar');
  minBtn.textContent = header.classList.contains('min-toolbar') ? '🔼 Open Toolbar 🔼' : '🧩 Close Toolbar 🧩';
}

// ========== Service Worker ==========

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW failed:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('install-btn');
    btn.classList.add('available');
    btn.disabled = false;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showToast('App instalada exitosamente');
  });
}