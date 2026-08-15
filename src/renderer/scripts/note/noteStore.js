const STORE_KEY = 'fascinateNotesStore';
const SETTINGS_KEY = 'fascinateNotesSettings';
const LEGACY_KEY = 'editorContent';
const DEFAULT_TITLE = 'New Note';

const SOFT_MAX_HTML_CHARS = 1000000;

const safeParse = (value, fallback) => {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const createId = () => {
    // crypto.randomUUID() is available in modern browsers
    // Falls back to  timestamp + random for older environments
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `note_${crypto.randomUUID()}`;
    }
    // Fallback: timestamp + random bytes (virtually collision-free)
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 15);
    return `note_${timestamp}_${random}`;
};

const normalizeTitle = (title) => {
    if (typeof title !== 'string') return DEFAULT_TITLE;

    const trimmed = title.replace(/\s+/g, ' ').trim();
    if (!trimmed.length) return DEFAULT_TITLE;

    const arr = [...trimmed];
    return arr.slice(0, 80).join('');
};

const createNoteData = ({ title, html } = {}) => ({
    id: createId(),
    title: normalizeTitle(title),
    html: typeof html === 'string' ? html : '',
    createdAt: Date.now(),
    updatedAt: Date.now()
});

let storeCache = null;
let settingsCache = null;

if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('storage', (e) => {
        if (e.key === STORE_KEY) {
            storeCache = null;
        }
    });
}

const persistStore = () => {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(storeCache));
        return true;
    } catch (err) {
        if (err instanceof DOMException && err.name === 'QuotaExceededError') {
            console.warn('Note store persist failed: quota exceeded');
        } else {
            console.error('Error persisting note store:', err);
        }
        return false;
    }
};

const persistSettings = () => {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsCache));
    } catch {
        // Ignore storage errors.
    }
};

const ensureStore = () => {
    if (storeCache) return storeCache;
    const loaded = safeParse(localStorage.getItem(STORE_KEY), null);
    const store = {
        version: 1,
        currentNoteId: null,
        notes: []
    };

    if (loaded && Array.isArray(loaded.notes)) {
        store.version = loaded.version || 1;
        store.currentNoteId = loaded.currentNoteId || null;
        store.notes = loaded.notes.filter((note) => note && typeof note.id === 'string');
    }

    if (!store.notes.length) {
        const legacy = safeParse(localStorage.getItem(LEGACY_KEY), null);
        const legacyHtml = legacy && typeof legacy.text === 'string' ? legacy.text : '';
        const note = createNoteData({ title: DEFAULT_TITLE, html: legacyHtml });
        store.notes.push(note);
        store.currentNoteId = note.id;
        // once migrated, clear legacy to avoid repeated import
        try { localStorage.removeItem(LEGACY_KEY); } catch {};
    }

    if (!store.currentNoteId || !store.notes.find((note) => note.id === store.currentNoteId)) {
        store.currentNoteId = store.notes[0]?.id || null;
    }

    storeCache = store;
    persistStore();
    return storeCache;
};

const ensureSettings = (fallbackFontSize) => {
    if (settingsCache) return settingsCache;
    const loaded = safeParse(localStorage.getItem(SETTINGS_KEY), null);
    settingsCache = loaded && typeof loaded === 'object' ? loaded : {};

    if (typeof settingsCache.fontSize !== 'number') {
        const legacy = safeParse(localStorage.getItem(LEGACY_KEY), null);
        if (legacy && typeof legacy.fontSize === 'number') {
            settingsCache.fontSize = legacy.fontSize;
        } else if (typeof fallbackFontSize === 'number') {
            settingsCache.fontSize = fallbackFontSize;
        }
    }

    persistSettings();
    return settingsCache;
};

const copyNote = (note) => (note ? { ...note } : null);

export const listNotes = () => {
    const store = ensureStore();
    return store.notes.map((note) => ({ ...note }));
};

export const getNoteById = (id) => {
    if (!id) return null;
    const store = ensureStore();
    return copyNote(store.notes.find((note) => note.id === id));
};

export const getCurrentNoteId = () => ensureStore().currentNoteId;

export const getCurrentNote = () => getNoteById(getCurrentNoteId());

export const setCurrentNoteId = (id) => {
    if (!id) return null;
    const store = ensureStore();
    const exists = store.notes.find((note) => note.id === id);
    if (!exists) return null;
    store.currentNoteId = id;
    persistStore();
    return copyNote(exists);
};

export const createNote = ({ title, html } = {}) => {
    const store = ensureStore();
    const note = createNoteData({ title, html });
    store.notes.push(note);
    if (!store.currentNoteId) {
        store.currentNoteId = note.id;
    }
    persistStore();
    return copyNote(note);
};

export const updateNote = (id, updates = {}) => {
    if (!id) return null;
    const store = ensureStore();
    const note = store.notes.find((item) => item.id === id);
    if (!note) return null;

    if (typeof updates.title === 'string') {
        note.title = normalizeTitle(updates.title);
    }
    if (typeof updates.html === 'string') {
        if (updates.html.length > SOFT_MAX_HTML_CHARS) {
            console.warn('updateNote: html exceeds recommended size, storing full html to avoid breaking rich content');
        }
        // Never hard-truncate the HTML
        note.html = updates.html;
    }

    note.updatedAt = Date.now();
    persistStore();
    return copyNote(note);
};

export const deleteNote = (id) => {
    const store = ensureStore();
    const index = store.notes.findIndex((note) => note.id === id);
    if (index === -1) {
        return { deleted: null, currentNoteId: store.currentNoteId };
    }

    const [deleted] = store.notes.splice(index, 1);

    if (store.currentNoteId === id) {
        store.currentNoteId = store.notes[0]?.id || null;
    }

    let newNote = null;
    if (!store.notes.length) {
        const note = createNoteData();
        store.notes.push(note);
        store.currentNoteId = note.id;
        newNote = note;
    }

    persistStore();
    return {
        deleted: copyNote(deleted),
        currentNoteId: store.currentNoteId,
        newNote: newNote ? copyNote(newNote) : null
    };
};

export const getFontSize = (fallbackFontSize) => {
    const settings = ensureSettings(fallbackFontSize);
    return settings.fontSize ?? fallbackFontSize;
};

export const setFontSize = (size) => {
    const settings = ensureSettings(size);
    settings.fontSize = size;
    persistSettings();
};