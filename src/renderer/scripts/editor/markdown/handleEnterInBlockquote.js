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

    e.preventDefault();

    if (!selection.rangeCount) {
        return true;
    }

    const range = selection.getRangeAt(0);
    const text = blockquote.textContent || '';

    let pos = 0;

    try {
        const preRange = range.cloneRange();
    
        preRange.selectNodeContents(blockquote);
        preRange.setEnd(range.startContainer, range.startOffset);
    
        pos = preRange.toString().length;
    } catch (error) {
        pos = 0;
    }

    const lineStart = pos === 0 ? 0 : text.lastIndexOf('\n', pos - 1) + 1;
    const lineEndRaw = text.indexOf('\n', pos);
    const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
    
    const currentLine = text.slice(lineStart, lineEnd);
    const currentLineIsEmpty = currentLine.replace(/\u00A0/g, ' ').trim() === '';

    if (currentLineIsEmpty) {
        let newText = '';

        if (lineEndRaw !== -1) {
            newText = text.slice(0, lineStart) + text.slice(lineEndRaw + 1);
        } else if (lineStart > 0 && text[lineStart - 1] === '\n') {
            newText = text.slice(0, lineStart - 1);
        } else {
            newText = text.slice(0, lineStart);
        }

        const remainingHasContent = newText.replace(/\u00A0/g, ' ').trim() !== '';

        const newP = document.createElement('p');
        newP.innerHTML = '<br>';

        if (!remainingHasContent) {
            blockquote.replaceWith(newP);
        } else {
            blockquote.textContent = newText;
            blockquote.after(newP);
        }

        const newRange = document.createRange();
        newRange.setStart(newP, 0);
        newRange.collapse(true);
    
        selection.removeAllRanges();
        selection.addRange(newRange);

        return true;
    }

    const before = text.slice(0, pos);
    const after = text.slice(pos);

    blockquote.textContent = before + '\n' + after;

    const newPos = pos + 1;
    const newRange = document.createRange();
    const textNode = blockquote.firstChild || blockquote;
    const newOffset = Math.min(newPos, textNode.textContent.length);

    newRange.setStart(textNode, newOffset);
    newRange.collapse(true);
    selection.removeAllRanges();
    selection.addRange(newRange);

    return true;
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
