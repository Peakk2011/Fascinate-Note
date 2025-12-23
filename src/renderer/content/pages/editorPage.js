import { initRichEditor } from '../rich.js';
import { keyMap } from '../../scripts/editor/keymap.js';
import { initStatusIndicator } from '../pageComponents/statusIndicator.js';
import { initZoomControls } from '../pageComponents/zoomControls.js';
import { initExportMenu } from '../pageComponents/exportMenu.js';
import { initSelectionMenu } from '../pageComponents/selectionMenu.js';
import { initEditorMask } from '../pageComponents/editorMask.js';

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

    // Initialize other components first
    modelFind.init({ pageConfig: config, noteAPI });
    const commandPaletteAPI = commandPalette.init({ noteAPI });
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

            const keyIsK = (typeof e.key === 'string' && e.key.toLowerCase() === 'k') || e.code === 'KeyK';
            if (keyIsK) {
                e.preventDefault();
                commandPaletteAPI.toggle();
            }
        };

        document.addEventListener('keydown', handleCommandPaletteShortcut);
        cleanupFunctions.push(() => {
            document.removeEventListener('keydown', handleCommandPaletteShortcut);
        });
    });

    /**
     * Get the text content immediately before the selection/caret inside the current
     * text node. Returns an empty string if not a text node.
     * @param {Range} range
     * @returns {string}
     */
    const getTextBeforeCursor = (range) => {
        if (!range) return '';

        const textNode = range.startContainer;
        if (textNode.nodeType !== Node.TEXT_NODE) {
            return '';
        }

        const offset = range.startOffset;
        const textContent = textNode.textContent || '';

        // Get text from start of line to cursor
        const beforeCursor = textContent.substring(0, offset);

        // Check if we're at start of a block element
        const element = textNode.parentElement;
        const blockElement = element?.closest('p, div, h1, h2, h3, h4, h5, h6, li, blockquote');

        if (blockElement) {
            // Get first text node of the block
            const firstTextNode = getFirstTextNode(blockElement);
            if (firstTextNode === textNode) {
                return beforeCursor;
            }
        }

        return beforeCursor;
    };

    /**
     * Return the first text node within `element` using a TreeWalker,
     * or `null` if none found.
     * @param {Element} element
     * @returns {Text|null}
     */
    const getFirstTextNode = (element) => {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        return walker.nextNode();
    };

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