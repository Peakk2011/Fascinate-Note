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

    e.preventDefault();

    const sel = selection;
    if (!sel.rangeCount) {
        return true;
    }

    const range = sel.getRangeAt(0);
    const text = codeNode.textContent || '';

    let beforeText = '';
    let afterText = '';

    try {
        const startRange = range.cloneRange();
        startRange.selectNodeContents(codeNode);
        startRange.setEnd(range.startContainer, range.startOffset);
        beforeText = startRange.toString();

        const endRange = range.cloneRange();
        endRange.selectNodeContents(codeNode);
        endRange.setStart(range.endContainer, range.endOffset);
        afterText = endRange.toString();
    } catch (error) {
        beforeText = text;
        afterText = '';
    }

    const beforeLine = (beforeText.split('\n').pop() || '');
    const afterLine = (afterText.split('\n')[0] || '');
    const currentLine = beforeLine + afterLine;
    const currentLineIsEmpty = currentLine.replace(/\u00A0/g, ' ').trim() === '';

    if (currentLineIsEmpty) {
        const preElement = codeNode.parentElement;

        const beforeLines = beforeText.split('\n');
        const afterLines = afterText.split('\n');
        const hasBefore = beforeLines.length > 1;
        const hasAfter = afterLines.length > 1;
        const beforeBase = beforeLines.slice(0, -1).join('\n');
        const afterBase = afterLines.slice(1).join('\n');

        let newText = '';
        if (hasBefore && hasAfter) {
            newText = `${beforeBase}\n${afterBase}`;
        } else if (hasBefore) {
            newText = beforeBase;
        } else if (hasAfter) {
            newText = afterBase;
        }

        const remainingHasContent = newText.replace(/\u00A0/g, ' ').trim() !== '';

        const newP = document.createElement('p');
        newP.innerHTML = '<br>';

        if (!remainingHasContent) {
            preElement.replaceWith(newP);
        } else {
            codeNode.textContent = newText;
            preElement.after(newP);
        }

        const newRange = document.createRange();
        newRange.setStart(newP, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

        return true;
    }

    // Get text before cursor to determine current line's indentation
    const indentMatch = currentLine.match(/^\s*/);
    const indent = indentMatch ? indentMatch[0] : '';

    const newText = `${beforeText}\n${indent}${afterText}`;
    codeNode.textContent = newText;

    // Set the new cursor position
    const newPos = beforeText.length + 1 + indent.length;
    const newRange = document.createRange();

    const textNode = codeNode.firstChild || codeNode;
    const newOffset = Math.min(newPos, textNode.textContent.length);

    newRange.setStart(textNode, newOffset);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);

    return true;
};
