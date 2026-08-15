/**
 * Remove unwanted inline wrapper elements (font/span) inside the editor.
 * This keeps text content while unwrapping the elements.
 *
 * @param {HTMLElement} editor - The editor root element.
 * @param {Selection} [selection] - Optional selection to preserve caret.
 * @returns {boolean} True if cleanup happened.
 */
export const sanitizeInlineArtifacts = (editor, selection = null) => {
    if (!editor) return false;

    const doc = editor.ownerDocument || document;
    const win = doc.defaultView;
    const activeSelection = selection || win?.getSelection?.() || null;

    if (!editor.querySelector('font, span')) {
        return false;
    }

    const KEEP_SPAN_CLASSES = new Set([
        'link-url-text',
    ]);

    const shouldKeepSpan = (span) => {
        if (span.dataset?.editorKeep === '1') return true;
        if (span.getAttribute('contenteditable') !== null) return true;
        if (span.classList?.length > 0) {
            return Array.from(span.classList).some((className) => KEEP_SPAN_CLASSES.has(className));
        }

        return false;
    };

    const targets = [];

    editor.querySelectorAll('font').forEach((el) => targets.push(el));
    
    editor.querySelectorAll('span').forEach((span) => {
        if (!shouldKeepSpan(span)) targets.push(span);
    });

    if (targets.length === 0) {
        return false;
    }

    let startMarker = null;
    let endMarker = null;

    if (activeSelection && activeSelection.rangeCount) {
        const range = activeSelection.getRangeAt(0);

        if (editor.contains(range.startContainer) && editor.contains(range.endContainer)) {
            try {
                if (!range.collapsed) {
                    endMarker = doc.createComment('sanitize-end');
                    const endRange = range.cloneRange();
                    endRange.collapse(false);
                    endRange.insertNode(endMarker);
                }

                startMarker = doc.createComment('sanitize-start');
                const startRange = range.cloneRange();
                startRange.collapse(true);
                startRange.insertNode(startMarker);
            } catch (error) {
                startMarker = null;
                endMarker = null;
            }
        }
    }

    const unwrapElement = (el) => {
        const parent = el.parentNode;
        if (!parent) return;

        while (el.firstChild) {
            parent.insertBefore(el.firstChild, el);
        }

        parent.removeChild(el);
    };

    targets.forEach(unwrapElement);

    if ((startMarker || endMarker) && activeSelection) {
        try {
            const hasStart = Boolean(startMarker && startMarker.isConnected);
            const hasEnd = Boolean(endMarker && endMarker.isConnected);

            if (hasStart || hasEnd) {
                const newRange = doc.createRange();

                if (hasStart && hasEnd) {
                    newRange.setStartAfter(startMarker);
                    newRange.setEndBefore(endMarker);
                } else if (hasStart) {
                    newRange.setStartAfter(startMarker);
                    newRange.collapse(true);
                } else {
                    newRange.setStartBefore(endMarker);
                    newRange.collapse(true);
                }

                activeSelection.removeAllRanges();
                activeSelection.addRange(newRange);
            }
        } catch (error) {
            // Ignore selection restoration errors and keep cleanup result.
        } finally {
            if (startMarker?.parentNode) {
                startMarker.parentNode.removeChild(startMarker);
            }
            if (endMarker?.parentNode) {
                endMarker.parentNode.removeChild(endMarker);
            }
        }
    }

    return true;
};
