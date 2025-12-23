/**
 * Initialize a subtle gradient mask behind the editor element.
 * The mask is inserted before the editor in the DOM so it renders underneath.
 *
 * @param {HTMLElement} editorElement
 * @param {Object} [options]
 * @returns {{ destroy: () => void }}
 */
export const initEditorMask = (editorElement, options = {}) => {
    if (!(editorElement instanceof HTMLElement)) {
        return {
            destroy: () => {}
        };
    }

    const parent = editorElement.parentElement ?? document.body;

    // Positioning context without overriding existing layout intent
    const computedPosition = getComputedStyle(parent).position;
    const shouldRestorePosition = computedPosition === 'static';

    if (shouldRestorePosition) {
        parent.style.position = 'relative';
    }

    const mask = document.createElement('div');
    mask.className = 'editor-mask';

    parent.insertBefore(mask, editorElement);
    editorElement.classList.add('with-mask');

    let destroyed = false;

    return {
        destroy() {
            if (destroyed) return;
            destroyed = true;

            if (mask.parentNode) {
                mask.parentNode.removeChild(mask);
            }

            editorElement.classList.remove('with-mask');

            // Restore parent position only if we changed it
            if (shouldRestorePosition) {
                parent.style.position = '';
            }
        }
    };
};
