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
	loadSettings();
	configBtn.addEventListener("click", openConfigForm);
	closeForm.addEventListener("click", closeConfigForm);
	cancelBtn.addEventListener("click", closeConfigForm);
	resetBtn.addEventListener("click", resetSettings);
	settingsForm.addEventListener("submit", saveSettings);

	configForm.addEventListener("click", function (e) {
		if (e.target === configForm) {
			closeConfigForm();
		}
	});
});

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

	for (const [key, value] of formData.entries()) {
		settings[key] = value;
	}

	const checkboxes = settingsForm.querySelectorAll('input[type="checkbox"]');
	checkboxes.forEach((checkbox) => {
		settings[checkbox.name] = checkbox.checked;
	});

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

		if (window.minecraftTypesManager) {
			await window.minecraftTypesManager.reloadDefinitions();
		}

		applyEditorSettings(settings);
		showNotification("Configuración guardada correctamente", true);
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
		localStorage.removeItem(STORAGE_KEY);
		localStorage.removeItem("minecraft_typescript_config");
		settingsForm.reset();
		loadAndApplySettings();
		showNotification("Configuración restablecida correctamente", true);
		setTimeout(closeConfigForm, 1000);
	}
}

// Mostrar notificación
function showNotification(message, isSuccess) {
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
			max-width: 300px;
			width: auto;
			height: auto;
			max-height: 80px;
			overflow: hidden;
			box-sizing: border-box;
		`;
		document.body.appendChild(notification);
	}

	notification.textContent = message;
	notification.className = `notification ${isSuccess ? "success" : "error"}`;
	notification.style.backgroundColor = isSuccess ? "#4CAF50" : "#f44336";
	notification.style.opacity = "1";
	notification.style.transform = "translateX(0)";

	setTimeout(() => {
		notification.style.opacity = "0";
		notification.style.transform = "translateX(100%)";
	}, 3000);
}

// Aplicar configuración básica al editor usando configuraciones nativas de Monaco
function applyEditorSettings(settings) {
	if (window.editorManager && window.editorManager.editor) {
		const editor = window.editorManager.editor;

		// Configuración usando opciones nativas de Monaco Editor
		editor.updateOptions({
			// Configuración básica
			fontSize: parseInt(settings.fontSize) || 14,
			lineNumbers: settings.lineNumbers !== false ? "on" : "off",
			wordWrap: settings.wordWrap === true ? "on" : "off",

			// Configuraciones de formato nativas
			formatOnType: settings.formatOnType === true,
			formatOnPaste: settings.formatOnPaste === true,

			// Autocompletado nativo
			suggest: {
				preview: settings.enablePreview !== false,
				showMethods: settings.showMethods !== false,
				showFunctions: settings.showFunctions !== false,
				showConstructors: settings.showConstructors !== false,
				showFields: settings.showFields !== false,
				showKeywords: settings.showKeywords !== false,
				showSnippets: settings.showSnippets !== false
			},

			// Configuración de hover nativa
			hover: {
				enabled: settings.enableHover !== false,
				delay: parseInt(settings.hoverDelay) || 300
			},

			// Comportamiento del cursor nativo
			cursorBlinking: settings.cursorBlinking || "blink",
			cursorSmoothCaretAnimation: settings.smoothCursor === true,

			// Selección y scrolling nativos
			selectOnLineNumbers: settings.selectOnLineNumbers === true,
			smoothScrolling: settings.smoothScrolling === true,
			mouseWheelZoom: settings.mouseWheelZoom === true,

			// Brackets y indentación nativos
			autoClosingBrackets:
				settings.autoClosingBrackets !== false ? "always" : "never",
			autoClosingQuotes:
				settings.autoClosingQuotes !== false ? "always" : "never",
			autoIndent: settings.autoIndent !== false ? "full" : "none",

			// Renderizado nativo
			renderWhitespace: settings.renderWhitespace || "none",
			renderControlCharacters: settings.renderControlCharacters === true,
			renderLineHighlight: settings.renderLineHighlight || "line",

			// Minimap nativo
			minimap: {
				enabled: settings.minimap === true,
				side: settings.minimapSide || "right",
				showSlider: settings.minimapShowSlider || "mouseover"
			}
		});

		// Aplicar tema usando API nativa
		if (settings.theme) {
			monaco.editor.setTheme(
				settings.theme === "light" ? "vs" : "vs-dark"
			);
		}

		// Aplicar tamaño de tabulación a todos los modelos
		if (settings.tabSize) {
			const allModels = monaco.editor.getModels();
			allModels.forEach((model) => {
				model.updateOptions({ tabSize: parseInt(settings.tabSize) });
			});
		}

		// Configurar diagnósticos de TypeScript usando API nativa
		if (settings.enableLinting !== false) {
			monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(
				{
					noSemanticValidation: settings.semanticValidation === false,
					noSyntaxValidation: settings.syntaxValidation === false,
					noSuggestionDiagnostics:
						settings.suggestionDiagnostics === false
				}
			);
		}

		// Auto-guardado usando eventos nativos de Monaco
		if (settings.autoSave && settings.autoSaveInterval) {
			const interval = parseInt(settings.autoSaveInterval) * 60000;

			if (window.autoSaveDisposable) {
				window.autoSaveDisposable.dispose();
			}

			window.autoSaveDisposable = editor.onDidChangeModelContent(() => {
				if (window.autoSaveTimeout) {
					clearTimeout(window.autoSaveTimeout);
				}

				window.autoSaveTimeout = setTimeout(() => {
					console.log("Auto-guardado activado");
				}, interval);
			});
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
	loadAndApplySettings
};
