import { handleSpaceInBlockquote } from './markdown/handleEnterInBlockquote.js';
import {
    processInlineMarkdown,
    processMarkdownInLine,
    handleCodeBlockExit
} from './markdown/commands.js';
import { noteFeaturesConfig } from '../note/noteConfig.js';
import { setCurrentFontSize } from '../note/state.js';

const LINE_SELECTOR = 'div, p, li, blockquote, pre, h1, h2, h3, h4, h5, h6';

const BLOCK_TAGS = new Set([
    'DIV',
    'P',
    'LI',
    'BLOCKQUOTE',
    'PRE',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
]);

/**
 * Places the caret at the start or end of the given element.
 * @param {HTMLElement} element
 * @param {boolean} atStart
 */
const placeCaretIn = (element, atStart) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(atStart);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
};

/**
 * Appends a fresh empty line and moves the caret into it.
 * @param {HTMLElement} editor
 */
const insertEmptyLine = (editor) => {
    const emptyLine = document.createElement('div');
    emptyLine.innerHTML = '<br>';
    editor.appendChild(emptyLine);
    placeCaretIn(emptyLine, true);
};

const resolveLineElement = (node, editor) => {
    let line = node.closest?.(LINE_SELECTOR);
    if (!line || !editor.contains(line)) return null;

    let parent = line.parentElement;

    while (parent && parent !== editor && editor.contains(parent) && BLOCK_TAGS.has(parent.tagName)) {
        // Stop climbing if the parent groups more than one line together —
        // otherwise we'd end up deleting the whole wrapper instead of one line.
        if (parent.children.length > 1) break;

        line = parent;
        parent = parent.parentElement;
    }

    return line;
};

/**
 * @param {HTMLElement} editor
 */
const deleteCurrentLine = (editor) => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) return;

    let node = range.startContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    if (!node) return;

    let line = resolveLineElement(node, editor);
    if (!line) return;

    if (line === editor) {
        line = editor.firstElementChild;
        if (!line) {
            insertEmptyLine(editor);
            editor.focus();
            return;
        }
    }

    const previousLine = line.previousElementSibling;
    const nextLine = line.nextElementSibling;
    line.remove();

    const target = nextLine ?? previousLine;
    if (target && editor.contains(target)) {
        placeCaretIn(target, Boolean(nextLine));
    } else {
        insertEmptyLine(editor);
    }

    editor.focus();

    editor.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'deleteContentBackward'
    }));
};

/**
 * Handles keyboard shortcuts for the editor.
 * @param {KeyboardEvent} e                         - The keyboard event.
 * @param {HTMLElement} editor                      - The editor element.
 * @param {Object} callbacks                        - Optional callback functions for custom actions
 * @param {Function} callbacks.onSave               - Callback when save is triggered
 * @param {Function} callbacks.onSearch             - Callback when search is triggered
 * @param {Function} callbacks.onReplace            - Callback when replace is triggered
 * @param {Function} callbacks.onUndo               - Callback when undo is triggered
 * @param {Function} callbacks.onRedo               - Callback when redo is triggered
 * @param {Function} callbacks.onNewWindow          - Callback when new window is triggered
 */
export const handleKeydown = (e, editor, callbacks = {}) => {
    // Validate inputs
    if (!e || !(e instanceof KeyboardEvent)) {
        console.warn('[Keymap] Invalid event object');
        return;
    }

    if (!editor || !editor.isContentEditable) {
        console.warn('[Keymap] Invalid or non-editable editor element');
        return;
    }

    // Check for Ctrl on Windows/Linux or Cmd on macOS
    const isModKey = e.ctrlKey || e.metaKey;

    try {
        // Inline markdown formatting (**, *, ~~, `)
        if (!isModKey) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount) {
                const range = selection.getRangeAt(0);
                const beforeCursor = range.startContainer.nodeType === Node.TEXT_NODE
                    ? range.startContainer.textContent.slice(0, range.startOffset)
                    : '';

                const blockElement = range.startContainer.nodeType === Node.TEXT_NODE
                    ? range.startContainer.parentElement?.closest('p, div, li, blockquote, h1, h2, h3, h4')
                    : range.startContainer.closest?.('p, div, li, blockquote, h1, h2, h3, h4');

                if (blockElement && processInlineMarkdown(e, beforeCursor, blockElement, selection)) return;
            }
        }

        // Tab / Shift+Tab for indentation
        if (e.key === 'Tab') {
            const selection = window.getSelection();

            if (!selection || !selection.rangeCount) {
                console.warn('[Keymap] No valid selection for indentation');
                return;
            }

            const range = selection.getRangeAt(0);
            let parentElement = range.startContainer.nodeType === Node.TEXT_NODE
                ? range.startContainer.parentNode
                : range.startContainer;

            let blockquote = null;
            let currentNode = parentElement;
            while (currentNode && currentNode !== editor) {
                if (currentNode.tagName === 'BLOCKQUOTE') {
                    blockquote = currentNode;
                    break;
                }
                currentNode = currentNode.parentNode;
            }

            if (blockquote && !e.shiftKey) {
                e.preventDefault();
                const newDiv = document.createElement('div');
                newDiv.innerHTML = '<br>';
                blockquote.parentNode.insertBefore(newDiv, blockquote.nextSibling);
                range.setStart(newDiv, 0);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
                if (blockquote.textContent.trim() === '') {
                    blockquote.remove();
                }
                return;
            }

            e.preventDefault();

            try {
                if (e.shiftKey) {
                    const success = document.execCommand('outdent');
                    if (!success) {
                        console.warn('[Keymap] Outdent command not supported or failed');
                    }
                } else {
                    const indent = document.createTextNode('\u00A0\u00A0\u00A0\u00A0');
                    range.deleteContents();
                    range.insertNode(indent);
                    range.setStartAfter(indent);
                    range.setEndAfter(indent);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            } catch (error) {
                console.error('[Keymap] Indent/Outdent operation failed:', {
                    operation: e.shiftKey ? 'outdent' : 'indent',
                    error: error.message
                });

                try {
                    const range = selection.getRangeAt(0);
                    selection.removeAllRanges();
                    selection.addRange(range);
                } catch (restoreError) {
                    console.error('[Keymap] Failed to restore selection:', restoreError.message);
                }
            }
            return;
        }

        // Handle space in blockquote
        if (e.key === ' ') { if (handleSpaceInBlockquote(e, editor)) return; }

        // Handle Enter key - code block exit + block-level markdown shortcuts (# - 1. /h1 etc.)
        if (e.key === 'Enter' && !isModKey) {
            const selection = window.getSelection();

            if (selection && selection.rangeCount) {
                const range = selection.getRangeAt(0);
                const currentElement = range.startContainer;

                const beforeCursor = currentElement.nodeType === Node.TEXT_NODE
                    ? currentElement.textContent.slice(0, range.startOffset)
                    : '';

                const blockElement = currentElement.nodeType === Node.TEXT_NODE
                    ? currentElement.parentElement?.closest('p, div, li, blockquote, h1, h2, h3, h4')
                    : currentElement.closest?.('p, div, li, blockquote, h1, h2, h3, h4');

                if (handleCodeBlockExit(e, currentElement, selection)) return;
                if (blockElement && processMarkdownInLine(e, beforeCursor, blockElement, selection)) return;
            }
        }

        if (isModKey) {
            if (e.code === 'Digit1') {
                e.preventDefault();
                setCurrentFontSize(noteFeaturesConfig.defaultFontSize);
                const editor = document.querySelector('.editable-div');
                if (editor) {
                    editor.style.fontSize = `${noteFeaturesConfig.defaultFontSize}px`;
                }
                return;
            }
            // 2. Clipboard operations
            if (e.code === 'KeyC' || e.code === 'KeyX' || e.code === 'KeyV') {
                return;
            }

            // 3. Undo/Redo
            if (e.code === 'KeyZ') {
                e.preventDefault();

                try {
                    if (e.shiftKey) {
                        // Ctrl/Cmd + Shift + Z (Redo)
                        if (callbacks.onRedo && typeof callbacks.onRedo === 'function') {
                            callbacks.onRedo();
                        } else {
                            document.execCommand('redo');
                        }
                    } else {
                        // Ctrl/Cmd + Z (Undo)
                        if (callbacks.onUndo && typeof callbacks.onUndo === 'function') {
                            callbacks.onUndo();
                        } else {
                            document.execCommand('undo');
                        }
                    }
                } catch (error) {
                    console.error('[Keymap] Undo/Redo failed:', error);
                }
                return;
            }

            if (e.code === 'KeyY') {
                // Ctrl/Cmd + Y (Redo) - Windows standard
                e.preventDefault();

                try {
                    if (callbacks.onRedo && typeof callbacks.onRedo === 'function') {
                        callbacks.onRedo();
                    } else {
                        document.execCommand('redo');
                    }
                } catch (error) {
                    console.error('[Keymap] Redo failed:', error);
                }
                return;
            }

            // 4. Select All
            if (e.code === 'KeyA') {
                e.preventDefault();

                try {
                    const range = document.createRange();
                    range.selectNodeContents(editor);

                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                } catch (error) {
                    console.error('[Keymap] Select All failed:', error);
                    document.execCommand('selectAll');
                }
                return;
            }

            // 5. Search
            if (e.code === 'KeyF') {
                e.preventDefault();

                if (callbacks.onSearch && typeof callbacks.onSearch === 'function') {
                    try {
                        callbacks.onSearch();
                    } catch (error) {
                        console.error('[Keymap] Search callback failed:', error);
                    }
                } else {
                    console.warn('[Keymap] Search callback not provided');
                }
                return;
            }

            // 6. Replace
            if (isModKey && e.code === 'KeyH') {
                e.preventDefault();

                if (callbacks.onReplace && typeof callbacks.onReplace === 'function') {
                    try {
                        callbacks.onReplace();
                    } catch (error) {
                        console.error('[Keymap] Replace callback failed:', error);
                    }
                }
                return;
            }

            // 7. Save
            if (isModKey && e.code === 'KeyS') {
                e.preventDefault();

                if (callbacks.onSave && typeof callbacks.onSave === 'function') {
                    try {
                        callbacks.onSave(editor.innerHTML);
                    } catch (error) {
                        console.error('[Keymap] Save callback failed:', error);
                    }
                }
                return;
            }

            // 8. New Window (Ctrl/Cmd + Shift + N)
            if (isModKey && e.shiftKey && e.code === 'KeyN') {
                e.preventDefault();

                if (callbacks.onNewWindow && typeof callbacks.onNewWindow === 'function') {
                    try {
                        callbacks.onNewWindow();
                    } catch (error) {
                        console.error('[Keymap] New window callback failed:', error);
                    }
                }
                return;
            }

            // 8b. Insert Line
            if (e.key === 'Enter') {
                e.preventDefault();

                try {
                    const selection = window.getSelection();
                    if (!selection.rangeCount) return;

                    const range = selection.getRangeAt(0);

                    if (e.shiftKey) {
                        const br = document.createElement('br');
                        range.insertNode(br);
                        range.setStartAfter(br);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                    } else {
                        const currentNode = range.startContainer;

                        const parent = currentNode.nodeType === Node.TEXT_NODE
                            ? currentNode.parentNode
                            : currentNode;

                        let node = parent;
                        while (node && node !== editor && node.nextSibling) {
                            node = node.nextSibling;
                        }

                        const br = document.createElement('br');
                        if (node && node.parentNode) {
                            node.parentNode.insertBefore(br, node.nextSibling);
                            range.setStartAfter(br);
                            range.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        } else {
                            document.execCommand('insertParagraph');
                        }
                    }
                } catch (error) {
                    console.error('[Keymap] Insert line failed:', error);
                }
                return;
            }

            // 9. Delete Line (Ctrl/Cmd + Shift + K)
            if (isModKey && e.shiftKey && e.code === 'KeyK') {
                e.preventDefault();

                try {
                    deleteCurrentLine(editor);
                } catch (error) {
                    console.error('[Keymap] Delete line failed:', error);
                }

                return;
            }

            // 10. Bold (Ctrl/Cmd + B)
            if (e.code === 'KeyB') {
                e.preventDefault();
                try {
                    document.execCommand('bold');
                } catch (error) {
                    console.error('[Keymap] Bold failed:', error);
                }
                return;
            }

            // 11. Italic (Ctrl/Cmd + I)
            if (e.code === 'KeyI') {
                e.preventDefault();
                try {
                    document.execCommand('italic');
                } catch (error) {
                    console.error('[Keymap] Italic failed:', error);
                }
                return;
            }

            // 12. Underline (Ctrl/Cmd + U)
            if (e.code === 'KeyU') {
                e.preventDefault();
                try {
                    document.execCommand('underline');
                } catch (error) {
                    console.error('[Keymap] Underline failed:', error);
                }
                return;
            }
        }
    } catch (error) {
        console.error('[Keymap] Unexpected error:', error);
    }
};

/**
 * Initialize keyboard shortcuts for an editor
 * @param {HTMLElement} editor              - The editor element
 * @param {Object} callbacks                - Callback functions
 * @returns {Function} Cleanup function to remove event listener
 */
export const keyMap = (editor, callbacks = {}) => {
    if (!editor || !editor.isContentEditable) {
        console.error('[Keymap] Cannot initialize: invalid editor');
        return () => { };
    }

    const handler = (e) => handleKeydown(e, editor, callbacks);

    editor.addEventListener('keydown', handler);

    return () => {
        editor.removeEventListener('keydown', handler);
    };
};