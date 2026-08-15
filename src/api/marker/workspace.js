import {
    loadConfiguration,
    getState,
    updateState,
    getConfig
} from './utils/config.js';

import {
    setupCanvas,
    getCanvasCoords,
    requestRedraw
} from './core/canvas.js';

import {
    handleWheel,
    zoomIn,
    zoomOut,
    resetZoom,
    panImmediately
} from './controllers/zoomPan.js';

import { MarkerBoard } from './index.js';
import { createMarkerGroupModal } from './markerGroupModal.js';

/**
 * Initializes a new workspace within a given container element.
 * @param {HTMLElement} container                       - The container element to create the workspace in.
 * @param {Object} [options]                            - Optional callbacks for integration.
 * @param {function(string):void} [options.onOpenNote]  - Called when a marker window is activated and
 *     the associated note should be opened in the editor.
 * @param {function():void} [options.onReturnToEditor]  - Called when the current note window is clicked
 *     to return focus back to the main editor (e.g. close workspace view).
 * @returns {Promise<Object>} A promise that resolves to the workspace API.
 * @throws {Error} If the container element is not found or invalid.
 */
export const createWorkspace = async (container, options = {}) => {
    if (!container || !(container instanceof HTMLElement)) {
        throw new Error('A valid container HTMLElement must be provided.');
    }

    // 1. Load configuration and initial state
    await loadConfiguration();
    const state = getState();
    const config = getConfig();
    const middlePanSensitivity = Number(config?.constants?.MIDDLE_PAN_SENSITIVITY ?? 1.15);

    // 2. Create and set up canvas
    const canvas = document.createElement('canvas');
    canvas.id = 'workspace-canvas';
    container.appendChild(canvas);

    // 3. Initialize state with DOM elements
    updateState({
        canvasContainer: container,
        canvas: canvas,
        ctx: canvas.getContext('2d'),
    });

    // 4. Initial setup
    setupCanvas();

    let board = null;

    const groupModalInstance = createMarkerGroupModal({
        onConfirm: (name) => board?.addGroup(name)
    });

    document.body.insertAdjacentHTML('beforeend', groupModalInstance.markups);
    const groupModal = groupModalInstance.init();

    board = new MarkerBoard({
        container,
        getCanvasCoords,
        groupModal,
        onOpenNote: options.onOpenNote,
        onReturnToEditor: options.onReturnToEditor,
    });

    console.log('Workspace: MarkerBoard created', board);

    if (board?.layer) {
        updateState({
            markerLayer: board.layer,
            markerZoomIndicator: board.zoomIndicator || null
        });
        setupCanvas();
    }

    // helper to update last mouse coords for zoom centering
    const updateMousePos = (e) => {
        const rect = container.getBoundingClientRect();
        const state = getState();
        state.lastMouseX = e.clientX - rect.left;
        state.lastMouseY = e.clientY - rect.top;
    };

    container.addEventListener('pointermove', updateMousePos);

    let spacePanActive = false;
    let middleDrag = null;
    const updatePanCursor = () => {
        if (!board?.layer) return;
        const isDragging = Boolean(middleDrag);
        board.layer.classList.toggle('space-pan-active', spacePanActive && !isDragging);
        board.layer.classList.toggle('space-pan-grabbing', isDragging);
    };

    const onSpaceKeyDown = (e) => {
        if (e.code !== 'Space' || e.repeat) return;
        if (e.target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable)) {
            return;
        }
        spacePanActive = true;
        updatePanCursor();
        e.preventDefault();
    };

    const onSpaceKeyUp = (e) => {
        if (e.code !== 'Space') return;
        spacePanActive = false;
        updatePanCursor();
        e.preventDefault();
    };

    const onWindowBlur = () => {
        spacePanActive = false;
        if (middleDrag) {
            middleDrag = null;
            window.removeEventListener('mousemove', onMiddleMove);
            window.removeEventListener('mouseup', onMiddleUp);
        }
        updatePanCursor();
    };

    const onContainerMouseDown = (e) => {
        if (e.button === 1 || (e.button === 0 && spacePanActive)) {
            e.preventDefault();
            middleDrag = { x: e.clientX, y: e.clientY };
            updatePanCursor();
            window.addEventListener('mousemove', onMiddleMove);
            window.addEventListener('mouseup', onMiddleUp);
        }
    };

    container.addEventListener('mousedown', onContainerMouseDown);

    const onMiddleMove = (e) => {
        if (!middleDrag) return;
        const state = getState();
        if (state.isMissionActive) return;
        const dx = (e.clientX - middleDrag.x) * middlePanSensitivity;
        const dy = (e.clientY - middleDrag.y) * middlePanSensitivity;

        const newPanX = state.panX + dx;
        const newPanY = state.panY + dy;
        panImmediately(newPanX, newPanY);

        middleDrag.x = e.clientX;
        middleDrag.y = e.clientY;
    };

    const onMiddleUp = (e) => {
        if (!middleDrag) return;
        if (e.button === 1 || e.button === 0) {
            middleDrag = null;
            updatePanCursor();
            window.removeEventListener('mousemove', onMiddleMove);
            window.removeEventListener('mouseup', onMiddleUp);
        }
    };

    window.addEventListener('keydown', onSpaceKeyDown);
    window.addEventListener('keyup', onSpaceKeyUp);
    window.addEventListener('blur', onWindowBlur);

    // 5. Add event listeners
    container.addEventListener('wheel', handleWheel, { passive: false });

    const resizeObserver = new ResizeObserver(() => {
        setupCanvas();
    });
    resizeObserver.observe(container);

    // 6. Return public API
    const api = {
        zoomIn,
        zoomOut,
        resetZoom,
        getCanvasCoords,
        redraw: requestRedraw,
        refreshCurrentNote: (html) => {
            board?.refreshCurrentNote(html);
        },
        refreshAllNotes: () => {
            board?.refreshAllNotes && board.refreshAllNotes();
        },
        markerAPI: board,
        destroy: () => {
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('pointermove', updateMousePos);
            container.removeEventListener('mousedown', onContainerMouseDown);
            
            resizeObserver.disconnect();
            
            window.removeEventListener('mousemove', onMiddleMove);
            window.removeEventListener('mouseup', onMiddleUp);
            window.removeEventListener('keydown', onSpaceKeyDown);
            window.removeEventListener('keyup', onSpaceKeyUp);
            window.removeEventListener('blur', onWindowBlur);
            
            container.innerHTML = '';
            board?.destroy();
        }
    };

    // Set global marker API for command palette
    window.__markerAPI = board;

    return api;
};