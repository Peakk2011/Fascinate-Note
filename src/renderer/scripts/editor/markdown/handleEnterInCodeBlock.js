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

    // Determine which line the cursor is on
    const lines = text.split('\n');
    let charCount = 0;
    let currentLineIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        if (pos <= charCount + lines[i].length) {
            currentLineIndex = i;
            break;
        }
        charCount += lines[i].length + 1; // +1 for the newline character
    }

    const currentLine = lines[currentLineIndex];

    // If the current line is empty or just whitespace, we should exit the code block
    if (currentLine !== undefined && currentLine.trim() === '') {
        // Remove the current empty line
        lines.splice(currentLineIndex, 1);
        const newText = lines.join('\n');

        const pre = codeNode.parentElement;
        const newP = document.createElement('p');
        newP.innerHTML = '<br>';

        // If removing the line makes the block empty, replace the block.
        // Otherwise, update the block and add the paragraph after it.
        if (newText.trim() === '') {
            pre.replaceWith(newP);
        } else {
            codeNode.textContent = newText;
            pre.after(newP);
        }

        // Move the cursor to the new paragraph
        const newRange = document.createRange();
        newRange.setStart(newP, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);

    } else {
        // If the line has content, insert a new line with the same indentation

        const indentMatch = currentLine.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';

        const before = text.slice(0, pos);
        const after = text.slice(pos);

        codeNode.textContent = before + '\n' + indent + after;

        // Set the new cursor position
        const newPos = pos + 1 + indent.length;
        const newRange = document.createRange();

        // The text node might not exist if the block was empty, but setting textContent creates it.
        newRange.setStart(codeNode.firstChild || codeNode, newPos);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
    }

    return true; // We've handled the event
};