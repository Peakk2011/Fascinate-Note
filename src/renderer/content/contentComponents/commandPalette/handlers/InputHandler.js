/**
 * Filter node and switch mode handler
 */
export class InputHandler {
    /**
     * @param {Array} systemCommands
     * @param {Array} markdownCommands
     * @param {Array} markerCommands
     */
    constructor(systemCommands, markdownCommands, markerCommands) {
        this.systemCommands = systemCommands;
        this.markdownCommands = markdownCommands;
        this.markerCommands = markerCommands;
    }

    /**
     * Filter system commands via search value
     * @param {string} value
     * @returns {Array}
     */
    filterSystemCommands(value) {
        return this.systemCommands.filter(c =>
            c.label.toLowerCase().includes(value.toLowerCase())
        );
    }

    /**
     * Filter markdown commands via search value
     * @param {string} value
     * @returns {Array}
     */
    filterMarkdownCommands(value) {
        return this.markdownCommands.filter(c =>
            c.syntax.toLowerCase().includes(value.toLowerCase()) ||
            c.description.toLowerCase().includes(value.toLowerCase())
        );
    }

    /**
     * Filter marker commands via search value
     * @param {string} value
     * @returns {Array}
     */
    filterMarkerCommands(value) {
        return this.markerCommands.filter(c =>
            c.label.toLowerCase().includes(value.toLowerCase())
        );
    }

    /**
     * Get all system commands
     * @returns {Array}
     */
    getAllSystemCommands() {
        return this.systemCommands;
    }

    /**
     * Get all markdown commands
     * @returns {Array}
     */
    getAllMarkdownCommands() {
        return this.markdownCommands;
    }

    /**
     * Get all marker commands
     * @returns {Array}
     */
    getAllMarkerCommands() {
        return this.markerCommands;
    }
}