/**
 * @fileoverview Real-time collaboration cursor styling module.
 * Handles rendering user cursor badge colors
 */
// Colors for @selector .collab-pointer-label
const COLOR_PALETTE = [
    '#FFD1DC',      // Pink
    '#FFDAB9',      // Peach
    '#FFFACD',      // Yellow
    '#CFFFE5',      // Mint
    '#BDE0FE',      // Sky Blue
    '#E4C1F9',      // Lavender
    '#FFF8DC'       // Cream
];

export const TEXT_COLLAB_POINTER_COLOR = '#000000';

const hashToIndex = (id, length) => {
    const str = String(id);
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0;
    }

    return Math.abs(hash) % length;
};

export const getOrCreateUserIdentity = (clientId, overrides = {}) => {
    // session-stroage keys = fascinate-collab-user-session 
    const key = 'fascinate-collab-user-session';
    let stored = null;

    try {
        stored = JSON.parse(sessionStorage.getItem(key));
    } catch {
        stored = null;
    }

    const storedColorIsValid = stored?.color
        && COLOR_PALETTE.includes(stored.color);

    const fallbackName = `User ${String(clientId).slice(-4)}`;
    const colorIndex = hashToIndex(clientId, COLOR_PALETTE.length);
    const fallbackColor = COLOR_PALETTE[colorIndex];

    const name = overrides.name
        || stored?.name
        || fallbackName;

    const color = overrides.color
        || (storedColorIsValid ? stored.color : null)
        || fallbackColor;

    const textColor = overrides.textColor
        || stored?.textColor
        || TEXT_COLLAB_POINTER_COLOR;

    try {
        sessionStorage.setItem(key, JSON.stringify({
            name,
            color,
            textColor
        }));
    } catch {
        // Ignore storage errors.
    }

    return {
        id: clientId,
        name,
        color,
        textColor
    };
};