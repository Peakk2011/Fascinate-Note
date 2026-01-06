/**
 * Handle Enter key in Code Block
 * @param {KeyboardEvent} e - Keyboard event
 * @param {HTMLElement} editor - Editor element
 * @param {Node} node - Current node
 * @param {Selection} selection - Window selection
 * @returns {boolean|undefined} True if handled, undefined if not in code block
 */
export const handleEnterInCodeBlock = (e, editor, node, selection) => {
    // Find the current cursor inside of <code> or <pre> element
    let codeNode = node;

    while (codeNode && codeNode !== editor) {
        if (codeNode.tagName === 'CODE' &&
            codeNode.parentElement?.tagName === 'PRE'
        ) {
            break;
        }

        codeNode = codeNode.parentElement;
    }

    if (!codeNode || codeNode.tagName !== 'CODE') {
        return undefined; // That is not code block
    }

    e.preventDefault(); // We will handle all cases for the code block here.

    const sel = selection;
    const range = sel.getRangeAt(0);
    const pos = range.startOffset;
    const text = codeNode.textContent;

    // Get text before cursor to determine current line's indentation
    const textBeforeCursor = text.slice(0, pos);
    const linesBeforeCursor = textBeforeCursor.split('\n');
    const currentLineContent = linesBeforeCursor[linesBeforeCursor.length - 1];
    const indentMatch = currentLineContent.match(/^\s*/);
    const indent = indentMatch ? indentMatch[0] : '';
    
    // Insert a new line with the same indentation
    const before = text.slice(0, pos);
    const after = text.slice(pos);

    codeNode.textContent = before + '\n' + indent + after;

    // Set the new cursor position
    const newPos = pos + 1 + indent.length;
    const newRange = document.createRange();

    // The text node might not exist if the block was empty, but setting textContent creates it.
    // Ensure the new position is not out of bounds.
    const textNode = codeNode.firstChild || codeNode;
    const newOffset = Math.min(newPos, textNode.textContent.length);
    
    newRange.setStart(textNode, newOffset);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    return true; // We've handled the event
};