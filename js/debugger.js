class MinecraftDebugger {
    constructor(editor) {
        this.editor = editor;
        this.worldState = {
            players: [{ name: "TestPlayer", position: { x: 0, y: 0, z: 0 } }],
            entities: [],
            events: []
        };
    }

    async executeScript(code) {
        try {
            const sandbox = this.createSandbox();
            const result = await this.safeEval(code, sandbox);
            
            return {
                success: true,
                output: result,
                worldState: this.worldState
            };
        } catch (error) {
            this.logToDebugConsole(`[ERROR] ${this.formatMcbeError(error)}`);
            return {
                success: false,
                error: error,
                worldState: this.worldState
            };
        }
    }

    createSandbox() {
        return {
            console: {
                log: this.logToDebugConsole.bind(this),
                debug: this.logToDebugConsole.bind(this),
                error: this.logToDebugConsole.bind(this)
            },
            ...this.mockMcbeApis(),
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval
        };
    }

    mockMcbeApis() {
        return {
            '@minecraft/server': {
                world: {
                    getPlayers: () => this.worldState.players,
                    say: (msg) => this.logToDebugConsole(`[SAY] ${msg}`),
                    getDimension: (dim) => ({
                        runCommand: (cmd) => this.mockCommand(cmd)
                    })
                },
                system: {
                    runInterval: (fn, delay) => setInterval(fn, delay)
                }
            },
            '@minecraft/server-ui': {
                ActionForm: class {
                    constructor() { this.buttons = []; }
                    title(t) { this.title = t; return this; }
                    body(b) { this.body = b; return this; }
                    button(text, icon) { 
                        this.buttons.push({ text, icon }); 
                        return this; 
                    }
                    show() { 
                        return Promise.resolve({ 
                            selection: 0, 
                            canceled: false 
                        }); 
                    }
                }
            }
        };
    }

    mockCommand(cmd) {
        this.logToDebugConsole(`[CMD] ${cmd}`);
        return Promise.resolve("Command executed successfully");
    }

    logToDebugConsole(msg) {
        const debugConsole = document.getElementById('debug-console');
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.textContent = msg;
        debugConsole.appendChild(entry);
        debugConsole.scrollTop = debugConsole.scrollHeight;
    }

    formatMcbeError(error) {
        const errorMap = {
            TypeError: "Script execution failed: Invalid operation",
            ReferenceError: "Undefined variable or function",
            SyntaxError: "Syntax error in script"
        };
        return errorMap[error.name] || `Minecraft Error: ${error.message}`;
    }

    async safeEval(code, sandbox) {
        const fn = new Function('sandbox', `
            with(sandbox) {
                try {
                    ${code}
                } catch(e) {
                    console.error(e);
                    throw e;
                }
            }
        `);
        return await fn(sandbox);
    }
}

function updateWorldStateView(state) {
    const viewer = document.getElementById('world-state-viewer');
    viewer.innerHTML = `
        <div>Players: ${state.players.map(p => p.name).join(', ')}</div>
        <div>Entities: ${state.entities.length}</div>
        <div>Events: ${state.events.length}</div>
    `;
}