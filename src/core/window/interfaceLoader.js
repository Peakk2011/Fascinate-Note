import path from 'node:path';
import { safeLog } from '../../utils/safeLogger.js';
import { app } from 'electron';

const isDev = !app.isPackaged;

/**
 * Loads the main interface HTML into the window
 * @async
 * @param {BrowserWindow} mainWindow
 * @returns {Promise<void>}
 */
export const loadInterface = async (mainWindow) => {
    const startTime = Date.now()

    if (isDev) {
        // Vite dev server
        await mainWindow.loadURL('http://localhost:5173')
    } else {
        // Vite build output
        const indexPath = path.join(
            app.getAppPath(),
            'dist',
            'renderer',
            'index.html'
        )

        await mainWindow.loadFile(indexPath)
    }

    safeLog(`loadInterface(): ${Date.now() - startTime}ms`)
}