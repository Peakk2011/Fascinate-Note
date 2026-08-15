import path from 'node:path';
import { safeLog } from '#utils-logger';
import { app } from 'electron';
// import wait from '@wait';
import wait from '../../api/wait.js';

const isDev = !app.isPackaged;
const VITE_DEV_SERVER_URL = "http://localhost:5173";
const sleep = wait;

/**
 * Loads the main interface HTML into the window
 * @async
 * @param {BrowserWindow} mainWindow
 * @returns {Promise<void>}
 */
export const loadInterface = async (mainWindow) => {
    const startTime = Date.now()

    if (isDev) {
        while (true) {
            try {
                await mainWindow.loadURL(VITE_DEV_SERVER_URL);
                break;
            } catch {
                await sleep(300);
            }
        }
    } else {
        // Vite build output
        const indexPath = path.join(
            app.getAppPath(),
            'dist',
            'renderer',
            'index.html'
        );

        await mainWindow.loadFile(indexPath);
    }

    safeLog(`loadInterface(): ${Date.now() - startTime}ms`);
}

/*
Electron start
 ├─ loadInterface()
 │   └─ retry loadURL when Vite was ready
 └─ did-finish-load
     └─ Close/Stop
*/