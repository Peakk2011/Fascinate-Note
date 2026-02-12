/**
 * Creates a single command item element
 */
export class CommandItem {
    /**
     * Create system command item
     * @param {Object} command
     * @param {string} command.label
     * @param {string} [command.description]
     * @param {number} index
     * @param {string} itemClass
     * @returns {HTMLElement}
     */
    static createSystemItem(command, index, itemClass) {
        const div = document.createElement('div');
        div.classList.add(itemClass);
        div.dataset.index = String(index);
        
        div.innerHTML = `
            <div class="command-item-main">
                <span class="command-label">${command.label}</span>
                ${command.description ? `<span class="command-description" id='command-description-un-headingable'>${command.description}</span>` : ''}
            </div>
        `;
        
        return div;
    }

    /**
     * Create markdown command item
     * @param {Object} command
     * @param {string} command.syntax
     * @param {string} command.description
     * @param {number} index
     * @param {string} itemClass
     * @returns {HTMLElement}
     */
    static createMarkdownItem(command, index, itemClass) {
        const div = document.createElement('div');
        div.classList.add(itemClass);
        div.dataset.index = String(index);
        
        div.innerHTML = `
            <div class="command-item-main">
                <span class="command-description">${command.description}</span>
                <span class="command-syntax">${command.syntax}</span>
            </div>
        `;
        
        return div;
    }

    /**
     * Create empty state element
     * @returns {HTMLElement}
     */
    static createEmptyState() {
        const div = document.createElement('div');
        div.className = 'command-empty';
        div.textContent = 'No commands found';
        return div;
    }
}