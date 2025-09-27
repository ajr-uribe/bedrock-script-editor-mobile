// StatusBarManager.js - Sistema de barra de estado y auto-guardado mejorado
class StatusBarManager {
	constructor(editorManager) {
		this.editorManager = editorManager;
		this.statusBar = null;
		this.autoSaveInterval = null;
		this.lastSaveTime = null;
		this.hasUnsavedChanges = false;
		this.autoSaveEnabled = true;
		this.autoSaveDelay = 5000; // 5 segundos por defecto

		this.init();
	}

	init() {
		this.createStatusBar();
		this.createMobileSaveButton();
		this.setupAutoSave();
		this.setupEventListeners();
		this.updateStatusBar();
	}

	// Crear la barra de estado
	createStatusBar() {
		this.statusBar = document.createElement("div");
		this.statusBar.id = "editor-status-bar";
		this.statusBar.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 24px;
            background: #007ACC;
            color: white;
            font-family: 'Segoe UI', monospace;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 15px;
            z-index: 999;
            border-top: 1px solid #005a9e;
        `;

		this.statusBar.innerHTML = `
            <div class="status-left">
                <span id="file-info">Sin archivo</span>
                <span id="cursor-info" style="margin-left: 15px;">Línea 1, Columna 1</span>
                <span id="selection-info" style="margin-left: 15px;"></span>
            </div>
            <div class="status-right">
                <span id="save-status">Guardado</span>
                <span id="file-stats" style="margin-left: 15px;">0 líneas, 0 caracteres</span>
                <span id="editor-language" style="margin-left: 15px;">JavaScript</span>
            </div>
        `;

		// Insertar antes del editor para que no lo cubra
		const editorContainer = document.querySelector(".editor-container");
		if (editorContainer) {
			editorContainer.style.paddingBottom = "24px";
		}

		document.body.appendChild(this.statusBar);
	}

	createMobileSaveButton() {
		// Solo crear en dispositivos móviles
		if (!("ontouchstart" in window) && !navigator.maxTouchPoints) return;

		const saveButton = document.createElement("button");
		saveButton.id = "mobile-save-btn";
		saveButton.innerHTML = "💾";
		saveButton.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 40px;
        height: 40px;
        background: #007ACC;
        border: none;
        color: white;
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        z-index: 1001;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
    `;

		saveButton.addEventListener("click", () => {
			this.performManualSave();
			this.showSaveNotification();
		});

		// Efecto visual al tocar
		saveButton.addEventListener("touchstart", () => {
			saveButton.style.transform = "scale(0.95)";
			saveButton.style.background = "#005a9e";
		});

		saveButton.addEventListener("touchend", () => {
			saveButton.style.transform = "scale(1)";
			saveButton.style.background = "#007ACC";
		});

		document.body.appendChild(saveButton);
	}

	// Mostrar notificación de guardado para móvil
	showSaveNotification() {
		const notification = document.createElement("div");
		notification.style.cssText = `
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 25px;
        font-size: 14px;
        z-index: 2000;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
		notification.textContent = "💾 Guardado exitosamente";

		document.body.appendChild(notification);

		// Animación de entrada
		setTimeout(() => (notification.style.opacity = "1"), 100);

		// Remover después de 2 segundos
		setTimeout(() => {
			notification.style.opacity = "0";
			setTimeout(() => document.body.removeChild(notification), 300);
		}, 2000);
	}

	// Configurar auto-guardado mejorado
	setupAutoSave() {
		// Cargar configuración de auto-guardado
		this.loadAutoSaveConfig();

		// Configurar auto-guardado basado en eventos del editor
		if (this.editorManager && this.editorManager.editor) {
			this.setupEditorAutoSave();
		}
	}

	// Configurar auto-guardado para el editor actual
	setupEditorAutoSave() {
		const editor = this.editorManager.editor;

		if (this.contentChangeDisposable) {
			this.contentChangeDisposable.dispose();
		}

		// Escuchar cambios en el contenido
		this.contentChangeDisposable = editor.onDidChangeModelContent(() => {
			this.hasUnsavedChanges = true;
			this.updateSaveStatus("No guardado");
			this.scheduleAutoSave();
		});

		// Escuchar cambios de posición del cursor
		if (this.cursorChangeDisposable) {
			this.cursorChangeDisposable.dispose();
		}

		this.cursorChangeDisposable = editor.onDidChangeCursorPosition(() => {
			this.updateCursorInfo();
		});

		// Escuchar cambios de selección
		if (this.selectionChangeDisposable) {
			this.selectionChangeDisposable.dispose();
		}

		this.selectionChangeDisposable = editor.onDidChangeCursorSelection(
			() => {
				this.updateSelectionInfo();
			}
		);
	}

	// Programar auto-guardado
	scheduleAutoSave() {
		if (!this.autoSaveEnabled) return;

		// Limpiar timeout anterior
		if (this.autoSaveTimeout) {
			clearTimeout(this.autoSaveTimeout);
		}

		// Programar nuevo auto-guardado
		this.autoSaveTimeout = setTimeout(() => {
			this.performAutoSave();
		}, this.autoSaveDelay);
	}

	// Realizar auto-guardado
	performAutoSave() {
		if (!this.hasUnsavedChanges || !this.editorManager) return;

		try {
			// Guardar todos los modelos en localStorage
			this.editorManager.saveModels();

			this.hasUnsavedChanges = false;
			this.lastSaveTime = new Date();
			this.updateSaveStatus("Guardado automáticamente");

			// Limpiar el estado después de 2 segundos
			setTimeout(() => {
				if (!this.hasUnsavedChanges) {
					this.updateSaveStatus("Guardado");
				}
			}, 2000);
		} catch (error) {
			console.error("Error en auto-guardado:", error);
			this.updateSaveStatus("Error al guardar");
		}
	}

	// Configurar event listeners
	setupEventListeners() {
		// Escuchar cambios de tab activo
		document.addEventListener("tab-switched", () => {
			this.updateStatusBar();
			this.setupEditorAutoSave();
		});

		// Escuchar teclas de atajo para guardado manual
		document.addEventListener("keydown", (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === "s") {
				e.preventDefault();
				this.performManualSave();
			}
		});

		// Hacer la barra de estado clickeable para mostrar más info
		this.statusBar.addEventListener("click", (e) => {
			if (e.target.id === "save-status") {
				this.showSaveOptions();
			}
		});
	}

	// Realizar guardado manual
	performManualSave() {
		if (!this.editorManager) return;

		try {
			this.editorManager.saveModels();
			this.hasUnsavedChanges = false;
			this.lastSaveTime = new Date();
			this.updateSaveStatus("Guardado manualmente");

			setTimeout(() => {
				if (!this.hasUnsavedChanges) {
					this.updateSaveStatus("Guardado");
				}
			}, 2000);
		} catch (error) {
			console.error("Error en guardado manual:", error);
			this.updateSaveStatus("Error al guardar");
		}
	}

	// Actualizar información de la barra de estado
	updateStatusBar() {
		this.updateFileInfo();
		this.updateCursorInfo();
		this.updateSelectionInfo();
		this.updateFileStats();
		this.updateLanguageInfo();
	}

	// Actualizar información del archivo
	updateFileInfo() {
		const fileInfoElement = document.getElementById("file-info");
		if (!fileInfoElement) return;

		if (this.editorManager && this.editorManager.activeModelId) {
			const activeModel = this.editorManager.getActiveModel();
			if (activeModel) {
				fileInfoElement.textContent = activeModel.name || "Sin título";
			}
		} else {
			fileInfoElement.textContent = "Sin archivo";
		}
	}

	// Actualizar información del cursor
	updateCursorInfo() {
		const cursorInfoElement = document.getElementById("cursor-info");
		if (!cursorInfoElement || !this.editorManager?.editor) return;

		const position = this.editorManager.editor.getPosition();
		if (position) {
			cursorInfoElement.textContent = `Línea ${position.lineNumber}, Columna ${position.column}`;
		}
	}

	// Actualizar información de selección
	updateSelectionInfo() {
		const selectionInfoElement = document.getElementById("selection-info");
		if (!selectionInfoElement || !this.editorManager?.editor) return;

		const selection = this.editorManager.editor.getSelection();
		if (selection && !selection.isEmpty()) {
			const selectedText = this.editorManager.editor
				.getModel()
				.getValueInRange(selection);
			const lines = selectedText.split("\n").length;
			const chars = selectedText.length;

			if (lines > 1) {
				selectionInfoElement.textContent = `${lines} líneas, ${chars} caracteres seleccionados`;
			} else {
				selectionInfoElement.textContent = `${chars} caracteres seleccionados`;
			}
		} else {
			selectionInfoElement.textContent = "";
		}
	}

	// Actualizar estadísticas del archivo
	updateFileStats() {
		const fileStatsElement = document.getElementById("file-stats");
		if (!fileStatsElement || !this.editorManager?.editor) return;

		const model = this.editorManager.editor.getModel();
		if (model) {
			const lineCount = model.getLineCount();
			const charCount = model.getValue().length;
			const wordCount = model
				.getValue()
				.split(/\s+/)
				.filter((word) => word.length > 0).length;

			fileStatsElement.textContent = `${lineCount} líneas, ${wordCount} palabras, ${charCount} caracteres`;
		}
	}

	// Actualizar información del lenguaje
	updateLanguageInfo() {
		const languageElement = document.getElementById("editor-language");
		if (!languageElement || !this.editorManager?.editor) return;

		const model = this.editorManager.editor.getModel();
		if (model) {
			const language = model.getLanguageId();
			languageElement.textContent =
				language === "javascript" ? "JavaScript" : language;
		}
	}

	// Actualizar estado de guardado
	updateSaveStatus(status) {
		const saveStatusElement = document.getElementById("save-status");
		if (saveStatusElement) {
			saveStatusElement.textContent = status;

			// Cambiar color según el estado
			if (status.includes("Error")) {
				saveStatusElement.style.color = "#f44336";
			} else if (status.includes("No guardado")) {
				saveStatusElement.style.color = "#FF9800";
			} else {
				saveStatusElement.style.color = "white";
			}
		}
	}

	// Mostrar opciones de guardado
	showSaveOptions() {
		const modal = document.createElement("div");
		modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        `;

		modal.innerHTML = `
            <div style="
                background: #2d2d2d;
                padding: 20px;
                border-radius: 8px;
                color: white;
                font-family: 'Segoe UI', sans-serif;
                min-width: 300px;
            ">
                <h3 style="margin: 0 0 15px 0;">Configuración de Guardado</h3>
                
                <div style="margin: 10px 0;">
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" id="auto-save-toggle" ${
							this.autoSaveEnabled ? "checked" : ""
						} 
                               style="margin-right: 10px;">
                        Habilitar auto-guardado
                    </label>
                </div>
                
                <div style="margin: 15px 0;">
                    <label style="display: block; margin-bottom: 5px;">
                        Intervalo de auto-guardado (segundos):
                    </label>
                    <input type="range" id="auto-save-interval" min="1" max="30" 
                           value="${this.autoSaveDelay / 1000}"
                           style="width: 100%; margin-bottom: 5px;">
                    <div style="font-size: 12px; color: #ccc;">
                        <span id="interval-display">${
							this.autoSaveDelay / 1000
						}</span> segundos
                    </div>
                </div>
                
                <div style="margin-top: 20px; text-align: right;">
                    <button id="save-config-cancel" style="
                        background: none;
                        border: 1px solid #666;
                        color: white;
                        padding: 8px 15px;
                        margin-right: 10px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Cancelar</button>
                    <button id="save-config-apply" style="
                        background: #007ACC;
                        border: none;
                        color: white;
                        padding: 8px 15px;
                        border-radius: 4px;
                        cursor: pointer;
                    ">Aplicar</button>
                </div>
            </div>
        `;

		document.body.appendChild(modal);

		// Actualizar display del intervalo
		const intervalSlider = modal.querySelector("#auto-save-interval");
		const intervalDisplay = modal.querySelector("#interval-display");

		intervalSlider.addEventListener("input", (e) => {
			intervalDisplay.textContent = e.target.value;
		});

		// Manejar botones
		modal
			.querySelector("#save-config-cancel")
			.addEventListener("click", () => {
				document.body.removeChild(modal);
			});

		modal
			.querySelector("#save-config-apply")
			.addEventListener("click", () => {
				const autoSaveEnabled =
					modal.querySelector("#auto-save-toggle").checked;
				const autoSaveDelay =
					parseInt(modal.querySelector("#auto-save-interval").value) *
					1000;

				this.updateAutoSaveConfig(autoSaveEnabled, autoSaveDelay);
				document.body.removeChild(modal);
			});

		// Cerrar al hacer click fuera
		modal.addEventListener("click", (e) => {
			if (e.target === modal) {
				document.body.removeChild(modal);
			}
		});
	}

	// Cargar configuración de auto-guardado
	loadAutoSaveConfig() {
		const config = localStorage.getItem("editor_autosave_config");
		if (config) {
			try {
				const parsed = JSON.parse(config);
				this.autoSaveEnabled = parsed.enabled !== false;
				this.autoSaveDelay = parsed.delay || 5000;
			} catch (e) {
				console.warn("Error loading autosave config:", e);
			}
		}
	}

	// Actualizar configuración de auto-guardado
	updateAutoSaveConfig(enabled, delay) {
		this.autoSaveEnabled = enabled;
		this.autoSaveDelay = delay;

		// Guardar configuración
		localStorage.setItem(
			"editor_autosave_config",
			JSON.stringify({
				enabled: enabled,
				delay: delay
			})
		);

		// Aplicar cambios
		if (!enabled && this.autoSaveTimeout) {
			clearTimeout(this.autoSaveTimeout);
		}

		this.updateSaveStatus("Configuración actualizada");
		setTimeout(() => {
			if (!this.hasUnsavedChanges) {
				this.updateSaveStatus("Guardado");
			}
		}, 2000);
	}

	// Limpiar recursos
	dispose() {
		if (this.contentChangeDisposable) {
			this.contentChangeDisposable.dispose();
		}
		if (this.cursorChangeDisposable) {
			this.cursorChangeDisposable.dispose();
		}
		if (this.selectionChangeDisposable) {
			this.selectionChangeDisposable.dispose();
		}
		if (this.autoSaveTimeout) {
			clearTimeout(this.autoSaveTimeout);
		}
		if (this.statusBar) {
			this.statusBar.remove();
		}
	}
}

// Hacer disponible globalmente
window.StatusBarManager = StatusBarManager;

export default StatusBarManager;
