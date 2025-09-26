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
		// Mostrar mensaje de éxito
		showNotification("Configuración guardada correctamente", true);

		// Cerrar el formulario después de guardar
		setTimeout(closeConfigForm, 1000);
	} catch (e) {
		console.error("Error al guardar la configuración:", e);
		showNotification("Error al guardar la configuración", false);
	}
	
	loadAndApplySettings();
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

		// Restablecer el formulario
		settingsForm.reset();

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
		document.body.appendChild(notification);
	}

	// Configurar notificación
	notification.textContent = message;
	notification.className = `notification ${isSuccess ? "success" : "error"}`;
	notification.classList.add("show");

	// Ocultar notificación después de 3 segundos
	setTimeout(() => {
		notification.classList.remove("show");
	}, 3000);
}

// Aplicar configuración al editor
function applyEditorSettings(settings) {
	if (window.editorManager && window.editorManager.editor) {
		const editor = window.editorManager.editor;
		
		// Aplicar tema
		if (settings.theme) {
			monaco.editor.setTheme(settings.theme === 'light' ? 'vs' : 'vs-dark');
		}
		
		// Aplicar tamaño de fuente
		if (settings.fontSize) {
			editor.updateOptions({ fontSize: parseInt(settings.fontSize) });
		}
		
		// Aplicar tamaño de tabulación
		if (settings.tabSize) {
			editor.getModel().updateOptions({ tabSize: parseInt(settings.tabSize) });
		}
		
		// Aplicar números de línea
		if (settings.lineNumbers !== undefined) {
			editor.updateOptions({ lineNumbers: settings.lineNumbers ? 'on' : 'off' });
		}
		
		// Aplicar ajuste de línea
		if (settings.wordWrap !== undefined) {
			editor.updateOptions({ wordWrap: settings.wordWrap ? 'on' : 'off' });
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
window.addEventListener('storage', function(e) {
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