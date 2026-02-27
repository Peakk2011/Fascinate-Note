import { getSelectionOffsets } from '../selection/index.js';

export const createAwarenessScheduler = ({ editor, awareness, scheduleRender, isDestroyed } = {}) => {
    let awarenessRaf = null;

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

    const destroy = () => {
        if (awarenessRaf) {
            cancelAnimationFrame(awarenessRaf);
            awarenessRaf = null;
        }
    };

    return { scheduleAwarenessUpdate, destroy };
};