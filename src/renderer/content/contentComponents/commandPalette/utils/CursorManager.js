/**
 * @typedef {Object} SavedCursor
 * @property {Node} startContainer
 * @property {number} startOffset
 * @property {boolean} collapsed
 */

/**
 * Utility for saving and restoring cursor positions in contenteditable elements
 */
export class CursorManager {
    /**
     * Capture current selection position
     * @returns {SavedCursor|null}
     */
    static save() {
        try {
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return null;
            
            const range = sel.getRangeAt(0).cloneRange();
            
            return {
                startContainer: range.startContainer,
                startOffset: range.startOffset,
                collapsed: range.collapsed
            };
        } catch (err) {
            console.warn('[CursorManager] save failed', err);
            return null;
        }
    }

    /**
     * Restore previously saved cursor position
     * @param {SavedCursor|null} saved
     * @param {HTMLElement} [editor] - fallback editor element
     * @returns {void}
     */
    static restore(saved, editor = null) {
        try {
            const editorEl = editor || window.rich?.editor || document.querySelector('[contenteditable]');
            if (!saved || !editorEl) return;

            const { startContainer, startOffset } = saved;
            let node = startContainer;

            // Check if node is detached
            const isDetached = 
                !node || 
                (node.nodeType && node.nodeType === Node.ELEMENT_NODE && !node.isConnected) || 
                (node.nodeType === Node.TEXT_NODE && !node.parentNode);

            if (isDetached) {
                // Fallback: place caret at end of editor
                this.#placeCaretAtEnd(editorEl);
                return;
            }

            // Create range at saved position
            const range = document.createRange();
            if (node.nodeType === Node.TEXT_NODE) {
                const off = Math.min(startOffset, node.textContent.length);
                range.setStart(node, off);
            } else {
                const childIndex = Math.min(startOffset, node.childNodes.length);
                range.setStart(node.childNodes[childIndex] || node, 0);
            }
            
            range.collapse(true);
            
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (err) {
            console.warn('[CursorManager] restore failed', err);
        }
    }

    /**
     * Place caret at end of element
     * @param {HTMLElement} element
     * @private
     */
    static #placeCaretAtEnd(element) {
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let lastText = null;
        while (walker.nextNode()) {
            lastText = walker.currentNode;
        }
        
        const range = document.createRange();
        if (lastText) {
            range.setStart(lastText, lastText.textContent.length);
        } else {
            range.selectNodeContents(element);
            range.collapse(false);
        }
        
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}