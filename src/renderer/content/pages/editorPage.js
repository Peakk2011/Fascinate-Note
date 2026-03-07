import { initRichEditor } from '../rich.js';
import { keyMap } from '../../scripts/editor/keymap.js';
import { initStatusIndicator } from '../pageComponents/statusIndicator.js';
import { initZoomControls } from '../pageComponents/zoomControls.js';
import { initExportMenu } from '../pageComponents/exportMenu.js';
import { initSelectionMenu } from '../pageComponents/selectionMenu.js';
import { initEditorMask } from '../pageComponents/editorMask.js';
import { initRealtimeCollab } from '../../scripts/collab/realtimeCollab.js';

/**
 * @typedef {Object} EditorConfig
 * @property {string} textareaId - ID of the contenteditable editor element
 * @property {string} textareaPlaceholder - Placeholder text to show when empty
 */

/**
 * @typedef {Object} NoteAPI
 * @property {Function} saveData
 * @property {Function} loadData
 * @property {Function} [showCommandPalette]
 */

/**
 * @typedef {Object} ModelFindAPI
 * @property {Function} init
 * @property {Function} [show]
 */

/**
 * @typedef {Object} CommandPaletteAPI
 * @property {Function} show
 * @property {Function} hide
 * @property {Function} toggle
 * @property {Function} destroy
 */

/**
 * @typedef {Object} ContextMenuAPI
 * @property {Function} init
 */

/**
 * @typedef {Object} EditorPageReturn
 * @property {NoteAPI} noteAPI
 * @property {Function} cleanup - Cleanup function to remove listeners and destroy components
 */

/**
 * @typedef {Object} EditorCallbacks
 * @property {Function} onSave - called with current HTML content
 * @property {Function} onSearch
 * @property {Function} onReplace
 * @property {Function} onNewWindow
 */

/**
 * Initialize the editor page and wire its subcomponents.
 * @param {EditorConfig} config
 * @param {NoteAPI} noteAPI
 * @param {ModelFindAPI} modelFind
 * @param {ContextMenuAPI} contextMenu
 * @param {{init: Function}} commandPalette - factory object exposing `init` which returns a `CommandPaletteAPI`
 * @returns {Promise<EditorPageReturn>}
 */
export const initEditorPage = async (config, noteAPI, modelFind, contextMenu, commandPalette) => {
    const editorElement = document.getElementById(config.textareaId);
    if (!editorElement) {
        throw new Error(`Editor element with ID "${config.textareaId}" not found.`);
    }

    // Initialize rich editor component
    const rich = initRichEditor({
        editorId: config.textareaId,
        placeholderText: config.textareaPlaceholder
    });

    window.rich = rich;

    // Store cleanup functions
    const cleanupFunctions = [];

    // Ensure local content is loaded before collaboration sync
    if (noteAPI && typeof noteAPI.loadData === 'function') {
        try {
            await noteAPI.loadData();
        } catch (error) {
            console.warn('Failed to load local content before collab:', error);
        }
    }

    // Initialize realtime collaboration (optional)
    if (config?.collab?.enabled) {
        const collabController = initRealtimeCollab(editorElement, {
            serverUrl: config.collab.serverUrl,
            room: config.collab.room,
            mapName: config.collab.mapName,
            debounceMs: config.collab.debounceMs,
            connectionTimeoutMs: config.collab.connectionTimeoutMs,
            autoDisableOnFail: config.collab.autoDisableOnFail,
            userName: config.collab.userName,
            userColor: config.collab.userColor
        });
        cleanupFunctions.push(() => collabController.destroy());
    }

    // Initialize other components first
    modelFind.init({ pageConfig: config, noteAPI });

    const commandPaletteAPI = commandPalette.init({ noteAPI, markerAPI: window.__markerAPI });
    window.__commandPaletteAPI = commandPaletteAPI;

    noteAPI.showCommandPalette = commandPaletteAPI.toggle;
    const contextMenuAPI = contextMenu.init({ pageConfig: config, noteAPI });

    cleanupFunctions.push(commandPaletteAPI.destroy, contextMenuAPI.destroy);

    // Setup event listeners
    requestAnimationFrame(() => {
        // Initialize components
        const statusIndicator = initStatusIndicator(config);
        const zoomControls = initZoomControls(config, noteAPI);
        const exportMenu = initExportMenu(config, rich);
        const selectionMenu = initSelectionMenu(editorElement);

        // Add editor background mask (gradient behind the editor)
        const editorMask = initEditorMask(editorElement);

        // Store cleanup functions
        cleanupFunctions.push(
            zoomControls.cleanup,
            exportMenu.cleanup,
            selectionMenu.cleanup,
            editorMask.destroy
        );

        // Initialize Keyboard Shortcuts with Command Palette support
        /** @type {EditorCallbacks} */
        const editorCallbacks = {
            /**
             * Called on Ctrl/Cmd + S
             * @param {string} content - Current HTML content of the editor
             */
            onSave: async (content) => {
                await noteAPI.saveData();
                statusIndicator.showSaved();
            },
            /**
             * Called on Ctrl/Cmd + F
             */
            onSearch: () => {
                if (modelFind && typeof modelFind.show === 'function') {
                    modelFind.show();
                } else {
                    console.warn('modelFind.show() is not available.');
                }
            },
            /**
             * Called on Ctrl/Cmd + H
             */
            onReplace: () => {
                if (modelFind && typeof modelFind.show === 'function') {
                    modelFind.show(true); // Pass true to open replace tab
                } else {
                    console.warn('modelFind.show(true) is not available.');
                }
            },
            /**
             * Called on Ctrl/Cmd + Shift + N
             */
            onNewWindow: async () => {
                if (window.electronAPI && typeof window.electronAPI.newWindow === 'function') {
                    try {
                        await window.electronAPI.newWindow();
                    } catch (error) {
                        console.error('Failed to create new window:', error);
                    }
                }
            }
        };

        const cleanupKeyMap = keyMap(editorElement, editorCallbacks);
        cleanupFunctions.push(cleanupKeyMap);

        // Command Palette - Markdown Helper
        /**
         * Handle global keydown for Command Palette shortcut (Ctrl/Cmd+K).
         * @param {KeyboardEvent} e
         */
        const handleCommandPaletteShortcut = (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;

            const keyIsK = e.code === 'KeyK' || (typeof e.key === 'string' && e.key.toLowerCase() === 'k');

            if (keyIsK) {
                e.preventDefault();
                const isInMarker = document.getElementById('workspace-container')
                    ?.classList.contains('is-active');
                console.log('[shortcut] isInMarker:', isInMarker); // เพิ่ม
                if (isInMarker) {
                    window.__commandPaletteAPI?.toggle('marker');
                    return;
                }
                commandPaletteAPI.toggle();
            }
        };

        document.addEventListener('keydown', handleCommandPaletteShortcut);
        cleanupFunctions.push(() => {
            document.removeEventListener('keydown', handleCommandPaletteShortcut);
            window.__commandPaletteAPI = null;
            window.__markerAPI = null;
        });
    });

    // Return cleanup function
    return {
        noteAPI,
        /**
         * Remove listeners and call cleanup helpers for child components.
         * @returns {void}
         */
        cleanup() {
            cleanupFunctions.forEach(fn => fn());
        }
    };
};