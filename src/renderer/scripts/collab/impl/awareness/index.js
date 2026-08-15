import { getSelectionOffsets } from '../selection/index.js';

export const createAwarenessScheduler = ({ editor, awareness, scheduleRender, isDestroyed } = {}) => {
    let awarenessRaf = null;
    let pointerRaf = null;

    const scheduleAwarenessUpdate = () => {
        if (awarenessRaf) return;
        awarenessRaf = requestAnimationFrame(() => {
            awarenessRaf = null;
            if (isDestroyed?.()) return;

            const offsets = getSelectionOffsets(editor);
            awareness.setLocalStateField('cursor', offsets || null);
        
            if (scheduleRender) {
                scheduleRender();
            }
        });
    };

    // Mouse pointer broadcast
    const schedulePointerUpdate = (clientX, clientY, container) => {
        if (pointerRaf) {
            return;
        }
        
        pointerRaf = requestAnimationFrame(() => {
            pointerRaf = null;
            if (isDestroyed?.() || !container) {
                return;
            }

            const rect = container.getBoundingClientRect();
            const x = clientX - rect.left + container.scrollLeft;
            const y = clientY - rect.top + container.scrollTop;

            awareness.setLocalStateField('pointer', {
                x, y, ts: Date.now()
            });
            
            if (scheduleRender) {
                scheduleRender();
            }
        });
    };

    const clearPointer = () => {
        awareness.setLocalStateField('pointer', null);
        if (scheduleRender) scheduleRender();
    };

    const destroy = () => {
        if (awarenessRaf) {
            cancelAnimationFrame(awarenessRaf);
            awarenessRaf = null;
        }
        if (pointerRaf) {
            cancelAnimationFrame(pointerRaf);
            pointerRaf = null;
        }
    };

    return {
        scheduleAwarenessUpdate,
        schedulePointerUpdate,
        clearPointer,
        destroy
    };
};