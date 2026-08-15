import { createNote, getNoteById, getCurrentNoteId } from '../sharedNoteStore.js';
import {
    htmlToText,
    truncateText,
    sanitizePreviewHtml
} from './utils.js';
import { getState } from '../utils/config.js';

const logPreviewDebug = (message, details = {}) => {
    // console.log('[MarkerPreview]', message, details);
};

const getLegacyMarkerNoteById = (id) => {
    if (!id) return null;
    try {
        const raw = localStorage.getItem('markerNotes');
        if (!raw) return null;
        const notes = JSON.parse(raw);
        if (!Array.isArray(notes)) return null;
        return notes.find((note) => note && note.id === id) || null;
    } catch {
        return null;
    }
};

/**
 * Refreshes the preview content of a window.
 * @param {object} win - The window object to refresh.
 */
export const refreshWindowPreview = (win) => {
    if (win.type === 'comment') {
        logPreviewDebug('Skipped preview refresh for comment window', {
            windowId: win.id
        });
        return;
    }
    if (!win.noteId) {
        const note = createNote({ title: win.title || 'New Note' });
        win.noteId = note?.id ?? null;
        logPreviewDebug('Created missing note for preview window', {
            windowId: win.id,
            noteId: win.noteId
        });
    }
    if (!win.noteId) return;

    let note = getNoteById(win.noteId);
    if (!note) {
        const legacy = getLegacyMarkerNoteById(win.noteId);
        const fallback = createNote({
            title: legacy?.title || win.title || 'New Note',
            html: legacy?.html || ''
        });
        if (!fallback?.id) return;
        win.noteId = fallback.id;
        note = fallback;
        logPreviewDebug('Recovered preview note from legacy/fallback data', {
            windowId: win.id,
            noteId: win.noteId
        });
    }

    if (note) {
        const safeHtml = sanitizePreviewHtml(note.html || '');
        win.title = note.title || win.title;
        win.previewHtml = safeHtml;
        win.content = truncateText(htmlToText(safeHtml), 260);
        logPreviewDebug('Preview refreshed', {
            windowId: win.id,
            noteId: win.noteId,
            title: win.title,
            contentLength: win.content.length
        });
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
    
    const note = createNote({
        title: 'Current Notes'
    });
    
    const state = getState();

    // CURRENT NOTES SIZES *
    const width = 300;
    const height = 280;
    const canvasWidth = state?.canvasWidth || 7680;
    const canvasHeight = state?.canvasHeight || 4320;

    const centeredX = Math.max(0, Math.floor((canvasWidth - width) / 2));
    const centeredY = Math.max(0, Math.floor((canvasHeight - height) / 2));

    const current = {
        id: `win_${crypto.randomUUID?.() || Date.now().toString(36)}`,
        title: 'Current Notes',
        previewHtml: '',
        content: '',
        x: centeredX, y: centeredY,
        width, height,
        color: '#7aa5ff',
        groupId: null,
        isCurrent: false,
        noteId: note?.id ?? getCurrentNoteId()
    };
    windows.unshift(current);
};