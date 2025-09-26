export default class SnippetsManager {
    constructor() {
        this.snippets = {
            'custom-component': {
                name: 'Custom Component - Block',
                code: 'import { system } from \'@minecraft/server\';\n\nsystem.beforeEvents.startup.subscribe(ev => {\n    ev.blockComponentRegistry.registerCustomComponent(\'name:component\', {\n        // onPlace: (data, { params }) => {\n            // Tu código aquí\n            // const { block } = data;\n            // console.log(`Bloque colocado en: ${block.location.x}, ${block.location.y}, ${block.location.z}`);\n            \n            \n            // Ejemplo: Ejecutar acciones cuando se coloca el bloque\n            // const dimension = block.dimension;\n            // dimension.runCommand(`say ¡Bloque personalizado colocado!`);\n        // }\n    })\n})',
                description: 'Un custom component basico para bloques personalizados.'
            }
        };
        
        this.modal = null;
        this.createModal();
    }
    
    // Crear el modal de snippets
    createModal() {
        this.modal = document.createElement('div');
        this.modal.className = 'snippets-modal';
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
            <div class="snippets-container" style="
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
                <div class="snippets-header" style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    color: #fff;
                ">
                    <h3>Seleccionar Snippet</h3>
                    <button class="close-snippets" style="
                        background: none;
                        border: none;
                        color: #fff;
                        font-size: 20px;
                        cursor: pointer;
                    ">&times;</button>
                </div>
                <div class="snippets-list" style="
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
        // Cerrar modal
        this.modal.querySelector('.close-snippets').addEventListener('click', () => {
            this.hide();
        });
        
        // Cerrar al hacer clic fuera
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });
    }
    
    // Mostrar el modal de snippets
    show(editor) {
        this.currentEditor = editor;
        this.renderSnippets();
        this.modal.style.display = 'block';
    }
    
    // Ocultar el modal
    hide() {
        this.modal.style.display = 'none';
    }
    
    // Renderizar la lista de snippets
    renderSnippets() {
        const container = this.modal.querySelector('.snippets-list');
        container.innerHTML = '';
        
        Object.keys(this.snippets).forEach(key => {
            const snippet = this.snippets[key];
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
                <div style="font-weight: bold; margin-bottom: 5px;">${snippet.name}</div>
                <div style="font-size: 12px; color: #ccc;">${snippet.description}</div>
            `;
            
            item.addEventListener('click', () => {
                this.insertSnippet(key);
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
    
    // Insertar snippet en el editor
    insertSnippet(key) {
        if (!this.currentEditor || !this.snippets[key]) return;
        
        const snippet = this.snippets[key];
        const position = this.currentEditor.getPosition();
        
        // Procesar placeholders del snippet
        let processedCode = this.processSnippetPlaceholders(snippet.code);
        
        // Insertar el código en la posición del cursor
        this.currentEditor.executeEdits('snippet-insertion', [{
            range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column
            },
            text: processedCode
        }]);
        
        this.hide();
    }
    
    // Procesar placeholders del snippet (simplificado)
    processSnippetPlaceholders(code) {
        // Remover los placeholders de VSCode-style y usar texto por defecto
        return code.replace(/\$\{\d+:([^}]+)\}/g, '$1').replace(/\$\{\d+\}/g, '');
    }
    
    // Agregar nuevo snippet programáticamente
    addSnippet(key, name, code, description) {
        this.snippets[key] = {
            name: name,
            code: code,
            description: description
        };
    }
}