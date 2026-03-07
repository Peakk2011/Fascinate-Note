import { Mint } from '../../../../framework/mint.js';
import { fetchJSON } from '../../../../utils/fetch.js';
import { CommandPaletteController } from './controller/CommandPaletteController.js';

/**
 * @typedef {Object} NoteAPI
 * @property {Function} [saveData]
 * @property {Function} [loadData]
 * @property {Function} [zoomIn]
 * @property {Function} [zoomOut]
 * @property {Function} [resetZoom]
 */

/**
 * @typedef {Object} MarkerAPI
 * @property {Function} [createNewWindow]
 * @property {Function} [clearAllWindows]
 * @property {Function} [toggleMissionView]
 * @property {Function} [createNewGroup]
 */

Mint.include('stylesheet/style-components/command-palette.css');

/**
 * Create a command palette component factory.
 * @returns {Promise<{
 *   markups: string,
 *   init: function({noteAPI: NoteAPI, markerAPI: MarkerAPI}): {
 *     show: function(string=): Promise<void>,
 *     hide: function(): Promise<void>,
 *     toggle: function(string=): Promise<void>,
 *     showMarkdownCommands: function(): Promise<void>,
 *     destroy: function(): void
 *   }
 * }>}
 */
export const createCommandPalette = async () => {
    let config;
    let systemCommands = [];
    let markdownCommands = [];
    let markerCommands = [];

    // Load configuration
    try {
        config = await fetchJSON(
            'renderer/content/contentComponents/commandPalette/commandPaletteConfig.json'
        );
    } catch (error) {
        console.error('[CommandPalette] Failed to load configuration:', error);
        throw new Error('Command Palette configuration could not be loaded');
    }

    // Load commands from external JSON
    try {
        const commands = await fetchJSON(
            'renderer/content/contentComponents/commandPalette/commands.json'
        );

        systemCommands = commands.systemCommands || [];
        markdownCommands = commands.markdownCommands || [];
        markerCommands = commands.markerCommands || [];
    } catch (error) {
        console.warn('[CommandPalette] Failed to load commands.json', error);
    }

    // Create modal instance to get markup
    const modalComponent = new (
        await import('./components/CommandPaletteModal.js')
    ).CommandPaletteModal(config);

    return {
        markups: modalComponent.getMarkup(),

        /**
         * Initialize the command palette DOM and wire up behavior.
         * @param {{noteAPI: NoteAPI, markerAPI: MarkerAPI}} opts
         * @returns {{
         *      show: function(string=): Promise<void>,
         *      hide: function(): Promise<void>,
         *      toggle: function(string=): Promise<void>,
         *      showMarkdownCommands: function(): Promise<void>,
         *      destroy: function(): void
         * }}
         */
        init({ noteAPI, markerAPI }) {
            // Create controller
            const controller = new CommandPaletteController(
                config,
                systemCommands,
                markdownCommands,
                markerCommands,
                { noteAPI, markerAPI }
            );

            // Initialize controller
            controller.init();

            // Return public API
            return {
                show: (mode) => controller.show(mode),
                hide: () => controller.hide(),
                toggle: (mode) => controller.toggle(mode),
                showMarkdownCommands: () => controller.showMarkdownCommands(),
                destroy: () => controller.destroy()
            };
        }
    };
};