/**
 * global event listeners manager (escape, click outside)
 */
export class EventManager {
    constructor() {
        this.listeners = [];
    }

    /**
     * Register click outside to close
     * @param {HTMLElement} modal
     * @param {Function} onClose
     * @returns {void}
     */
    registerClickOutside(modal, onClose) {
        const handler = (e) => {
            if (e.target === modal) {
                onClose();
            }
        };
        
        modal.addEventListener('click', handler);
        this.listeners.push({ element: modal, type: 'click', handler });
    }

    /**
     * Register escape key to close
     * @param {Function} onClose
     * @param {Function} isVisible
     * @returns {void}
     */
    registerEscapeKey(onClose, isVisible) {
        const handler = (e) => {
            if (e.key === 'Escape' && isVisible()) {
                onClose();
            }
        };
        
        document.addEventListener('keydown', handler);
        this.listeners.push({ element: document, type: 'keydown', handler });
    }

    /**
     * Clean up all listeners
     * @returns {void}
     */
    destroy() {
        this.listeners.forEach(({ element, type, handler }) => {
            element.removeEventListener(type, handler);
        });
        this.listeners = [];
    }
}