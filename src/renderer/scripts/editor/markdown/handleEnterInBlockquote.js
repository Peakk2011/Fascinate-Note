/**
 * Handle Enter key in blockquote
 * @param {KeyboardEvent} e - Keyboard event
 * @param {HTMLElement} editor - Editor element
 * @param {Node} node - Current node
 * @param {Selection} selection - Window selection
 * @returns {boolean|undefined} True if handled, undefined if not in blockquote
 */
export const handleEnterInBlockquote = (e, editor, node, selection) => {
    // blockquote element
    let blockquote = node;
    while (blockquote && blockquote !== editor) {
        if (blockquote.tagName === 'BLOCKQUOTE') {
            break;
        }
        blockquote = blockquote.parentElement;
    }

    if (!blockquote || blockquote.tagName !== 'BLOCKQUOTE') {
        return undefined; 
    }

    const text = blockquote.textContent.trim();

    if (text === '' || text === '\n') {
        e.preventDefault();

        const newP = document.createElement('p');
        newP.innerHTML = '<br>';

        blockquote.replaceWith(newP);

        // Cursor Position
        const newRange = document.createRange();
        newRange.setStart(newP, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        return true;
    } else {
        e.preventDefault();

        const newBlockquote = document.createElement('blockquote');
        newBlockquote.innerHTML = '<br>';

        blockquote.after(newBlockquote);

        // Cursor Position
        const newRange = document.createRange();
        
        newRange.setStart(newBlockquote, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);

        return true;
    }
};

/**
 * Handle Space key in blockquote to exit the block
 * @param {KeyboardEvent} e - Keyboard event
 * @param {HTMLElement} editor - Editor element
 * @returns {boolean|undefined} True if handled, undefined if not
 */
export const handleSpaceInBlockquote = (e, editor) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) return;

    const container = range.startContainer;
    let parentElement = container.nodeType === Node.TEXT_NODE ? container.parentNode : container;

    let blockquote = null;
    let currentNode = parentElement;
    while (currentNode && currentNode !== editor) {
        if (currentNode.tagName === 'BLOCKQUOTE') {
            blockquote = currentNode;
            break;
        }
        currentNode = currentNode.parentNode;
    }

    if (blockquote) {
        const textNode = container;
        if (textNode.nodeType === Node.TEXT_NODE && range.startOffset >= 2) {
            const textContent = textNode.textContent;
            if (textContent.substring(range.startOffset - 2, range.startOffset) === '  ') {
                const lineSoFar = textContent.substring(0, range.startOffset - 2);
                if (lineSoFar.trim() === '') {
                    e.preventDefault();

                    textNode.textContent = textContent.substring(0, range.startOffset - 2) + textContent.substring(range.startOffset);
                    range.setStart(textNode, range.startOffset - 2);
                    selection.removeAllRanges();
                    selection.addRange(range);

                    const newDiv = document.createElement('div');
                    newDiv.innerHTML = '<br>';

                    if (blockquote.parentNode) {
                        blockquote.parentNode.insertBefore(newDiv, blockquote.nextSibling);
                        const newRange = document.createRange();
                        newRange.setStart(newDiv, 0);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);

                        if (blockquote.textContent.trim() === '') {
                            blockquote.remove();
                        }
                    }
                    return true;
                }
            }
        }
    }
};
