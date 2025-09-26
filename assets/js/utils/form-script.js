// Variables globales
const configForm = document.getElementById("config-form");
const configBtn = document.getElementById("config-btn");
const closeForm = document.getElementById("close-form");
const cancelBtn = document.getElementById("cancel-btn");
const resetBtn = document.getElementById("reset-btn");
const settingsForm = document.getElementById("settings-form");
const STORAGE_KEY = "mcbeditor_settings";

// Inicialización cuando el DOM está listo
document.addEventListener("DOMContentLoaded", function () {
	// Cargar configuración guardada si existe
	loadSettings();

	// Configurar event listeners
	configBtn.addEventListener("click", openConfigForm);
	closeForm.addEventListener("click", closeConfigForm);
	cancelBtn.addEventListener("click", closeConfigForm);
	resetBtn.addEventListener("click", resetSettings);
	settingsForm.addEventListener("submit", saveSettings);

	// Cerrar al hacer clic fuera del formulario
	configForm.addEventListener("click", function (e) {
		if (e.target === configForm) {
			closeConfigForm();
		}
	});

	// Configurar eventos específicos para opciones avanzadas
	setupAdvancedEventListeners();
});

// Configurar event listeners para opciones avanzadas
function setupAdvancedEventListeners() {
	// Event listener para format on type
	const formatOnTypeCheckbox = document.getElementById("format-on-type");
	if (formatOnTypeCheckbox) {
		formatOnTypeCheckbox.addEventListener("change", (e) => {
			const settings = JSON.parse(
				localStorage.getItem(STORAGE_KEY) || "{}"
			);
			settings.formatOnType = e.target.checked;
			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
			applyFormatSettings();
		});
	}

	// Event listener para format on paste
	const formatOnPasteCheckbox = document.getElementById("format-on-paste");
	if (formatOnPasteCheckbox) {
		formatOnPasteCheckbox.addEventListener("change", (e) => {
			const settings = JSON.parse(
				localStorage.getItem(STORAGE_KEY) || "{}"
			);
			settings.formatOnPaste = e.target.checked;
			localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
			applyFormatSettings();
		});
	}
}

// Abrir el formulario de configuración
function openConfigForm() {
	configForm.classList.add("active");
}

// Cerrar el formulario de configuración
function closeConfigForm() {
	configForm.classList.remove("active");
}

// Cargar configuración desde localStorage
function loadSettings() {
	const savedSettings = localStorage.getItem(STORAGE_KEY);

	if (savedSettings) {
		try {
			const settings = JSON.parse(savedSettings);

			// Rellenar el formulario con los valores guardados
			for (const key in settings) {
				const input = settingsForm.elements[key];

				if (input) {
					if (input.type === "checkbox") {
						input.checked = settings[key];
					} else {
						input.value = settings[key];
					}
				}
			}
		} catch (e) {
			console.error("Error al cargar la configuración:", e);
			showNotification(
				"Error al cargar la configuración guardada",
				false
			);
		}
	}
}

// Guardar configuración en localStorage
async function saveSettings(e) {
	e.preventDefault();

	const formData = new FormData(settingsForm);
	const settings = {};

	// Convertir FormData a objeto
	for (const [key, value] of formData.entries()) {
		settings[key] = value;
	}

	// Procesar checkboxes (no se incluyen en FormData si no están checked)
	const checkboxes = settingsForm.querySelectorAll('input[type="checkbox"]');
	checkboxes.forEach((checkbox) => {
		settings[checkbox.name] = checkbox.checked;
	});

	try {
		// Guardar en localStorage como JSON
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

		// Cargar definiciones TypeScript si está disponible
		if (window.minecraftTypesManager) {
			await window.minecraftTypesManager.reloadDefinitions();
		}

		// Aplicar configuración inmediatamente
		applyEditorSettings(settings);
		applyFormatSettings();
		applyAdvancedSettings(settings);

		// Mostrar mensaje de éxito
		showNotification("Configuración guardada correctamente", true);

		// Cerrar el formulario después de guardar
		setTimeout(closeConfigForm, 1000);
	} catch (e) {
		console.error("Error al guardar la configuración:", e);
		showNotification("Error al guardar la configuración", false);
	}
}

// Restablecer configuración a valores predeterminados
function resetSettings() {
	if (
		confirm(
			"¿Estás seguro de que quieres restablecer la configuración a los valores predeterminados?"
		)
	) {
		// Eliminar la configuración guardada
		localStorage.removeItem(STORAGE_KEY);

		// También limpiar configuración de TypeScript si existe
		localStorage.removeItem("minecraft_typescript_config");

		// Restablecer el formulario
		settingsForm.reset();

		// Aplicar configuración predeterminada
		loadAndApplySettings();

		// Mostrar mensaje de éxito
		showNotification("Configuración restablecida correctamente", true);

		// Cerrar el formulario después de restablecer
		setTimeout(closeConfigForm, 1000);
	}
}

// Mostrar notificación
function showNotification(message, isSuccess) {
	// Crear elemento de notificación si no existe
	let notification = document.querySelector(".notification");

	if (!notification) {
		notification = document.createElement("div");
		notification.className = "notification";
		notification.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			padding: 15px 20px;
			border-radius: 5px;
			color: white;
			font-weight: bold;
			z-index: 10000;
			opacity: 0;
			transform: translateX(100%);
			transition: all 0.3s ease;
		`;
		document.body.appendChild(notification);
	}

	// Configurar notificación
	notification.textContent = message;
	notification.className = `notification ${isSuccess ? "success" : "error"}`;
	notification.style.backgroundColor = isSuccess ? "#4CAF50" : "#f44336";
	notification.style.opacity = "1";
	notification.style.transform = "translateX(0)";

	// Ocultar notificación después de 3 segundos
	setTimeout(() => {
		notification.style.opacity = "0";
		notification.style.transform = "translateX(100%)";
	}, 3000);
}

// Aplicar configuración básica al editor
function applyEditorSettings(settings) {
	if (window.editorManager && window.editorManager.editor) {
		const editor = window.editorManager.editor;

		// Aplicar tema
		if (settings.theme) {
			monaco.editor.setTheme(
				settings.theme === "light" ? "vs" : "vs-dark"
			);
		}

		// Aplicar tamaño de fuente
		if (settings.fontSize) {
			editor.updateOptions({ fontSize: parseInt(settings.fontSize) });
		}

		// Aplicar tamaño de tabulación
		if (settings.tabSize) {
			const allModels = monaco.editor.getModels();
			allModels.forEach((model) => {
				model.updateOptions({ tabSize: parseInt(settings.tabSize) });
			});
		}

		// Aplicar números de línea
		if (settings.lineNumbers !== undefined) {
			editor.updateOptions({
				lineNumbers: settings.lineNumbers ? "on" : "off"
			});
		}

		// Aplicar ajuste de línea
		if (settings.wordWrap !== undefined) {
			editor.updateOptions({
				wordWrap: settings.wordWrap ? "on" : "off"
			});
		}

		// Configuraciones avanzadas del editor
		editor.updateOptions({
			// Autocompletado
			suggest: {
				preview: settings.enablePreview !== false,
				showMethods: settings.showMethods !== false,
				showFunctions: settings.showFunctions !== false,
				showConstructors: settings.showConstructors !== false,
				showFields: settings.showFields !== false,
				showKeywords: settings.showKeywords !== false,
				showSnippets: settings.showSnippets !== false
			},

			// Validación y diagnósticos
			hover: {
				enabled: settings.enableHover !== false,
				delay: parseInt(settings.hoverDelay) || 300
			},

			// Comportamiento del cursor
			cursorBlinking: settings.cursorBlinking || "blink",
			cursorSmoothCaretAnimation: settings.smoothCursor === true,

			// Selección y scrolling
			selectOnLineNumbers: settings.selectOnLineNumbers === true,
			smoothScrolling: settings.smoothScrolling === true,
			mouseWheelZoom: settings.mouseWheelZoom === true,

			// Brackets y indentación
			autoClosingBrackets:
				settings.autoClosingBrackets !== false ? "always" : "never",
			autoClosingQuotes:
				settings.autoClosingQuotes !== false ? "always" : "never",
			autoIndent: settings.autoIndent !== false ? "full" : "none",

			// Renderizado
			renderWhitespace: settings.renderWhitespace || "none",
			renderControlCharacters: settings.renderControlCharacters === true,
			renderLineHighlight: settings.renderLineHighlight || "line",

			// Minimap
			minimap: {
				enabled: settings.minimap === true,
				side: settings.minimapSide || "right",
				showSlider: settings.minimapShowSlider || "mouseover"
			}
		});
	}
}

// Aplicar configuraciones de formato
function applyFormatSettings() {
	const settings = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

	if (window.editorManager && window.editorManager.editor) {
		const editor = window.editorManager.editor;

		// Configurar format on type
		if (settings.formatOnType) {
			// Agregar listener para format on type
			editor.onDidType(() => {
				if (settings.formatOnType) {
					setTimeout(() => {
						editor.getAction("editor.action.formatDocument").run();
					}, 100);
				}
			});
		}

		// Configurar format on save (se activaría con Ctrl+S)
		if (settings.formatOnSave) {
			editor.addCommand(
				monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
				() => {
					editor.getAction("editor.action.formatDocument").run();
				}
			);
		}

		// Configurar format on paste
		editor.onDidPaste(() => {
			if (settings.formatOnPaste) {
				setTimeout(() => {
					editor.getAction("editor.action.formatDocument").run();
				}, 100);
			}
		});
	}
}

// Aplicar configuraciones avanzadas
function applyAdvancedSettings(settings) {
	if (window.editorManager && window.editorManager.editor) {
		const editor = window.editorManager.editor;

		// Auto-guardado
		if (settings.autoSave && settings.autoSaveInterval) {
			const interval = parseInt(settings.autoSaveInterval) * 60000; // Convertir a milisegundos

			if (window.autoSaveInterval) {
				clearInterval(window.autoSaveInterval);
			}

			window.autoSaveInterval = setInterval(() => {
				// Aquí podrías implementar lógica de auto-guardado
				console.log("Auto-guardado activado");
			}, interval);
		}

		// Configuración de validación de código
		if (settings.enableLinting !== false) {
			monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(
				{
					noSemanticValidation: !settings.semanticValidation,
					noSyntaxValidation: !settings.syntaxValidation,
					noSuggestionDiagnostics: !settings.suggestionDiagnostics
				}
			);
		}
	}
}

// Cargar y aplicar configuración cuando esté disponible
function loadAndApplySettings() {
	const savedSettings = localStorage.getItem(STORAGE_KEY);
	if (savedSettings) {
		try {
			const settings = JSON.parse(savedSettings);
			applyEditorSettings(settings);
			applyFormatSettings();
			applyAdvancedSettings(settings);
		} catch (e) {
			console.error("Error al aplicar la configuración:", e);
		}
	}
}

// Escuchar cambios en la configuración
window.addEventListener("storage", function (e) {
	if (e.key === STORAGE_KEY) {
		loadAndApplySettings();
	}
});

// Exportar funciones para uso global
window.ConfigManager = {
	openConfigForm,
	closeConfigForm,
	loadSettings,
	saveSettings,
	resetSettings,
	applyEditorSettings,
	loadAndApplySettings,
	applyFormatSettings,
	applyAdvancedSettings
};
