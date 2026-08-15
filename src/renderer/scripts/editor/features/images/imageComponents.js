/*
 * Image block component helpers (create block + resize handles).
 */

const RESIZE_HANDLES = [
    { pos: 'nw', cursor: 'nwse-resize' },
    { pos: 'ne', cursor: 'nesw-resize' },
    { pos: 'se', cursor: 'nwse-resize' },
    { pos: 'sw', cursor: 'nesw-resize' }
];

const applyImageSizing = (block, img, editor) => {
    if (!block || !img) return;

    const naturalWidth = img.naturalWidth || 0;
    const naturalHeight = img.naturalHeight || 0;
    const aspect = naturalWidth && naturalHeight ? naturalWidth / naturalHeight : 1;
    block.dataset.aspect = String(aspect);

    if (!editor) return;

    const editorWidth = editor.clientWidth || 560;
    const maxWidth = Math.max(120, editorWidth - 40);
    const baseWidth = naturalWidth > 0
        ? Math.min(naturalWidth, maxWidth)
        : Math.min(420, maxWidth);
    const width = Math.max(120, baseWidth);

    block.style.width = `${width}px`;
    block.style.height = 'auto';
};

export const ensureImageResizeHandles = (block) => {
    if (!block || block.querySelector('.image-resize-handle')) return;

    RESIZE_HANDLES.forEach(({ pos, cursor }) => {
        const handle = document.createElement('div');
        handle.className = `image-resize-handle ${pos}`;
        handle.dataset.handle = pos;
        handle.dataset.editorKeep = '1';
        handle.style.cursor = cursor;
        handle.contentEditable = 'false';
        block.appendChild(handle);
    });
};

export const createImageBlock = ({ dataUrl, name = 'Image', editor } = {}) => {
    const block = document.createElement('div');
    block.className = 'image-block';
    block.contentEditable = 'false';

    const img = document.createElement('img');
    img.className = 'note-image';
    img.src = dataUrl || '';
    img.alt = name;
    img.loading = 'lazy';
    img.draggable = false;

    block.appendChild(img);
    ensureImageResizeHandles(block);

    const applySizing = () => applyImageSizing(block, img, editor);

    if (img.complete) {
        requestAnimationFrame(applySizing);
    } else {
        img.onload = applySizing;
    }

    return { block, img };
};