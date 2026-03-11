// `page.js` This file is part of Fascinate-Note (Renderer Side)

import { noteFeatures } from '@scripts/note.js';
import { createModelFind } from '@model/modelFind.js';
import { createContextMenu } from '@contextmenu/contextMenu.js';
import { getConfig } from '@services/configService.js';
import { createCommandPalette } from '@command/commandPalette.js';
import { createPageMarkup } from '@pages/pageMarkup.js';
import { createTitlebar, initTitlebar } from '@page-components/titlebar.js';
import { initFileDropOverlay } from '@page-components/fileDropOverlay.js';
import { initEditorPage } from '@pages/editorPage.js';
import '@cursor';

export const Page = {
    // Cache instances
    _modelFindCache: null,
    _contextMenuCache: null,
    _titlebarCache: null,
    _commandPaletteCache: null,

    async _getModelFind() {
        if (!this._modelFindCache) {
            this._modelFindCache = await createModelFind();
        }
        return this._modelFindCache;
    },

    async _getContextMenu() {
        if (!this._contextMenuCache) {
            this._contextMenuCache = await createContextMenu();
        }
        return this._contextMenuCache;
    },

    async _getTitlebar() {
        // Only create titlebar in Electron environment
        if (window.electronAPI) {
            if (!this._titlebarCache) {
                this._titlebarCache = await createTitlebar();
            }
            return this._titlebarCache;
        }
        return null; // Return null if not in Electron
    },

    async _getCommandPalette() {
        if (!this._commandPaletteCache) {
            this._commandPaletteCache = await createCommandPalette();
        }
        return this._commandPaletteCache;
    },

    async markups() {
        const [config, modelFind, contextMenu, titlebar, commandPalette] = await Promise.all([
            getConfig(),
            this._getModelFind(),
            this._getContextMenu(),
            this._getTitlebar(),
            this._getCommandPalette()
        ]);

        return createPageMarkup(config, modelFind, contextMenu, titlebar, commandPalette);
    },

    async init() {
        try {
            // Load in parallel (config already cached from markups())
            const [config, noteAPI, modelFind, contextMenu, commandPalette] = await Promise.all([
                getConfig(),
                noteFeatures(),
                this._getModelFind(),
                this._getContextMenu(),
                this._getCommandPalette()
            ]);

            // make available for workspace callbacks
            window.noteAPI = noteAPI;

            if (!noteAPI) {
                throw new Error('Failed to initialize note features');
            }

            const result = await initEditorPage(
                config,
                noteAPI,
                modelFind,
                contextMenu,
                commandPalette
            );

            try {
                const editorElement = document.getElementById(config.textareaId);
                const overlay = initFileDropOverlay({ editor: editorElement, noteAPI });
                if (result && typeof result.cleanup === 'function') {
                    const origCleanup = result.cleanup.bind(result);
                    result.cleanup = () => {
                        try { overlay.cleanup(); } catch (e) { }
                        origCleanup();
                    };
                }
            } catch (e) {
                console.warn('initFileDropOverlay failed', e);
            }

            // Initialize titlebar behavior
            try {
                const tb = initTitlebar(60, {
                    onOpenMarkerCommandPalette: () => {
                        commandPalette.init({
                            noteAPI: window.noteAPI,
                            markerAPI: window.__markerAPI
                        })?.toggle('marker');
                    }
                });
                // ensure titlebar listener is cleaned when page cleanup runs
                if (result && typeof result.cleanup === 'function') {
                    const origCleanup = result.cleanup.bind(result);
                    result.cleanup = () => {
                        try { tb.destroy(); } catch (e) { }
                        origCleanup();
                    };
                }
            } catch (e) {
                console.warn('initTitlebar failed', e);
            }

            return result.noteAPI;
        } catch (error) {
            console.log('Error in Page.init:', error);
            return null;
        }
    }
};