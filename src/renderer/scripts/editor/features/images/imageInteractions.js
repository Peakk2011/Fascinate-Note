import { ensureImageResizeHandles } from './imageComponents.js';

/**
 * Image selection, resize, drag, and border hover behaviors.
 */
export const initImageInteractions = ({ editor, selectionMenuId = 'selection-menu' } = {}) => {
    if (!editor) return null;

    // Image selection + resize + drag
    let selectedImageBlock = null;
    let resizeState = null;
    let dragState = null;
    let borderHoverBlock = null;
    const SNAP_THRESHOLD = 10;
    const DRAG_THRESHOLD = 2;
    const BORDER_HOVER_THRESHOLD = 13;

    const hideSelectionMenu = () => {
        const menu = document.getElementById(selectionMenuId);
        if (menu) {
            menu.classList.remove('show');
        }
    };

    const selectImageBlock = (block) => {
        if (!block) return;
        if (selectedImageBlock && selectedImageBlock !== block) {
            selectedImageBlock.classList.remove('is-selected');
        }
        ensureImageResizeHandles(block);
        selectedImageBlock = block;
        selectedImageBlock.classList.add('is-selected');
        hideSelectionMenu();
    };

    const clearImageSelection = () => {
        if (!selectedImageBlock) return;
        selectedImageBlock.classList.remove('is-selected');
        selectedImageBlock = null;
    };

    const onEditorClick = (e) => {
        const block = e.target.closest('.image-block');
        if (block) {
            e.preventDefault();
            selectImageBlock(block);
            return;
        }
        if (!e.target.closest('.image-resize-handle')) {
            clearImageSelection();
        }
    };

    const onPointerDown = (e) => {
        if (e.button !== 0) return;

        const handle = e.target.closest('.image-resize-handle');
        if (!handle) return;
        const block = handle.closest('.image-block');
        if (!block) return;

        e.preventDefault();
        e.stopPropagation();

        selectImageBlock(block);
        block.classList.add('is-resizing');

        const rect = block.getBoundingClientRect();
        const aspect = Number(block.dataset.aspect) || (rect.width / rect.height) || 1;
        resizeState = {
            block,
            handle: handle.dataset.handle,
            startX: e.clientX,
            startY: e.clientY,
            startWidth: rect.width,
            startHeight: rect.height,
            aspect
        };

        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
    };

    const getBorderHandleAt = (block, x, y) => {
        const rect = block.getBoundingClientRect();
        const localX = x - rect.left;
        const localY = y - rect.top;

        const left = localX <= BORDER_HOVER_THRESHOLD;
        const right = localX >= rect.width - BORDER_HOVER_THRESHOLD;
        const top = localY <= BORDER_HOVER_THRESHOLD;
        const bottom = localY >= rect.height - BORDER_HOVER_THRESHOLD;

        if (!(left || right || top || bottom)) return null;

        let handle = '';
        if (top) handle += 'n';
        if (bottom) handle += 's';
        if (left) handle += 'w';
        if (right) handle += 'e';

        let cursor = 'nwse-resize';
        if (handle === 'n' || handle === 's') cursor = 'ns-resize';
        if (handle === 'e' || handle === 'w') cursor = 'ew-resize';
        if (handle === 'ne' || handle === 'sw') cursor = 'nesw-resize';
        if (handle === 'nw' || handle === 'se') cursor = 'nwse-resize';

        return { handle, cursor };
    };

    const onImagePointerDown = (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('.image-resize-handle')) return;

        const block = e.target.closest('.image-block');
        if (!block) return;

        const borderHandle = block.dataset.borderHandle
            || getBorderHandleAt(block, e.clientX, e.clientY)?.handle;

        if (borderHandle) {
            e.preventDefault();
            selectImageBlock(block);

            const rect = block.getBoundingClientRect();
            resizeState = {
                block,
                handle: borderHandle,
                startX: e.clientX,
                startY: e.clientY,
                startWidth: rect.width
            };

            block.classList.add('is-resizing');
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            return;
        }

        e.preventDefault();
        selectImageBlock(block);

        const rect = block.getBoundingClientRect();
        const editorStyle = window.getComputedStyle(editor);
        const paddingLeft = parseFloat(editorStyle.paddingLeft || '0');
        const paddingRight = parseFloat(editorStyle.paddingRight || '0');
        const contentWidth = Math.max(0, editor.clientWidth - paddingLeft - paddingRight);
        const blockWidth = rect.width;
        const maxOffset = Math.max(0, contentWidth - blockWidth);
        const centerOffset = Math.max(0, (contentWidth - blockWidth) / 2);

        const marginLeft = window.getComputedStyle(block).marginLeft;
        const currentOffset = marginLeft === 'auto'
            ? centerOffset
            : Math.max(0, Math.min(parseFloat(marginLeft || '0'), maxOffset));

        dragState = {
            block,
            startX: e.clientX,
            startOffset: currentOffset,
            maxOffset,
            centerOffset,
            moved: false
        };

        document.addEventListener('pointermove', onDragMove);
        document.addEventListener('pointerup', onDragUp);
    };

    const onPointerMove = (e) => {
        if (!resizeState) return;

        const { block, handle, startX, startY, startWidth } = resizeState;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        const xSign = handle.includes('w') ? -1 : 1;
        const ySign = handle.includes('n') ? -1 : 1;

        const adjDx = dx * xSign;
        const adjDy = dy * ySign;
        const delta = Math.abs(adjDx) > Math.abs(adjDy) ? adjDx : adjDy;

        const editorWidth = editor.clientWidth || startWidth;
        const maxWidth = Math.max(120, editorWidth - 40);
        const newWidth = Math.min(Math.max(120, startWidth + delta), maxWidth);

        block.style.width = `${newWidth}px`;
        block.style.height = 'auto';
    };

    const onPointerUp = () => {
        if (!resizeState) return;
        resizeState.block.classList.remove('is-resizing');
        resizeState = null;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
    };

    const onDragMove = (e) => {
        if (!dragState) return;

        const { block, startX, startOffset, maxOffset, centerOffset } = dragState;
        const dx = e.clientX - startX;

        if (!dragState.moved && Math.abs(dx) < DRAG_THRESHOLD) {
            return;
        }

        dragState.moved = true;
        block.classList.add('is-dragging');

        let nextOffset = startOffset + dx;
        nextOffset = Math.max(0, Math.min(nextOffset, maxOffset));

        const isCentered = block.classList.contains('is-centered');
        const snapRange = isCentered ? SNAP_THRESHOLD * 1.5 : SNAP_THRESHOLD;

        if (Math.abs(nextOffset - centerOffset) <= snapRange) {
            block.style.marginLeft = 'auto';
            block.style.marginRight = 'auto';
            block.dataset.align = 'center';
            block.classList.add('is-centered');
            return;
        }

        block.classList.remove('is-centered');
        block.dataset.align = 'custom';
        block.style.marginLeft = `${Math.round(nextOffset)}px`;
        block.style.marginRight = '0';
    };

    const onDragUp = () => {
        if (!dragState) return;
        dragState.block.classList.remove('is-dragging');
        dragState = null;
        document.removeEventListener('pointermove', onDragMove);
        document.removeEventListener('pointerup', onDragUp);
    };

    const clearBorderHover = () => {
        if (borderHoverBlock) {
            borderHoverBlock.classList.remove('is-border-hover');
            borderHoverBlock.style.cursor = '';
            delete borderHoverBlock.dataset.borderHandle;
            borderHoverBlock = null;
        }
    };

    const onImagePointerMove = (e) => {
        if (resizeState || dragState) return;

        const block = e.target.closest('.image-block');
        if (!block) {
            clearBorderHover();
            return;
        }

        if (e.target.closest('.image-resize-handle')) {
            block.classList.remove('is-border-hover');
            block.style.cursor = '';
            delete block.dataset.borderHandle;
            return;
        }

        const borderInfo = getBorderHandleAt(block, e.clientX, e.clientY);

        if (borderInfo) {
            if (borderHoverBlock && borderHoverBlock !== block) {
                borderHoverBlock.classList.remove('is-border-hover');
                borderHoverBlock.style.cursor = '';
                delete borderHoverBlock.dataset.borderHandle;
            }
            borderHoverBlock = block;
            block.classList.add('is-border-hover');
            block.dataset.borderHandle = borderInfo.handle;
            block.style.cursor = borderInfo.cursor;
        } else if (block.classList.contains('is-border-hover')) {
            block.classList.remove('is-border-hover');
            block.style.cursor = '';
            delete block.dataset.borderHandle;
            if (borderHoverBlock === block) borderHoverBlock = null;
        }
    };

    const onDocumentMouseDown = (e) => {
        if (selectedImageBlock && !e.target.closest('.image-block')) {
            clearImageSelection();
        }
    };

    editor.addEventListener('click', onEditorClick);
    editor.addEventListener('pointerdown', onPointerDown);
    editor.addEventListener('pointerdown', onImagePointerDown);
    editor.addEventListener('pointermove', onImagePointerMove);
    editor.addEventListener('pointerleave', clearBorderHover);
    document.addEventListener('mousedown', onDocumentMouseDown);

    return {
        cleanup() {
            editor.removeEventListener('click', onEditorClick);
            editor.removeEventListener('pointerdown', onPointerDown);
            editor.removeEventListener('pointerdown', onImagePointerDown);
            editor.removeEventListener('pointermove', onImagePointerMove);
            editor.removeEventListener('pointerleave', clearBorderHover);
            document.removeEventListener('mousedown', onDocumentMouseDown);
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointermove', onDragMove);
            document.removeEventListener('pointerup', onDragUp);
            clearBorderHover();
            clearImageSelection();
        }
    };
};