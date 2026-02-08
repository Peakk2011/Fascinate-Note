import { noteFeaturesConfig } from '../note/noteConfig.js';

/**
 * Creates and manages a placeholder element for a text editor.
 * The placeholder is an overlay that shows when the editor is empty.
 *
 * @param {HTMLElement} editor                  - The editor element that the placeholder is for.
 * @param {string} placeholderText              - The text to display in the placeholder.
 * @returns {{
 *      element: HTMLElement,
 *      updateVisibility: Function,
 *      syncFontSize: Function,
 *      destroy: Function
 * }}                                             An object containing the placeholder element and functions to update its state.
 * @property {HTMLElement} element              - The created placeholder DOM element.
 * @property {Function} updateVisibility        - A function to show or hide the placeholder based on the editor's content.
 * @property {Function} syncFontSize            - A function to synchronize the placeholder's font size with the editor's.
 * @property {Function} destroy                 - A function to clean up event listeners and observers.
 */
export const createPlaceholder = (editor, placeholderText) => {
    try {
        const placeholder = document.createElement('div');
        placeholder.className = 'editor-placeholder';
        placeholder.textContent = placeholderText || '';

        const parent = editor.parentElement;
        if (parent) {
            parent.style.position = 'relative';
            parent.appendChild(placeholder);
        }

        const DEEP_CHECK_INTERVAL = 800;
        let lastKnownEmpty = true;
        let lastDeepCheck = 0;

        /**
         * Fast empty check using textContent only.
         * This treats any whitespace as content to avoid costly DOM scans on every keystroke.
         */
        const quickIsEmpty = () => {
            const rawText = editor.textContent || '';
            const textWithoutZWS = rawText.replace(/\u200B/g, '');
            return textWithoutZWS.length === 0;
        };

        /**
         * Deep empty check for non-text content (images, blocks, etc).
         * This is heavier and should be used sparingly.
         */
        const deepIsEmpty = () => {
            try {
                // Get raw text content without any cleaning first
                const rawText = editor.textContent || '';

                // Remove only zero-width spaces for checking, but keep regular spaces
                const textWithoutZWS = rawText.replace(/\u200B/g, '');

                // If there's any non-whitespace character, it's not empty
                if (textWithoutZWS.trim().length > 0) {
                    return false;
                }

                // Check if there are only spaces (spacebar was pressed)
                // If there are spaces but no other content, still show content (hide placeholder)
                if (textWithoutZWS.length > 0 && textWithoutZWS !== '') {
                    // Has spaces or other whitespace - check if it's just BR tags
                    const hasOnlyBR = Array.from(editor.childNodes).every(node =>
                        node.nodeType === Node.TEXT_NODE && node.textContent.trim() === '' ||
                        (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR')
                    );

                    if (!hasOnlyBR) {
                        return false;
                    }
                }

                // If there are block elements that represent content
                const contentSelectors = 'h1,h2,h3,h4,h5,h6,ul,ol,table,pre,blockquote,img';

                if (editor.querySelector(contentSelectors)) {
                    return false;
                }

                // Check whether there's any non-empty text node or non-BR element
                for (const node of editor.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const cleanText = node.textContent
                            .replace(/\u200B/g, '')
                            .replace(/\u00A0/g, ' ')
                            .trim();

                        if (cleanText.length > 0) {
                            return false;
                        }
                    }

                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const el = node;
                        if (el.tagName === 'BR') continue;

                        // If element has meaningful children or text, not empty
                        const cleanText = (el.textContent || '')
                            .replace(/\u200B/g, '')
                            .replace(/\u00A0/g, ' ')
                            .trim();

                        if (cleanText.length > 0) {
                            return false;
                        }

                        if (el.querySelector && el.querySelector(contentSelectors)) {
                            return false;
                        }
                    }
                }

                return true;
            } catch (error) {
                console.error('Error checking editor empty state:', error);
                return false;
            }
        };

        const updateVisibility = () => {
            try {
                const quickEmpty = quickIsEmpty();

                if (!quickEmpty) {
                    lastKnownEmpty = false;
                    placeholder.style.display = 'none';
                    return;
                }

                const now = Date.now();
                const needsDeepCheck =
                    lastKnownEmpty === false ||
                    (now - lastDeepCheck) > DEEP_CHECK_INTERVAL;

                if (needsDeepCheck) {
                    const deepEmpty = deepIsEmpty();
                    lastKnownEmpty = deepEmpty;
                    lastDeepCheck = now;
                    placeholder.style.display = deepEmpty ? 'block' : 'none';
                    return;
                }

                placeholder.style.display = lastKnownEmpty ? 'block' : 'none';
            } catch (error) {
                console.error('Error updating placeholder visibility:', error);
            }
        };

        // Update visibility on input events (catches spacebar and all typing)
        const handleInput = () => {
            updateVisibility();
        };

        // Update visibility on keydown
        const handleKeyDown = (e) => {
            // Hide immediately on normal space
            if (e.key === ' ' || e.code === 'Space') {
                lastKnownEmpty = false;
                placeholder.style.display = 'none';
            }

            // Defer check for nbsp / paste / browser insert
            setTimeout(() => {
                updateVisibility();
            }, 0);
        };


        // Observe DOM mutations so programmatic changes
        const mutationObserver = new MutationObserver(() => {
            // small debounce to coalesce rapid mutations
            if (mutationObserver._timeout) {
                clearTimeout(mutationObserver._timeout);
            }
            
            mutationObserver._timeout = setTimeout(() => {
                updateVisibility();
            }, 120);
        });

        mutationObserver.observe(editor, {
            childList: true,
            subtree: true,
            characterData: true,
            characterDataOldValue: true
        });

        // Add event listeners
        editor.addEventListener('input', handleInput);
        editor.addEventListener('keydown', handleKeyDown);
        editor.addEventListener('keyup', handleInput);
        editor.addEventListener('paste', handleInput);
        editor.addEventListener('cut', handleInput);

        /**
         * Synchronizes the font size of the placeholder with the editor's font size.
         */
        const syncFontSize = () => {
            try {
                const editorFontSize = window.getComputedStyle(editor).fontSize;
                placeholder.style.fontSize = editorFontSize;
            } catch (error) {
                console.error('Error synchronizing placeholder font size:', error);
            }
        };

        /**
         * Cleanup function to remove event listeners and observers
         */
        const destroy = () => {
            try {
                mutationObserver.disconnect();
                editor.removeEventListener('input', handleInput);
                editor.removeEventListener('keydown', handleKeyDown);
                editor.removeEventListener('keyup', handleInput);
                editor.removeEventListener('paste', handleInput);
                editor.removeEventListener('cut', handleInput);

                if (placeholder.parentElement) {
                    placeholder.parentElement.removeChild(placeholder);
                }
            } catch (error) {
                console.error('Error destroying placeholder:', error);
            }
        };

        // Initial visibility check
        updateVisibility();

        return {
            element: placeholder,
            updateVisibility,
            syncFontSize,
            destroy
        };
    } catch (error) {
        console.error('Error creating placeholder:', error);
        return null;
    }
};
