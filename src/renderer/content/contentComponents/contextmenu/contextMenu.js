// Editor ContextMenu Component Implementation
import { Mint } from '@mintkit';
import { fetchJSON } from '@fJson';
import { renderMenu } from './menu/menuRenderer.js';
import { createMenuState, updateMenuState } from './menu/menuState.js';
import { showMenu, hideMenu } from './menu/menuPosition.js';
import { recordState, performUndo, performRedo } from './features/primitiveAction.js';
import { handleMenuItemClick } from './features/menuActions.js';
import { initializeEventListeners } from './features/eventHandlers.js';
import {
    safeGetElementById,
    isValidElement,
    removeAllEventListeners
} from './utils/domUtility.js';
import Mucous from '../../../../api/mucous.js';

Mint.include('stylesheet/style-components/context-menu.css');

/**
 * Creates a custom context menu for contenteditable elements
 * @returns {Promise<Object>} ContextMenu component with markups and init method
 */
export const createContextMenu = async () => {
    let config;

    try {
        config = await fetchJSON(
            'renderer/content/contentComponents/contextmenu/contextMenuConfig.json'
        );
    } catch (error) {
        console.error('[ContextMenu] Failed to load configuration:', error);
        throw new Error('Context menu configuration could not be loaded');
    }

    // Find IDs for undo/redo from config for direct element access
    const undoItemId = config.items.find(i => i.command === 'undo')?.id;
    const redoItemId = config.items.find(i => i.command === 'redo')?.id;

    return {
        markups: renderMenu(config),

        init({ pageConfig, noteAPI }) {
            // Validation
            if (!pageConfig?.textareaId) {
                console.error('[ContextMenu] Invalid pageConfig: missing textareaId');
                return;
            }

            if (!noteAPI) {
                console.error('[ContextMenu] Invalid noteAPI: API not provided');
                return;
            }

            const CONSTANTS = {
                DEBOUNCE_DELAY: 300,
                MAX_HISTORY_SIZE: 50,
                MENU_OFFSET: 5,
            };

            // DOM elements cache
            const elements = {
                textarea: null,
                contextMenu: null,
            };

            // Map cache for menu items (id -> element)
            const menuItemsCache = new Map();

            // State management
            const stateManager = createMenuState(CONSTANTS.MAX_HISTORY_SIZE);

            // Cleanup functions / registered listeners
            const eventListeners = [];

            // Mucous hover highlight instance
            let mucousInstance = null;
            let submenuMucousInstance = null;


            /**
             * Initialize and validate required DOM elements
             * @returns {boolean} Success status
             */
            const initializeElements = () => {
                try {
                    if (!pageConfig?.textareaId) {
                        console.error(
                            '[ContextMenu] initializeElements: missing textareaId in pageConfig'
                        );
                        return false;
                    }

                    elements.textarea = safeGetElementById(pageConfig.textareaId);
                    elements.contextMenu = safeGetElementById(config.menuId);

                    if (!isValidElement(elements.textarea) || !isValidElement(elements.contextMenu)) {
                        console.error(
                            '[ContextMenu] initializeElements: required DOM elements missing'
                        );
                        return false;
                    }

                    // Attach Mucous hover highlight to the context menu
                    mucousInstance = Mucous(elements.contextMenu, {
                        speed: 80,
                        itemSelector: ':scope > .context-menu-item:not([data-disabled="true"]):not(.disabled)',
                    });

                    elements.contextMenu.style.overflow = '';

                    // Submenu
                    const submenu = elements.contextMenu.querySelector('.context-submenu');
                    if (submenu) {
                        submenu.addEventListener('transitionend', () => {
                            if (submenu.classList.contains('visible') && !submenuMucousInstance) {
                                submenuMucousInstance = Mucous(submenu, {
                                    speed: 80,
                                    itemSelector: '.context-menu-item',
                                });
                                submenu.style.overflow = '';
                            }
                        }, { once: false });

                        submenu.addEventListener('mouseleave', () => {
                            submenuMucousInstance?.destroy();
                            submenuMucousInstance = null;
                        });
                    }

                    elements.contextMenu.addEventListener('mouseover', (event) => {
                        const item = event.target.closest('.context-menu-item');
                        if (!item) return;
                        if (item.dataset.disabled === 'true' || item.classList.contains('disabled')) {
                            const highlight = elements.contextMenu.querySelector('.mucous-highlight');
                            if (highlight) highlight.style.opacity = '0';
                            elements.contextMenu
                                .querySelectorAll('.context-menu-item')
                                .forEach(i => i.classList.remove('hovered'));
                        }
                    });

                    // Populate menu items cache
                    for (const item of (config.items || [])) {
                        if (item.id) {
                            const el = safeGetElementById(item.id);
                            if (el) menuItemsCache.set(item.command || item.id, el);
                        }
                    }

                    // Capture initial state of the textarea
                    recordState({
                        content: elements.textarea.innerHTML,
                        stateManager,
                        updateMenuState: updateMenuStateWrapper
                    });

                    return true;
                } catch (error) {
                    console.error('[ContextMenu] initializeElements failed', error);
                    return false;
                }
            };

            // Wrapper functions with bound parameters
            const updateMenuStateWrapper = () => {
                updateMenuState({
                    menuItemsCache,
                    stateManager,
                    undoItemId,
                    redoItemId,
                    safeGetElementById
                });
            };

            const hideMenuWrapper = () => {
                hideMenu({
                    contextMenu: elements.contextMenu,
                    stateManager,
                    config
                });
            };

            const showMenuWrapper = (event) => {
                showMenu({
                    event,
                    contextMenu: elements.contextMenu,
                    stateManager,
                    config,
                    MENU_OFFSET: CONSTANTS.MENU_OFFSET
                });
            };

            const recordStateWrapper = (content) => {
                recordState({
                    content,
                    stateManager,
                    updateMenuState: updateMenuStateWrapper
                });
            };

            const performUndoWrapper = () => {
                performUndo({
                    textarea: elements.textarea,
                    stateManager,
                    updateMenuState: updateMenuStateWrapper
                });
            };

            const performRedoWrapper = () => {
                performRedo({
                    textarea: elements.textarea,
                    stateManager,
                    updateMenuState: updateMenuStateWrapper
                });
            };

            const handleMenuItemClickWrapper = (event) => {
                handleMenuItemClick({
                    event,
                    config,
                    stateManager,
                    textarea: elements.textarea,
                    noteAPI,
                    performUndo: performUndoWrapper,
                    performRedo: performRedoWrapper,
                    recordState: recordStateWrapper,
                    hideMenu: hideMenuWrapper
                });
            };

            /**
             * Destroy the component and remove all listeners
             */
            const destroy = () => {
                if (stateManager.isDestroyed()) return;
                stateManager.setDestroyed(true);

                mucousInstance?.destroy();
                mucousInstance = null;

                submenuMucousInstance?.destroy();
                submenuMucousInstance = null;

                removeAllEventListeners(eventListeners);

                // Clear state stacks
                stateManager.clearStacks();

                // Clear caches and references
                menuItemsCache.clear();
                Object.keys(elements).forEach(key => elements[key] = null);

                console.info('[ContextMenu] Component destroyed');
            };

            // Initialize component
            if (initializeElements()) {
                initializeEventListeners({
                    textarea: elements.textarea,
                    contextMenu: elements.contextMenu,
                    config,
                    stateManager,
                    eventListeners,
                    updateMenuState: updateMenuStateWrapper,
                    showMenu: showMenuWrapper,
                    hideMenu: hideMenuWrapper,
                    handleMenuItemClick: handleMenuItemClickWrapper,
                    recordState: recordStateWrapper,
                    DEBOUNCE_DELAY: CONSTANTS.DEBOUNCE_DELAY
                });
            } else {
                console.error(
                    '[ContextMenu] Initialization failed - component will not be active'
                );
            }

            return { destroy };
        }
    };
};