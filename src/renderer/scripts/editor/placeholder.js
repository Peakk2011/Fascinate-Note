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
        placeholder.textContent = placeholderText || '';
        placeholder.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            color: var(--theme-fg);
            opacity: 65%;
            pointer-events: none;
            user-select: none;
            padding: 1.4rem 1.2rem;
            width: 100%;
            z-index: 1;
            font-family: var(--font-display);
            font-weight: 430;
            font-size: ${noteFeaturesConfig.defaultFontSize}px;
        `;

        const parent = editor.parentElement;
        if (parent) {
            parent.style.position = 'relative';
            parent.appendChild(placeholder);
        }

        /**
         * Updates the visibility of the placeholder.
         * It is displayed only when the editor is empty.
         */
        const isEditorEffectivelyEmpty = () => {
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
                const empty = isEditorEffectivelyEmpty();
                placeholder.style.display = empty ? 'block' : 'none';
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
                placeholder.style.display = 'none';
            }

            // Defer check for nbsp / paste / browser insert
            setTimeout(() => {
                const text = editor.innerText || editor.textContent;

                // remove both normal spaces and nbsp
                const cleaned = text.replace(/[\s\u00A0]/g, '');

                if (cleaned.length > 0) {
                    placeholder.style.display = 'none';
                } else {
                    placeholder.style.display = '';
                }
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
            }, 30);
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