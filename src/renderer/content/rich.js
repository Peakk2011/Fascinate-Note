import { createPlaceholder } from '../scripts/editor/placeholder.js';
import { handleMarkdown } from '../scripts/editor/markdown.js';
import { handlePaste } from '../scripts/editor/handlePaste.js';
import { initRendering } from '../scripts/editor/rendering.js';
import { sanitizeInlineArtifacts } from '../scripts/editor/sanitizeInlineArtifacts.js';
import { exportHTML, downloadHTML, downloadTXT, downloadImage } from '../scripts/editor/download.js';

/**
 * Component to manage rich editor with Markdown support and HTML export
 * @param {Object} options - Configuration options
 * @param {string} options.editorId - ID of contentEditable element
 * @param {string} [options.placeholderText] - Placeholder text when empty
 * @param {Object} [options.formatButtons] - Format button IDs: {bold, italic}
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
    editor.addEventListener(
        'wheel',
        wheelHandler,
        {
            passive: true
        }
    );

    editor.addEventListener(
        'keydown',
        markdownHandler
    );

    editor.addEventListener(
        'paste',
        pasteHandler
    );

    const rendering = initRendering(editor);

    const setPerformanceMode = rendering?.setPerformanceMode
        ? (enabled) => rendering.setPerformanceMode(enabled)
        : () => { };

    const getPerformanceMode = rendering?.getPerformanceMode
        ? () => rendering.getPerformanceMode()
        : () => false;

    // Track previous content for history
    let previousContent = editor.innerHTML;
    let lastInputTime = 0;

    editor.addEventListener(
        'input',
        updateVisibility
    );

    // Simple history tracking on input
    const trackInputHandler = (e) => {
        const now = Date.now();
        const currentContent = editor.innerHTML;
        
        // Log content changes for potential undo tracking
        if (currentContent !== previousContent) {
            lastInputTime = now;
        }
        previousContent = currentContent;
    };

    editor.addEventListener(
        'input',
        trackInputHandler
    );

    editor.addEventListener(
        'input',
        scheduleInlineSanitize
    );

    editor.addEventListener(
        'paste',
        scheduleInlineSanitize
    );

    editor.addEventListener(
        'focus',
        updateVisibility
    );

    editor.addEventListener(
        'blur',
        updateVisibility
    );

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
            const fn = () => {
                document.execCommand('bold', false, null);
            }

            el.addEventListener(
                'click',
                fn
            );

            boundFormatButtons.push({ el, fn });
        }
    }

    if (formatButtons.italic) {
        const el = document.getElementById(formatButtons.italic);
        if (el) {
            const fn = () => {
                document.execCommand(
                    'italic',
                    false,
                    null
                );
            }

            el.addEventListener(
                'click',
                fn
            );

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
            editor.removeEventListener(
                'wheel',
                wheelHandler
            );

            editor.removeEventListener(
                'keydown',
                markdownHandler
            );

            editor.removeEventListener(
                'paste',
                pasteHandler
            );

            if (rendering && typeof rendering.destroy === 'function') {
                rendering.destroy();
            }

            editor.removeEventListener(
                'input',
                updateVisibility
            );

            editor.removeEventListener(
                'input',
                trackInputHandler
            );

            editor.removeEventListener(
                'input',
                scheduleInlineSanitize
            );

            editor.removeEventListener(
                'paste',
                scheduleInlineSanitize
            );

            if (sanitizeRaf) {
                cancelAnimationFrame(sanitizeRaf);
                sanitizeRaf = 0;
            }

            editor.removeEventListener(
                'focus',
                updateVisibility
            );

            editor.removeEventListener(
                'blur',
                updateVisibility
            );

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

        exportHTML: (
            includeStyles = true
        ) => exportHTML(
            editor,
            includeStyles
        ),

        downloadHTML: (filename = 'document.html') => {
            downloadHTML(editor, filename);
        },

        downloadTXT: (filename = 'document.txt') => {
            downloadTXT(editor, filename);
        },

        downloadImage: (filename = 'document.png') => {
            downloadImage(editor, filename);
        },

        editor,
        placeholder,
        setPerformanceMode,
        getPerformanceMode,
        
        // History methods
        showHistory() {
            const formatButtons = document.querySelectorAll('[data-history-action]');
            console.log(`History for ${formatButtons.length} format actions logged in keymap`);
        },
        
        getEditorHistory() {
            return {
                type: 'editor',
                content: previousContent,
                lastInputTime: lastInputTime
            };
        }
    };
};
