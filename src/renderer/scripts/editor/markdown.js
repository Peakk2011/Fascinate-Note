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

    let beforeCursor = getTextBeforeCursor(
        node,
        cursorPos,
        blockElement
    );

    beforeCursor = beforeCursor.replace(/\u00A0/g, ' ');

    return processMarkdownInLine(
        e,
        beforeCursor,
        blockElement,
        selection,
        false
    );
};