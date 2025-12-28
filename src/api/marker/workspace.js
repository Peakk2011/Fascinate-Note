import { loadConfiguration, getState, updateState, getConfig } from './utils/config.js';
import { setupCanvas, getCanvasCoords, requestRedraw, updateViewTransform } from './core/canvas.js';
import { handleWheel, zoomIn, zoomOut, resetZoom } from './controllers/zoomPan.js';

/**
 * Initializes a new workspace within a given container element.
 * 
 * @param {HTMLElement} container - The container element to create the workspace in.
 * @returns {Promise<Object>} A promise that resolves to the workspace API.
 * @throws {Error} If the container element is not found or invalid.
 */
export const createWorkspace = async (container) => {
    if (!container || !(container instanceof HTMLElement)) {
        throw new Error('A valid container HTMLElement must be provided.');
    }

    // 1. Load configuration and initial state
    await loadConfiguration();
    const state = getState();
    const config = getConfig();

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
    
    // 5. Add event listeners
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Handle window resizing
    const resizeObserver = new ResizeObserver(entries => {
        // setupCanvas will handle recalculating dimensions and redrawing
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
        /**
         * Cleans up the workspace, removing event listeners and observers.
         */
        destroy: () => {
            container.removeEventListener('wheel', handleWheel);
            resizeObserver.disconnect();
            container.innerHTML = ''; // Clear canvas and SVG
        }
    };

    return api;
};
