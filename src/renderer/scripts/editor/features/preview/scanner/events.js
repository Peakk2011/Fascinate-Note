/**
 * URL preview card system - event handlers & lifecycle
 * @module urlPreview/scanner/events
 */

export const createEvents = (editor, state, enqueueScanRoot, scheduleScan) => {
    if (!editor || !state || typeof enqueueScanRoot !== 'function' || typeof scheduleScan !== 'function') {
        return null;
    }

    // Selection guard 

    const isSelectionInsideCard = () => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return false;

        const node    = selection.getRangeAt(0).startContainer;
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        return Boolean(element?.closest?.('.link-card'));
    };

    // Event handlers

    const handleBeforeInput = (event) => {
        if (!state.enabled) return;
        if (event?.target?.closest?.('.link-card') || isSelectionInsideCard()) {
            event.preventDefault();
        }
    };

    const handleKeyDownForCard = (event) => {
        if (!state.enabled) return;
        if (!isSelectionInsideCard()) return;

        const blockedKeys = ['Backspace', 'Delete', 'Enter'];
        if (blockedKeys.includes(event.key)) {
            event.preventDefault();
        }
    };

    const handleInputForURLs = () => {
        if (!state.enabled) return;

        const selection = window.getSelection();
        if (selection && selection.rangeCount) {
            enqueueScanRoot(selection.getRangeAt(0).startContainer);
        } else {
            enqueueScanRoot(editor);
        }

        scheduleScan();
    };

    const handlePasteForURLs = () => {
        if (!state.enabled) return;

        setTimeout(() => {
            const selection = window.getSelection();
            if (selection?.rangeCount) {
                enqueueScanRoot(selection.getRangeAt(0).startContainer);
            } else {
                enqueueScanRoot(editor);
            }
            scheduleScan();
        }, 0);
    };

    // Attach / detach

    const attach = (mutationObserver) => {
        if (!mutationObserver || state.isActive) return;

        mutationObserver.observe(editor, {
            childList:     true,
            subtree:       true,
            characterData: true,
        });

        editor.addEventListener('beforeinput', handleBeforeInput);
        editor.addEventListener('keydown',     handleKeyDownForCard);
        editor.addEventListener('input',       handleInputForURLs);
        editor.addEventListener('paste',       handlePasteForURLs);

        state.isActive = true;
    };

    const detach = (mutationObserver) => {
        if (!state.isActive) return;

        editor.removeEventListener('beforeinput', handleBeforeInput);
        editor.removeEventListener('keydown',     handleKeyDownForCard);
        editor.removeEventListener('input',       handleInputForURLs);
        editor.removeEventListener('paste',       handlePasteForURLs);

        mutationObserver?.disconnect();
        state.isActive = false;
    };

    return { attach, detach };
};