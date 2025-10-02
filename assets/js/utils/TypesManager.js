// MinecraftTypesManager.js - Sistema para gestionar definiciones TypeScript de Minecraft
class MinecraftTypesManager {
	constructor() {
		this.baseUrl = "https://cdn.jsdelivr.net/npm/@minecraft";
		this.modules = ["server", "server-ui", "server-net", "server-gametest"];

		this.moduleVersions = {};
		this.loadedDefinitions = {};
		this.configElements = {};

		this.init();
	}

	async init() {
		await this.fetchAllAvailableVersions();
		this.addConfigurationToModal();
		this.setupConfigurationHandlers();
	}

	// Obtener versiones disponibles para todos los módulos
	async fetchAllAvailableVersions() {
		const versionPromises = this.modules.map((module) =>
			this.fetchModuleVersions(module)
		);

		try {
			await Promise.all(versionPromises);
		} catch (error) {
			console.error("Error fetching module versions:", error);
		}
	}

	// Obtener versiones disponibles para un módulo específico
	async fetchModuleVersions(moduleName) {
		try {
			const registryUrl = `https://registry.npmjs.org/@minecraft/${moduleName}`;
			const response = await fetch(registryUrl);

			if (!response.ok) {
				throw new Error(
					`Failed to fetch versions for ${moduleName}: ${response.status}`
				);
			}

			const data = await response.json();
			const versions = Object.keys(data.versions || {});

			// Filtrar y ordenar versiones (más recientes primero)
			const sortedVersions = versions
				.filter((v) => /^\d+\.\d+\.\d+/.test(v)) // Solo versiones numéricas
				.sort((a, b) => {
					const aParts = a.split(".").map(Number);
					const bParts = b.split(".").map(Number);

					for (
						let i = 0;
						i < Math.max(aParts.length, bParts.length);
						i++
					) {
						const aPart = aParts[i] || 0;
						const bPart = bParts[i] || 0;

						if (aPart !== bPart) {
							return bPart - aPart; // Orden descendente
						}
					}
					return 0;
				});

			this.moduleVersions[moduleName] = sortedVersions;

			// Agregar "latest" como primera opción para vanilla-data
			if (moduleName === "vanilla-data") {
				this.moduleVersions[moduleName].unshift("latest");
			}
		} catch (error) {
			console.error(`Error fetching versions for ${moduleName}:`, error);
			this.moduleVersions[moduleName] = ["latest"]; // Fallback
		}
	}

	// Agregar configuración al modal existente
	// Agregar configuración al modal existente
	addConfigurationToModal() {
		const configForm = document.getElementById("config-form");
		if (!configForm) {
			console.error("Configuration form not found");
			return;
		}

		const formContainer = configForm.querySelector(".form-container form");
		if (!formContainer) {
			console.error("Form container not found");
			return;
		}

		// Crear sección para configuración de TypeScript
		const typescriptSection = document.createElement("div");
		typescriptSection.className = "typescript-config-section";
		typescriptSection.innerHTML = `
        <div class="form-group">
            <h3 style="color: #fff; margin-bottom: 15px; border-bottom: 1px solid #555; padding-bottom: 5px;">
                Configuración de TypeScript - Minecraft Bedrock
            </h3>
            <p style="color: #ccc; font-size: 12px; margin-bottom: 20px;">
                Selecciona las versiones de los módulos de Minecraft para autocompletado
            </p>
        </div>
    `;

		// Crear selectores para cada módulo
		this.modules.forEach((module) => {
			const moduleGroup = document.createElement("div");
			moduleGroup.className = "form-group";

			const displayName = this.getModuleDisplayName(module);
			const versions = this.moduleVersions[module] || ["latest"];
			const defaultVersion = versions[0]; // Usar la primera versión como default inicial

			moduleGroup.innerHTML = `
            <label class="form-label" for="minecraft-${module}">
                ${displayName}
            </label>
            <select class="form-select" id="minecraft-${module}" name="minecraft-${module}">
                ${versions
					.map(
						(version) =>
							`<option value="${version}" ${
								version === defaultVersion ? "selected" : ""
							}>
                        ${version}
                    </option>`
					)
					.join("")}
            </select>
            <div class="checkbox-group" style="margin-top: 10px;">
                <input class="form-checkbox" type="checkbox" 
                       id="enable-${module}" name="enable-${module}" checked />
                <label class="checkbox-label" for="enable-${module}">
                    Habilitar ${displayName}
                </label>
            </div>
        `;

			typescriptSection.appendChild(moduleGroup);

			// Guardar referencias a los elementos
			this.configElements[module] = {
				select: moduleGroup.querySelector(`#minecraft-${module}`),
				checkbox: moduleGroup.querySelector(`#enable-${module}`)
			};
		});

		// Insertar antes de los botones del formulario
		const buttonContainer = formContainer.querySelector(".form-buttons");
		if (buttonContainer) {
			formContainer.insertBefore(typescriptSection, buttonContainer);
		} else {
			formContainer.appendChild(typescriptSection);
		}

		// IMPORTANTE: Aplicar configuración guardada después de crear los elementos
		this.applyStoredConfiguration();
	}

	// Obtener nombre para mostrar del módulo
	getModuleDisplayName(module) {
		const displayNames = {
			server: "Minecraft Server",
			"server-ui": "Server UI",
			"server-net": "Server Net",
			"server-gametest": "Server GameTest",
			"vanilla-data": "Vanilla Data"
		};
		return displayNames[module] || module;
	}

	// Configurar manejadores de eventos para la configuración
	setupConfigurationHandlers() {
		// Escuchar cambios en la configuración
		Object.keys(this.configElements).forEach((module) => {
			const elements = this.configElements[module];

			if (elements.select) {
				elements.select.addEventListener("change", () => {
					this.saveConfiguration();
				});
			}

			if (elements.checkbox) {
				elements.checkbox.addEventListener("change", () => {
					this.saveConfiguration();
				});
			}
		});
	}

	// Guardar configuración actual
	saveConfiguration() {
		const config = {};

		Object.keys(this.configElements).forEach((module) => {
			const elements = this.configElements[module];
			config[module] = {
				version: elements.select?.value || "latest",
				enabled: elements.checkbox?.checked || false
			};
		});

		localStorage.setItem(
			"minecraft_typescript_config",
			JSON.stringify(config)
		);
	}

	// Cargar configuración guardada
	loadConfiguration() {
		const saved = localStorage.getItem("minecraft_typescript_config");
		if (!saved) return {};

		try {
			return JSON.parse(saved);
		} catch (error) {
			console.error("Error loading TypeScript configuration:", error);
			return {};
		}
	}

	// Aplicar configuración guardada a los elementos del formulario
	applyStoredConfiguration() {
		const config = this.loadConfiguration();

		Object.keys(config).forEach((module) => {
			const elements = this.configElements[module];
			const moduleConfig = config[module];

			if (elements && moduleConfig) {
				if (elements.select && moduleConfig.version) {
					elements.select.value = moduleConfig.version;
				}
				if (
					elements.checkbox &&
					typeof moduleConfig.enabled === "boolean"
				) {
					elements.checkbox.checked = moduleConfig.enabled;
				}
			}
		});
	}

	// Cargar definiciones TypeScript basadas en la configuración
	async loadTypeScriptDefinitions() {
		const config = this.loadConfiguration();
		const loadPromises = [];

		Object.keys(config).forEach((module) => {
			const moduleConfig = config[module];
			if (moduleConfig && moduleConfig.enabled) {
				const version =
					moduleConfig.version === "latest"
						? "latest"
						: moduleConfig.version;
				loadPromises.push(this.loadModuleDefinitions(module, version));
			}
		});

		try {
			const results = await Promise.all(loadPromises);
			this.applyDefinitionsToMonaco(
				results.filter((result) => result !== null)
			);
			return true;
		} catch (error) {
			console.error("Error loading TypeScript definitions:", error);
			return false;
		}
	}

	// Cargar definiciones para un módulo específico
	async loadModuleDefinitions(module, version) {
		try {
			// Determinar la ruta correcta según el módulo
			let urlPath;
			if (module === "vanilla-data") {
				urlPath = `${this.baseUrl}/${module}@${version}/lib/index.d.ts`;
			} else {
				urlPath = `${this.baseUrl}/${module}@${version}/index.d.ts`;
			}

			const response = await fetch(urlPath);

			if (!response.ok) {
				console.warn(
					`Failed to load definitions for ${module}@${version}: ${response.status}`
				);
				return null;
			}

			let content = await response.text();

			// Validar que el contenido no esté vacío o corrupto
			if (!content || content.length < 10) {
				console.warn(`Invalid content for ${module}@${version}`);
				return null;
			}

			// Limpiar contenido problemático
			content = content.replace(/\r\n/g, "\n");
			content = content.replace(/^\uFEFF/, "");

			// Para vanilla-data, usar una versión específica en lugar de "latest"
			const actualVersion =
				module === "vanilla-data" && version === "latest"
					? "1.21.101"
					: version;

			// Guardar definiciones cargadas
			this.loadedDefinitions[module] = {
				version: actualVersion,
				content: content,
				uri: `file:///node_modules/@minecraft/${module}/index.d.ts`
			};

			// Cachear con el service worker para uso offline
			if (window.pwaManager && response.ok) {
				try {
					await window.pwaManager.cacheTypeDefinitions([urlPath]);
					console.log(
						`[PWA] Cached type definitions for ${module}@${actualVersion}`
					);
				} catch (error) {
					console.warn(
						`[PWA] Failed to cache type definitions for ${module}:`,
						error
					);
					// No fallar si el cacheo falla, solo advertir
				}
			}

			return {
				module: module,
				version: actualVersion,
				content: content,
				uri: `file:///node_modules/@minecraft/${module}/index.d.ts`
			};
		} catch (error) {
			console.error(
				`Error loading definitions for ${module}@${version}:`,
				error
			);
			return null;
		}
	}
	// Aplicar definiciones a Monaco Editor
	applyDefinitionsToMonaco(definitions) {
		if (!window.monaco) {
			console.warn("Monaco Editor not available");
			return;
		}

		try {
			// Limpiar definiciones anteriores usando el método correcto
			monaco.languages.typescript.javascriptDefaults.setExtraLibs([]);

			// Configurar SOLO javascriptDefaults (no typescriptDefaults) siguiendo el patrón de tu v1
			monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
				target: monaco.languages.typescript.ScriptTarget.ES2020,
				allowNonTsExtensions: true,
				moduleResolution:
					monaco.languages.typescript.ModuleResolutionKind.NodeJs,
				module: monaco.languages.typescript.ModuleKind.CommonJS,
				noEmit: true,
				esModuleInterop: true,
				allowJs: true,
				checkJs: true,
				strict: false,
				noImplicitAny: false,
				skipLibCheck: false,
				typeRoots: ["node_modules/@types", "node_modules/@minecraft"],
				paths: {
					"@minecraft/*": ["node_modules/@minecraft/*"]
				}
				// NO especificar 'lib' - dejar que Monaco use sus defaults que incluyen console
			});

			// Usar addExtraLib() individualmente como en tu versión anterior
			definitions.forEach((def) => {
				if (def && def.content) {
					const libPath = `file:///node_modules/@minecraft/${def.module}/index.d.ts`;

					// Procesar el contenido para mejorar las referencias entre módulos
					let processedContent = def.content.replace(
						/from\s+['"]@minecraft\/(server|server-ui|server-gametest|server-net)['"]/g,
						`from '@minecraft/$1'`
					);

					const enhancedContent = `/**
					 * @namespace Minecraft Bedrock API - ${def.module}
					 * @version ${def.version}
					 */
					${processedContent}`;

					monaco.languages.typescript.javascriptDefaults.addExtraLib(
						enhancedContent,
						libPath
					);

					console.log(
						`Loaded TypeScript definitions for ${def.module}@${def.version}`
					);
				}
			});

			// Configurar diagnósticos solo para JavaScript
			monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(
				{
					noSemanticValidation: false,
					noSyntaxValidation: false,
					noSuggestionDiagnostics: false,
					diagnosticCodesToIgnore: [
						1005, // ';' expected
						1109, // Expression expected
						2304 // Cannot find name (para algunos casos específicos)
					]
				}
			);

			console.log("TypeScript definitions applied successfully");
		} catch (error) {
			console.error(
				"Error applying TypeScript definitions to Monaco:",
				error
			);
		}
	}

	// Limpiar definiciones anteriores
	clearPreviousDefinitions() {
		Object.keys(this.loadedDefinitions).forEach((module) => {
			const def = this.loadedDefinitions[module];
			if (def && def.uri) {
				const uri = monaco.Uri.parse(def.uri);
				const model = monaco.editor.getModel(uri);
				if (model) {
					model.dispose();
				}
			}
		});

		this.loadedDefinitions = {};
	}

	// Método público para recargar definiciones
	async reloadDefinitions() {
		const success = await this.loadTypeScriptDefinitions();
		if (success) {
			console.log("TypeScript definitions reloaded successfully");
		} else {
			console.error("Failed to reload TypeScript definitions");
		}
		return success;
	}

	// Obtener información sobre las definiciones cargadas
	getLoadedDefinitionsInfo() {
		return Object.keys(this.loadedDefinitions).map((module) => ({
			module: module,
			version: this.loadedDefinitions[module].version,
			loaded: true
		}));
	}
}

// Integración con el sistema de configuración existente
window.MinecraftTypesManager = MinecraftTypesManager;

// Inicializar automáticamente cuando Monaco esté disponible
document.addEventListener("DOMContentLoaded", async () => {
	// Esperar a que Monaco esté disponible
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
	window.minecraftTypesManager = new MinecraftTypesManager();

	// Cargar definiciones después de un breve delay para asegurar que todo esté inicializado
	setTimeout(async () => {
		await window.minecraftTypesManager.loadTypeScriptDefinitions();
	}, 1000);
});

export default MinecraftTypesManager;
