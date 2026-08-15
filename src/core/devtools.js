/**
 * @file Manages the opening of Developer Tools for a BrowserWindow.
 * @typedef {object} DevToolsOptions
 * @property {boolean} [enabled=true] - Whether DevTools should be opened. Defaults to true in development environment.
 * @property {'undocked' | 'right' | 'bottom' | 'detach'} [mode='undocked'] - The mode to open DevTools in.
 */

export class OpenDevTools {
    /**
     * @param {import('electron').BrowserWindow} window - The window to open DevTools for.
     * @param {DevToolsOptions} [options={}]            - Configuration options.
     */
    constructor(window, options = {}) {
        if (!window || !window.webContents) {
            throw new Error('A valid BrowserWindow instance must be provided.');
        }

        this.window = window;
        this.options = {
            enabled: options.enabled ?? process.env.NODE_ENV === 'development',
            mode: options.mode || 'undocked',
        };

        if (this.options.enabled) {
            this.open();
            // Bind keyboard shortcuts to toggle DevTools when in development
            this._bindShortcuts();
        }
    }

    // Opens the Developer Tools based on the configured options.
    open() {
        // If the window is still loading, wait until it's finished so DevTools attaches reliably.
        const open = () => this.window.webContents.openDevTools({ mode: this.options.mode });

        try {
            if (this.window.webContents.isLoading()) {
                this.window.webContents.once('did-finish-load', open);
            } else {
                open();
            }
        } catch (err) {
            // Fallback: attempt to open DevTools on DOM ready if other events are unavailable.
            this.window.webContents.once && this.window.webContents.once('dom-ready', open);
        }
    }

    // Binds F12 and Ctrl/Cmd+Shift+I to open DevTools (only when enabled)
    _bindShortcuts() {
        if (!this.window || !this.window.webContents || this._shortcutsBound) return;

        const handle = (event, input) => {
            try {
                const key = (input.key || '').toLowerCase();

                const isF12 = key === 'f12' || input.code === 'F12';
                const isCmdOrCtrl = !!(input.control || input.meta);
                const isShift = !!input.shift;
                const isI = key === 'i';

                if (isF12 || (isCmdOrCtrl && isShift && isI)) {
                    // prevent the page from handling it
                    event.preventDefault && event.preventDefault();
                    this.open();
                }
            } catch (e) {
                // ignore
            }
        };

        // Use before-input-event so it works in renderer input contexts
        this.window.webContents.on('before-input-event', handle);
        this._shortcutsBound = true;
    }
}