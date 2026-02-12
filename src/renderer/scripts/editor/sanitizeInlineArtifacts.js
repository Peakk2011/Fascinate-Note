/**
 * Remove unwanted inline wrapper elements (font/span) inside the editor.
 * This keeps text content while unwrapping the elements.
 *
 * @param {HTMLElement} editor - The editor root element.
 * @param {Selection} [selection] - Optional selection to preserve caret.
 * @returns {boolean} True if cleanup happened.
 */
export const sanitizeInlineArtifacts = (editor, selection = window.getSelection()) => {
    if (!editor) return false;

    if (!editor.querySelector('font, span')) {
        return false;
    }

    const shouldKeepSpan = (span) => {
        if (span.dataset && span.dataset.editorKeep === '1') return true;
        if (span.classList && span.classList.length > 0) return true;
        if (span.getAttribute('contenteditable') !== null) return true;

        return false;
    };

    const targets = [];

    editor.querySelectorAll('font').forEach((el) => targets.push(el));
    
    editor.querySelectorAll('span').forEach((span) => {
        if (!shouldKeepSpan(span)) targets.push(span);
    });

    if (targets.length === 0) {
        return false;
    }

    let caretOffset = null;
    
    if (selection && selection.rangeCount) {
        const range = selection.getRangeAt(0);

        if (editor.contains(range.startContainer)) {
            try {
                const preRange = range.cloneRange();
                preRange.selectNodeContents(editor);
                preRange.setEnd(range.startContainer, range.startOffset);
                caretOffset = preRange.toString().length;
            } catch (error) {
                caretOffset = null;
            }
        }
    }

    const unwrapElement = (el) => {
        const parent = el.parentNode;
        if (!parent) return;

        while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
        }

        parent.removeChild(el);
    };

    targets.forEach(unwrapElement);

    if (selection && selection.rangeCount) {
        const currentAnchor = selection.anchorNode;
        
        if (currentAnchor && currentAnchor.isConnected && editor.contains(currentAnchor)) {
            return true;
        }
    }

    if (caretOffset !== null && selection) {
        const walker = document.createTreeWalker(
            editor,
            NodeFilter.SHOW_TEXT,
            null
        );

        let node = walker.nextNode();
        let remaining = Math.max(0, caretOffset);

        while (node) {
            const len = node.textContent.length;
        
            if (remaining <= len) {
                const newRange = document.createRange();

                newRange.setStart(node, remaining);
                newRange.collapse(true);
                
                selection.removeAllRanges();
                selection.addRange(newRange);
                
                return true;
            }
        
            remaining -= len;
            node = walker.nextNode();
        }

        // Fallback place caret at end
        const endRange = document.createRange();
        endRange.selectNodeContents(editor);
        endRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(endRange);
    }

    return true;
};
