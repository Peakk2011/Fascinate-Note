import { getState, getConfig } from '../utils/config.js';
import { updateViewTransform } from '../core/canvas.js';

/**
 * @fileoverview Zoom and pan interaction module
 * @module zoomPan
 * 
 * @typedef {Object} ZoomState
 * @property {number} targetScale           - Target zoom scale
 * @property {number} currentScale          - Current animated scale
 * @property {number} targetPanX            - Target pan X position
 * @property {number} targetPanY            - Target pan Y position
 * @property {number} currentPanX           - Current animated pan X
 * @property {number} currentPanY           - Current animated pan Y
 * @property {number|null} animationFrame   - Animation frame ID
 * @property {boolean} isAnimating          - Animation state flag
 */

// Animation smoothing/easing constants
const ANIMATION_EASING = 0.15;              // Smoothing factor (0-1, higher = faster)
const EPSILON = 0.001;                      // Threshold for stopping animation
const HALF = 0.5;

/**
 * Retrieve or initialize per-workspace zoom state.
 * Placing the object on the global state rather than module scope
 * avoids a singleton when multiple workspaces are mounted in the
 * same page. The state object is already shared by the rest of the
 * API, so this keeps the animation data scoped appropriately.
 * @returns {ZoomState}
 */
const getZoomState = () => {
    const state = getState();
    if (!state.zoomState) {
        state.zoomState = {
            targetScale: state.scale,
            currentScale: state.scale,
            targetPanX: state.panX,
            targetPanY: state.panY,
            currentPanX: state.panX,
            currentPanY: state.panY,
            animationFrame: null,
            isAnimating: false
        };
    }
    return state.zoomState;
};

/**
 * Handles mouse wheel events for zoom and pan
 * @param {WheelEvent} e - Wheel event
 * @returns {void}
 */
export const handleWheel = (e) => {
    try {
        e.preventDefault();

        const state = getState();
        const config = getConfig().constants;

        const rect = state.canvasContainer.getBoundingClientRect();
        // record last mouse position so that button-based zooms can use a sensible center
        state.lastMouseX = e.clientX - rect.left;
        state.lastMouseY = e.clientY - rect.top;

        const mouseX = state.lastMouseX;
        const mouseY = state.lastMouseY;

        if (e.ctrlKey || e.metaKey) {
            // Zoom operation
            const delta = 1 - e.deltaY * config.ZOOM_SENSITIVITY;
            const newScale = Math.max(
                config.MIN_SCALE,
                Math.min(config.MAX_SCALE, state.scale * delta)
            );

            if (newScale !== state.scale) {
                const scaleDiff = newScale - state.scale;
                const panXDelta = (mouseX - state.panX) * scaleDiff / state.scale;
                const panYDelta = (mouseY - state.panY) * scaleDiff / state.scale;

                animateZoom(
                    newScale,
                    state.panX - panXDelta,
                    state.panY - panYDelta,
                    rect
                );
            }
        } else {
            // Pan operation
            const sens = config.PAN_SENSITIVITY;
            let newPanX, newPanY;

            if (e.shiftKey) {
                // Shift + Wheel scrolls horizontally
                newPanX = state.panX - e.deltaY * sens; // Use deltaY for X-axis
                newPanY = state.panY - e.deltaX * sens; // Use deltaX for Y-axis (for trackpads)
            } else {
                // Normal wheel scrolls vertically/horizontally based on device
                newPanX = state.panX - e.deltaX * sens;
                newPanY = state.panY - e.deltaY * sens;
            }

            animatePan(newPanX, newPanY, rect);
        }
    } catch (error) {
        console.error('Error handling wheel event:', error);
    }
};

/**
 * Animates zoom to target scale and position
 *
 * The `rect` argument used to be required for constraining pan, but we
 * now re-query the container size on every frame. It is left in the API
 * for backwards compatibility, callers may simply pass whatever rect they
 * have at hand.
 *
 * @param {number} targetScale              - Target zoom scale
 * @param {number} targetPanX               - Target pan X position
 * @param {number} targetPanY               - Target pan Y position
 * @param {DOMRect} [rect]                  - Deprecated bounding rect
 * @returns {void}
 */
const animateZoom = (targetScale, targetPanX, targetPanY, rect) => {
    try {
        const state = getState();
        const zs = getZoomState();

        // always sync current values from state so that if another
        // animation was in progress we restart the easing from the
        // *current* scale/pan rather than whatever was left in the
        // old zoomState object (fixes the small jank when interrupting)
        zs.currentScale = state.scale;
        zs.currentPanX = state.panX;
        zs.currentPanY = state.panY;

        zs.targetScale = targetScale;
        zs.targetPanX = targetPanX;
        zs.targetPanY = targetPanY;

        if (!zs.isAnimating) {
            zs.isAnimating = true;
            startAnimation(); // rect will be grabbed per-frame
        }
    } catch (error) {
        console.error('Error animating zoom:', error);
    }
};

/**
 * Animates pan to target position
 *
 * See notes on `animateZoom` about the `rect` argument; we no longer
 * consume it internally.
 *
 * @param {number} targetPanX               - Target pan X position
 * @param {number} targetPanY               - Target pan Y position
 * @param {DOMRect} [rect]                  - Deprecated bounding rect
 * @returns {void}
 */
export const animatePan = (targetPanX, targetPanY, rect) => {
    try {
        const state = getState();
        const zs = getZoomState();

        zs.currentScale = state.scale;
        zs.currentPanX = state.panX;
        zs.currentPanY = state.panY;

        zs.targetScale = state.scale;
        zs.targetPanX = targetPanX;
        zs.targetPanY = targetPanY;

        if (!zs.isAnimating) {
            zs.isAnimating = true;
            startAnimation();
        }
    } catch (error) {
        console.error('Error animating pan:', error);
    }
};

/**
 * Starts the animation loop
 * @param {DOMRect} rect                    - Container bounding rect
 * @returns {void}
 */
const startAnimation = () => {
    try {
        const animate = () => {
            try {
                const state = getState();
                const zs = getZoomState();

                // captured at the time the animation started.
                const rect = state.canvasContainer.getBoundingClientRect();

                // Calculate interpolation
                const scaleDiff = zs.targetScale - zs.currentScale;
                const panXDiff = zs.targetPanX - zs.currentPanX;
                const panYDiff = zs.targetPanY - zs.currentPanY;

                // Check if animation should stop
                const isComplete =
                    Math.abs(scaleDiff) < EPSILON &&
                    Math.abs(panXDiff) < EPSILON &&
                    Math.abs(panYDiff) < EPSILON;

                if (isComplete) {
                    // Snap to final values
                    state.scale = zs.targetScale;
                    state.panX = zs.targetPanX;
                    state.panY = zs.targetPanY;

                    constrainPan();
                    updateViewTransform();

                    zs.isAnimating = false;
                    zs.animationFrame = null;
                    return;
                }

                // Apply easing
                zs.currentScale += scaleDiff * ANIMATION_EASING;
                zs.currentPanX += panXDiff * ANIMATION_EASING;
                zs.currentPanY += panYDiff * ANIMATION_EASING;

                // Update state
                state.scale = zs.currentScale;
                state.panX = zs.currentPanX;
                state.panY = zs.currentPanY;

                constrainPan();
                updateViewTransform();

                // Continue animation
                zs.animationFrame = requestAnimationFrame(animate);
            } catch (error) {
                console.error('Error in animation frame:', error);

                const zs = getZoomState();
                zs.isAnimating = false;
                zs.animationFrame = null;
            }
        };

        // Cancel existing animation
        const zs = getZoomState();
        if (zs.animationFrame !== null) {
            cancelAnimationFrame(zs.animationFrame);
        }

        zs.animationFrame = requestAnimationFrame(animate);
    } catch (error) {
        console.error('Error starting animation:', error);
        // calls can retry
        const zs = getZoomState();
        zs.isAnimating = false;
    }
};

/**
 * Constrains pan within bounds
 * @param {DOMRect} containerRect           - Container bounding rect
 * @returns {void}
 */
const constrainPan = () => {
    try {
        const state = getState();
        const containerRect = state.canvasContainer.getBoundingClientRect();

        const scaledWidth = state.canvasWidth * state.scale;
        const scaledHeight = state.canvasHeight * state.scale;
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        // Constrain X axis
        if (scaledWidth > containerWidth) {
            const minPanX = containerWidth - scaledWidth;
            state.panX = Math.min(0, Math.max(minPanX, state.panX));
        } else {
            state.panX = (containerWidth - scaledWidth) * HALF;
        }

        // Constrain Y axis
        if (scaledHeight > containerHeight) {
            const minPanY = containerHeight - scaledHeight;
            state.panY = Math.min(0, Math.max(minPanY, state.panY));
        } else {
            state.panY = (containerHeight - scaledHeight) * HALF;
        }
    } catch (error) {
        console.error('Error constraining pan:', error);
    }
};

/**
 * Zooms in by one step
 * @returns {void}
 */
export const zoomIn = () => {
    try {
        const state = getState();
        const config = getConfig().constants;
        const rect = state.canvasContainer.getBoundingClientRect();
        const centerX = state.lastMouseX ?? rect.width / 2;
        const centerY = state.lastMouseY ?? rect.height / 2;

        zoom(config.ZOOM_STEP, centerX, centerY);
    } catch (error) {
        console.error('Error zooming in:', error);
    }
};

/**
 * Zooms out by one step
 * @returns {void}
 */
export const zoomOut = () => {
    try {
        const state = getState();
        const config = getConfig().constants;
        const rect = state.canvasContainer.getBoundingClientRect();
        const centerX = state.lastMouseX ?? rect.width / 2;
        const centerY = state.lastMouseY ?? rect.height / 2;

        zoom(1 / config.ZOOM_STEP, centerX, centerY);
    } catch (error) {
        console.error('Error zooming out:', error);
    }
};

/**
 * Resets zoom and pan to default values
 * @returns {void}
 */
export const resetZoom = () => {
    try {
        const state = getState();
        const rect = state.canvasContainer.getBoundingClientRect();

        // reset pointer position as well so that subsequent zooms are centered
        state.lastMouseX = rect.width / 2;
        state.lastMouseY = rect.height / 2;

        const targetScale = 1;
        const targetPanX = (rect.width - state.canvasWidth) * HALF;
        const targetPanY = (rect.height - state.canvasHeight) * HALF;

        animateZoom(targetScale, targetPanX, targetPanY, rect);
    } catch (error) {
        console.error('Error resetting zoom:', error);
    }
};

/**
 * Zooms by delta factor around center point
 * @param {number} delta                    - Zoom delta multiplier
 * @param {number} centerX                  - Center X coordinate
 * @param {number} centerY                  - Center Y coordinate
 * @returns {void}
 */
const zoom = (delta, centerX, centerY) => {
    try {
        const state = getState();
        const config = getConfig().constants;
        const rect = state.canvasContainer.getBoundingClientRect();

        const newScale = Math.max(
            config.MIN_SCALE,
            Math.min(config.MAX_SCALE, state.scale * delta)
        );

        if (newScale === state.scale) return;

        const scaleDiff = newScale - state.scale;
        const panXDelta = (centerX - state.panX) * scaleDiff / state.scale;
        const panYDelta = (centerY - state.panY) * scaleDiff / state.scale;

        animateZoom(
            newScale,
            state.panX - panXDelta,
            state.panY - panYDelta,
            rect
        );
    } catch (error) {
        console.error('Error zooming:', error);
    }
};