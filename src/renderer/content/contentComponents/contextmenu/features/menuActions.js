import { translate } from '../../../../../api/translate/translator.js';
import wait from '@wait';

/**
 * Handle paste command
 * @param {Object} params - Action parameters
 */
const handlePaste = async ({ textarea }) => {
    try {
        const clipboardItems = await navigator.clipboard.read();
        if (!clipboardItems) {
            console.warn('[ContextMenu] Clipboard is empty or access denied.');
            return;
        }

        // Search for plain text first (because it preserves whitespace best).
        let plainText = '';
        let htmlContent = '';

        for (const item of clipboardItems) {
            for (const type of item.types) {
                if (type === 'text/plain') {
                    const blob = await item.getType(type);
                    plainText = await blob.text();
                } else if (type === 'text/html') {
                    const blob = await item.getType(type);
                    htmlContent = await blob.text();
                }
            }
        }

        // Use plain text if available (because it preserves whitespace).
        const textToPaste = plainText || htmlContent;

        if (!textToPaste) {
            console.warn('[ContextMenu] No text content found on clipboard.');
            return;
        }

        // For contentEditable or rich text
        if (document.queryCommandSupported('insertText')) {
            textarea.focus();
            document.execCommand('insertText', false, textToPaste);
        }
        // For textarea/input elements
        else if (textarea.nodeName === 'TEXTAREA' || textarea.nodeName === 'INPUT') {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            textarea.setRangeText(
                textToPaste,
                start,
                end,
                'end' // selectMode
            );

            // Trigger events
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // For contentEditable div
        else if (textarea.isContentEditable || textarea.contentEditable === 'true') {
            // Insert HTML that keep whitespace
            const htmlWithWhitespace = preserveWhitespaceForContentEditable(textToPaste);

            // Use Selection API
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();

                // Create element that keep whitespace
                const tempDiv = document.createElement('div');
                tempDiv.style.whiteSpace = 'pre-wrap';
                tempDiv.style.fontFamily = 'inherit';
                tempDiv.textContent = textToPaste;

                const fragment = document.createDocumentFragment();
                fragment.appendChild(tempDiv);

                range.insertNode(fragment);
                range.collapse(false); // Move cursor to end

                // Trigger input event
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

    } catch (error) {
        console.warn('[ContextMenu] Clipboard API paste failed. Error:', error);

        try {
            textarea.focus();
            document.execCommand('paste');
        } catch (execError) {
            console.warn('[ContextMenu] execCommand fallback failed', execError);

            // legacy clipboard API
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    textarea.focus();
                    document.execCommand('insertText', false, text);
                }
            } catch (e) {
                console.warn('[ContextMenu] All paste methods failed', e);
            }
        }
    }
};

/**
 * Convert text to HTML that preserves whitespace for contentEditable.
 */
const preserveWhitespaceForContentEditable = (text) => {
    return `<span style="white-space: pre-wrap; font-family: inherit;">${escapeHTML(text)}</span>`;
}

const escapeHTML = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Handle copy or cut command
 * @param {string} command - 'copy' or 'cut'
 * @param {Object} params - Action parameters
 */
const handleCopyOrCut = async ({ command, textarea, recordState }) => {
    try {
        const selection = window.getSelection().toString();

        if (selection) {
            await navigator.clipboard.writeText(selection);
            if (command === 'cut') {
                document.execCommand('delete');
                recordState(textarea.innerHTML);
            }
        }
    } catch (error) {
        // Fall back to execCommand
        try {
            document.execCommand(command);
        } catch (error) {
            console.warn('[ContextMenu] execCommand fallback failed', error);
        }

        if (command === 'cut') {
            recordState(textarea.innerHTML);
        }
    }
};

/**
 * Handle translate command
 * @param {Object} params - Action parameters
 */
const handleTranslate = async ({ target, hideMenu }) => {
    hideMenu();

    const targetMethod = target.dataset.value;
    const translateFunc = translate[targetMethod];

    if (!targetMethod) return;

    if (typeof translateFunc !== 'function') {
        console.error(`[ContextMenu] Invalid translation method: ${targetMethod}`);
        return;
    }

    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const feedbackNode = document.createTextNode('Translating..');
    range.insertNode(feedbackNode);

    try {
        const [translatedText] = await Promise.all([
            translateFunc(selectedText),
            wait(400),
        ]);

        feedbackNode.textContent = translatedText;

        // Move cursor to the end of the translated text
        range.setStartAfter(feedbackNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    } catch (error) {
        console.error(
            `[ContextMenu] Translation failed for ${targetMethod}`,
            error
        );
        feedbackNode.textContent = selectedText;
    }
};

/**
 * Handle search with Google command
 * @param {Object} params - Action parameters
 */
const handleSearchWithGoogle = ({ noteAPI }) => {
    const selection = window.getSelection().toString().trim();

    if (!selection) {
        console.warn('[ContextMenu] No text selected for search');
        return;
    }

    const searchURL = `https://www.google.com/search?q=${encodeURIComponent(selection)}`;

    if (noteAPI && typeof noteAPI.openExternal === 'function') {
        noteAPI.openExternal(searchURL);
    } else {
        console.warn('[ContextMenu] noteAPI.openExternal not available, using window.open');
        window.open(searchURL, '_blank');
    }
};

/**
 * Main menu item click handler
 * @param {Object} params - Handler parameters
 */
export const handleMenuItemClick = async (params) => {
    const {
        event,
        config,
        stateManager,
        textarea,
        noteAPI,
        performUndo,
        performRedo,
        recordState,
        hideMenu
    } = params;

    try {
        if (stateManager.isDestroyed()) return;

        const target = event.target.closest(`.${config.itemClass}`);
        if (!target) return;

        const command = target.dataset.command;
        const isDisabled = target.getAttribute('aria-disabled') === 'true';

        if (!command || isDisabled) {
            hideMenu();
            return;
        }

        // Route to appropriate handler
        switch (command) {
            case 'paste':
                await handlePaste({ textarea, recordState });
                break;

            case 'undo':
                performUndo();
                break;

            case 'redo':
                performRedo();
                break;

            case 'copy':
            case 'cut':
                await handleCopyOrCut({ command, textarea, recordState });
                break;

            case 'translate':
                if (!target.dataset.value) {
                    const submenu = target.querySelector('.context-submenu');
                    if (submenu) submenu.classList.toggle('visible');
                    return;
                }

                await handleTranslate({ target, hideMenu });
                break;

            case 'searchWithGoogle':
                handleSearchWithGoogle({ noteAPI });
                break;

            case 'showCommandPalette':
                if (noteAPI && typeof noteAPI.showCommandPalette === 'function') {
                    noteAPI.showCommandPalette();
                } else {
                    console.warn('[ContextMenu] noteAPI.showCommandPalette not available');
                }
                break;

            case 'selectAll':
                document.execCommand('selectAll');
                break;

            case 'openAboutFN':
                // call electronAPI.openAboutWindow
                if (window.electronAPI && typeof window.electronAPI.openAboutWindow === 'function') {
                    try {
                        await window.electronAPI.openAboutWindow();
                    } catch (error) {
                        console.error('[ContextMenu] Failed to open about window:', error);
                    }
                } else {
                    console.warn('[ContextMenu] electronAPI.openAboutWindow not available');
                    // fallback
                    alert('About window coming soon!');
                }
                break;

            default:
                try {
                    document.execCommand(command);
                } catch (error) {
                    console.warn('[ContextMenu] execCommand failed', error);
                }
                if (command === 'cut') {
                    recordState(textarea.innerHTML);
                }
                break;
        }
    } catch (error) {
        console.error('[ContextMenu] handleMenuItemClick failed', error);
    } finally {
        // Don't hide menu if translate submenu was clicked
        if (event.target.closest('[data-command="translate"]') === null &&
            event.target.closest('.context-submenu') === null) {
            hideMenu();
        }
    }
};