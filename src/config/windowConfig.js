import { osConfig, OS } from './osConfig.js';
import { nativeTheme } from 'electron';
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
        ...(OS === 'darwin' && {
            titleBarStyle: 'hiddenInset',
            transparent: true,
            vibrancy: 'sidebar',
            visualEffectState: 'active',
            hasShadow: true,
        }),
        ...(OS === 'win32' && {
            backgroundMaterial: 'mica',
            titleBarStyle: 'hidden',
            // transparent: true,
            frame: false,
            titleBarOverlay: {
                color: '#00000000',
                symbolColor: nativeTheme.shouldUseDarkColors ? '#ffffff' : '#000000',
                height: 38
            }
        }),
        webPreferences: {
            preload: resolvePath('../preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    };
};