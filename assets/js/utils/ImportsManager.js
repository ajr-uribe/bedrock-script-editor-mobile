export default class ImportsManager {
    constructor() {
        this.imports = {
            // Imports de React
            'server': {
                name: '@minecraft/server',
                code: "import { } from '@minecraft/server';",
                description: 'Import "@minecraft/server" API'
            },
            'server-ui': {
                name: '@minecraft/server-ui',
                code: "import { } from '@minecraft/server-ui';",
                description: 'Import "@minecraft/server-ui" API'
            }
        };
        
        this.modal = null;
        this.createModal();
    }
    
    // Crear el modal de imports (similar al de snippets)
    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'imports-modal';
        this.modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 2000;
            display: none;
        `;
        
        this.modal.innerHTML = `
            <div class="imports-container" style="
                background: #2d2d2d;
                border-radius: 8px;
                padding: 20px;
                margin: 20px;
                max-height: 70vh;
                overflow-y: auto;
                position: relative;
                top: 50%;
                transform: translateY(-50%);
            ">
                <div class="imports-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    color: #fff;
                ">
                    <h3>Seleccionar Import</h3>
                    <button class="close-imports" style="
                        background: none;
                        border: none;
                        color: #fff;
                        font-size: 20px;
                        cursor: pointer;
                    ">&times;</button>
                </div>
                <div class="imports-list" style="
                    display: grid;
                    gap: 10px;
                "></div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
        this.setupModalEvents();
    }
    
    // Configurar eventos del modal
    setupModalEvents() {
        this.modal.querySelector('.close-imports').addEventListener('click', () => {
            this.hide();
        });
        
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });
    }
    
    // Mostrar el modal de imports
    show(editor) {
        this.currentEditor = editor;
        this.renderImports();
        this.modal.style.display = 'block';
    }
    
    // Ocultar el modal
    hide() {
        this.modal.style.display = 'none';
    }
    
    // Renderizar la lista de imports
    renderImports() {
        const container = this.modal.querySelector('.imports-list');
        container.innerHTML = '';
        
        Object.keys(this.imports).forEach(key => {
            const importItem = this.imports[key];
            const item = document.createElement('div');
            item.style.cssText = `
                background: #404040;
                border: 1px solid #555;
                border-radius: 4px;
                padding: 12px;
                cursor: pointer;
                transition: background 0.2s;
                color: #fff;
            `;
            
            item.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 5px;">${importItem.name}</div>
                <div style="font-size: 12px; color: #ccc;">${importItem.description}</div>
            `;
            
            item.addEventListener('click', () => {
                this.insertImport(key);
            });
            
            item.addEventListener('mouseover', () => {
                item.style.background = '#505050';
            });
            
            item.addEventListener('mouseout', () => {
                item.style.background = '#404040';
            });
            
            container.appendChild(item);
        });
    }
    
    // Insertar import en el editor
    insertImport(key) {
        if (!this.currentEditor || !this.imports[key]) return;
        
        const importItem = this.imports[key];
        
        // Insertar al principio del documento
        this.currentEditor.executeEdits('import-insertion', [{
            range: {
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: 1,
                endColumn: 1
            },
            text: importItem.code + '\n'
        }]);
        
        this.hide();
    }
    
    // Agregar nuevo import programáticamente
    addImport(key, name, code, description) {
        this.imports[key] = {
            name: name,
            code: code,
            description: description
        };
    }
}
