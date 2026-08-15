/**
 * Manages command palette input behavior and mode detection
 */
export class CommandPaletteInput {
    /**
     * @param {HTMLInputElement} inputElement
     */
    constructor(inputElement) {
        this.input = inputElement;
        this.listeners = new Map();
    }

    /**
     * Get current input value
     * @returns {string}
     */
    getValue() {
        return this.input.value.toLowerCase();
    }

    /**
     * Set input value
     * @param {string} value
     * @returns {void}
     */
    setValue(value) {
        this.input.value = value;
    }

    /**
     * Detect if input suggests markdown mode
     * @returns {boolean}
     */
    isMarkdownMode() {
        const value = this.getValue();
        return value.startsWith('/') || 
               value.startsWith('#') || 
               value === '-' || 
               /^\d+\.$/.test(value);
    }

    /**
     * Register input change listener
     * @param {Function} callback
     * @returns {void}
     */
    onInput(callback) {
        const handler = () => callback(this.getValue(), this.isMarkdownMode());
        this.input.addEventListener('input', handler);
        this.listeners.set('input', handler);
    }

    /**
     * Register keydown listener
     * @param {Function} callback
     * @returns {void}
     */
    onKeyDown(callback) {
        this.input.addEventListener('keydown', callback);
        this.listeners.set('keydown', callback);
    }

    /**
     * Remove all event listeners
     * @returns {void}
     */
    destroy() {
        this.listeners.forEach((handler, event) => {
            this.input.removeEventListener(event, handler);
        });
        this.listeners.clear();
    }
}