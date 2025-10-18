export default class EditorManager {
	constructor(editorContainer, tabsContainer) {
		this.editorContainer = editorContainer;
		this.tabsContainer = tabsContainer;
		this.editor = null;
		this.models = {};
		this.activeModelId = null;
		this.nextTabId = 1;

		// Inicializar
		this.init();
	}

	// Inicializar el editor
	async init() {
		// Configurar Monaco
		require.config({
			paths: {
				vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs"
			}
		});

		// Cargar Monaco
		await new Promise((resolve) => {
			require(["vs/editor/editor.main"], () => {
				// Crear instancia del editor
				this.editor = monaco.editor.create(this.editorContainer, {
					theme: "vs-dark",
					automaticLayout: true,
					minimap: { enabled: false }
				});
				resolve();
			});
		});

		// Cargar modelos guardados
		this.loadModels();

		// Configurar eventos
		this.setupEvents();

		// Crear pestaña inicial si no hay modelos
		if (Object.keys(this.models).length === 0) {
			this.createNewTab();
		}
	}

	// Determinar lenguaje por extensión
	getLanguageFromFilename(filename) {
		const extension = filename.split(".").pop().toLowerCase();
		const languageMap = {
			js: "javascript",
			json: "json",
			ts: "typescript",
			html: "html",
			css: "css",
			md: "markdown",
			txt: "plaintext"
		};
		return languageMap[extension] || "javascript";
	}

	// Cargar modelos desde localStorage
	loadModels() {
		const savedModels = localStorage.getItem("mcbeditor_models");

		if (savedModels) {
			try {
				const modelsData = JSON.parse(savedModels);

				modelsData.forEach((modelData) => {
					this.createModelFromData(modelData);
				});
			} catch (e) {
				console.error("Error al cargar modelos:", e);
			}
		}
	}

	// Crear modelo desde datos
	createModelFromData(modelData) {
		let {
			id,
			content,
			language = "",
			name = `file-${this.nextTabId}.js`
		} = modelData;

		// Determinar lenguaje por extensión si no está especificado
		if (!language) {
			language = this.getLanguageFromFilename(name);
		}

		// Crear el modelo
		const uri = monaco.Uri.parse(`file:///${name}`);
		const model = monaco.editor.createModel(content, language, uri);

		// Guardar referencia
		this.models[id] = {
			model,
			name,
			language,
			hasUnsavedChanges: false
		};

		// Crear pestaña
		this.createTab(id, name);

		// Configurar detección de cambios
		model.onDidChangeContent(() => {
			this.models[id].hasUnsavedChanges = true;
			this.updateTabTitle(id);
			this.saveModels();
		});

		this.nextTabId++;

		return id;
	}

	// Crear nueva pestaña
	createNewTab(fileName) {
		const id = `tab-${Date.now()}`;
		const random = Math.floor(Math.random() * 10);
		const name =
			fileName ||
			`sin-nombre-${
				(random + random).toString() + (random + random).toString()
			}.js`;

		// Determinar lenguaje
		const language = this.getLanguageFromFilename(name);

		// Crear modelo vacío
		const uri = monaco.Uri.parse(`file:///${name}`);
		const model = monaco.editor.createModel("", language, uri);

		// Guardar referencia
		this.models[id] = {
			model,
			name,
			language,
			hasUnsavedChanges: false
		};

		// Crear pestaña
		this.createTab(id, name);

		// Configurar detección de cambios
		model.onDidChangeContent(() => {
			this.models[id].hasUnsavedChanges = true;
			this.updateTabTitle(id);
			this.saveModels();
		});

		// Activar esta pestaña
		this.switchToTab(id);

		// Notificar a SchemasManager si es JSON
		if (language === "json" && window.minecraftSchemasManager) {
			setTimeout(() => {
				window.minecraftSchemasManager.onModelCreated(model);
			}, 100);
		}

		this.nextTabId++;

		return id;
	}

	// Crear elemento de pestaña
	createTab(id, name) {
		const tab = document.createElement("div");
		tab.className = "tab";
		tab.dataset.tabId = id;

		tab.innerHTML = `
                    <button class="tab-name">${name}</button>
                    <button class="close">&times;</button>
                `;

		// Insertar antes del botón de añadir
		this.tabsContainer.insertBefore(
			tab,
			this.tabsContainer.lastElementChild
		);

		// Configurar eventos
		tab.querySelector(".tab-name").addEventListener("click", () => {
			this.switchToTab(id);
		});

		tab.querySelector(".close").addEventListener("click", (e) => {
			e.stopPropagation();
			this.closeTab(id);
		});

		return tab;
	}

	// Cambiar a una pestaña específica
	switchToTab(id) {
		if (!this.models[id]) return;

		// Actualizar UI
		document.querySelectorAll(".tab").forEach((tab) => {
			tab.classList.toggle("active", tab.dataset.tabId === id);
		});

		// Cambiar modelo en el editor
		this.editor.setModel(this.models[id].model);
		this.activeModelId = id;

		// Hacer disponible para el debugger
		window.editorManager.activeEditor = this.editor;

		// Enfocar el editor
		this.editor.focus();
	}

	// Cerrar una pestaña
	closeTab(id) {
		if (!this.models[id]) return;

		// Si hay cambios sin guardar, preguntar
		if (this.models[id].hasUnsavedChanges) {
			if (
				!confirm(
					"¿Estás seguro de que quieres cerrar sin guardar los cambios?"
				)
			) {
				return;
			}
		}

		// Eliminar modelo
		this.models[id].model.dispose();
		delete this.models[id];

		// Eliminar pestaña de la UI
		const tabElement = document.querySelector(`.tab[data-tab-id="${id}"]`);
		if (tabElement) {
			tabElement.remove();
		}

		// Si era la pestaña activa, cambiar a otra
		if (this.activeModelId === id) {
			const remainingIds = Object.keys(this.models);
			if (remainingIds.length > 0) {
				this.switchToTab(remainingIds[0]);
			} else {
				this.editor.setModel(null);
				this.activeModelId = null;
				// Crear una nueva pestaña vacía si se cierran todas
				this.createNewTab();
			}
		}

		// Guardar cambios
		this.saveModels();
	}

	// Actualizar título de pestaña
	updateTabTitle(id) {
		if (!this.models[id]) return;

		const tabElement = document.querySelector(`.tab[data-tab-id="${id}"]`);
		if (tabElement) {
			const nameElement = tabElement.querySelector(".tab-name");
			const indicator = this.models[id].hasUnsavedChanges ? "• " : "";
			nameElement.textContent = indicator + this.models[id].name;
		}
	}

	// Guardar modelos en localStorage
	saveModels() {
		const modelsData = [];

		for (const id in this.models) {
			modelsData.push({
				id: id,
				content: this.models[id].model.getValue(),
				language: this.models[id].language,
				name: this.models[id].name
			});
		}

		localStorage.setItem("mcbeditor_models", JSON.stringify(modelsData));
	}

	// Configurar eventos
	setupEvents() {
		// Evento para añadir nueva pestaña
		document.getElementById("add-tab").addEventListener("click", () => {
			document.getElementById("fileName-form").style.display = "flex";
		});

		document
			.getElementById("close-fileName-form")
			.addEventListener("click", () => {
				document.getElementById("fileName-form").style.display = "none";
			});

		document
			.getElementById("crear-con-nombre")
			.addEventListener("click", () => {
				const filename = document
					.getElementById("filename-input")
					.value.trim();

				if (!filename) {
					alert("Por favor ingresa un nombre de archivo");
					return;
				}

				// Validar extensión permitida
				const validExtensions = /\.(js|json|ts|html|css|md|txt)$/i;
				if (!validExtensions.test(filename)) {
					alert(
						"Extensión no válida. Usa: .js, .json, .ts, .html, .css, .md, .txt"
					);
					return;
				}

				this.createNewTab(filename);
				document.getElementById("fileName-form").style.display = "none";
				document.getElementById("filename-input").value = "";
			});
	}

	// Obtener modelo activo
	getActiveModel() {
		return this.activeModelId ? this.models[this.activeModelId] : null;
	}

	// Cambiar lenguaje del modelo activo
	setActiveModelLanguage(language) {
		if (this.activeModelId && this.models[this.activeModelId]) {
			monaco.editor.setModelLanguage(
				this.models[this.activeModelId].model,
				language
			);
			this.models[this.activeModelId].language = language;
			this.saveModels();
		}
	}

	// Cambiar nombre del modelo activo
	renameActiveModel(newName) {
		if (this.activeModelId && this.models[this.activeModelId]) {
			this.models[this.activeModelId].name = newName;
			this.updateTabTitle(this.activeModelId);
			this.saveModels();
		}
	}
}
