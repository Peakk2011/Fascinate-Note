/**
 * Fascinate Notes Application Initializer
 * Handles all initialization logic for the Electron application
 */

import { app, BrowserWindow, ipcMain, dialog, nativeTheme, shell } from 'electron';
import fs from 'fs/promises';
import { createWindow } from './core/createWindow.js';
import { preloadAssets } from './core/preloadAssets.js';
import { OS } from './config/osConfig.js';

/**
 * Indicates whether the app is running in development mode
 * @type {boolean}
 */
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

/**
 * Indicates whether the current system is running on Apple Silicon architecture (ARM64)
 * @type {boolean}
 * @constant
 */
const isAppleSilicon = process.arch === 'arm64';

/**
 * Indicates whether the current system is running on Intel-based macOS (x64 architecture)
 * Used to determine if hardware acceleration should be disabled for compatibility
 * @type {boolean}
 * @constant
 */
const isIntelMac = process.arch === 'x64' && process.platform === 'darwin';

/**
 * Indicates whether the current system is running on Linux
 * @type {boolean}
 * @constant
 */
const isLinux = process.platform === 'linux';

/**
 * Configures platform-specific settings before app initialization
 * @private
 * @returns {void}
 */
const configurePlatformSettings = () => {
	/**
	 * Disables hardware acceleration and GPU features on Intel-based Macs
	 * This prevents rendering issues and crashes that can occur on older Intel Mac hardware
	 */
	if (isIntelMac) {
		app.disableHardwareAcceleration();
		app.commandLine.appendSwitch('--disable-gpu');
		app.commandLine.appendSwitch('--disable-webgl');
	}

	/**
	 * Forces X11 backend on Linux to avoid Wayland/Vulkan
	 * compositor crashes (SIGSEGV) seen on some GPU drivers
	 */
	if (isLinux) {
		app.commandLine.appendSwitch('ozone-platform-hint', 'x11');
		// app.commandLine.appendSwitch('disable-gpu');
		// app.commandLine.appendSwitch('disable-software-rasterizer');
		// app.disableHardwareAcceleration();
	}
}

/**
 * Handles Squirrel installer events on Windows
 * Quits the application if Squirrel command line arguments are detected
 * @private
 * @returns {boolean} Returns true if app should quit
 */
const handleSquirrelEvents = () => {
	if (OS === 'win32' && process.argv.some(arg => arg.includes('--squirrel'))) {
		app.quit();
		return true;
	}
	return false;
}

/**
 * Registers the Electron IPC handlers
 */
let ipcHandlersRegistered = false;
let aboutWindow = null;

const registerIpcHandlers = () => {
	if (ipcHandlersRegistered) {
		console.log('IPC handlers already registered, skipping');
		return;
	}

	console.log('Registering IPC handlers...');

	ipcMain.handle('new-window', async () => {
		try {
			await createWindow();
			return true;
		} catch (error) {
			console.error('Failed to create new window:', error);
			return false;
		}
	});

	ipcMain.handle('show-open-dialog', async (event, options) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		if (!win) {
			return { canceled: true, filePaths: [] };
		}

		try {
			return await dialog.showOpenDialog(win, options);
		} catch (error) {
			console.error('Failed to show open dialog:', error);
			return { canceled: true, filePaths: [] };
		}
	});

	ipcMain.handle('read-file', async (event, filePath) => {
		try {
			const content = await fs.readFile(filePath, 'utf8');
			return { success: true, content };
		} catch (error) {
			console.error('Failed to read file:', error);
			return { success: false, error: error.message };
		}
	});

	ipcMain.handle('app:toggle-always-on-top', (event) => {
		const win = BrowserWindow.fromWebContents(event.sender);
		if (win) {
			const isAlwaysOnTop = win.isAlwaysOnTop();
			win.setAlwaysOnTop(!isAlwaysOnTop);
			return !isAlwaysOnTop;
		}
		return false;
	});

	ipcMain.handle('open-about-window', async () => {
		if (aboutWindow && !aboutWindow.isDestroyed()) {
			aboutWindow.focus();
			return;
		}

		const mainWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
		// About Fascinate Notes
		aboutWindow = new BrowserWindow({
			width: 520,
			height: 230,
			parent: mainWindow,
			show: true,
			resizable: false,
			minimizable: false,
			maximizable: false,
			title: 'About Fascinate Notes',
			center: true,
			frame: false,
			titleBarStyle: 'hidden',
			titleBarOverlay: {
				color: '#00000000',
				symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#000000',
				height: 38
			},
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true
			}
		});

		await aboutWindow.loadURL('https://mint-teams.web.app/Fascinate-Welcome/');

		aboutWindow.once('ready-to-show', () => {
			aboutWindow.show();
		});

		aboutWindow.on('closed', () => {
			aboutWindow = null;
		});
	});

	app.on('web-contents-created', (event, contents) => {
		contents.on('will-navigate', (event, url) => {
			if (isDev && url.startsWith('http://localhost:5173')) {
				return;
			}

			event.preventDefault();
			shell.openExternal(url);
		});

		contents.setWindowOpenHandler(({ url }) => {
			// Allow opening Vite dev server URLs in development mode
			if (isDev && url.startsWith('http://localhost:5173')) {
				return { action: 'allow' };
			}

			shell.openExternal(url);
			return { action: 'deny' };
		});
	});

	app.on('will-quit', () => {
		ipcMain.removeHandler('new-window');
		ipcMain.removeHandler('show-open-dialog');
		ipcMain.removeHandler('read-file');
		ipcMain.removeHandler('app:toggle-always-on-top');
	});

	ipcHandlersRegistered = true;
};

/**
 * Registers application event handlers
 * @private
 * @returns {void}
 */
const registerEventHandlers = () => {
	/**
	 * Handles macOS-specific behavior when the app is activated from the dock
	 * Creates a new window if all windows have been closed
	 */
	app.on('activate', async () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			await createWindow();
		}
	});

	/**
	 * Handles the event when all application windows have been closed
	 * On Windows and Linux, quits the application entirely
	 * On macOS, the app remains active in the dock
	 */
	app.on('window-all-closed', () => {
		if (OS !== 'darwin') {
			app.quit();
		}
	});
}

/**
 * Initializes the Fascinate Notes application
 * Handles platform configuration, Squirrel events, and app startup
 * @returns {Promise<void>}
 */
const initFascinateNotes = async () => {
	// Configure platform-specific settings
	configurePlatformSettings();

	// Handle Squirrel installer events (Windows)
	if (handleSquirrelEvents()) {
		return; // Exit early if handling Squirrel event
	}

	// Wait for Electron to be ready
	await app.whenReady();

	// Register IPC handlers (new window, etc.)
	registerIpcHandlers();

	// Preload application assets
	await preloadAssets();

	// Create the main application window
	await createWindow();

	// Register event handlers for app lifecycle
	registerEventHandlers();
}

export default initFascinateNotes;