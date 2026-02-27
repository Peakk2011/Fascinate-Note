import { createRangeFromOffset } from '../selection/index.js';

const DEFAULT_USER = { name: 'User', color: '#6b7280' };

export const createCursorElements = (overlay, user) => {
    const caret = document.createElement('div');
    caret.className = 'collab-caret';
    caret.style.backgroundColor = user.color;

    const label = document.createElement('div');
    label.className = 'collab-label';
    label.style.backgroundColor = user.color;
    label.textContent = user.name || 'User';

    overlay.appendChild(caret);
    overlay.appendChild(label);

    return { caret, label };
};

export const createCursorRenderer = ({ editor, overlayState, awareness, doc, isDestroyed } = {}) => {
    const cursorMap = new Map();
    let renderRaf = null;

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
            const cursor = state?.cursor

            let elements = cursorMap.get(clientId);
            if (!elements) {
                elements = createCursorElements(overlay, user);
                cursorMap.set(clientId, elements);
            } else {
                elements.label.textContent = user.name || 'User';
                
                elements.label.style.backgroundColor = user.color || DEFAULT_USER.color;
                elements.caret.style.backgroundColor = user.color || DEFAULT_USER.color;
            }

            if (!cursor || typeof cursor.start !== 'number') {
                elements.caret.style.display = 'none';
                elements.label.style.display = 'none';
                seen.add(clientId);
                return;
            }

            const range = createRangeFromOffset(editor, cursor.start);
            const rect = range.getClientRects()[0] || range.getBoundingClientRect();

            if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) {
                elements.caret.style.display = 'none';
                elements.label.style.display = 'none';
                seen.add(clientId);
                return;
            }

            const left = rect.left - containerRect.left;
            const top = rect.top - containerRect.top;
            const height = Math.max(14, rect.height || 14);

            elements.caret.style.display = 'block';
            elements.label.style.display = 'block';

            elements.caret.style.height = `${height}px`;
            
            elements.caret.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
            elements.label.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;

            seen.add(clientId);
        });

        cursorMap.forEach((elements, clientId) => {
            if (seen.has(clientId)) return;
            elements.caret.remove();
            elements.label.remove();
            cursorMap.delete(clientId);
        });
    };

    const scheduleRender = () => {
        if (!overlayState) return;
        if (renderRaf) return;
        renderRaf = requestAnimationFrame(() => {
            renderRaf = null;
            renderRemoteCursors();
        });
    };

    const destroy = () => {
        if (renderRaf) {
            cancelAnimationFrame(renderRaf);
            renderRaf = null;
        }

        cursorMap.forEach((elements) => {
            elements.caret.remove();
            elements.label.remove();
        });
        cursorMap.clear();
    };

    return { scheduleRender, renderRemoteCursors, destroy };
};