// MinecraftSchemasManager.js - Versión con autocompletado funcional
class MinecraftSchemasManager {
    constructor() {
        this.baseUrl = "https://api.github.com/repos/Mojang/bedrock-samples/contents/metadata/json_schemas";
        this.rawBaseUrl = "https://raw.githubusercontent.com/Mojang/bedrock-samples/main/metadata/json_schemas";
        this.availableVersions = [];
        this.currentVersion = null;
        this.loadedSchemas = {};
        this.schemaCache = {};
        this.isMonacoReady = false;
        this.isFetching = false;
        
        // Bind methods
        this.onModelAdded = this.onModelAdded.bind(this);
    }

    async init() {
        // Esperar a que Monaco esté disponible
        if (!window.monaco) {
            console.warn("[Schemas] Monaco not ready yet, waiting...");
            setTimeout(() => this.init(), 1000);
            return;
        }

        this.isMonacoReady = true;
        console.log("[Schemas] Initializing Monaco JSON schemas...");

        // Configurar Monaco JSON defaults primero
        this.setupMonacoDefaults();

        await this.fetchAvailableVersions();
        
        console.log("[Schemas] Available versions:", this.availableVersions);
        
        this.addSchemaConfigToModal();
        this.setupModelListening();

        // Cargar schemas
        const savedVersion = localStorage.getItem("minecraft_schema_version");
        
        if (savedVersion && this.availableVersions.includes(savedVersion)) {
            console.log("[Schemas] Loading saved version:", savedVersion);
            this.currentVersion = savedVersion;
            await this.loadSchemasForVersion(this.currentVersion);
        } else if (this.availableVersions.length > 0) {
            console.log("[Schemas] Loading latest version:", this.availableVersions[0]);
            this.currentVersion = this.availableVersions[0];
            localStorage.setItem("minecraft_schema_version", this.currentVersion);
            await this.loadSchemasForVersion(this.currentVersion);
        } else {
            console.error("[Schemas] No versions available to load");
            this.updateSchemaStatus("✗ No hay versiones disponibles", "error");
        }
    }

    // CONFIGURACIÓN CRÍTICA: Setup de Monaco para JSON
    setupMonacoDefaults() {
        if (!window.monaco) return;

        console.log("[Schemas] Setting up Monaco JSON defaults...");
        
        // Configurar opciones por defecto para JSON
        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
            validate: true,
            allowComments: true,
            schemas: [], // Inicialmente vacío, se llenará después
            enableSchemaRequest: false,
            schemaValidation: 'warning',
            schemaRequest: 'error',
            trailingCommas: 'ignore'
        });

        // Habilitar todas las características de lenguaje JSON
        monaco.languages.json.jsonDefaults.setModeConfiguration({
            documentFormattingEdits: true,
            documentRangeFormattingEdits: true,
            completionItems: true,
            hovers: true,
            documentSymbols: true,
            tokens: true,
            colors: true,
            foldingRanges: true,
            diagnostics: true,
            selectionRanges: true
        });
    }

    async loadSchemasForVersion(version) {
        if (!version) {
            console.warn("[Schemas] No version specified");
            return;
        }

        if (!this.isMonacoReady) {
            console.warn("[Schemas] Monaco not ready");
            return;
        }

        console.log("[Schemas] Loading schemas for version:", version);
        this.updateSchemaStatus("Cargando schemas...", "loading");

        try {
            // Usar GitHub Trees API
            const treeUrl = `https://api.github.com/repos/Mojang/bedrock-samples/git/trees/main?recursive=1`;
            const response = await fetch(treeUrl, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            });

            if (!response.ok) {
                throw new Error(`Trees API failed: ${response.status}`);
            }

            const treeData = await response.json();
            
            // Filtrar archivos de schema
            const schemaFiles = treeData.tree.filter(item =>
                item.type === "blob" &&
                item.path.startsWith(`metadata/json_schemas/${version}/`) &&
                item.path.endsWith(".json")
            );

            console.log(`[Schemas] Found ${schemaFiles.length} schema files`);

            if (schemaFiles.length === 0) {
                this.updateSchemaStatus("✗ No se encontraron schemas", "error");
                return;
            }

            // Limpiar schemas anteriores
            this.loadedSchemas = {};

            // Cargar schemas importantes primero
            const importantSchemas = this.getImportantSchemasList();
            const filesToLoad = schemaFiles.filter(file => 
                importantSchemas.some(schema => file.path.includes(schema))
            ).slice(0, 15);

            console.log("[Schemas] Loading important schemas:", filesToLoad.map(f => f.path));

            const loadPromises = filesToLoad.map(file =>
                this.loadSchemaFileFromPath(file.path)
            );

            const results = await Promise.allSettled(loadPromises);
            const successCount = results.filter(r => 
                r.status === "fulfilled" && r.value !== null
            ).length;

            console.log("[Schemas] Successfully loaded", successCount, "schemas");

            this.updateSchemaStatus(
                `✓ Cargadas ${successCount}/${filesToLoad.length} schemas`, 
                "success"
            );

            // Aplicar schemas a Monaco
            this.applySchemas();

        } catch (error) {
            console.error("[Schemas] Error loading schemas:", error);
            this.updateSchemaStatus("✗ Error al cargar schemas", "error");
        }
    }

    // Lista de schemas importantes para autocompletado
    getImportantSchemasList() {
        return [
            'entity/entity',
            'item/item', 
            'block/block',
            'biome/biome',
            'loot_table/loot_table',
            'recipe/recipe',
            'animation/animation',
            'animation_controller/animation_controller',
            'render_controller/render_controller',
            'manifest/manifest'
        ];
    }

    async loadSchemaFileFromPath(filePath) {
        const cacheKey = filePath;
        
        if (this.schemaCache[cacheKey]) {
            const schemaName = this.getSchemaNameFromPath(filePath);
            this.loadedSchemas[schemaName] = {
                path: filePath,
                schema: this.schemaCache[cacheKey]
            };
            return this.schemaCache[cacheKey];
        }

        try {
            const url = `https://raw.githubusercontent.com/Mojang/bedrock-samples/main/${filePath}`;
            console.log(`[Schemas] Fetching: ${filePath}`);
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const schemaData = await response.json();
            
            // PREPROCESAR SCHEMA: Asegurar que tenga propiedades para autocompletado
            const processedSchema = this.preprocessSchema(schemaData, filePath);

            this.schemaCache[cacheKey] = processedSchema;

            const schemaName = this.getSchemaNameFromPath(filePath);
            this.loadedSchemas[schemaName] = {
                path: filePath,
                schema: processedSchema
            };

            console.log(`[Schemas] ✓ Loaded: ${schemaName}`);
            return processedSchema;

        } catch (error) {
            console.warn(`[Schemas] ✗ Failed to load ${filePath}:`, error.message);
            return null;
        }
    }

    // PREPROCESAR SCHEMA: Mejorar para autocompletado
    preprocessSchema(schema, filePath) {
        if (!schema || typeof schema !== 'object') return schema;

        // Clonar el schema para no modificar el original
        const processed = JSON.parse(JSON.stringify(schema));

        // Asegurar que el schema tenga $schema (requerido por Monaco)
        if (!processed.$schema) {
            processed.$schema = "http://json-schema.org/draft-07/schema#";
        }

        // Mejorar el schema para mejor autocompletado
        if (processed.properties) {
            this.enhanceSchemaProperties(processed.properties);
        }

        // Agregar título si no existe
        if (!processed.title) {
            processed.title = this.getSchemaNameFromPath(filePath);
        }

        return processed;
    }

    // MEJORAR PROPIEDADES para autocompletado
    enhanceSchemaProperties(properties) {
        if (!properties || typeof properties !== 'object') return;

        Object.keys(properties).forEach(key => {
            const prop = properties[key];
            
            // Agregar descripción si no existe
            if (!prop.description) {
                prop.description = `Property: ${key}`;
            }

            // Mejorar objetos anidados
            if (prop.type === 'object' && prop.properties) {
                this.enhanceSchemaProperties(prop.properties);
            }

            // Mejorar arrays
            if (prop.type === 'array' && prop.items) {
                if (prop.items.properties) {
                    this.enhanceSchemaProperties(prop.items.properties);
                }
            }
        });
    }

    // APLICAR SCHEMAS A MONACO (MÉTODO CRÍTICO)
    applySchemas() {
        if (!window.monaco) {
            console.warn("[Schemas] Monaco not available");
            return;
        }

        try {
            const schemas = [];
            const schemaCount = Object.keys(this.loadedSchemas).length;

            console.log(`[Schemas] Creating ${schemaCount} schema configurations for Monaco...`);

            Object.entries(this.loadedSchemas).forEach(([name, data]) => {
                if (!data.schema) {
                    console.warn(`[Schemas] Skipping empty schema: ${name}`);
                    return;
                }

                const fileMatch = this.getFileMatchPattern(name);
                
                console.log(`[Schemas] Schema: ${name} ->`, fileMatch);

                schemas.push({
                    uri: `http://minecraft-schemas/${this.currentVersion}/${name}.json`,
                    fileMatch: fileMatch,
                    schema: data.schema
                });
            });

            console.log(`[Schemas] Applying ${schemas.length} schemas to Monaco...`);

            // CONFIGURACIÓN CRÍTICA: Aplicar schemas a Monaco
            monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                validate: true,
                allowComments: true,
                schemas: schemas,
                enableSchemaRequest: false,
                schemaValidation: 'warning',
                schemaRequest: 'error',
                trailingCommas: 'ignore'
            });

            console.log(`[Schemas] ✓ Successfully applied ${schemas.length} schemas`);

            // Forzar actualización de modelos existentes
            this.refreshAllJSONModels();

            // Debug: verificar configuración
            this.debugSchemaConfiguration();

        } catch (error) {
            console.error("[Schemas] Error applying schemas:", error);
        }
    }

    // ACTUALIZAR TODOS LOS MODELOS JSON
    refreshAllJSONModels() {
        if (!window.monaco) return;

        const models = monaco.editor.getModels();
        let refreshedCount = 0;

        models.forEach(model => {
            if (model.getLanguageId() === 'json') {
                try {
                    this.refreshModelContent(model);
                    refreshedCount++;
                } catch (error) {
                    console.warn('[Schemas] Error refreshing model:', error);
                }
            }
        });

        console.log(`[Schemas] Refreshed ${refreshedCount} JSON models`);
    }

    // REFRESCAR CONTENIDO DEL MODELO (truco para forzar autocompletado)
    refreshModelContent(model) {
        const currentValue = model.getValue();
        if (!currentValue.trim()) return;

        try {
            // Pequeño delay para asegurar que Monaco esté listo
            setTimeout(() => {
                try {
                    // Truco: cambiar temporalmente el valor para forzar re-evaluación
                    model.setValue(currentValue + ' ');
                    model.setValue(currentValue);
                    
                    console.log(`[Schemas] Refreshed model: ${model.uri?.toString()}`);
                } catch (e) {
                    console.warn('[Schemas] Error in model refresh:', e);
                }
            }, 100);
        } catch (error) {
            console.warn('[Schemas] Error preparing model refresh:', error);
        }
    }

    // CONFIGURAR ESCUCHA DE MODELOS
    setupModelListening() {
        if (!window.monaco) return;

        // Escuchar cuando se crean nuevos modelos
        const originalCreateModel = monaco.editor.createModel;
        monaco.editor.createModel = function(value, language, uri) {
            const model = originalCreateModel.call(this, value, language, uri);
            
            if (language === 'json' && window.MinecraftSchemasManager) {
                setTimeout(() => {
                    window.MinecraftSchemasManager.onModelAdded(model);
                }, 100);
            }
            
            return model;
        };

        // También procesar modelos existentes
        setTimeout(() => {
            const models = monaco.editor.getModels();
            models.forEach(model => {
                if (model.getLanguageId() === 'json') {
                    this.onModelAdded(model);
                }
            });
        }, 2000);

        console.log("[Schemas] Model listening setup complete");
    }

    // MANEJADOR DE NUEVOS MODELOS
    onModelAdded(model) {
        if (!model || model.getLanguageId() !== 'json') return;

        console.log('[Schemas] New JSON model detected:', model.uri?.toString());

        // Aplicar schemas a este modelo específico
        if (Object.keys(this.loadedSchemas).length > 0) {
            setTimeout(() => {
                this.refreshModelContent(model);
            }, 500);
        }
    }

    // DEBUG: Verificar configuración actual
    debugSchemaConfiguration() {
        if (!window.monaco) return;

        try {
            const options = monaco.languages.json.jsonDefaults.getDiagnosticsOptions();
            console.log("[Schemas] CURRENT MONACO CONFIG:");
            console.log("- Schemas count:", options.schemas?.length || 0);
            console.log("- Validation:", options.validate);
            
            if (options.schemas) {
                options.schemas.forEach((schema, index) => {
                    console.log(`  Schema ${index}:`, {
                        uri: schema.uri,
                        fileMatch: schema.fileMatch,
                        hasSchema: !!schema.schema
                    });
                });
            }

            // Verificar modelos
            const models = monaco.editor.getModels();
            const jsonModels = models.filter(m => m.getLanguageId() === 'json');
            console.log("[Schemas] JSON Models:", jsonModels.length);
            jsonModels.forEach(model => {
                console.log("  -", model.uri?.toString());
            });

        } catch (error) {
            console.error("[Schemas] Debug error:", error);
        }
    }

    // PATRONES DE ARCHIVO MEJORADOS
    getFileMatchPattern(schemaName) {
        const patterns = {
            entity: ["**/entities/*.json", "**/*entity*.json", "**/entity.json"],
            item: ["**/items/*.json", "**/*item*.json", "**/item.json"],
            block: ["**/blocks/*.json", "**/*block*.json", "**/block.json"],
            biome: ["**/biomes/*.json", "**/*biome*.json"],
            loot_table: ["**/loot_tables/*.json", "**/*loot*.json"],
            recipe: ["**/recipes/*.json", "**/*recipe*.json"],
            animation: ["**/animations/*.json", "**/*animation*.json"],
            animation_controller: ["**/animation_controllers/*.json"],
            render_controller: ["**/render_controllers/*.json"],
            manifest: ["**/manifest.json"]
        };

        // Coincidencia exacta
        if (patterns[schemaName]) {
            return patterns[schemaName];
        }

        // Coincidencia parcial
        for (const [key, pattern] of Object.entries(patterns)) {
            if (schemaName.includes(key)) {
                return pattern;
            }
        }

        // Por defecto
        return [`**/*${schemaName}*.json`];
    }

    getSchemaNameFromPath(filePath) {
        const parts = filePath.split('/');
        const filename = parts[parts.length - 1];
        return filename.replace('.json', '');
    }

    // ... (otros métodos como addSchemaConfigToModal, updateSchemaStatus, etc. se mantienen igual)
    addSchemaConfigToModal() {
        // Mantener igual que antes
    }

    updateSchemaStatus(message, status) {
        // Mantener igual que antes
    }

    // MÉTODO DE DEBUG PÚBLICO
    debugAutocomplete() {
        console.log("=== SCHEMAS DEBUG ===");
        console.log("Loaded schemas:", Object.keys(this.loadedSchemas));
        
        if (window.monaco) {
            const options = monaco.languages.json.jsonDefaults.getDiagnosticsOptions();
            console.log("Monaco schemas:", options.schemas?.length);
            
            // Probar autocompletado en modelo activo
            if (window.editorManager) {
                const activeModel = window.editorManager.getActiveModel();
                if (activeModel && activeModel.language === 'json') {
                    console.log("Active JSON model:", activeModel.uri);
                    console.log("Content sample:", activeModel.getValue().substring(0, 100));
                }
            }
        }
        
        console.log("=== END DEBUG ===");
    }
}

// Hacer disponible globalmente
window.MinecraftSchemasManager = MinecraftSchemasManager;

// Auto-inicialización cuando Monaco esté listo
if (window.monaco) {
    setTimeout(() => {
        window.schemasManager = new MinecraftSchemasManager();
        window.schemasManager.init();
    }, 1000);
} else {
    window.addEventListener('monaco-ready', () => {
        window.schemasManager = new MinecraftSchemasManager();
        window.schemasManager.init();
    });
}

export default MinecraftSchemasManager;