import { createNote, getNoteById, getCurrentNoteId } from '../../noteStore.js';
import { htmlToText, truncateText } from './utils.js';

/**
 * Refreshes the preview content of a window.
 * @param {object} win - The window object to refresh.
 */
export const refreshWindowPreview = (win) => {
    if (!win.noteId) {
        const note = createNote({ title: win.title || 'New Note' });
        win.noteId = note?.id ?? null;
    }
    if (!win.noteId) return;
    
    const note = getNoteById(win.noteId);
    if (note) {
        win.title = note.title || win.title;
        win.content = truncateText(htmlToText(note.html), 260);
    }
};

/**
 * Refreshes the preview content for all windows.
 * @param {Array<object>} windows - The array of window objects.
 */
export const refreshAllPreviews = (windows) => {
    windows.forEach(refreshWindowPreview);
};

/**
 * Ensures that there is at least one window, creating one if needed.
 * @param {Array<object>} windows - The array of window objects.
 */
export const ensureCurrentWindow = (windows) => {
    if (windows.length > 0) return;
    
    const note = createNote({ title: 'Current Notes' });
    const current = {
        id: `win_${crypto.randomUUID?.() || Date.now().toString(36)}`,
        title: 'Current Notes',
        content: '',
        x: 360, y: 260,
        width: 360, height: 220,
        color: '#7aa5ff',
        groupId: null,
        isCurrent: false,
        noteId: note?.id ?? getCurrentNoteId()
    };
    windows.unshift(current);
};