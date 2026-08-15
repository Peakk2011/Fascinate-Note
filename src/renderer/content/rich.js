import { createPlaceholder } from '@editor/placeholder.js';
import { handleMarkdown } from '@editor/markdown.js';
import { handlePaste, insertImagesFromFiles } from '@editor/handlePaste.js';
import { initImageInteractions } from '@editor/features/images/imageInteractions.js';
import { initRendering } from '@editor/rendering.js';
import { sanitizeInlineArtifacts } from '@editor/sanitizeInlineArtifacts.js';
import { exportHTML, downloadHTML, downloadTXT, downloadImage } from '@editor/download.js';
// import { handleKeydown } from '../scripts/editor/keymap.js';

/**
 * Component to manage rich editor with Markdown support and HTML export
 * @param {Object} options                      - Configuration options
 * @param {string} options.editorId             - ID of contentEditable element
 * @param {string} [options.placeholderText]    - Placeholder text when empty
 * @param {Object} [options.formatButtons]      - Format button IDs: {bold, italic}
 * @returns {{
 *      cleanup: Function,
 *      updatePlaceholder: Function,
 *      editor: HTMLElement,
 *      placeholder: HTMLElement,
 *      exportHTML: Function,
 *      downloadHTML: Function,
 *      downloadTXT: Function,
 *      downloadImage: Function
 * }|null}
 */

export const initRichEditor = ({ editorId, placeholderText, formatButtons = {} } = {}) => {
    const editor = document.getElementById(editorId);
    if (!editor) {
        return null;
    }

    // Create placeholder
    const placeholderManager = createPlaceholder(
        editor,
        placeholderText
    );

    const {
        element: placeholder,
        updateVisibility,
        syncFontSize
    } = placeholderManager;

    // Markdown handler wrapper
    const markdownHandler = (e) => {
        handleMarkdown(e, editor);
    }

    // Paste handler wrapper
    const pasteHandler = (e) => {
        handlePaste(e, editor);
    }

    /**
     * @feature Auto-closing brackets (Fascinate Notes 1.3.0)
     * @description Bracket and quote pair auto-completion
     */
    const PAIR_MAP = {
        '(': ')',
        '[': ']',
        '{': '}',
        '"': '"',
        "'": "'",
        '`': '`'
    };

    const pairKeydownHandler = (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) {
            return;
        }

        const open = e.key;
        const close = PAIR_MAP[open];
        if (!close) {
            return;
        }

        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        e.preventDefault();

        // If there is a selection, wrap it with the pair
        if (!range.collapsed) {
            const contents = range.extractContents();
            const frag = document.createDocumentFragment();
            frag.appendChild(document.createTextNode(open));
            frag.appendChild(contents);
            frag.appendChild(document.createTextNode(close));
            range.insertNode(frag);

            // Re-select the previously selected content (now between the pair)
            sel.removeAllRanges();
            const newRange = document.createRange();
            // Find the node after the opening text node we just inserted
            let startNode = range.startContainer;
            let startOffset = range.startOffset;
            // Try to place caret/select inside the middle content
            // Walk to find the text node we inserted as the content's first child
            try {
                const parent = range.startContainer;
                if (parent && parent.childNodes && parent.childNodes.length) {
                    // locate the opening text node index
                    for (let i = 0; i < parent.childNodes.length; i++) {
                        const node = parent.childNodes[i];
                        if (node.nodeType === Node.TEXT_NODE && node.nodeValue === open) {
                            // content should be next node(s)
                            const contentNode = parent.childNodes[i + 1] || node.nextSibling;
                            if (contentNode) {
                                newRange.selectNodeContents(contentNode);
                                sel.addRange(newRange);
                                return;
                            }
                        }
                    }
                }
            } catch (err) {
                // Fallback: place caret between the pair
            }

            // Fallback: place caret between the pair
            const textNode = document.createTextNode(open + close);
            range.insertNode(textNode);
            sel.removeAllRanges();
            const caretRange = document.createRange();
            caretRange.setStart(textNode, open.length);
            caretRange.collapse(true);
            sel.addRange(caretRange);
            return;
        }

        // Collapsed selection: insert open+close and place caret between
        const textNode = document.createTextNode(open + close);
        range.insertNode(textNode);
        // Move caret between the pair
        sel.removeAllRanges();
        const caretRange = document.createRange();
        caretRange.setStart(textNode, open.length);
        caretRange.collapse(true);
        sel.addRange(caretRange);
    };

    // Drag & drop image handler
    const dragOverHandler = (e) => {
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
            e.preventDefault();
        }
    };

    const dropHandler = (e) => {
        if (!e.dataTransfer) return;
        const files = Array.from(e.dataTransfer.files || []);
        const imageFiles = files.filter(file => file.type && file.type.startsWith('image/'));
        if (imageFiles.length === 0) return;
        e.preventDefault();
        const range = document.caretRangeFromPoint
            ? document.caretRangeFromPoint(e.clientX, e.clientY)
            : null;
        if (range) {
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        }
        insertImagesFromFiles(imageFiles, editor);
    };

    const imageInteractions = initImageInteractions({ editor, selectionMenuId: 'selection-menu' });

    // Inline sanitization (strip unwanted font/span wrappers)
    let sanitizeRaf = 0;
    const scheduleInlineSanitize = () => {
        if (sanitizeRaf) return;
        sanitizeRaf = requestAnimationFrame(() => {
            sanitizeRaf = 0;
            sanitizeInlineArtifacts(editor);
        });
    };

    // Handle zoom events
    let wheelTimeout = null;
    const wheelHandler = (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (wheelTimeout) clearTimeout(wheelTimeout);
            wheelTimeout = setTimeout(() => {
                syncFontSize();
            }, 50);
        }
    };

    // Attach event listeners
    editor.addEventListener('wheel', wheelHandler, { passive: true });
    editor.addEventListener('keydown', pairKeydownHandler);
    editor.addEventListener('keydown', markdownHandler);
    editor.addEventListener('paste', pasteHandler);
    editor.addEventListener('dragover', dragOverHandler);
    editor.addEventListener('drop', dropHandler);

    const rendering = initRendering(editor);

    const setPerformanceMode = rendering?.setPerformanceMode
        ? (enabled) => rendering.setPerformanceMode(enabled)
        : () => { };

    const getPerformanceMode = rendering?.getPerformanceMode
        ? () => rendering.getPerformanceMode()
        : () => false;

    editor.addEventListener('input', updateVisibility);
    editor.addEventListener('input', scheduleInlineSanitize);
    editor.addEventListener('paste', scheduleInlineSanitize);
    editor.addEventListener('focus', updateVisibility);
    editor.addEventListener('blur', updateVisibility);

    // Listen for font-size changes
    let fontObserver = null;

    const initFontObserver = () => {
        if (!fontObserver) {
            fontObserver = new MutationObserver(syncFontSize);
            fontObserver.observe(editor, {
                attributes: true,
                attributeFilter: ['style']
            });
        }
    };

    // Setup format buttons
    const boundFormatButtons = [];

    if (formatButtons.bold) {
        const el = document.getElementById(formatButtons.bold);
        if (el) {
            const fn = () => document.execCommand('bold', false, null);
            el.addEventListener('click', fn);
            boundFormatButtons.push({ el, fn });
        }
    }

    if (formatButtons.italic) {
        const el = document.getElementById(formatButtons.italic);
        if (el) {
            const fn = () => document.execCommand('italic', false, null);
            el.addEventListener('click', fn);
            boundFormatButtons.push({ el, fn });
        }
    }

    // Initialize
    updateVisibility();
    requestAnimationFrame(() => {
        syncFontSize();
        initFontObserver();
    });

    // Return public API
    return {
        cleanup() {
            if (fontObserver) {
                fontObserver.disconnect();
            }

            editor.removeEventListener('wheel', wheelHandler);
                editor.removeEventListener('keydown', pairKeydownHandler);
                editor.removeEventListener('keydown', markdownHandler);
            editor.removeEventListener('paste', pasteHandler);
            editor.removeEventListener('dragover', dragOverHandler);
            editor.removeEventListener('drop', dropHandler);
            if (imageInteractions?.cleanup) {
                imageInteractions.cleanup();
            }

            if (rendering && typeof rendering.destroy === 'function') {
                rendering.destroy();
            }

            editor.removeEventListener('input', updateVisibility);
            editor.removeEventListener('input', scheduleInlineSanitize);
            editor.removeEventListener('paste', scheduleInlineSanitize);

            if (sanitizeRaf) {
                cancelAnimationFrame(sanitizeRaf);
                sanitizeRaf = 0;
            }

            editor.removeEventListener('focus', updateVisibility);
            editor.removeEventListener('blur', updateVisibility);

            boundFormatButtons.forEach(({ el, fn }) => {
                el.removeEventListener('click', fn);
            });

            if (placeholder.parentElement) {
                placeholder.parentElement.removeChild(placeholder);
            }
        },

        updatePlaceholder: () => {
            updateVisibility();
            syncFontSize();
        },

        exportHTML: (includeStyles = true) => exportHTML(editor, includeStyles),
        downloadHTML: (filename = 'document.html') => downloadHTML(editor, filename),
        downloadTXT: (filename = 'document.txt') => downloadTXT(editor, filename),
        downloadImage: (filename = 'document.png') => downloadImage(editor, filename),

        editor,
        placeholder,
        setPerformanceMode,
        getPerformanceMode,
    };
};