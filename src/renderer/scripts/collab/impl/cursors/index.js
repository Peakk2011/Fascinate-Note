/**
 * @fileoverview Real-time collaboration cursor rendering module.
 * Handles rendering of remote users' text carets and mouse pointers
 */

import { createRangeFromOffset } from '../selection/index.js';
import { TEXT_COLLAB_POINTER_COLOR } from '@collab-impl/identity';

/**
 * Default user configuration
 * @constant
 * @type {Object}
 */
const DEFAULT_USER = {
    name: 'User',
    color: '#979daa',
    textColor: TEXT_COLLAB_POINTER_COLOR
};

const POINTER_LERP = 0.35;
const POINTER_IDLE_MS = 4000;
const RESERVED_CORNER_WIDTH = 140;
const RESERVED_CORNER_HEIGHT = 70;

/**
 * @param {HTMLElement} overlay         - The overlay container element
 * @param {Object} user                 - User configuration
 * @param {string} user.name            - User's display name
 * @param {string} user.color           - User's color
 * @param {string} [user.textColor]     - Optional text color override
 * @returns {Object} 
 * @returns {HTMLElement} returns.caret 
 * @returns {HTMLElement} returns.pointerDot
 * @returns {HTMLElement} returns.pointerLabel
 */
export const createCursorElements = (overlay, user) => {
    const caret = document.createElement('div');
    caret.className = 'collab-caret';
    caret.style.backgroundColor = user.color;
    overlay.appendChild(caret);

    const pointerDot = document.createElement('div');
    pointerDot.className = 'collab-pointer-dot';
    pointerDot.style.backgroundColor = user.color;

    const pointerLabel = document.createElement('div');
    pointerLabel.className = 'collab-pointer-label';
    pointerLabel.style.backgroundColor = user.color;
    pointerLabel.style.color = user.textColor || TEXT_COLLAB_POINTER_COLOR;
    pointerLabel.textContent = user.name || 'User';

    overlay.appendChild(pointerDot);
    overlay.appendChild(pointerLabel);

    return { caret, pointerDot, pointerLabel };
};

// Creates a cursor renderer for managing remote user cursors
export const createCursorRenderer = ({
    editor,
    overlayState,
    awareness,
    doc,
    isDestroyed
} = {}) => {
    // Map of clientId -> DOM elements for each remote user
    const cursorMap = new Map();
    
    // Map of clientId -> pointer animation state
    const pointerState = new Map();
    
    let renderRaf = null;
    let tickRaf = null;

    /**
     * Updates caret positions, pointer dots, and labels
     * @private
     */
    const renderRemoteCursors = () => {
        if (!overlayState) return;
        if (isDestroyed?.()) return;

        const { overlay, container } = overlayState;
        const containerRect = container.getBoundingClientRect();
        const states = awareness.getStates();
        const seen = new Set();

        states.forEach((state, clientId) => {
            if (clientId === doc.clientID) return;

            const user = state?.user || DEFAULT_USER;
            const cursor = state?.cursor;
            const pointer = state?.pointer;

            // Create or update cursor elements for this user
            let elements = cursorMap.get(clientId);
            if (!elements) {
                elements = createCursorElements(overlay, user);
                cursorMap.set(clientId, elements);
            } else {
                elements.pointerLabel.textContent = user.name || 'User';
                elements.caret.style.backgroundColor = user.color || DEFAULT_USER.color;
                elements.pointerDot.style.backgroundColor = user.color || DEFAULT_USER.color;
                elements.pointerLabel.style.backgroundColor = user.color || DEFAULT_USER.color;
                elements.pointerLabel.style.color = user.textColor || TEXT_COLLAB_POINTER_COLOR;
            }

            // Render text caret->Thin line only, no name label
            if (!cursor || typeof cursor.start !== 'number') {
                elements.caret.style.display = 'none';
            } else {
                const range = createRangeFromOffset(editor, cursor.start);
                const rect = range.getClientRects()[0] || range.getBoundingClientRect();

                if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) {
                    elements.caret.style.display = 'none';
                } else {
                    const left = rect.left - containerRect.left;
                    const top = rect.top - containerRect.top;
                    const height = Math.max(14, rect.height || 14);

                    elements.caret.style.display = 'block';
                    elements.caret.style.height = `${height}px`;
                    elements.caret.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
                }
            }

            // Render mouse pointer
            const isStale = !pointer || (Date.now() - (pointer.ts || 0) > POINTER_IDLE_MS);
            if (isStale) {
                elements.pointerDot.style.display = 'none';
                elements.pointerLabel.style.display = 'none';
                pointerState.delete(clientId);
            } else {
                const screenX = pointer.x - container.scrollLeft;
                const screenY = pointer.y - container.scrollTop;

                const containerWidth = containerRect.width;
                const containerHeight = containerRect.height;

                const isOffScreen =
                    screenX < 0 || screenY < 0 ||
                    screenX > containerWidth || screenY > containerHeight;

                const isInReservedCorner =
                    screenX > containerWidth - RESERVED_CORNER_WIDTH &&
                    screenY > containerHeight - RESERVED_CORNER_HEIGHT;

                if (isOffScreen || isInReservedCorner) {
                    elements.pointerDot.style.display = 'none';
                    elements.pointerLabel.style.display = 'none';
                    pointerState.delete(clientId);
                } else {
                    let p = pointerState.get(clientId);
                    if (!p) {
                        p = {
                            x: screenX,
                            y: screenY,
                            targetX: screenX,
                            targetY: screenY
                        };
                        pointerState.set(clientId, p);
                    } else {
                        p.targetX = screenX;
                        p.targetY = screenY;
                    }

                    elements.pointerDot.style.display = 'block';
                    elements.pointerLabel.style.display = 'block';
                    elements.pointerDot.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
                    elements.pointerLabel.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
                }
            }

            seen.add(clientId);
        });

        cursorMap.forEach((elements, clientId) => {
            if (seen.has(clientId)) return;
            elements.caret.remove();
            elements.pointerDot.remove();
            elements.pointerLabel.remove();
            cursorMap.delete(clientId);
        });
    };

    /**
     * Continuous easing loop for smooth pointer animation
     * @private
     */
    const tick = () => {
        tickRaf = null;
        if (isDestroyed?.()) return;

        let anyMoving = false;
        pointerState.forEach((p) => {
            p.x += (p.targetX - p.x) * POINTER_LERP;
            p.y += (p.targetY - p.y) * POINTER_LERP;
            if (Math.abs(p.targetX - p.x) > 0.1 || Math.abs(p.targetY - p.y) > 0.1) {
                anyMoving = true;
            }
        });

        renderRemoteCursors();

        if (anyMoving || pointerState.size > 0) {
            tickRaf = requestAnimationFrame(tick);
        }
    };

    /**
     * Schedules a render pass on the next animation frame
     * @public
     */
    const scheduleRender = () => {
        if (!overlayState) return;
        if (renderRaf) return;
        renderRaf = requestAnimationFrame(() => {
            renderRaf = null;
            renderRemoteCursors();
            if (!tickRaf && pointerState.size > 0) {
                tickRaf = requestAnimationFrame(tick);
            }
        });
    };

    /**
     * Cleans up all resources and removes cursor elements
     * @public
     */
    const destroy = () => {
        if (renderRaf) {
            cancelAnimationFrame(renderRaf);
            renderRaf = null;
        }
        if (tickRaf) {
            cancelAnimationFrame(tickRaf);
            tickRaf = null;
        }

        cursorMap.forEach((elements) => {
            elements.caret.remove();
            elements.pointerDot.remove();
            elements.pointerLabel.remove();
        });
        cursorMap.clear();
        pointerState.clear();
    };

    return {
        scheduleRender,
        renderRemoteCursors,
        destroy
    };
};