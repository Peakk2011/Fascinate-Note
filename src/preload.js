/**
 * Electron modules for building cross-platform desktop applications
 * @type {import('electron')}
 */
const { contextBridge, ipcRenderer } = require('electron');

/**
 * Electron API interface exposed to the renderer process
 * @typedef {Object} ElectronAPI
 * @property {() => Promise<string>} getOS - Retrieves the operating system platform identifier
 * @property {() => void} closeApp - Sends a signal to close the application
 * @property {() => Promise<boolean>} newWindow - Creates a new application window
 */

try {
    /**
     * Exposes a secure API bridge between the main and renderer processes
     * Creates a global `electronAPI` object accessible in the renderer process
     * 
     * @function exposeInMainWorld
     * @param {string} apiKey - The global variable name to expose in the renderer context
     * @param {ElectronAPI} api - The API object containing methods to expose
     * @returns {void}
     * @throws {Error} Throws if context isolation is disabled or if called multiple times with the same apiKey
     */
    contextBridge.exposeInMainWorld('electronAPI', {
        /**
         * Invokes the 'get-os' IPC channel to retrieve the operating system information
         * 
         * @function getOS
         * @returns {Promise<string>} A promise that resolves to the OS platform string (e.g., 'win32', 'darwin', 'linux')
         * @throws {Error} Throws if the IPC channel handler is not registered in the main process
         */
        getOS: () => ipcRenderer.invoke('get-os'),

        /**
         * Sends a one-way message to the main process to close the application
         * Does not wait for a response or acknowledgment
         * 
         * @function closeApp
         * @returns {void}
         */
        closeApp: () => ipcRenderer.send('close-app'),

        /**
         * Requests the main process to create a new window
         * @function newWindow
         * @returns {Promise<boolean>}
         */
        newWindow: () => ipcRenderer.invoke('new-window'),
    });
} catch (error) {
    /**
     * Error object caught during the context bridge exposure process
     * @type {Error}
     */
    
    /**
     * Logs any errors that occur during the preload script execution
     * Common errors include security violations or duplicate API exposure attempts
     * 
     * @param {string} message - Error context message
     * @param {Error} error - The caught error object
     * @returns {void}
     */
    console.error('Error in preload:', error);
}