import { getBlockElement, getTextBeforeCursor } from './nodeElement.js';
import { handleEnterInBlockquote } from './markdown/handleEnterInBlockquote.js';
import { handleEnterInHeading } from './markdown/handleEnterInHeading.js';
import { handleEnterInCodeBlock } from './markdown/handleEnterInCodeBlock.js';
import { processMarkdownInLine } from './markdown/commands.js';

/**
 * Markdown handler - triggers on Space and Enter keys
 * @param {KeyboardEvent} e - Keyboard event
 * @param {HTMLElement} editor - Editor element
 */
export const handleMarkdown = (e, editor) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    let node = range.startContainer;

    // Handle Enter key first
    if (e.key === 'Enter') {
        // Handle Enter in an empty heading

        if (handleEnterInHeading(e, editor)) {
            return;
        }

        // Handle Enter in blockquote
        const handledBlockquote = handleEnterInBlockquote(
            e,
            editor,
            node,
            selection
        );
        if (handledBlockquote !== undefined) return handledBlockquote;

        // Handle Enter in code block
        const handledCodeBlock = handleEnterInCodeBlock(
            e,
            editor,
            node,
            selection
        );
        if (handledCodeBlock !== undefined) return handledCodeBlock;

        // fallback: default Enter
        return;
    }

    // Handle Space / Unicode whitespace
    const keyIsSpace = (typeof e.key === 'string' && /\s/.test(e.key)) ||
        e.code === 'Space' ||
        e.key === 'Spacebar';

    if (!keyIsSpace) {
        return;
    }

    const blockElement = getBlockElement(node, editor);
    if (!blockElement || blockElement === editor) {
        if (editor.children.length === 0 ||
            (editor.children.length === 1 && editor.firstElementChild?.tagName === 'BR')) {

            const text = editor.textContent || '';
            const cursorPos = range.startOffset;
            let beforeCursor = '';

            if (node.nodeType === Node.TEXT_NODE) {
                beforeCursor = node.textContent.substring(0, cursorPos);
            } else {
                beforeCursor = text;
            }

            // Normalize Unicode spaces
            beforeCursor = beforeCursor.replace(/\u00A0/g, ' ');

            return processMarkdownInLine(
                e,
                beforeCursor,
                editor,
                selection,
                true
            );
        }
        return;
    }

    const text = blockElement.textContent || '';
    const cursorPos = range.startOffset;

    let beforeCursor = getTextBeforeCursor({
        node,
        cursorPos,
        blockElement
    });

    beforeCursor = beforeCursor.replace(/\u00A0/g, ' ');

    /*
        Double-space to exit blockquote: if inside a blockquote and the
        user types a space immediately after a previous space (rapidly)
        Use a WeakMap to track the last space timestamp per block element.
    */

    if (!handleMarkdown._lastSpaceMap) handleMarkdown._lastSpaceMap = new WeakMap();
    const lastSpaceMap = handleMarkdown._lastSpaceMap;

    if (blockElement.tagName === 'BLOCKQUOTE') {
        const now = Date.now();
        const last = lastSpaceMap.get(blockElement) || 0;

        if (beforeCursor.endsWith(' ') && (now - last) < 500) {
            e.preventDefault();

            const selection = window.getSelection();
            const range = selection.getRangeAt(0);

            // find last text node inside blockquote
            const walker = document.createTreeWalker(
                blockElement,
                NodeFilter.SHOW_TEXT,
                null
            );

            let lastTextNode = null;
            while (walker.nextNode()) {
                lastTextNode = walker.currentNode;
            }

            if (!lastTextNode ||
                range.endContainer !== lastTextNode ||
                range.endOffset !== lastTextNode.length) {
                lastSpaceMap.set(blockElement, now);
                return;
            }

            // trim trigger space
            lastTextNode.textContent =
                lastTextNode.textContent.replace(/\s$/, '');

            // create inline exit container
            const exitSpan = document.createElement('span');
            exitSpan.setAttribute('data-exit', 'true');
            exitSpan.appendChild(document.createTextNode('\u200B')); // zero width space

            blockElement.parentNode.insertBefore(
                exitSpan,
                blockElement.nextSibling
            );

            // move caret inside span AFTER zero-width char
            const newRange = document.createRange();
            newRange.setStart(exitSpan.firstChild, 1);
            newRange.collapse(true);

            selection.removeAllRanges();
            selection.addRange(newRange);

            lastSpaceMap.delete(blockElement);
            return;
        }

        lastSpaceMap.set(blockElement, now);
    }

    return processMarkdownInLine(
        e,
        beforeCursor,
        blockElement,
        selection,
        false
    );
};
