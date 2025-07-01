// ===== CONSTANTES GLOBALES =====
const APP_CONFIG = {
    VERSION: '1.3.1',
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
    },
    EXAMPLES: {
        server: `// @minecraft/server example\nimport { world } from '@minecraft/server';\n\nworld.afterEvents.playerSpawn.subscribe(() => {\n    // Tu código aquí\n});`,
        'server-ui': `// @minecraft/server-ui example\nimport { ActionForm } from '@minecraft/server-ui';\n\nasync function showForm(player) {\n    const form = new ActionForm();\n    // Configura tu formulario\n}`,
        'server-gametest': `// @minecraft/server-gametest example\nimport * as gametest from '@minecraft/server-gametest';\n\ngametest.register("TestSuite", "exampleTest", (test) => {\n    // Tu prueba aquí\n});`
    }
};

// ===== CLASE PRINCIPAL DEL EDITOR =====
class MonacoEditorApp {
    constructor() {
        this.editor = null;
        this.deferredPrompt = null;
        this.saveTimeout = null;
        this.typeCache = {};
        this.isLoadingTypes = false;
    }

    // ===== INICIALIZACIÓN =====
    async initialize() {
        try {
            this.showStatus('Inicializando editor...');
            
            // Cargar Monaco Editor
            await this.loadMonaco();
            
            // Crear instancia del editor
            this.editor = this.createEditor();
            
            // Configuraciones iniciales
            this.setupAutoSave();
            this.loadPersistentState();
            this.setupPWA();
            this.setupControls();
            
            this.showStatus('Editor listo');
            this.showToast('Editor cargado correctamente');
        } catch (error) {
            console.error('Error inicializando:', error);
            this.showError('Error al iniciar', error);
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
            
            loaderScript.onerror = reject;
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

        // Solución completa para Backspace
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

        return editor;
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
            
            return { content, filename };
        } catch (error) {
            console.error('Error loading state:', error);
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
            console.error('Error saving:', error);
            return false;
        }
    }

    resetEditor() {
        if (!confirm('¿Resetear editor? Se perderán los cambios.')) return;
        
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
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                this.showToast('¡Nueva versión disponible!');
                            }
                        });
                    });
                });
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
        });
    }

    // ===== UI =====
    setupControls() {
        // Asignar todos los event listeners
        document.getElementById('min-btn')?.addEventListener('click', this.toggleToolbar);
        document.getElementById('reset-btn')?.addEventListener('click', () => this.resetEditor());
        document.getElementById('copy-btn')?.addEventListener('click', () => this.copyCode());
        document.getElementById('download-btn')?.addEventListener('click', () => this.downloadCode());
        document.getElementById('install-btn')?.addEventListener('click', () => this.installApp());
        document.getElementById('module-select')?.addEventListener('change', (e) => this.loadExample(e.target.value));
    }

    copyCode() {
        navigator.clipboard.writeText(this.editor.getValue())
            .then(() => this.showToast('Código copiado'))
            .catch(() => this.showToast('Error al copiar', true));
    }

    downloadCode() {
        const content = this.editor.getValue();
        const filename = document.getElementById('filename-input').value.trim() || 'script';
        const blob = new Blob([content], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.js`;
        a.click();
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    // ===== HELPERS =====
    showToast(message, isError = false, duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = isError ? 'toast error' : 'toast';
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.style.display = 'none', 300);
        }, duration);
    }

    showStatus(message) {
        const statusBar = document.getElementById('status-bar');
        if (statusBar) statusBar.textContent = message;
    }

    flashSaveIndicator() {
        const indicator = document.getElementById('save-status');
        if (indicator) {
            indicator.style.display = 'block';
            setTimeout(() => indicator.style.display = 'none', 2000);
        }
    }
}

// ===== INICIAR APLICACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    const app = new MonacoEditorApp();
    app.initialize();
});