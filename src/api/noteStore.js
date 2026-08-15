const STORAGE_KEYS = {
    notes: 'markerNotes',
    currentNoteId: 'markerCurrentNoteId',
    fontSize: 'markerFontSize'
};

const DEFAULT_FONT_SIZE = 16;

// Utilities
const safeParse = (value, fallback) => {
    if (!value) return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
};

const saveToStorage = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
};

// Note management
const createId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const loadNotes = () => {
    const notes = safeParse(localStorage.getItem(STORAGE_KEYS.notes), []);
    return notes;
};

const saveNotes = (notes) => {
    saveToStorage(STORAGE_KEYS.notes, notes);
};

// Notes CRUD operations
export const createNote = ({ title = 'Untitled', html = '', tags = [] } = {}) => {
    const notes = loadNotes();
    const newNote = {
        id: createId(),
        title,
        html,
        tags,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    notes.push(newNote);
    saveNotes(notes);
    return newNote;
};

export const getNoteById = (id) => {
    const notes = loadNotes();
    return notes.find(note => note.id === id);
};

export const updateNote = (id, updates) => {
    const notes = loadNotes();
    const index = notes.findIndex(note => note.id === id);
    if (index === -1) return null;
    
    notes[index] = {
        ...notes[index],
        ...updates,
        updatedAt: Date.now()
    };
    saveNotes(notes);
    return notes[index];
};

export const deleteNote = (id) => {
    const notes = loadNotes();
    const filtered = notes.filter(note => note.id !== id);
    saveNotes(filtered);
    
    if (getCurrentNoteId() === id) {
        localStorage.removeItem(STORAGE_KEYS.currentNoteId);
    }
};

export const getAllNotes = () => {
    return loadNotes();
};

export const searchNotes = (query) => {
    const notes = loadNotes();
    const searchTerm = query.toLowerCase();
    return notes.filter(note => 
        note.title.toLowerCase().includes(searchTerm) || 
        note.html.toLowerCase().includes(searchTerm)
    );
};

// Current note management
export const setCurrentNoteId = (id) => {
    if (id) {
        localStorage.setItem(STORAGE_KEYS.currentNoteId, id);
    } else {
        localStorage.removeItem(STORAGE_KEYS.currentNoteId);
    }
};

export const getCurrentNoteId = () => {
    return localStorage.getItem(STORAGE_KEYS.currentNoteId) || null;
};

export const getCurrentNote = () => {
    const id = getCurrentNoteId();
    return id ? getNoteById(id) : null;
};

// Font size management
export const setFontSize = (size) => {
    const fontSize = Math.max(10, Math.min(32, parseInt(size) || DEFAULT_FONT_SIZE));
    localStorage.setItem(STORAGE_KEYS.fontSize, fontSize);
    return fontSize;
};

export const getFontSize = (defaultSize = DEFAULT_FONT_SIZE) => {
    const size = localStorage.getItem(STORAGE_KEYS.fontSize);
    return size ? parseInt(size) : defaultSize;
};

// Import/Export
export const exportNotes = () => {
    const notes = loadNotes();
    const data = {
        version: '1.3',
        exportDate: Date.now(),
        notes
    };
    return JSON.stringify(data, null, 2);
};

export const importNotes = (jsonString) => {
    try {
        const data = JSON.parse(jsonString);
        if (data.version && data.notes && Array.isArray(data.notes)) {
            const existingNotes = loadNotes();
            const newNotes = [...existingNotes, ...data.notes];
            saveNotes(newNotes);
            return true;
        }
    } catch (e) {
        console.error('Failed to import notes:', e);
    }
    return false;
};