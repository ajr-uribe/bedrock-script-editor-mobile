import { MinecraftJSEditor } from './EditorClass.js';

export default class MinecraftJSEditorWindowManager {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container with id ${containerId} not found`);
        }

        this.options = {
            defaultFileName: 'main.js',
            initialContent: '',
            ...options
        };

        this.editors = {};
        this.activeEditorId = null;
        this.fileCounter = 0;

        this.setupHTML();
    }

    setupHTML() {
        // Limpiar y preparar estructura
        this.container.innerHTML = `
            <div class="editor-nav-bar"></div>
            <div class="editors-container"></div>
        `;

        this.navBar = this.container.querySelector('.editor-nav-bar');
        this.editorsContainer = this.container.querySelector('.editors-container');

        // Botón para añadir nuevo editor
        this.addTabButton = document.createElement('button');
        this.addTabButton.className = 'add-tab-button';
        this.addTabButton.innerHTML = '<i class="fas fa-plus"></i>';
        this.addTabButton.addEventListener('click', () => this.addEditor());
        this.navBar.appendChild(this.addTabButton);

        // Añadir editor inicial
        this.addEditor(this.options.initialContent, this.options.defaultFileName);
    }

    async addEditor(content = '', fileName = null) {
        this.fileCounter++;
        const editorId = `editor-${this.fileCounter}`;
        const displayName = fileName || `${this.options.defaultFileName.split('.')[0]}-${this.fileCounter}.js`;

        // Crear contenedor del editor
        const editorContainer = document.createElement('div');
        editorContainer.id = editorId;
        editorContainer.className = 'editor-instance';
        editorContainer.style.display = 'none';
        this.editorsContainer.appendChild(editorContainer);

        // Crear pestaña
        const tab = document.createElement('div');
        tab.className = 'editor-tab';
        tab.dataset.editorId = editorId;
        
        // Nombre del archivo
        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'tab-filename';
        fileNameSpan.textContent = displayName;
        tab.appendChild(fileNameSpan);
        
        // Botón cerrar
        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-tab';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeEditor(editorId);
        });
        tab.appendChild(closeBtn);
        
        // Evento para cambiar de editor
        tab.addEventListener('click', () => this.switchToEditor(editorId));
        
        // Insertar antes del botón de añadir
        this.navBar.insertBefore(tab, this.addTabButton);
        
        // Crear instancia del editor
        const editor = new MinecraftJSEditor(editorId);
        
        // Guardar referencia
        this.editors[editorId] = {
            instance: editor,
            container: editorContainer,
            tab: tab,
            fileName: displayName,
            isInitialized: false
        };
        
        // Inicializar
        try {
            await editor.initialize();
            if (content) {
                editor.editor.setValue(content);
            }
            this.editors[editorId].isInitialized = true;
            this.setupEditorEvents(editorId);
            this.switchToEditor(editorId);
            return editorId;
        } catch (error) {
            console.error(`Error initializing editor ${editorId}:`, error);
            this.showError(`Error al iniciar el editor ${displayName}`, error);
            return null;
        }
    }

    setupEditorEvents(editorId) {
        const editorData = this.editors[editorId];
        if (!editorData || !editorData.isInitialized) return;

        // Configurar auto-guardado
        editorData.instance.editor.onDidChangeModelContent(() => {
            this.saveEditorState(editorId);
        });

        // Actualizar barra de estado
        editorData.instance.editor.onDidChangeCursorPosition(() => {
            if (this.activeEditorId === editorId) {
                editorData.instance.updateStatusBar();
            }
        });
    }

    async switchToEditor(editorId) {
        if (!this.editors[editorId]) return;
        
        // Ocultar todos los editores
        Object.values(this.editors).forEach(editor => {
            editor.container.style.display = 'none';
            editor.tab.classList.remove('active');
        });
        
        // Mostrar editor seleccionado
        const editorData = this.editors[editorId];
        editorData.container.style.display = 'block';
        editorData.tab.classList.add('active');
        this.activeEditorId = editorId;
        
        // Inicializar si es necesario
        if (!editorData.isInitialized) {
            try {
                await editorData.instance.initialize();
                editorData.isInitialized = true;
                this.setupEditorEvents(editorId);
            } catch (error) {
                console.error(`Error initializing editor ${editorId}:`, error);
                return;
            }
        }
        
        // Enfocar y actualizar UI
        editorData.instance.editor.focus();
        editorData.instance.updateStatusBar();
        
        // Actualizar nombre de archivo en el input
        const filenameInput = document.getElementById('filename-input');
        if (filenameInput) {
            filenameInput.value = editorData.fileName.replace('.js', '');
        }
    }

    closeEditor(editorId) {
        if (!this.editors[editorId]) return;
        
        // No permitir cerrar el último editor
        if (Object.keys(this.editors).length <= 1) {
            this.showToast("No puedes cerrar el último editor", true);
            return;
        }
        
        // Guardar estado antes de cerrar
        this.saveEditorState(editorId);
        
        // Eliminar del DOM
        this.editors[editorId].container.remove();
        this.editors[editorId].tab.remove();
        
        // Eliminar referencia
        delete this.editors[editorId];
        
        // Cambiar a otro editor si era el activo
        if (this.activeEditorId === editorId) {
            const remainingEditors = Object.keys(this.editors);
            this.switchToEditor(remainingEditors[0]);
        }
    }

    saveEditorState(editorId) {
        if (!this.editors[editorId] || !this.editors[editorId].isInitialized) return;
        
        const editor = this.editors[editorId].instance;
        const content = editor.editor.getValue();
        
        // Guardar en localStorage
        localStorage.setItem(`mcbe_editor_content_${editorId}`, content);
        localStorage.setItem(`mcbe_editor_filename_${editorId}`, this.editors[editorId].fileName);
        
        // Mostrar indicador de guardado
        if (this.activeEditorId === editorId) {
            editor.flashSaveIndicator();
        }
    }

    getActiveEditor() {
        if (!this.activeEditorId) return null;
        return this.editors[this.activeEditorId].instance;
    }

    renameActiveEditor(newName) {
        if (!this.activeEditorId) return;
        
        const editorData = this.editors[this.activeEditorId];
        if (!editorData) return;
        
        // Asegurar extensión .js
        if (!newName.endsWith('.js')) {
            newName += '.js';
        }
        
        editorData.fileName = newName;
        editorData.tab.querySelector('.tab-filename').textContent = newName;
        
        // Actualizar input de nombre de archivo
        const filenameInput = document.getElementById('filename-input');
        if (filenameInput) {
            filenameInput.value = newName.replace('.js', '');
        }
        
        // Guardar estado
        this.saveEditorState(this.activeEditorId);
    }

    showToast(message, isError = false, duration = 3000) {
        const activeEditor = this.getActiveEditor();
        if (activeEditor) {
            activeEditor.showToast(message, isError, duration);
        } else {
            console.log(isError ? '[ERROR]' : '[INFO]', message);
        }
    }

    showError(title, error) {
        this.showToast(`${title}: ${error.message}`, true);
        console.error(title, error);
    }
}