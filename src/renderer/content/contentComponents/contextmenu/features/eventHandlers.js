import { debounce, addEventListener } from '../utils/domUtility.js';

/**
 * @typedef {Object} TouchContextMenuConfig
 * @property {number} longPressDelayMs
 * @property {number} cancelMoveThresholdPx
 */

/**
 * @typedef {Object} ContextMenuConfig
 * @property {string} menuId
 * @property {string} itemClass
 * @property {string} submenuClass
 * @property {{ longPress?: TouchContextMenuConfig }} [contextMenu]
 */

/**
 * @typedef {Object} InitializeParams
 * @property {HTMLElement} textarea
 * @property {HTMLElement} contextMenu
 * @property {ContextMenuConfig} config
 * @property {{ isDestroyed: () => boolean }} stateManager
 * @property {Array<Function>} eventListeners
 * @property {() => void} updateMenuState
 * @property {(event: { clientX: number, clientY: number, preventDefault: () => void }) => void} showMenu
 * @property {() => void} hideMenu
 * @property {(event: { target: HTMLElement, preventDefault: () => void }) => void} handleMenuItemClick
 * @property {(content: string) => void} recordState
 * @property {number} [DEBOUNCE_DELAY]
 */

/**
 * @type {TouchContextMenuConfig}
 */
const DEFAULT_TOUCH_CONTEXT_MENU_CONFIG = {
    longPressDelayMs: 500,
    cancelMoveThresholdPx: 10
};

/**
 * Setup hover and focus behavior for submenus inside a context menu.
 * Handles delayed show/hide and ARIA state synchronization.
 *
 * @param {Object} params
 * @param {HTMLElement} params.contextMenu
 * @param {ContextMenuConfig} params.config
 * @param {Array<Function>} params.eventListeners
 * @returns {void}
 */
const setupSubmenuInteractions = ({ contextMenu, config, eventListeners }) => {
    const triggers = contextMenu.querySelectorAll('[aria-haspopup="true"]');

    triggers.forEach(trigger => {
        const submenu = trigger.querySelector(`.${config.submenuClass}`);
        if (!submenu) return;

        let showTimer = null;
        let hideTimer = null;
        let pointerInTrigger = false;
        let pointerInSubmenu = false;

        const show = () => {
            if (trigger.getAttribute('aria-disabled') === 'true') return;

            clearTimeout(hideTimer);
            showTimer = setTimeout(() => {
                submenu.style.display = 'block';
                requestAnimationFrame(() => {
                    submenu.classList.add('visible');
                    trigger.setAttribute('aria-expanded', 'true');
                });
            }, 150);
        };

        const hide = () => {
            clearTimeout(showTimer);
            hideTimer = setTimeout(() => {
                if (!pointerInTrigger && !pointerInSubmenu) {
                    submenu.classList.remove('visible');
                    trigger.setAttribute('aria-expanded', 'false');

                    setTimeout(() => {
                        if (!pointerInTrigger && !pointerInSubmenu) {
                            submenu.style.display = 'none';
                        }
                    }, 200);
                }
            }, 100);
        };

        addEventListener(eventListeners, trigger, 'mouseenter', () => {
            pointerInTrigger = true;
            show();
        });

        addEventListener(eventListeners, trigger, 'mouseleave', () => {
            pointerInTrigger = false;
            hide();
        });

        addEventListener(eventListeners, submenu, 'mouseenter', () => {
            pointerInSubmenu = true;
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        });

        addEventListener(eventListeners, submenu, 'mouseleave', () => {
            pointerInSubmenu = false;
            hide();
        });
    });
};

/**
 * Initialize all editor-related event listeners including
 * touch-based context menu behavior and keyboard/mouse interactions.
 *
 * @param {InitializeParams} params
 * @returns {void}
 */
export const initializeEventListeners = (params) => {
    const {
        textarea,
        contextMenu,
        config,
        stateManager,
        eventListeners,
        updateMenuState,
        showMenu,
        hideMenu,
        handleMenuItemClick,
        recordState,
        DEBOUNCE_DELAY = 300
    } = params;

    if (!textarea || !contextMenu || stateManager.isDestroyed()) return;

    addEventListener(eventListeners, textarea, 'contextmenu', (e) => {
        e.preventDefault();
        updateMenuState();
        showMenu(e);
    });

    const isElectron =
        typeof window !== 'undefined' &&
        typeof window.electronAPI !== 'undefined';

    const supportsTouch =
        'ontouchstart' in window ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);

    const {
        longPressDelayMs,
        cancelMoveThresholdPx
    } = config.contextMenu?.longPress ?? DEFAULT_TOUCH_CONTEXT_MENU_CONFIG;

    if (!isElectron && supportsTouch) {
        let longPressTimer = null;
        let initialTouch = null;
        let menuActive = false;
        let hoveredItem = null;

        const cancelPendingPress = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            initialTouch = null;
        };

        const onTouchStart = (event) => {
            const touch = event.touches?.[0];
            if (!touch) return;

            initialTouch = touch;

            longPressTimer = setTimeout(() => {
                event.preventDefault();

                menuActive = true;
                hoveredItem = null;

                updateMenuState();
                showMenu({
                    clientX: initialTouch.clientX,
                    clientY: initialTouch.clientY,
                    preventDefault: () => { }
                });
            }, longPressDelayMs);
        };

        const onTouchMove = (event) => {
            const touch = event.touches?.[0];
            if (!touch) return;

            if (!menuActive && initialTouch) {
                const dx = Math.abs(touch.clientX - initialTouch.clientX);
                const dy = Math.abs(touch.clientY - initialTouch.clientY);

                if (dx > cancelMoveThresholdPx || dy > cancelMoveThresholdPx) {
                    cancelPendingPress();
                }
                return;
            }

            if (!menuActive) return;

            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const item = target?.closest(`.${config.itemClass}`);

            contextMenu.querySelectorAll('.touch-hover')
                .forEach(el => el.classList.remove('touch-hover'));

            if (item && item.getAttribute('aria-disabled') !== 'true') {
                item.classList.add('touch-hover');
                hoveredItem = item;
            } else {
                hoveredItem = null;
            }

            event.preventDefault();
        };

        const onTouchEnd = () => {
            if (menuActive) {
                if (hoveredItem) {
                    handleMenuItemClick({
                        target: hoveredItem,
                        preventDefault: () => { }
                    });
                } else {
                    hideMenu();
                }
            }

            menuActive = false;
            hoveredItem = null;
            cancelPendingPress();
        };

        addEventListener(
            eventListeners,
            textarea,
            'touchstart',
            onTouchStart,
            {
                passive: false
            }
        );
        
        addEventListener(
            eventListeners,
            textarea,
            'touchmove',
            onTouchMove,
            {
                passive: false
            }
        );
        
        addEventListener(
            eventListeners,
            textarea,
            'touchend',
            onTouchEnd
        );
        
        addEventListener(
            eventListeners,
            textarea,
            'touchcancel',
            onTouchEnd
        );
    }

    const debouncedRecord = debounce(() => {
        recordState(textarea.innerHTML);
    }, DEBOUNCE_DELAY);

    addEventListener(
        eventListeners,
        textarea,
        'input',
        debouncedRecord
    );
    
    addEventListener(
        eventListeners,
        contextMenu,
        'click',
        handleMenuItemClick
    );

    addEventListener(
        eventListeners,
        contextMenu,
        'contextmenu',
        (e) => {
            e.preventDefault();
        }
    );

    addEventListener(
        eventListeners,
        window,
        'resize',
        debounce(hideMenu, 100)
    );

    addEventListener(eventListeners, document, 'keydown', (e) => {
        if (e.key === 'Escape') hideMenu();
    });

    addEventListener(eventListeners, document, 'click', (e) => {
        if (stateManager.isDestroyed()) return;
        if (!e.target.closest?.(`#${config.menuId}`)) hideMenu();
    });

    setupSubmenuInteractions({ contextMenu, config, eventListeners });
};