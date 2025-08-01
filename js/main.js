// ===== CONSTANTES GLOBALES =====
const APP_CONFIG = {
    VERSION: '1.4.0',
    STORAGE_KEYS: {
        CONTENT: 'mcbe_editor_content',
        FILENAME: 'mcbe_editor_filename',
        MODULE: 'mcbe_editor_module',
        VERSION: 'mcbe_editor_version'
    },
    TIMINGS: {
        SAVE_DEBOUNCE: 1000,
        AUTO_SAVE: 30000,
        CACHE_EXPIRY: 86400000
    }
};

class MonacoEditorApp {
    constructor() {
        this.editor = null;
        this.deferredPrompt = null;
        this.saveTimeout = null;
        this.typeCache = {};
        this.isLoadingTypes = false;
        this.currentModule = 'server';
        this.currentVersion = '1.0.0';
        this.toastTimeout = null;
    }
    // ===== INICIALIZACIÓN PRINCIPAL =====
    async initialize() {
        try {
            this.showStatus('Inicializando editor...');
            await this.loadMonaco();
            this.editor = this.createEditor();
            this.setupAutoSave();
            this.loadPersistentState();
            this.setupPWA();
            this.setupControls();
            await this.loadTypeDefinitions();
            this.showStatus('Editor listo');
            this.updateStatusBar();
        } catch (error) {
            console.error('Error inicializando:', error);
            this.showError('Error al iniciar el editor', error);
        }
    }

    // ===== CONFIGURACIÓN MONACO EDITOR =====
    async loadMonaco() {
        if (window.monaco) return;

        return new Promise((resolve, reject) => {
            const loaderScript = document.createElement('script');
            loaderScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js';
            
            loaderScript.onload = () => {
                require.config({
                    paths: { 
                        'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' 
                    }
                });

                window.MonacoEnvironment = {
                    getWorkerUrl: function() {
                        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
                            self.MonacoEnvironment = { baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/' };
                            importScripts('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/base/worker/workerMain.js');
                        `)}`;
                    }
                };

                require(['vs/editor/editor.main'], resolve, reject);
            };
            
            loaderScript.onerror = (err) => {
                console.error('Error cargando Monaco:', err);
                reject(new Error('Failed to load Monaco Editor'));
            };
            document.head.appendChild(loaderScript);
        });
    }

    createEditor() {
        const editor = monaco.editor.create(document.getElementById('monaco-editor'), {
            value: '',
            language: 'typescript',
            theme: 'vs-dark',
            automaticLayout: true,
            minimap: { enabled: true },
            fontSize: 14,
            lineHeight: 24,
            autoClosingBrackets: 'languageDefined',
            autoClosingQuotes: 'languageDefined',
            formatOnType: true,
            wordWrap: 'on'
        });

        // Solución robusta para Backspace
        editor.onKeyDown((e) => {
            if (e.code === 'Backspace') {
                const selection = editor.getSelection();
                const model = editor.getModel();
                const lineContent = model.getLineContent(selection.positionLineNumber);
                const charBeforeCursor = lineContent.charAt(selection.positionColumn - 2);
                
                if (/[\/_\-+&(){}\[\]]/.test(charBeforeCursor)) {
                    e.preventDefault();
                    editor.executeEdits('backspace', [{
                        range: new monaco.Range(
                            selection.positionLineNumber,
                            selection.positionColumn - 1,
                            selection.positionLineNumber,
                            selection.positionColumn
                        ),
                        text: '',
                    }]);
                }
            }
        });

        // Actualizar barra de estado al escribir
        editor.onDidChangeModelContent(() => {
            this.updateStatusBar();
        });
        editor.onDidChangeCursorPosition(() => {
            this.updateStatusBar();
        });

        return editor;
    }

    // ===== SISTEMA DE TIPOS =====
    async loadTypeDefinitions() {
        if (this.isLoadingTypes) {
            this.showToast('Ya se están cargando tipos...', false);
            return false;
        }

        this.isLoadingTypes = true;
        this.updateLoadTypesButton(true);

        try {
            this.showStatus('Cargando definiciones de tipos...');
            const moduleSelect = document.getElementById('module-select');
            const versionInput = document.getElementById('version-input');
            
            this.currentModule = moduleSelect.value;
            this.currentVersion = versionInput.value.trim();

            if (!/^\d+\.\d+\.\d+$/.test(this.currentVersion)) {
                throw new Error('Formato de versión inválido. Use X.X.X');
            }

            const modulesToLoad = this.getModulesToLoad(this.currentModule);
            const typeDefs = await Promise.all(
                modulesToLoad.map(mod => 
                    this.fetchTypeDefinition(mod, this.currentVersion)
                        .catch(e => {
                            console.warn(`No se pudo cargar ${mod}:`, e);
                            return null;
                        })
                )
            );

            this.configureTypeScriptDefaults();
            monaco.languages.typescript.typescriptDefaults.setExtraLibs([]);
            
            typeDefs.forEach((content, index) => {
                if (content) {
                    const libPath = `file:///node_modules/${modulesToLoad[index]}/index.d.ts`;
                    monaco.languages.typescript.typescriptDefaults.addExtraLib(content, libPath);
                }
            });

            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.MODULE, this.currentModule);
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.VERSION, this.currentVersion);
            
            this.showToast(`Tipos cargados: ${this.currentModule}@${this.currentVersion}`);
            return true;
        } catch (error) {
            console.error("Error cargando tipos:", error);
            this.showToast(`Error: ${error.message}`, true);
            return false;
        } finally {
            this.isLoadingTypes = false;
            this.updateLoadTypesButton(false);
            this.showStatus('Editor listo');
        }
    }

    async fetchTypeDefinition(module, version, retries = 2) {
        const cacheKey = `${module}@${version}`;
        
        if (this.typeCache[cacheKey] && 
            Date.now() - this.typeCache[cacheKey].timestamp < APP_CONFIG.TIMINGS.CACHE_EXPIRY) {
            return this.typeCache[cacheKey].content;
        }

        try {
            const url = `https://cdn.jsdelivr.net/npm/${module}@${version}/index.d.ts`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            let content = await response.text();
            content = content.replace(
                /from\s+['"]@minecraft\/(server|server-ui|server-gametest|vanilla-data)['"]/g,
                `from '@minecraft/$1'`
            );
            
            this.typeCache[cacheKey] = {
                content,
                timestamp: Date.now()
            };
            
            return content;
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.fetchTypeDefinition(module, version, retries - 1);
            }
            throw error;
        }
    }

    getModulesToLoad(module) {
        const baseModules = [
            '@minecraft/server',
            '@minecraft/server-ui',
            '@minecraft/server-gametest', 
            '@minecraft/vanilla-data'
        ];
        
        switch (module) {
            case 'server': return [baseModules[0], baseModules[3]];
            case 'server-ui': return [baseModules[1]];
            case 'server-gametest': return [baseModules[2], baseModules[0], baseModules[3]];
            default: return baseModules;
        }
    }

    configureTypeScriptDefaults() {
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: monaco.languages.typescript.ScriptTarget.ES2020,
            allowNonTsExtensions: true,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            strict: true,
            typeRoots: ["file:///node_modules/@types"],
            paths: { "@minecraft/*": ["file:///node_modules/@minecraft/*"] },
            esModuleInterop: true
        });
    }

    updateLoadTypesButton(isLoading) {
        const btn = document.getElementById('load-types-btn');
        if (!btn) return;
        
        btn.disabled = isLoading;
        btn.innerHTML = isLoading 
            ? '<i class="fas fa-spinner fa-spin"></i> Cargando...'
            : '<i class="fas fa-code"></i> Cargar Tipos';
    }

    // ===== MANEJO DE ESTADO =====
    loadPersistentState() {
        try {
            const content = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.CONTENT) || '';
            const filename = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.FILENAME) || 'main';
            
            if (this.editor) {
                this.editor.setValue(content);
                document.getElementById('filename-input').value = filename;
            }

            const lastModule = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.MODULE) || 'server';
            const lastVersion = localStorage.getItem(APP_CONFIG.STORAGE_KEYS.VERSION) || 
                              (lastModule === 'server' ? '2.0.0' : '2.0.0');
            
            document.getElementById('module-select').value = lastModule;
            document.getElementById('version-input').value = lastVersion;
            this.currentModule = lastModule;
            this.currentVersion = lastVersion;
            
            return { content, filename };
        } catch (error) {
            console.error('Error cargando estado:', error);
            return { content: '', filename: 'main' };
        }
    }

    saveState() {
        try {
            if (!this.editor) return false;
            
            const content = this.editor.getValue();
            const filename = document.getElementById('filename-input')?.value.trim() || 'main';
            
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.CONTENT, content);
            localStorage.setItem(APP_CONFIG.STORAGE_KEYS.FILENAME, filename);
            
            this.flashSaveIndicator();
            return true;
        } catch (error) {
            console.error('Error guardando:', error);
            return false;
        }
    }

    resetEditor() {
        if (!confirm('¿Resetear editor? Se perderán los cambios no guardados.')) return;
        
        localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.CONTENT);
        localStorage.removeItem(APP_CONFIG.STORAGE_KEYS.FILENAME);
        
        this.editor.setValue('');
        document.getElementById('filename-input').value = 'main';
        this.showToast('Editor reiniciado');
    }

    // ===== AUTO-GUARDADO =====
    setupAutoSave() {
        this.editor.onDidChangeModelContent(() => {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => this.saveState(), APP_CONFIG.TIMINGS.SAVE_DEBOUNCE);
        });
        
        setInterval(() => this.saveState(), APP_CONFIG.TIMINGS.AUTO_SAVE);
        window.addEventListener('beforeunload', () => this.saveState());
    }

    // ===== PWA =====
    setupPWA() {
        // Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => {
                    console.log('Service Worker registrado:', reg.scope);
                    
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                this.showToast('¡Nueva versión disponible! Recarga para actualizar.');
                            }
                        });
                    });
                })
                .catch(err => console.error('Error registrando Service Worker:', err));
        }

        // Install Prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.updateInstallButton();
        });

        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            this.updateInstallButton();
            this.showToast('App instalada correctamente');
        });

        // Verificar si ya está instalada
        this.updateInstallButton();
    }

    updateInstallButton() {
        const installBtn = document.getElementById('install-btn');
        if (!installBtn) return;

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        
        if (isStandalone) {
            installBtn.style.display = 'none';
        } else if (this.deferredPrompt) {
            installBtn.style.display = 'block';
            installBtn.disabled = false;
        } else {
            installBtn.style.display = 'none';
        }
    }

    async installApp() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                this.showToast('Instalación en progreso...');
            }
            this.deferredPrompt = null;
        } else {
            this.showToast('La app ya está instalada o no se puede instalar', true);
        }
    }

    // ===== UI/CONTROLES =====
    setupControls() {
        document.getElementById('min-btn')?.addEventListener('click', () => this.toggleToolbar());
        document.getElementById('reset-btn')?.addEventListener('click', () => this.resetEditor());
        document.getElementById('copy-btn')?.addEventListener('click', () => this.copyCode());
        document.getElementById('download-btn')?.addEventListener('click', () => this.downloadCode());
        document.getElementById('install-btn')?.addEventListener('click', () => this.installApp());
        document.getElementById('load-types-btn')?.addEventListener('click', () => this.loadTypeDefinitions());
        document.getElementById('module-select')?.addEventListener('change', (e) => {
            this.currentModule = e.target.value;
            this.currentVersion = e.target.value === 'server-ui' ? '1.1.0' : '1.0.0';
            document.getElementById('version-input').value = this.currentVersion;
        });
    }

    copyCode() {
        navigator.clipboard.writeText(this.editor.getValue())
            .then(() => this.showToast('Código copiado'))
            .catch(() => this.showToast('Error al copiar', true));
    }

    downloadCode() {
        const content = this.editor.getValue();
        const filename = document.getElementById('filename-input').value.trim() || 'script';
        const blob = new Blob(["\uFEFF" + content], { type: 'text/javascript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.js`;
        a.click();
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
        this.showToast(`Descargado: ${filename}.js`);
    }

    toggleToolbar() {
        const header = document.getElementById('header');
        const toolbar = document.getElementById('toolbar');
        const minBtn = document.getElementById('min-btn');

        if (header.classList.contains('min-toolbar')) {
            header.classList.remove('min-toolbar');
            toolbar.style.display = 'flex';
            minBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Ocultar';
        } else {
            header.classList.add('min-toolbar');
            toolbar.style.display = 'none';
            minBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Mostrar';
        }
    }

    // ===== HELPERS DE UI =====
    showToast(message, isError = false, duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        clearTimeout(this.toastTimeout);
        
        toast.textContent = message;
        toast.className = isError ? 'toast error' : 'toast';
        toast.style.display = 'block';

        this.toastTimeout = setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.style.display = 'none', 300);
        }, duration);
    }

    showStatus(message) {
        const statusBar = document.getElementById('status-bar');
        if (statusBar) statusBar.textContent = message;
    }

    updateStatusBar() {
        if (!this.editor) return;
        const statusBar = document.getElementById('status-bar');
        if (!statusBar) return;

        const position = this.editor.getPosition();
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        const isOnline = navigator.onLine;
        
        statusBar.textContent = `Ln ${position.lineNumber}, Col ${position.column} | ${
            isStandalone ? 'App' : 'Web'} ${isMobile ? 'Mobile' : 'Desktop'} | ${
            isOnline ? 'Online' : 'Offline'} | v${APP_CONFIG.VERSION}`;
        
        statusBar.classList.toggle('offline', !isOnline);
    }

    showError(title, error) {
        console.error(title, error);
        this.showToast(`${title}: ${error.message}`, true);
    }

    flashSaveIndicator() {
        const indicator = document.getElementById('save-status');
        if (indicator) {
            indicator.style.display = 'block';
            setTimeout(() => indicator.style.display = 'none', 2000);
        }
    }

    adjustEditorHeight() {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const app = document.getElementById('app');
        
        if (app) {
            app.style.height = isStandalone && isMobile ? `${window.innerHeight}px` : '93vh';
            app.style.marginTop = isStandalone && isMobile ? '0' : '50px';
        }
    }
}

// ===== INICIAR APLICACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    const app = new MonacoEditorApp();
    app.initialize();

    // Ajustar altura en redimensionamiento
    window.addEventListener('resize', () => app.adjustEditorHeight());
    window.addEventListener('online', () => app.updateStatusBar());
    window.addEventListener('offline', () => app.updateStatusBar());
});
=======
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
            return [baseModules[0],
                baseModules[3]]; // server + vanilla-data
        case 'server-ui':
            return [baseModules[1]]; // solo server-ui
        case 'server-gametest':
            return [baseModules[2],
                baseModules[0],
                baseModules[3]]; // gametest + server + vanilla-data
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
versionInput.value = module === 'server' ? '2.0.0':
module === 'server-ui' ? '1.2.0': '1.0.0';
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
const filename = filenameInput ? filenameInput.value.trim() || 'main': 'main';

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
let fileName = fileNameInput ? fileNameInput.value.trim(): 'script';

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
const emojis = ["⌛",
"⏳",
"🚧",
"👷",
"🔜"];

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
toast.style.backgroundColor = isError ? 'rgba(255, 59, 48, 0.9)': 'rgba(0, 0, 0, 0.9)';
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
statusText += isStandalone ? 'App': 'Web';
statusText += isMobile ? ' Mobile': ' Desktop';
statusText += isOnline ? ' | Online': ' | Offline';
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