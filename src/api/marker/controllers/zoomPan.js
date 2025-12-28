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

// Animation state
/** @type {ZoomState} */
const zoomState = {
    targetScale: 1,
    currentScale: 1,
    targetPanX: 0,
    targetPanY: 0,
    currentPanX: 0,
    currentPanY: 0,
    animationFrame: null,
    isAnimating: false
};

// Constants
const ANIMATION_DURATION = 200;             // milliseconds
const ANIMATION_EASING = 0.15;              // Smoothing factor (0-1, higher = faster)
const EPSILON = 0.001;                      // Threshold for stopping animation
const HALF = 0.5;

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
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

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
 * @param {number} targetScale              - Target zoom scale
 * @param {number} targetPanX               - Target pan X position
 * @param {number} targetPanY               - Target pan Y position
 * @param {DOMRect} rect                    - Container bounding rect
 * @returns {void}
 */
const animateZoom = (targetScale, targetPanX, targetPanY, rect) => {
    try {
        const state = getState();

        zoomState.targetScale = targetScale;
        zoomState.targetPanX = targetPanX;
        zoomState.targetPanY = targetPanY;
        zoomState.currentScale = state.scale;
        zoomState.currentPanX = state.panX;
        zoomState.currentPanY = state.panY;

        if (!zoomState.isAnimating) {
            zoomState.isAnimating = true;
            startAnimation(rect);
        }
    } catch (error) {
        console.error('Error animating zoom:', error);
    }
};

/**
 * Animates pan to target position
 * @param {number} targetPanX               - Target pan X position
 * @param {number} targetPanY               - Target pan Y position
 * @param {DOMRect} rect                    - Container bounding rect
 * @returns {void}
 */
const animatePan = (targetPanX, targetPanY, rect) => {
    try {
        const state = getState();

        zoomState.targetScale = state.scale;
        zoomState.targetPanX = targetPanX;
        zoomState.targetPanY = targetPanY;
        zoomState.currentScale = state.scale;
        zoomState.currentPanX = state.panX;
        zoomState.currentPanY = state.panY;

        if (!zoomState.isAnimating) {
            zoomState.isAnimating = true;
            startAnimation(rect);
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
const startAnimation = (rect) => {
    try {
        const animate = () => {
            try {
                const state = getState();

                // Calculate interpolation
                const scaleDiff = zoomState.targetScale - zoomState.currentScale;
                const panXDiff = zoomState.targetPanX - zoomState.currentPanX;
                const panYDiff = zoomState.targetPanY - zoomState.currentPanY;

                // Check if animation should stop
                const isComplete =
                    Math.abs(scaleDiff) < EPSILON &&
                    Math.abs(panXDiff) < EPSILON &&
                    Math.abs(panYDiff) < EPSILON;

                if (isComplete) {
                    // Snap to final values
                    state.scale = zoomState.targetScale;
                    state.panX = zoomState.targetPanX;
                    state.panY = zoomState.targetPanY;

                    constrainPan(rect);
                    updateViewTransform();

                    zoomState.isAnimating = false;
                    zoomState.animationFrame = null;
                    return;
                }

                // Apply easing
                zoomState.currentScale += scaleDiff * ANIMATION_EASING;
                zoomState.currentPanX += panXDiff * ANIMATION_EASING;
                zoomState.currentPanY += panYDiff * ANIMATION_EASING;

                // Update state
                state.scale = zoomState.currentScale;
                state.panX = zoomState.currentPanX;
                state.panY = zoomState.currentPanY;

                constrainPan(rect);
                updateViewTransform();

                // Continue animation
                zoomState.animationFrame = requestAnimationFrame(animate);
            } catch (error) {
                console.error('Error in animation frame:', error);

                zoomState.isAnimating = false;
                zoomState.animationFrame = null;
            }
        };

        // Cancel existing animation
        if (zoomState.animationFrame !== null) {
            cancelAnimationFrame(zoomState.animationFrame);
        }

        zoomState.animationFrame = requestAnimationFrame(animate);
    } catch (error) {
        console.error('Error starting animation:', error);
    }
};

/**
 * Constrains pan within bounds
 * @param {DOMRect} containerRect           - Container bounding rect
 * @returns {void}
 */
const constrainPan = (containerRect) => {
    try {
        const state = getState();

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
        const centerX = state.lastMouseX;
        const centerY = state.lastMouseY;

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
        const centerX = state.lastMouseX;
        const centerY = state.lastMouseY;

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