import os from 'os';
import { versions } from 'process';

/**
 * @typedef {Object} LocalStorageInfo
 * @property {string} used - Used storage in MB
 * @property {string} quota - Total quota in MB
 * @property {string} remaining - Remaining storage in MB
 */

/**
 * @typedef {Object} BrowserWindow
 * @property {Object} webContents - The webContents object
 * @property {Function} webContents.executeJavaScript - Execute JavaScript in the renderer
 */

/**
 * Retrieves operating system information formatted for user agent string
 * @returns {string} Formatted OS information
 */
const info = () => {
    const platform = os.platform();
    const arch = os.arch();
    const release = os.release();

    switch (platform) {
        case 'win32': {
            const [major, minor] = release.split('.');
            const archString = arch === 'x64' ? 'Win64; x64' : arch;
            return `Windows NT ${major}.${minor}; ${archString}`;
        }
        case 'darwin': {
            const [major, minor, patch = '0'] = release.split('.');
            return `Macintosh; Intel Mac OS X ${major}_${minor}_${patch}`;
        }
        case 'linux':
            return `X11; Linux ${arch}`;
        default:
            return `${platform}; ${arch}`;
    }
};

/**
 * Retrieves browser engine information (Chrome/Electron versions)
 * @returns {string} Formatted engine information
 */
const getEngineInfo = () => {
    const chromeVersion = versions.chrome || '0.0.0.0';
    const electronVersion = versions.electron || '0.0.0';
    return `AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Electron/${electronVersion}`;
};

/**
 * Retrieves localStorage usage information from the renderer process
 * @param {BrowserWindow | null | undefined} win - Electron BrowserWindow instance
 * @returns {Promise<LocalStorageInfo | null>} Storage information or null if unavailable
 */
const getLocalStorageInfo = async (win) => {
    if (!win?.webContents) {
        return null;
    }

    try {
        const storageInfo = await win.webContents.executeJavaScript(`
            (function() {
                try {
                    let totalBytes = 0;
                    
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        const value = localStorage.getItem(key);
                        
                        if (key) totalBytes += key.length;
                        if (value) totalBytes += value.length;
                    }
                    
                    const QUOTA_BYTES = 5 * 1024 * 1024; // 5MB standard quota
                    const toMB = (bytes) => (bytes / (1024 * 1024)).toFixed(2);
                    
                    return {
                        used: toMB(totalBytes),
                        quota: toMB(QUOTA_BYTES),
                        remaining: toMB(QUOTA_BYTES - totalBytes)
                    };
                } catch (error) {
                    console.error('Failed to calculate localStorage info:', error);
                    return null;
                }
            })()
        `);

        return storageInfo;
    } catch (error) {
        console.error('Failed to execute localStorage script:', error);
        return null;
    }
};

/**
 * Generates a comprehensive user agent string with system and storage information
 * @param {BrowserWindow | null | undefined} win - Electron BrowserWindow instance
 * @param {string} [appName='FascinateNotes'] - Application name
 * @param {string} [appVersion='1.0.0-Stable'] - Application version
 * @returns {Promise<string>} Complete user agent string
 * @example
 * const ua = await createUserAgent(mainWindow, 'Fascinate Notes', '2.0.0');
 * console.log(ua);
 * // Mozilla/5.0
 * // (Windows NT 10.0; Win64; x64)
 * // AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Electron/28.0.0
 * // Fascinate Notes/1.0.0
 * // LocalStorage: used=0.05MB; quota=5.00MB; remaining=4.95MB
 */
export const createUserAgent = async (
    win,
    appName = 'FascinateNotes',
    appVersion = '1.0.0-Stable'
) => {
    const osInfo = info();
    const engineInfo = getEngineInfo();
    const localStorageInfo = await getLocalStorageInfo(win);

    const userAgentParts = [
        'Mozilla/5.0',
        `(${osInfo})`,
        engineInfo,
        `${appName}/${appVersion}`
    ];

    if (localStorageInfo) {
        userAgentParts.push(
            `LocalStorage: used=${localStorageInfo.used}MB; quota=${localStorageInfo.quota}MB; remaining=${localStorageInfo.remaining}MB`
        );
    }

    const userAgentString = userAgentParts.join('\n');
    
    return userAgentString;
};

export const userAgent = createUserAgent;

// Self-invoking function to display user agent when run directly via node
(async () => {
  if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) {
    const ua = await createUserAgent(null);
    console.log(ua);
  }
})();