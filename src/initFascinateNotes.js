/**
 * Fascinate Notes Application Initializer
 * Handles all initialization logic for the Electron application
 */

import { app, BrowserWindow } from 'electron';
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

	// Preload application assets
	await preloadAssets();

	// Create the main application window
	await createWindow();

	// Register event handlers for app lifecycle
	registerEventHandlers();
}

export default initFascinateNotes;