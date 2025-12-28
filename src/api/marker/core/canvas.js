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
        const rect = container.getBoundingClientRect();
        const dpr = state.devicePixelRatio;

        // Use bitwise OR for rounding
        const newWidth = (rect.width + 0.5) | 0;
        const newHeight = (rect.height + 0.5) | 0;

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

        // Initialize pan values on first setup
        if (!state.isInitialized) {
            state.panX = (newWidth - config.canvas.DEFAULT_WIDTH) / 2;
            state.panY = (newHeight - config.canvas.DEFAULT_HEIGHT) / 2;
            state.isInitialized = true;
        }

        initSVG();
        requestRedraw();
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
        svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10';

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
        const config = getConfig();
        const ctx = state.ctx;
        const canvas = state.canvas;

        if (!ctx || !canvas) return;

        ctx.save();
        
        // Clear entire canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // The canvas content is always drawn at a 1:1 scale relative to the window.
        // Panning and zooming are handled by CSS transforms.

        // Draw grid if zoomed in enough
        if (state.scale > 0.25) {
            drawGrid(ctx, state, config, state.scale);
        }
        
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
        const { canvas, svg, scale, panX, panY } = state;

        if (!canvas || !svg) return;

        // Use integer values for pan to avoid sub-pixel rendering issues
        const transform = `translate(${(panX | 0)}px, ${(panY | 0)}px) scale(${scale})`;
        
        canvas.style.transformOrigin = '0 0';
        canvas.style.transform = transform;
        
        svg.style.transformOrigin = '0 0';
        svg.style.transform = transform;
    } catch (error) {
        console.error('Error updating view transform:', error);
    }
};

/**
 * Draws the grid pattern on canvas
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} state - Application state
 * @param {Object} config - Configuration object
 * @param {number} scale - Current zoom scale
 * @returns {void}
 */
const drawGrid = (ctx, state, config, scale) => {
    try {
        const gridSize = config.constants.GRID_SIZE;
        const canvasWidth = state.canvasWidth;
        const canvasHeight = state.canvasHeight;
        const panX = state.panX;
        const panY = state.panY;
        
        // Calculate opacity based on zoom level
        const opacity = Math.min(1, (scale - 0.25) / 0.25);
        const alphaValue = opacity * 0.5;
        
        ctx.fillStyle = 'rgba(128,128,128,' + alphaValue + ')';
        
        // Calculate dot radius based on zoom
        const dotRadius = 1 / scale;
        
        // Calculate visible grid bounds
        const startX = (((-panX / scale / gridSize) | 0) * gridSize) | 0;
        const startY = (((-panY / scale / gridSize) | 0) * gridSize) | 0;
        const endX = (startX + (canvasWidth / scale) + gridSize) | 0;
        const endY = (startY + (canvasHeight / scale) + gridSize) | 0;

        // Draw grid dots
        for (let x = startX; x < endX; x += gridSize) {
            for (let y = startY; y < endY; y += gridSize) {
                ctx.beginPath();
                ctx.arc(x, y, dotRadius, 0, TWO_PI);
                ctx.fill();
            }
        }
    } catch (err) {
        console.error('Error drawing grid:', err);
    }
};