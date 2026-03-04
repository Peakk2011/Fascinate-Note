import { getState, getConfig } from '../utils/config.js';

/**
 * @typedef {Object} CanvasCoordinates
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 */

// Constants cache
const SVG_NS = 'http://www.w3.org/2000/svg';
const TWO_PI = 6.283185307179586; // Math.PI * 2
const POSITION_ABSOLUTE = 'absolute';
const POINTER_EVENTS_NONE = 'none';
const LINE_CAP_ROUND = 'round';
const LINE_JOIN_ROUND = 'round';

/**
 * Sets up and configures all canvas elements
 * @returns {void}
 */
export const setupCanvas = () => {
    try {
        const state = getState();
        const config = getConfig();

        const container = state.canvasContainer;
        const dpr = state.devicePixelRatio;

        // Keep workspace board size fixed from config (independent from viewport size)
        const newWidth = config.canvas.DEFAULT_WIDTH | 0;
        const newHeight = config.canvas.DEFAULT_HEIGHT | 0;

        // Check if resize is needed
        if (state.canvasWidth !== newWidth || state.canvasHeight !== newHeight) {
            state.canvasWidth = newWidth;
            state.canvasHeight = newHeight;

            // Update main canvas size
            updateCanvasSize(
                state.canvas,
                newWidth,
                newHeight,
                dpr
            );

            // Scale and configure main context
            const ctx = state.ctx;
            ctx.scale(dpr, dpr);
            ctx.lineCap = LINE_CAP_ROUND;
            ctx.lineJoin = LINE_JOIN_ROUND;

        }

        if (state.markerLayer) {
            state.markerLayer.style.width = `${newWidth}px`;
            state.markerLayer.style.height = `${newHeight}px`;
        }

        // Initialize pan values on first setup
        if (!state.isInitialized) {
            const rect = container.getBoundingClientRect();
            state.panX = (rect.width - config.canvas.DEFAULT_WIDTH) / 2;
            state.panY = (rect.height - config.canvas.DEFAULT_HEIGHT) / 2;
            state.isInitialized = true;
        }

        initSVG();
        requestRedraw();
        updateViewTransform();
    } catch (err) {
        console.error('Error setting up canvas:', err);
    }
};

/**
 * Updates canvas dimensions and pixel ratio
 * @param {HTMLCanvasElement} canvas    - Canvas element to update
 * @param {number} width                - New width in CSS pixels
 * @param {number} height               - New height in CSS pixels
 * @param {number} dpr                  - Device pixel ratio
 * @returns {void}
 */
const updateCanvasSize = (canvas, width, height, dpr) => {
    try {
        // Set buffer size (actual pixels)
        canvas.width = (width * dpr) | 0;
        canvas.height = (height * dpr) | 0;
        
        // Set display size (CSS pixels)
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
    } catch (err) {
        console.error('Error updating canvas size:', err);
    }
};

/**
 * Initializes or reinitializes the SVG overlay
 * @returns {void}
 */
export const initSVG = () => {
    try {
        const state = getState();

        // Remove existing SVG if present
        if (state.svg && state.svg.parentNode) {
            state.svg.parentNode.removeChild(state.svg);
        }

        // Create new SVG element
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:10';
        svg.style.width = `${state.canvasWidth}px`;
        svg.style.height = `${state.canvasHeight}px`;

        // Create group element
        const g = document.createElementNS(SVG_NS, 'g');
        svg.appendChild(g);

        // Update state
        state.svg = svg;
        state.svgGroup = g;
        state.canvasContainer.appendChild(svg);
    } catch (err) {
        console.error('Error initializing SVG:', err);
    }
};

/**
 * Converts mouse event coordinates to canvas coordinates
 * @param {MouseEvent} e - Mouse event
 * @returns {CanvasCoordinates} Transformed coordinates
 */
export const getCanvasCoords = (e) => {
    try {
        const state = getState();
        const rect = state.canvasContainer.getBoundingClientRect();
        const scale = state.scale;
        const panX = state.panX;
        const panY = state.panY;
        
        return {
            x: (e.clientX - rect.left - panX) / scale,
            y: (e.clientY - rect.top - panY) / scale
        };
    } catch (err) {
        console.error('Error getting canvas coordinates:', err);
        return { x: 0, y: 0 };
    }
};

/**
 * Requests a full canvas redraw including grid and layers
 * @returns {void}
 */
export const requestRedraw = () => {
    try {
        const state = getState();
        const ctx = state.ctx;
        const canvas = state.canvas;

        if (!ctx || !canvas) return;

        ctx.save();
        
        // Clear entire canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // The canvas content is always drawn at a 1:1 scale relative to the window.
        // Panning and zooming are handled by CSS transforms.


        ctx.restore();
    } catch (err) {
        console.error('Error redrawing canvas:', err);
    }
};

/**
 * Updates the CSS transform of the canvas and SVG overlay for fast panning and zooming.
 * @returns {void}
 */
export const updateViewTransform = () => {
    try {
        const state = getState();
        const config = getConfig();
        const { canvas, svg, markerLayer, markerZoomIndicator, scale, panX, panY } = state;

        if (!canvas || !svg) return;

        // Use integer values for pan to avoid sub-pixel rendering issues
        const transform = `translate(${(panX | 0)}px, ${(panY | 0)}px) scale(${scale})`;
        
        canvas.style.transformOrigin = '0 0';
        canvas.style.transform = transform;
        
        svg.style.transformOrigin = '0 0';
        svg.style.transform = transform;

        if (markerLayer) {
            markerLayer.style.transformOrigin = '0 0';
            markerLayer.style.transform = transform;
            markerLayer.classList.toggle('is-lod', scale <= 0.4 && !state.isMissionActive);
        }

        if (markerZoomIndicator) {
            markerZoomIndicator.textContent = `${Math.round(scale * 100)}%`;
        }

        if (state.canvasContainer) {
            const rawStep = config.constants.GRID_SIZE * scale;
            const step = Math.max(6, rawStep);
            const offsetX = ((panX % step) + step) % step;
            const offsetY = ((panY % step) + step) % step;
            state.canvasContainer.style.setProperty('--marker-grid-step', `${step}px`);
            state.canvasContainer.style.setProperty('--marker-grid-offset-x', `${offsetX}px`);
            state.canvasContainer.style.setProperty('--marker-grid-offset-y', `${offsetY}px`);
            state.canvasContainer.classList.toggle('marker-grid-hidden', scale <= 0.6);
        }
    } catch (error) {
        console.error('Error updating view transform:', error);
    }
};