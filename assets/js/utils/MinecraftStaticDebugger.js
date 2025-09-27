// MinecraftStaticDebugger.js - Sistema de debugging estático para Minecraft Bedrock
class MinecraftStaticDebugger {
	constructor(typesManager) {
		this.typesManager = typesManager;
		this.analysisResults = {};
		this.debugPanel = null;
		this.isAnalyzing = false;

		this.init();
	}

	init() {
		this.createDebugPanel();
		this.setupEventListeners();
	}

	// Crear panel de debugging en la UI
	createDebugPanel() {
		this.debugPanel = document.createElement("div");
		this.debugPanel.id = "static-debug-panel";
		this.debugPanel.style.cssText = `
            position: absolute;
            word-wrap: wrap;
            left: 50%;
            top: 50%;
            width: auto;
            max-width: 90vw;
            max-height: 500px;
            transform: translate(-50%, -50%);
            background: #1e1e1e;
            border: 1px solid #444;
            border-radius: 8px;
            color: #fff;
            font-family: 'Segoe UI', monospace;
            font-size: 12px;
            overflow: hidden;
            z-index: 1000;
            display: none;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        `;

		this.debugPanel.innerHTML = `
            <div style="
                background: #2d2d2d;
                padding: 12px;
                border-bottom: 1px solid #444;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <strong style="color: #4CAF50;">🔍 Static Debugger</strong>
                <div>
                    <button id="refresh-debug" style="
                        background: #007ACC;
                        border: none;
                        color: white;
                        padding: 4px 8px;
                        border-radius: 3px;
                        font-size: 11px;
                        margin-right: 5px;
                        cursor: pointer;
                    ">Refresh</button>
                    <button id="close-debug" style="
                        background: none;
                        border: none;
                        color: #fff;
                        font-size: 16px;
                        cursor: pointer;
                        padding: 0 5px;
                    ">×</button>
                </div>
            </div>
            <div id="debug-content" style="
                padding: 15px;
                max-height: 430px;
                overflow-y: auto;
            "></div>
        `;

		document.body.appendChild(this.debugPanel);
	}

	// Configurar event listeners
	setupEventListeners() {
		document.getElementById("close-debug").addEventListener("click", () => {
			this.hidePanel();
		});

		document
			.getElementById("refresh-debug")
			.addEventListener("click", () => {
				this.debugCurrentCode();
			});

		// Hacer el panel arrastrable
		this.makeResizable();
	}

	// Hacer el panel arrastrable
	makeResizable() {
		const header = this.debugPanel.querySelector("div");
		let isDragging = false;
		let currentX = 0;
		let currentY = 0;
		let initialX = 0;
		let initialY = 0;

		header.style.cursor = "move";

		header.addEventListener("mousedown", (e) => {
			if (e.target.tagName === "BUTTON") return;

			isDragging = true;
			initialX = e.clientX - this.debugPanel.offsetLeft;
			initialY = e.clientY - this.debugPanel.offsetTop;
		});

		document.addEventListener("mousemove", (e) => {
			if (isDragging) {
				e.preventDefault();
				currentX = e.clientX - initialX;
				currentY = e.clientY - initialY;

				this.debugPanel.style.left = currentX + "px";
				this.debugPanel.style.top = currentY + "px";
				this.debugPanel.style.right = "auto";
			}
		});

		document.addEventListener("mouseup", () => {
			isDragging = false;
		});
	}

	// Analizar código estáticamente usando TypeScript Worker
	async analyzeCode(code, modelUri) {
		if (!monaco.languages.typescript || !code.trim()) {
			return null;
		}

		try {
			const worker =
				await monaco.languages.typescript.getJavaScriptWorker();
			const client = await worker(modelUri);

			// Obtener diagnósticos semánticos
			const semanticDiagnostics = await client.getSemanticDiagnostics(
				modelUri.toString()
			);
			const syntacticDiagnostics = await client.getSyntacticDiagnostics(
				modelUri.toString()
			);

			// Combinar diagnósticos
			const allDiagnostics = [
				...semanticDiagnostics,
				...syntacticDiagnostics
			];

			return this.processCodeAnalysis(code, allDiagnostics);
		} catch (error) {
			console.warn("Error analyzing code:", error);
			return this.fallbackAnalysis(code);
		}
	}

	// Procesar análisis del código
	processCodeAnalysis(code, diagnostics) {
		const lines = code.split("\n");

		return {
			variables: this.extractVariables(code),
			imports: this.extractImports(code),
			functionCalls: this.extractFunctionCalls(code),
			minecraftAPICalls: this.extractMinecraftAPICalls(code),
			typeInfo: this.extractTypeInformation(diagnostics),
			potentialIssues: this.processDiagnostics(diagnostics),
			codeStats: {
				lines: lines.length,
				nonEmptyLines: lines.filter((line) => line.trim()).length,
				functions: (
					code.match(/function\s+\w+|=>\s*{|\w+\s*:\s*function/g) ||
					[]
				).length
			}
		};
	}

	// Análisis de respaldo si el worker falla
	fallbackAnalysis(code) {
		return {
			variables: this.extractVariables(code),
			imports: this.extractImports(code),
			functionCalls: this.extractFunctionCalls(code),
			minecraftAPICalls: this.extractMinecraftAPICalls(code),
			typeInfo: [],
			potentialIssues: [],
			codeStats: {
				lines: code.split("\n").length,
				nonEmptyLines: code.split("\n").filter((line) => line.trim())
					.length,
				functions: (
					code.match(/function\s+\w+|=>\s*{|\w+\s*:\s*function/g) ||
					[]
				).length
			}
		};
	}

	// Extraer imports del código
	extractImports(code) {
		const importRegex =
			/import\s+(?:{([^}]+)}|\*\s+as\s+(\w+)|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
		const imports = [];
		let match;

		while ((match = importRegex.exec(code)) !== null) {
			const module = match[4];
			const imported = match[1] || match[2] || match[3];

			imports.push({
				module: module,
				items: match[1]
					? match[1].split(",").map((s) => s.trim())
					: [imported],
				line: code.substring(0, match.index).split("\n").length,
				isMinecraftAPI: module.startsWith("@minecraft/")
			});
		}

		return imports;
	}

	// Extraer variables del código
	extractVariables(code) {
		const variableRegex = /(?:const|let|var)\s+(\w+)\s*=\s*([^;,\n]+)/g;
		const variables = {};
		let match;

		while ((match = variableRegex.exec(code)) !== null) {
			const varName = match[1];
			const varValue = match[2].trim();

			variables[varName] = {
				type: this.inferType(varValue),
				value: varValue,
				line: code.substring(0, match.index).split("\n").length,
				isMinecraftRelated: this.isMinecraftRelated(varValue)
			};
		}

		return variables;
	}

	// Extraer llamadas a funciones generales
	extractFunctionCalls(code) {
		const functionCallRegex = /(\w+(?:\.\w+)*)\s*\([^)]*\)/g;
		const calls = [];
		let match;

		while ((match = functionCallRegex.exec(code)) !== null) {
			const functionName = match[1];
			if (!functionName.includes("console.log")) {
				calls.push({
					name: functionName,
					line: code.substring(0, match.index).split("\n").length,
					fullMatch: match[0]
				});
			}
		}

		return calls.slice(0, 20); // Limitar a 20 para no sobrecargar la UI
	}

	// Extraer llamadas específicas a la API de Minecraft
	extractMinecraftAPICalls(code) {
		const mcAPIRegex =
			/(system|world|player|server)\.\w+(?:\.\w+)*\s*\([^)]*\)/g;
		const mcCalls = [];
		let match;

		while ((match = mcAPIRegex.exec(code)) !== null) {
			mcCalls.push({
				call: match[0],
				line: code.substring(0, match.index).split("\n").length,
				api: match[1]
			});
		}

		return mcCalls;
	}

	// Procesar diagnósticos de TypeScript
	processDiagnostics(diagnostics) {
		return diagnostics
			.map((diagnostic) => ({
				line: this.getLineFromPosition(diagnostic.start),
				message:
					typeof diagnostic.messageText === "string"
						? diagnostic.messageText
						: diagnostic.messageText.messageText,
				severity: this.getSeverityLabel(diagnostic.category),
				code: diagnostic.code
			}))
			.slice(0, 10); // Limitar a 10 issues principales
	}

	// Obtener línea de una posición
	getLineFromPosition(position) {
		return position ? Math.floor(position / 100) + 1 : 0; // Estimación simple
	}

	// Obtener etiqueta de severidad
	getSeverityLabel(category) {
		switch (category) {
			case 0:
				return "Warning";
			case 1:
				return "Error";
			case 2:
				return "Suggestion";
			default:
				return "Info";
		}
	}

	// Extraer información de tipos
	extractTypeInformation(diagnostics) {
		return diagnostics
			.filter((d) => d.code && d.code.toString().startsWith("2"))
			.slice(0, 5);
	}

	// Inferir tipo basándose en el valor
	inferType(value) {
		if (
			value.startsWith('"') ||
			value.startsWith("'") ||
			value.startsWith("`")
		)
			return "string";
		if (/^\d+(\.\d+)?$/.test(value)) return "number";
		if (value === "true" || value === "false") return "boolean";
		if (value.startsWith("[")) return "array";
		if (value.startsWith("{")) return "object";
		if (
			value.includes("system.") ||
			value.includes("world.") ||
			value.includes("player.")
		)
			return "MinecraftAPI";
		if (value.includes("new ")) return "instance";
		return "unknown";
	}

	// Verificar si es relacionado con Minecraft
	isMinecraftRelated(value) {
		return /\b(system|world|player|server|dimension|entity|block|item)\b/.test(
			value
		);
	}

	// Mostrar panel de debugging
	showPanel() {
		this.debugPanel.style.display = "block";
	}

	// Ocultar panel de debugging
	hidePanel() {
		this.debugPanel.style.display = "none";
	}

	// Mostrar información de debugging
	showDebugInfo(debugInfo) {
		if (!debugInfo) {
			this.showError("No se pudo analizar el código");
			return;
		}

		const content = this.debugPanel.querySelector("#debug-content");

		content.innerHTML = `
            ${this.renderCodeStats(debugInfo.codeStats)}
            ${this.renderImports(debugInfo.imports)}
            ${this.renderVariables(debugInfo.variables)}
            ${this.renderMinecraftAPICalls(debugInfo.minecraftAPICalls)}
            ${this.renderFunctionCalls(debugInfo.functionCalls)}
            ${this.renderIssues(debugInfo.potentialIssues)}
        `;

		this.showPanel();
	}

	// Renderizar estadísticas del código
	renderCodeStats(stats) {
		return `
            <div style="margin-bottom: 15px; padding: 10px; background: #252525; border-radius: 4px;">
                <h4 style="color: #4CAF50; margin: 0 0 8px 0; font-size: 13px;">📊 Estadísticas</h4>
                <div style="font-size: 11px; line-height: 1.4;">
                    <div>Líneas totales: <span style="color: #9CDCFE;">${stats.lines}</span></div>
                    <div>Líneas con código: <span style="color: #9CDCFE;">${stats.nonEmptyLines}</span></div>
                    <div>Funciones: <span style="color: #9CDCFE;">${stats.functions}</span></div>
                </div>
            </div>
        `;
	}

	// Renderizar imports
	renderImports(imports) {
		if (imports.length === 0) return "";

		return `
            <div style="margin-bottom: 15px;">
                <h4 style="color: #FF9800; margin: 0 0 5px 0; font-size: 13px;">📦 Imports</h4>
                ${imports
					.map(
						(imp) => `
                    <div style="margin: 3px 0; font-size: 11px; padding: 4px; background: ${
						imp.isMinecraftAPI ? "#1B3A1B" : "#1A1A1A"
					}; border-radius: 3px;">
                        <span style="color: #569CD6;">${imp.module}</span>
                        <div style="color: #9CDCFE; margin-left: 10px;">
                            {${imp.items.join(", ")}}
                        </div>
                    </div>
                `
					)
					.join("")}
            </div>
        `;
	}

	// Renderizar variables
	renderVariables(variables) {
		const entries = Object.entries(variables);
		if (entries.length === 0) return "";

		return `
            <div style="margin-bottom: 15px;">
                <h4 style="color: #4CAF50; margin: 0 0 5px 0; font-size: 13px;">🔧 Variables</h4>
                ${entries
					.slice(0, 10)
					.map(
						([name, info]) => `
                    <div style="margin: 3px 0; font-size: 11px; padding: 4px; background: ${
						info.isMinecraftRelated ? "#1B3A1B" : "#1A1A1A"
					}; border-radius: 3px;">
                        <span style="color: #569CD6;">${name}</span>
                        <span style="color: #4EC9B0;">[${info.type}]</span>
                        <div style="color: #9CDCFE; margin-left: 10px; word-break: break-all;">
                            ${
								info.value.length > 50
									? info.value.substring(0, 50) + "..."
									: info.value
							}
                        </div>
                    </div>
                `
					)
					.join("")}
            </div>
        `;
	}

	// Renderizar llamadas a la API de Minecraft
	renderMinecraftAPICalls(mcCalls) {
		if (mcCalls.length === 0) return "";

		return `
            <div style="margin-bottom: 15px;">
                <h4 style="color: #8BC34A; margin: 0 0 5px 0; font-size: 13px;">🎮 Minecraft API Calls</h4>
                ${mcCalls
					.slice(0, 8)
					.map(
						(call) => `
                    <div style="margin: 3px 0; font-size: 11px; padding: 4px; background: #1B3A1B; border-radius: 3px;">
                        <span style="color: #DCDCAA;">${call.call}</span>
                        <span style="color: #666; margin-left: 10px;">línea ${call.line}</span>
                    </div>
                `
					)
					.join("")}
            </div>
        `;
	}

	// Renderizar llamadas a funciones
	renderFunctionCalls(calls) {
		if (calls.length === 0) return "";

		return `
            <div style="margin-bottom: 15px;">
                <h4 style="color: #FFD700; margin: 0 0 5px 0; font-size: 13px;">🔄 Function Calls</h4>
                ${calls
					.slice(0, 6)
					.map(
						(call) => `
                    <div style="margin: 3px 0; font-size: 11px; color: #DCDCAA; padding: 2px;">
                        ${call.name} <span style="color: #666;">(línea ${call.line})</span>
                    </div>
                `
					)
					.join("")}
            </div>
        `;
	}

	// Renderizar issues
	renderIssues(issues) {
		if (issues.length === 0) {
			return `
                <div style="margin-bottom: 15px;">
                    <h4 style="color: #4CAF50; margin: 0 0 5px 0; font-size: 13px;">✅ No Issues Found</h4>
                    <div style="color: #4CAF50; font-size: 11px;">El código parece estar bien!</div>
                </div>
            `;
		}

		return `
            <div style="margin-bottom: 15px;">
                <h4 style="color: #f44336; margin: 0 0 5px 0; font-size: 13px;">⚠️ Issues (${
					issues.length
				})</h4>
                ${issues
					.map(
						(issue) => `
                    <div style="margin: 5px 0; font-size: 11px; padding: 6px; background: #2D1B1B; border-left: 3px solid #f44336; border-radius: 0 3px 3px 0;">
                        <div style="color: #f44336; font-weight: bold;">
                            ${issue.severity} (Línea ${issue.line})
                        </div>
                        <div style="color: #FFCDD2; margin-top: 2px;">
                            ${issue.message}
                        </div>
                    </div>
                `
					)
					.join("")}
            </div>
        `;
	}

	// Mostrar error
	showError(message) {
		const content = this.debugPanel.querySelector("#debug-content");
		content.innerHTML = `
            <div style="text-align: center; color: #f44336; padding: 20px;">
                <div style="font-size: 14px; margin-bottom: 10px;">❌ Error</div>
                <div style="font-size: 12px;">${message}</div>
            </div>
        `;
		this.showPanel();
	}

	// Analizar código actual del editor
	async debugCurrentCode() {
		if (this.isAnalyzing) return;

		if (!window.editorManager || !window.editorManager.activeEditor) {
			this.showError("No hay editor activo");
			return;
		}

		const editor = window.editorManager.activeEditor;
		const model = editor.getModel();

		if (!model) {
			this.showError("No hay modelo de código activo");
			return;
		}

		const code = model.getValue();
		if (!code.trim()) {
			this.showError("El editor está vacío");
			return;
		}

		this.isAnalyzing = true;

		// Mostrar loading
		const content = this.debugPanel.querySelector("#debug-content");
		content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #9CDCFE;">
                <div style="margin-bottom: 10px;">🔄</div>
                <div>Analizando código...</div>
            </div>
        `;
		this.showPanel();

		try {
			const uri = model.uri;
			const debugInfo = await this.analyzeCode(code, uri);
			this.showDebugInfo(debugInfo);
		} catch (error) {
			console.error("Error during debugging:", error);
			this.showError("Error durante el análisis: " + error.message);
		} finally {
			this.isAnalyzing = false;
		}
	}

	// Método público para mostrar/ocultar el panel
	toggle() {
		if (this.debugPanel.style.display === "none") {
			this.debugCurrentCode();
		} else {
			this.hidePanel();
		}
	}
}

// Hacer disponible globalmente
window.MinecraftStaticDebugger = MinecraftStaticDebugger;

export default MinecraftStaticDebugger;
