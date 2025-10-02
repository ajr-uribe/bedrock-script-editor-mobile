// pwa-manager.js - Gestor de PWA
class PWAManager {
	constructor() {
		this.registration = null;
		this.init();
	}

	async init() {
		if ("serviceWorker" in navigator) {
			try {
				this.registration =
					await navigator.serviceWorker.register(
						"/sw.js"
					);
				console.log("[PWA] Service Worker registered successfully");

				this.setupUpdateNotification();
				this.setupOfflineIndicator();
				this.setupInstallPrompt();
			} catch (error) {
				console.error(
					"[PWA] Service Worker registration failed:",
					error
				);
			}
		}
	}

	setupUpdateNotification() {
		if (!this.registration) return;

		this.registration.addEventListener("updatefound", () => {
			const newWorker = this.registration.installing;

			newWorker.addEventListener("statechange", () => {
				if (
					newWorker.state === "installed" &&
					navigator.serviceWorker.controller
				) {
					this.showUpdateNotification();
				}
			});
		});
	}

	showUpdateNotification() {
		const notification = document.createElement("div");
		notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #007ACC;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
		notification.innerHTML = `
            <div style="margin-bottom: 10px;">Nueva versión disponible!</div>
            <button onclick="location.reload()" style="
                background: white;
                color: #007ACC;
                border: none;
                padding: 8px 15px;
                border-radius: 4px;
                cursor: pointer;
            ">Actualizar</button>
        `;
		document.body.appendChild(notification);
	}

	setupOfflineIndicator() {
		window.addEventListener("online", () =>
			this.showConnectionStatus(true)
		);
		window.addEventListener("offline", () =>
			this.showConnectionStatus(false)
		);
	}

	showConnectionStatus(isOnline) {
		const indicator = document.createElement("div");
		indicator.style.cssText = `
            position: fixed;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: ${isOnline ? "#4CAF50" : "#f44336"};
            color: white;
            padding: 10px 20px;
            border-radius: 25px;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s;
        `;
		indicator.textContent = isOnline
			? "✓ Conexión restaurada"
			: "⚠ Modo offline";
		document.body.appendChild(indicator);

		setTimeout(() => (indicator.style.opacity = "1"), 100);
		setTimeout(() => {
			indicator.style.opacity = "0";
			setTimeout(() => document.body.removeChild(indicator), 300);
		}, 3000);
	}

	setupInstallPrompt() {
		let deferredPrompt;

		window.addEventListener("beforeinstallprompt", (e) => {
			e.preventDefault();
			deferredPrompt = e;
			this.showInstallButton(deferredPrompt);
		});
	}

	showInstallButton(deferredPrompt) {
		const installBtn = document.createElement("button");
		installBtn.id = "install-pwa-btn";
		installBtn.innerHTML = "📱 Instalar App";
		installBtn.style.cssText = `
            position: fixed;
            bottom: 30px;
            right: 10px;
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 25px;
            cursor: pointer;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

		installBtn.addEventListener("click", async () => {
			deferredPrompt.prompt();
			const { outcome } = await deferredPrompt.userChoice;
			if (outcome === "accepted") {
				installBtn.remove();
			}
		});

		document.body.appendChild(installBtn);
	}

	async cacheTypeDefinitions(urls) {
		if (!this.registration || !this.registration.active) return;

		const messageChannel = new MessageChannel();

		return new Promise((resolve) => {
			messageChannel.port1.onmessage = (event) => {
				resolve(event.data.success);
			};

			this.registration.active.postMessage(
				{
					type: "CACHE_TYPES",
					urls: urls
				},
				[messageChannel.port2]
			);
		});
	}
}

window.PWAManager = PWAManager;
export default PWAManager;
