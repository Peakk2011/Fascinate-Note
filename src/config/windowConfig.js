import { osConfig, OS } from './osConfig.js';
import { getTitleBarOverlay } from '../core/window/titleBarTheme.js';
import { resolvePath } from '#utils-paths';

/**
 * @constant
 * @type {{width: number, height: number, min: {width: number, height: number}}}
 * @description Default window dimensions and minimum constraints.
 */
const windowSizeConfig = {
    width: 360,
    height: 600,
    min: {
        width: 320,
        height: 400
    }
};

/**
 * Generates the configuration object for the main BrowserWindow.
 * It combines a base configuration (like size and webPreferences) with
 * platform-specific settings (like title bar style and transparency)
 * based on the current operating system.
 *
 * @returns {import('electron').BrowserWindowConstructorOptions} The configuration object for creating a new BrowserWindow.
 */
export const getWindowConfig = () => {
    const config = osConfig[OS] || osConfig.linux;

    return {
        width: windowSizeConfig.width,
        height: windowSizeConfig.height,
        minWidth: windowSizeConfig.min.width,
        minHeight: windowSizeConfig.min.height,
        title: `Fascinate Note (${config.name})`,
        icon: config.icon || undefined,
        // Vibrancy and transparency settings
        backgroundColor: '#00000000',
        ...(OS === 'darwin' && {
            titleBarStyle: 'hiddenInset',
            transparent: true,
            vibrancy: 'sidebar',
            visualEffectState: 'active',
            hasShadow: true,
        }),
        ...(OS === 'win32' && { backgroundMaterial: 'mica' }),
        ...((OS === 'win32' || OS === 'linux') && {
            titleBarStyle: 'hidden',
            frame: false,
            titleBarOverlay: getTitleBarOverlay()
        }),
        ...(OS === 'linux' && {
            transparent: false,
        }),
        webPreferences: {
            preload: resolvePath('../preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    };
};
