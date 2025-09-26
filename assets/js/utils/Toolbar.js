import SnippetsManager from "./SnippetsManager.js";
import ImportsManager from "./ImportsManager.js";

class MobileEditorToolbar {
	constructor() {
		this.currentState = 0; // 0 = hidden, 1 = first row, 2 = both rows
		this.activeEditor = null;
		this.modifierKeys = {
			ctrl: false,
			shift: false,
			alt: false
		};

		this.toolbar = null;
		this.isKeyboardVisible = false;

		// Mapa de comandos específicos de Monaco para mejor compatibilidad
		this.monacoCommands = {
			paste: "editor.action.clipboardPasteAction",
			copy: "editor.action.clipboardCopyAction",
			cut: "editor.action.clipboardCutAction",
			undo: "undo",
			redo: "redo",
			selectAll: "editor.action.selectAll",
			find: "actions.find",
			replace: "editor.action.startFindReplaceAction"
		};

		this.init();

		this.snippetsManager = new SnippetsManager();
		this.importsManager = new ImportsManager();
	}

	init() {
		this.createToolbar();
		this.preventFocusLoss();
		this.setupKeyboardDetection();
		this.setupEditorDetection();
		this.setupEventListeners();
	}

	// Crear la estructura HTML de la barra
	createToolbar() {
		this.toolbar = document.createElement("div");
		this.toolbar.className = "mobile-editor-toolbar";
		this.toolbar.style.cssText = `
            position: fixed;
            left: 0;
            right: 0;
            bottom: -120px;
            background: #2d2d2d;
            border-top: 1px solid #444;
            transition: bottom 0.3s ease;
            z-index: 1000;
            display: none;
        `;

		this.toolbar.innerHTML = `
            <div class="toolbar-toggle" style="
                text-align: center;
                padding: 8px;
                background: #363636;
                cursor: pointer;
                user-select: none;
                font-size: 14px;
                color: #fff;
            ">^</div>
            
            <div class="toolbar-row-1" style="
                display: flex;
                padding: 10px;
                gap: 8px;
                justify-content: space-around;
                display: none;
            ">
                <button data-key="Tab" class="toolbar-btn">Tab</button>
                <button data-modifier="ctrl" class="toolbar-btn modifier">Ctrl</button>
                <button data-modifier="shift" class="toolbar-btn modifier">Shift</button>
                <button data-action="commandPalette" class="toolbar-btn">F1</button>
                <button data-key="ArrowLeft" class="toolbar-btn">←</button>
                <button data-key="ArrowUp" class="toolbar-btn">↑</button>
                <button data-key="ArrowDown" class="toolbar-btn">↓</button>
                <button data-key="ArrowRight" class="toolbar-btn">→</button>
            </div>
            
            <div class="toolbar-row-2" style="
                display: flex;
                padding: 10px;
                gap: 8px;
                justify-content: space-around;
                display: none;
            ">
                <button data-action="snippets" class="toolbar-btn">Snippets</button>
                <button data-action="imports" class="toolbar-btn">Imports</button>
                <button data-action="reset" class="toolbar-btn">Reset</button>
                <button data-action="format" class="toolbar-btn">Format</button>
                <button data-action="moveUp" class="toolbar-btn">M↑</button>
                <button data-action="moveDown" class="toolbar-btn">M↓</button>
                <button data-action="copyUp" class="toolbar-btn">C↑</button>
                <button data-action="copyDown" class="toolbar-btn">C↓</button>
            </div>
        `;

		// Estilos para los botones
		const style = document.createElement("style");
		style.textContent = `
            .toolbar-btn {
                background: #404040;
                border: 1px solid #555;
                color: #fff;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                min-width: 35px;
                transition: all 0.2s;
            }
            
            .toolbar-btn:active {
                background: #505050;
            }
            
            .toolbar-btn.active {
                background: #007acc;
                border-color: #007acc;
            }
            
            .mobile-editor-toolbar.visible {
                display: block !important;
            }
        `;

		document.head.appendChild(style);
		document.body.appendChild(this.toolbar);
	}

	// Detectar cuando aparece/desaparece el teclado virtual
	setupKeyboardDetection() {
		let initialViewportHeight = window.visualViewport
			? window.visualViewport.height
			: window.innerHeight;

		const checkKeyboard = () => {
			const currentHeight = window.visualViewport
				? window.visualViewport.height
				: window.innerHeight;
			const keyboardVisible = currentHeight < initialViewportHeight * 0.8;

			if (keyboardVisible !== this.isKeyboardVisible) {
				this.isKeyboardVisible = keyboardVisible;
				this.updateToolbarVisibility();
			}
		};

		if (window.visualViewport) {
			window.visualViewport.addEventListener("resize", checkKeyboard);
		} else {
			window.addEventListener("resize", checkKeyboard);
		}

		window.addEventListener("orientationchange", () => {
			setTimeout(() => {
				initialViewportHeight = window.visualViewport
					? window.visualViewport.height
					: window.innerHeight;
				checkKeyboard();
			}, 500);
		});
	}

	// Detectar qué editor de Monaco está activo
	setupEditorDetection() {
		document.addEventListener("focusin", (e) => {
			// Buscar si el elemento enfocado es parte de un editor Monaco
			let element = e.target;
			while (element && element !== document.body) {
				if (
					element.classList &&
					element.classList.contains("monaco-editor")
				) {
					// Encontrar la instancia del editor
					const editorInstance = monaco.editor
						.getEditors()
						.find((editor) => {
							return (
								editor.getDomNode() === element ||
								editor.getDomNode().contains(element)
							);
						});

					if (editorInstance) {
						this.activeEditor = editorInstance;
						break;
					}
				}
				element = element.parentElement;
			}
		});
	}

	// Configurar todos los event listeners
	setupEventListeners() {
		// Función auxiliar para manejar múltiples tipos de eventos
		const addMultiEventListener = (element, handler) => {
			element.addEventListener("touchend", (e) => {
				e.preventDefault();
				handler(e);
			});
			element.addEventListener("click", handler);
		};

		// Toggle de la barra
		addMultiEventListener(
			this.toolbar.querySelector(".toolbar-toggle"),
			() => {
				this.toggleToolbar();
			}
		);

		// Botones de la primera fila
		this.toolbar
			.querySelectorAll(".toolbar-row-1 .toolbar-btn")
			.forEach((btn) => {
				addMultiEventListener(btn, (e) => this.handleFirstRowAction(e));
			});

		// Botones de la segunda fila
		this.toolbar
			.querySelectorAll(".toolbar-row-2 .toolbar-btn")
			.forEach((btn) => {
				addMultiEventListener(btn, (e) =>
					this.handleSecondRowAction(e)
				);
			});
	}

	// Manejar visibilidad de la barra según el teclado
	updateToolbarVisibility() {
		if (this.isKeyboardVisible && this.activeEditor) {
			this.toolbar.classList.add("visible");
			this.positionToolbar();
		} else {
			this.toolbar.classList.remove("visible");
			this.currentState = 0;
			this.updateToolbarAppearance();
		}
	}

	// Posicionar la barra encima del teclado
	positionToolbar() {
		const keyboardHeight =
			window.innerHeight -
			(window.visualViewport
				? window.visualViewport.height
				: window.innerHeight);
		this.toolbar.style.bottom = `${keyboardHeight}px`;
	}

	// Alternar entre estados de la barra
	toggleToolbar() {
		this.currentState = (this.currentState + 1) % 3;
		this.updateToolbarAppearance();
	}

	// Prevenir pérdida de foco al tocar la barra
	preventFocusLoss() {
		this.toolbar.addEventListener(
			"touchstart",
			(e) => {
				e.preventDefault();
				e.stopPropagation();
			},
			{ passive: false }
		);

		this.toolbar.addEventListener("mousedown", (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
	}

	// Actualizar apariencia según el estado
	updateToolbarAppearance() {
		const toggle = this.toolbar.querySelector(".toolbar-toggle");
		const row1 = this.toolbar.querySelector(".toolbar-row-1");
		const row2 = this.toolbar.querySelector(".toolbar-row-2");

		switch (this.currentState) {
			case 0: // Oculto
				toggle.textContent = "^";
				row1.style.display = "none";
				row2.style.display = "none";
				break;
			case 1: // Primera fila
				toggle.textContent = "^";
				row1.style.display = "flex";
				row2.style.display = "none";
				break;
			case 2: // Ambas filas
				toggle.textContent = "v";
				row1.style.display = "flex";
				row2.style.display = "flex";
				break;
		}
	}

	// Manejar acciones de la primera fila
	handleFirstRowAction(e) {
		const btn = e.target;

		if (btn.dataset.modifier) {
			this.toggleModifier(btn.dataset.modifier, btn);
		} else if (btn.dataset.key) {
			this.handleKeyAction(btn.dataset.key);
		} else if (btn.dataset.action) {
			this.executeAction(btn.dataset.action);
		}
	}

	// Manejar acciones de la segunda fila
	handleSecondRowAction(e) {
		const btn = e.target;
		this.executeAction(btn.dataset.action);
	}

	// Alternar estado de teclas modificadoras// Alternar estado de teclas modificadoras
	toggleModifier(modifier, btn) {
		// Caso especial para Ctrl - no funciona correctamente
		if (modifier === "ctrl") {
			// Mostrar mensaje informativo
			this.showTemporaryMessage(
				"Tecla Ctrl no funcional, estamos trabajando en ello"
			);
			return;
		}

		this.modifierKeys[modifier] = !this.modifierKeys[modifier];
		btn.classList.toggle("active", this.modifierKeys[modifier]);
	}

	// Agregar método para mostrar mensajes temporales
	showTemporaryMessage(message) {
		// Crear elemento de mensaje si no existe
		let messageElement = document.getElementById("mobile-toolbar-message");

		if (!messageElement) {
			messageElement = document.createElement("div");
			messageElement.id = "mobile-toolbar-message";
			messageElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #333;
            color: #fff;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 2001;
            font-size: 14px;
            text-align: center;
            border: 1px solid #555;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
			document.body.appendChild(messageElement);
		}

		// Mostrar mensaje
		messageElement.textContent = message;
		messageElement.style.opacity = "1";

		// Ocultar después de 3 segundos
		setTimeout(() => {
			messageElement.style.opacity = "0";
		}, 3000);
	}

	// Manejar acciones de teclas con lógica mejorada
	handleKeyAction(key) {
		if (!this.activeEditor) return;

		// Manejar combinaciones especiales con Ctrl
		if (this.modifierKeys.ctrl) {
			this.handleCtrlCombination(key);
			return;
		}

		// Manejar teclas direccionales
		if (key.startsWith("Arrow")) {
			this.handleArrowKey(key);
			return;
		}

		// Manejar Tab
		if (key === "Tab") {
			this.handleTabKey();
			return;
		}

		// Para otras teclas, usar el método original
		this.sendKeyEvent(key);
	}

	// Manejar combinaciones con Ctrl usando comandos específicos de Monaco
	handleCtrlCombination(key) {
		if (!this.activeEditor) return;

		const editorDom = this.activeEditor.getDomNode();

		// First, simulate the Ctrl key being pressed
		const ctrlKeyDown = new KeyboardEvent("keydown", {
			key: "Control",
			code: "ControlLeft",
			ctrlKey: true,
			bubbles: true,
			cancelable: true
		});

		// Then simulate the target key with Ctrl held down
		const targetKeyDown = new KeyboardEvent("keydown", {
			key: key,
			code: `Key${key.toUpperCase()}`,
			ctrlKey: true,
			bubbles: true,
			cancelable: true
		});

		// Dispatch the events in sequence
		editorDom.dispatchEvent(ctrlKeyDown);
		editorDom.dispatchEvent(targetKeyDown);

		// Clear the Ctrl modifier state
		this.clearModifiersExceptShift();
	}

	// Manejar teclas direccionales con soporte para selección con Shift
	handleArrowKey(key) {
		const position = this.activeEditor.getPosition();
		let newPosition = null;

		switch (key) {
			case "ArrowLeft":
				newPosition = {
					lineNumber: position.lineNumber,
					column: Math.max(1, position.column - 1)
				};
				break;
			case "ArrowRight":
				const lineContent = this.activeEditor
					.getModel()
					.getLineContent(position.lineNumber);
				newPosition = {
					lineNumber: position.lineNumber,
					column: Math.min(
						lineContent.length + 1,
						position.column + 1
					)
				};
				break;
			case "ArrowUp":
				newPosition = {
					lineNumber: Math.max(1, position.lineNumber - 1),
					column: position.column
				};
				break;
			case "ArrowDown":
				const lineCount = this.activeEditor.getModel().getLineCount();
				newPosition = {
					lineNumber: Math.min(lineCount, position.lineNumber + 1),
					column: position.column
				};
				break;
		}

		if (newPosition) {
			if (this.modifierKeys.shift) {
				// Con Shift mantenemos la selección y extendemos
				const currentSelection = this.activeEditor.getSelection();
				const newSelection = {
					startLineNumber: currentSelection.startLineNumber,
					startColumn: currentSelection.startColumn,
					endLineNumber: newPosition.lineNumber,
					endColumn: newPosition.column
				};
				this.activeEditor.setSelection(newSelection);
			} else {
				// Sin Shift, simplemente movemos el cursor
				this.activeEditor.setPosition(newPosition);
				// Limpiar modificadores excepto Shift para futuras operaciones
				this.clearModifiersExceptShift();
			}
		}
	}

	// Manejar Tab con soporte para indentación
	handleTabKey() {
		if (this.modifierKeys.shift) {
			// Shift + Tab para des-indentar
			this.activeEditor.trigger("keyboard", "editor.action.outdentLines");
		} else {
			// Tab normal para indentar
			this.activeEditor.trigger("keyboard", "editor.action.indentLines");
		}
		this.clearModifiersExceptShift();
	}

	// Enviar evento de teclado al editor activo (método original mantenido como fallback)
	sendKeyEvent(key) {
		if (!this.activeEditor) return;

		const event = new KeyboardEvent("keydown", {
			key: key,
			code: key,
			ctrlKey: this.modifierKeys.ctrl,
			shiftKey: this.modifierKeys.shift,
			altKey: this.modifierKeys.alt,
			bubbles: true
		});

		this.activeEditor.getDomNode().dispatchEvent(event);
		this.clearModifiersExceptShift();
	}

	// Ejecutar acciones personalizadas
	executeAction(action) {
		if (!this.activeEditor) return;

		switch (action) {
			case "commandPalette":
				this.activeEditor.trigger(
					"keyboard",
					"editor.action.quickCommand"
				);
				break;

			case "snippets":
				this.snippetsManager.show(this.activeEditor);
				break;

			case "imports":
				this.importsManager.show(this.activeEditor);
				break;

			case "reset":
				if (
					confirm(
						"¿Estás seguro de que quieres limpiar el contenido?"
					)
				) {
					this.activeEditor.setValue("");
				}
				break;

			case "format":
				this.activeEditor.trigger(
					"keyboard",
					"editor.action.formatDocument"
				);
				break;

			case "moveUp":
				this.activeEditor.trigger(
					"keyboard",
					"editor.action.moveLinesUpAction"
				);
				break;

			case "moveDown":
				this.activeEditor.trigger(
					"keyboard",
					"editor.action.moveLinesDownAction"
				);
				break;

			case "copyUp":
				this.activeEditor.trigger(
					"keyboard",
					"editor.action.copyLinesUpAction"
				);
				break;

			case "copyDown":
				this.activeEditor.trigger(
					"keyboard",
					"editor.action.copyLinesDownAction"
				);
				break;
		}

		this.clearModifiers();
	}

	// Limpiar modificadores después de usar (excepto Shift para selecciones continuas)
	clearModifiersExceptShift() {
		this.modifierKeys.ctrl = false;
		this.modifierKeys.alt = false;
		// Mantener Shift para selecciones continuas

		this.toolbar.querySelectorAll(".modifier").forEach((btn) => {
			if (
				btn.dataset.modifier === "ctrl" ||
				btn.dataset.modifier === "alt"
			) {
				btn.classList.remove("active");
			}
		});
	}

	// Limpiar todos los modificadores
	clearModifiers() {
		Object.keys(this.modifierKeys).forEach((key) => {
			this.modifierKeys[key] = false;
		});

		this.toolbar.querySelectorAll(".modifier").forEach((btn) => {
			btn.classList.remove("active");
		});
	}
}

// Instanciar automáticamente cuando se carga
document.addEventListener("DOMContentLoaded", () => {
	if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
		window.mobileToolbar = new MobileEditorToolbar();
	}
});

export default MobileEditorToolbar;
