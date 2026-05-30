// Marker Window Context Menu Implementation
import { Mint } from '@mintkit';
import menuConfig from './contextMenuConfig.json';
import Mucous from '../../../api/mucous.js';
Mint.include('stylesheet/style-components/context-menu.css');

let menuElement = null;
let config = null;
let currentWindowId = null;
let handleOutsidePointerDown = null;
let mucousInstance = null;

/**
 * Renders the menu structure from the config.
 * @returns {string} The HTML string for the menu.
 */
const renderMenu = (menuConfig) => {
    const itemsHtml = menuConfig.items.map(item => {
        if (item.type === 'separator') {
            return '<div class="context-menu-separator"></div>';
        }
        return `
            <div class="context-menu-item" id="${item.id}" data-command="${item.command}">
                <span>${item.label}</span>
            </div>
        `;
    }).join('');

    return `<div id="${menuConfig.menuId}" class="context-menu">${itemsHtml}</div>`;
}

/**
 * Shows the context menu at the specified coordinates.
 * @param {object} options
 * @param {MouseEvent} options.event - The original contextmenu event.
 * @param {string} options.windowId - The ID of the window the menu is for.
 */
export const showContextMenu = ({ event, windowId, isPinned = false }) => {
    if (!menuElement) return;

    event.preventDefault();
    event.stopPropagation();

    currentWindowId = windowId;

    const { clientX, clientY } = event;
    menuElement.style.display = 'block';
    const menuRect = menuElement.getBoundingClientRect();
    const menuWidth = menuRect.width;
    const menuHeight = menuRect.height;
    const { innerWidth, innerHeight } = window;

    let x = clientX;
    let y = clientY;

    if (x + menuWidth > innerWidth) {
        x = innerWidth - menuWidth;
    }
    if (y + menuHeight > innerHeight) {
        y = innerHeight - menuHeight;
    }

    const pinLabel = menuElement.querySelector('[data-command="pin-window"] span');

    if (pinLabel) {
        pinLabel.textContent = isPinned ? 'Unpin' : 'Pin Window';
    }

    menuElement.style.left = `${x}px`;
    menuElement.style.top = `${y}px`;
    
    requestAnimationFrame(() => {
        menuElement?.classList.add('visible');
    });

    if (handleOutsidePointerDown) {
        document.removeEventListener('pointerdown', handleOutsidePointerDown);
    }

    handleOutsidePointerDown = (e) => {
        if (!menuElement) return;
        if (menuElement.contains(e.target)) return;
    
        hideContextMenu();
    };

    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
}

/**
 * Hides the context menu.
 */
export const hideContextMenu = () => {
    if (menuElement) {
        menuElement.classList.remove('visible');

        const handleTransitionEnd = () => {
            if (!menuElement.classList.contains('visible')) {
                menuElement.style.display = 'none';
            }
    
            menuElement.removeEventListener('transitionend', handleTransitionEnd);
        };

        menuElement.addEventListener('transitionend', handleTransitionEnd);
    }
    currentWindowId = null;
    
    if (handleOutsidePointerDown) {
        document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
        handleOutsidePointerDown = null;
    }
}

/**
 * Creates and initializes the context menu.
 * @param {object} options
 * @param {function(string, string):void} options.onItemClick
 * @returns {void}
 */
export const createMarkerContextMenu = ({ onItemClick }) => {
    if (menuElement) return; // Already initialized

    config = menuConfig;
    const menuHtml = renderMenu(config);
    
    document.body.insertAdjacentHTML('beforeend', menuHtml);
    menuElement = document.getElementById(config.menuId);

    if (menuElement) {
        // Attach Mucous hover highlight
        mucousInstance = Mucous(menuElement, {
            speed: 80,
            itemSelector: ':scope > .context-menu-item:not([data-disabled="true"]):not(.disabled)',
        });

        // Reset overflow so nothing gets clipped
        menuElement.style.overflow = '';

        menuElement.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });
    
        menuElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    
        menuElement.addEventListener('click', (e) => {
            const item = e.target.closest('.context-menu-item');
            if (item && item.dataset.command && currentWindowId) {
                onItemClick(item.dataset.command, currentWindowId);
                hideContextMenu();
            }
        });
    }
}

/**
 * Destroys the context menu and cleans up all resources.
 */
export const destroyMarkerContextMenu = () => {
    mucousInstance?.destroy();
    mucousInstance = null;

    if (handleOutsidePointerDown) {
        document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
        handleOutsidePointerDown = null;
    }

    menuElement?.remove();
    menuElement = null;
    config = null;
    currentWindowId = null;
}