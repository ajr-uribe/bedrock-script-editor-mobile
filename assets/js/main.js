import "./utils/form-script.js";
import EditorManager from "./core/EditorManager.js";
import MobileEditorToolbar from "./utils/Toolbar.js";
import TypesManager from './utils/TypesManager.js';

// Inicializar cuando la página cargue
document.addEventListener("DOMContentLoaded", async () => {
	// Ocultar pantalla de carga después de 3 segundos
	setTimeout(() => {
		const loadingScreen = document.getElementById("loading-screen");
		loadingScreen.style.opacity = "0";
		loadingScreen.style.transition = "opacity 0.8s ease";
		setTimeout(() => {
			loadingScreen.style.display = "none";
		}, 1000);
	}, 3000);

	// Inicializar el editor
	window.editorManager = new EditorManager(
		document.getElementById("editor"),
		document.getElementById("tabs-container")
	);

	if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
		window.mobileToolbar = new MobileEditorToolbar();
	}

	document.getElementById("apply-btn").addEventListener("click", async () => {
		await window.ConfigManager.applyEditorSettings();
	});
	// Cargar y aplicar configuración del editor
	setTimeout(() => {
		if (window.ConfigManager && window.ConfigManager.loadAndApplySettings) {
			window.ConfigManager.loadAndApplySettings();
		}
	}, 1000);
});

// Hacer el EditorManager disponible globalmente
window.EditorManager = EditorManager;
