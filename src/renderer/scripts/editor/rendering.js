/**
 * Text editor rendering module with URL preview cards and math suggestions
 * @module rendering
 */

import { initMathSystem } from './features/math.js';
import { initURLPreviewSystem } from './features/urlPreview.js';

// Utility Functions

/**
 * Sanitizes text by escaping HTML special characters
 * @param {string} str - Text to sanitize
 * @returns {string} Sanitized text
 */
const sanitizeText = (str) => {
    return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

/**
 * Positions a tooltip element at a given range
 * @param {HTMLElement} tooltip - Tooltip element
 * @param {Range} range - Text range to position at
 */
const positionTooltipAtRange = (tooltip, range) => {
    try {
        const rect = range.getBoundingClientRect();
        const viewport = window.visualViewport || {
            width: window.innerWidth,
            height: window.innerHeight,
            offsetLeft: 0,
            offsetTop: 0
        };

        let left = rect.left + rect.width / 2 + (viewport.offsetLeft || 0);
        let top = rect.top + rect.height + (viewport.offsetTop || 0) + 8;

        // Flip tooltip above if it would go off screen
        if (top + tooltip.offsetHeight > viewport.height + (viewport.offsetTop || 0)) {
            top = rect.top - tooltip.offsetHeight - 8 + (viewport.offsetTop || 0);
        }

        tooltip.style.left = `${Math.max(8, left - tooltip.offsetWidth / 2)}px`;
        tooltip.style.top = `${Math.max(8, top)}px`;
    } catch (error) {
        console.error('Error positioning tooltip:', error);
    }
};

// Main Rendering Controller

/**
 * Initializes rendering enhancements for a contenteditable element
 * @param {HTMLElement} editor - The contenteditable element to enhance
 * @returns {{destroy: Function}} Controller object with destroy method
 */
export const initRendering = (editor) => {
    if (!editor) {
        console.warn('initRendering: No editor element provided');
        return { destroy: () => {} };
    }
    
    // Initialize subsystems
    const mathSystem = initMathSystem(editor, positionTooltipAtRange);
    const urlPreviewSystem = initURLPreviewSystem(editor, sanitizeText);

    // Public API

    /**
     * Cleanup function to remove all enhancements
     */
    const destroy = () => {
        // Destroy subsystems
        mathSystem.destroy();
        urlPreviewSystem.destroy();

        console.log('Rendering enhancements destroyed');
    };

    return { destroy };
};

export default initRendering;