import "./utils/form-script.js";
import EditorManager from "./core/EditorManager.js";
import TypesManager from "./utils/TypesManager.js";
import MinecraftStaticDebugger from "./utils/MinecraftStaticDebugger.js";
import MobileEditorToolbar from "./utils/Toolbar.js";
import StatusBarManager from "./utils/StatusBarManager.js";
import PWAManager from "./utils/pwa-manager.js";

// Inicializar cuando la página cargue
document.addEventListener("DOMContentLoaded", async () => {
	// Inicializar PWA Manager primero
	window.pwaManager = new PWAManager();

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

	// Inicializar StatusBar después del editor
	window.statusBarManager = new StatusBarManager(window.editorManager);

	// Toolbar móvil
	if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
		window.mobileToolbar = new MobileEditorToolbar();
	}

	// Esperar a que Monaco esté disponible antes de inicializar tipos y debugger
	const waitForMonaco = () => {
		return new Promise((resolve) => {
			const checkMonaco = () => {
				if (window.monaco) {
					resolve();
				} else {
					setTimeout(checkMonaco, 100);
				}
			};
			checkMonaco();
		});
	};

	await waitForMonaco();

	// Inicializar el gestor de tipos TypeScript
	window.minecraftTypesManager = new TypesManager();

	// Inicializar el debugger estático después del types manager
	window.staticDebugger = new MinecraftStaticDebugger(
		window.minecraftTypesManager
	);

	// Configurar botón de debug
	const debugBtn = document.getElementById("debug-btn");
	if (debugBtn) {
		debugBtn.addEventListener("click", () => {
			if (window.staticDebugger) {
				window.staticDebugger.toggle();
			}
		});
	}

	// Configurar botón de aplicar configuración
	const applyBtn = document.getElementById("apply-btn");
	if (applyBtn) {
		applyBtn.addEventListener("click", async () => {
			if (window.ConfigManager && window.ConfigManager.saveSettings) {
				await window.ConfigManager.saveSettings();
			}
			if (window.minecraftTypesManager) {
				await window.minecraftTypesManager.reloadDefinitions();
			}
		});
	}

	// Cargar y aplicar configuración del editor
	setTimeout(() => {
		if (window.ConfigManager && window.ConfigManager.loadAndApplySettings) {
			window.ConfigManager.loadAndApplySettings();
		}
	}, 1000);

	// Cargar definiciones TypeScript después de un breve delay
	setTimeout(async () => {
		if (window.minecraftTypesManager) {
			await window.minecraftTypesManager.loadTypeScriptDefinitions();
		}
	}, 1500);
});

// Hacer clases disponibles globalmente
window.EditorManager = EditorManager;
window.MinecraftStaticDebugger = MinecraftStaticDebugger;