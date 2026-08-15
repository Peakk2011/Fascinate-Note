import { app, BrowserWindow } from "electron";
import { IpcManager } from '../ipcManager.js';
import { getWindowConfig } from '../../config/windowConfig.js';
import { OpenDevTools } from '../devtools.js';

/**
 * Creates and configures the main BrowserWindow
 * @returns {BrowserWindow}
 */
export const initializeWindow = () => {
    const windowOptions = getWindowConfig();
    const mainWindow = new BrowserWindow(windowOptions);

    mainWindow.show();
    mainWindow.webContents
        .setBackgroundThrottling(true);
    
    mainWindow.setMenu(null);

    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    
    new OpenDevTools(mainWindow, {
        enabled: isDev
    });

    return mainWindow;
};

/**
 * Creates and connects all core managers
 * @param {BrowserWindow} mainWindow
 * @returns {{
 *      ipcManager: IpcManager
 * }}
 */
export const initializeCoreManagers = (mainWindow) => {
    const ipcManager = new IpcManager();
    ipcManager.init();

    return {
        ipcManager
    };
};