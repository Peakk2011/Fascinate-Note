/**
 * Fascinate Notes Application Initializer
 * Handles all initialization logic for the Electron application
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs/promises';
import { createWindow } from './core/createWindow.js';
import { preloadAssets } from './core/preloadAssets.js';
import { OS } from './config/osConfig.js';

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
 * Registers IPC handlers that should be initialized once.
 */
let ipcHandlersRegistered = false;

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
		console.log('Handling show-open-dialog with options:', options);
		const win = BrowserWindow.fromWebContents(event.sender);
		if (!win) {
			console.log('No window found for show-open-dialog');
			return { canceled: true, filePaths: [] };
		}
		
		try {
			const result = await dialog.showOpenDialog(win, options);
			console.log('show-open-dialog result:', result);
			return result;
		} catch (error) {
			console.error('Failed to show open dialog:', error);
			return { canceled: true, filePaths: [] };
		}
	});

	ipcMain.handle('read-file', async (event, filePath) => {
		console.log('Handling read-file for:', filePath);
		try {
			const content = await fs.readFile(filePath, 'utf8');
			console.log('File read successfully, length:', content.length);
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

	app.on('will-quit', () => {
		console.log('Removing IPC handlers...');
		ipcMain.removeHandler('new-window');
		ipcMain.removeHandler('show-open-dialog');
		ipcMain.removeHandler('read-file');
		ipcMain.removeHandler('app:toggle-always-on-top');
	});

	ipcHandlersRegistered = true;
	console.log('IPC handlers registered successfully');
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