// ===== CONSTANTES Y CONFIGURACIÓN =====
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
        CACHE_EXPIRY: 86400000 // 1 día
    },
    EXAMPLES: {
        // ... (tus ejemplos existentes)
    }
};

// ===== MÓDULOS PRINCIPALES =====
import { EditorManager } from './editor/editor-manager.js';
import { CacheManager } from './editor/cache-manager.js';
import { UIManager } from './editor/ui-manager.js';
import { PWAManager } from './editor/pwa-manager.js';

// ===== INICIALIZACIÓN DE LA APLICACIÓN =====
class MCEditorApp {
    constructor() {
        this.modules = {
            editor: new EditorManager(),
            cache: new CacheManager(),
            ui: new UIManager(),
            pwa: new PWAManager()
        };
        this.initPromise = null;
    }

    async initialize() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                this.modules.ui.showStatus('Inicializando editor...');
                
                // Inicialización ordenada de módulos
                await this.modules.editor.initialize();
                await this.modules.cache.initialize(this.modules.editor);
                await this.modules.pwa.initialize();
                this.modules.ui.initialize(this.modules.editor, this.modules.cache);
                
                this.setupEventListeners();
                this.modules.ui.showStatus('Editor listo');
                this.modules.ui.showToast('Editor cargado correctamente');
                
                return true;
            } catch (error) {
                console.error('Error inicializando la app:', error);
                this.modules.ui.showError('Error al iniciar el editor', error);
                this.modules.ui.showStatus('Falló la inicialización');
                return false;
            }
        })();

        return this.initPromise;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.modules.ui.adjustEditorHeight());
        window.addEventListener('online', () => this.modules.ui.handleOnlineStatus());
        window.addEventListener('offline', () => this.modules.ui.handleOnlineStatus());
    }
}

// ===== INICIALIZAR AL CARGAR EL DOM =====
document.addEventListener('DOMContentLoaded', () => {
    const app = new MCEditorApp();
    app.initialize();
});