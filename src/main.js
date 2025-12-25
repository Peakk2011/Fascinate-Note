/**
 * Electron application modules for building cross-platform desktop applications
 * @type {import('electron')}
 */
import { app, Menu, BrowserWindow } from 'electron';

/**
 * Creates and configures the main application window
 * @type {() => Promise<BrowserWindow>}
 */
import { createWindow } from './core/createWindow.js';

/**
 * Preloads application assets before window creation
 * @type {() => Promise<void>}
 */
import { preloadAssets } from './core/preloadAssets.js';

/**
 * Operating system platform identifier configuration
 * @type {NodeJS.Platform}
 */
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
 * Disables hardware acceleration and GPU features on Intel-based Macs
 * This prevents rendering issues and crashes that can occur on older Intel Mac hardware
 * Only applies when running on x64 macOS systems
 */
if (isIntelMac) {
	/**
	 * Disables hardware acceleration to prevent GPU-related crashes on Intel Macs
	 * @returns {void}
	 */
	app.disableHardwareAcceleration();

	/**
	 * Appends a command line switch to disable GPU process
	 * @param {string} switch - The command line switch name
	 * @returns {void}
	 */
	app.commandLine.appendSwitch('--disable-gpu');

	/**
	 * Appends a command line switch to disable WebGL rendering
	 * @param {string} switch - The command line switch name
	 * @returns {void}
	 */
	app.commandLine.appendSwitch('--disable-webgl');
}

/**
 * Handles Squirrel installer events on Windows during app installation/update
 * Quits the application immediately if any Squirrel command line arguments are detected
 * This prevents the app from launching during installation, update, or uninstallation processes
 * @type {boolean}
 */
if (OS === 'win32' && process.argv.some(arg => arg.includes('--squirrel'))) {
	/**
	 * Quits the application immediately
	 * @returns {void}
	 */
	app.quit();
}

/**
 * Executes when Electron has finished initialization and is ready to create browser windows
 * Handles the application startup sequence: preloading assets then creating the main window
 * @event app#ready
 * @returns {Promise<void>}
 */
app.whenReady().then(async () => {
	/**
	 * Preloads all required application assets before window creation
	 * Ensures resources are available when the window is displayed
	 * @returns {Promise<void>}
	 */
	await preloadAssets();

	/**
	 * Creates and displays the main application window
	 * @returns {Promise<BrowserWindow>}
	 */
	await createWindow();

	/**
	 * Handles macOS-specific behavior when the app is activated from the dock
	 * Creates a new window if all windows have been closed
	 * @event app#activate
	 * @returns {Promise<void>}
	 */
	app.on('activate', async () => {
		/**
		 * Gets all currently open browser windows
		 * @type {BrowserWindow[]}
		 */
		if (BrowserWindow.getAllWindows().length === 0) {
			/**
			 * Creates a new window if none exist
			 * @returns {Promise<BrowserWindow>}
			 */
			await createWindow();
		}
	});
});

/**
 * Handles the event when all application windows have been closed
 * On Windows and Linux, this quits the application entirely
 * On macOS, the app remains active in the dock (standard macOS behavior)
 * @event app#window-all-closed
 * @returns {void}
 */
app.on('window-all-closed', () => {
	/**
	 * Checks if the operating system is not macOS (darwin)
	 * @type {boolean}
	 */
	if (OS !== 'darwin') {
		/**
		 * Quits the application completely
		 * @returns {void}
		 */
		app.quit();
	}
});