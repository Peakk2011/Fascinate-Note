export const createOverlay = (editor) => {
    const container = editor.closest('.textarea-container') || editor.parentElement;
    if (!container) return null;

    const style = window.getComputedStyle(container);
    if (style.position === 'static') {
        container.style.position = 'relative';
    }

    const overlay = document.createElement('div');
    overlay.className = 'collab-overlay';
    container.appendChild(overlay);

    return { overlay, container };
};