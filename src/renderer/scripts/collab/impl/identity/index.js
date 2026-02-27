export const getOrCreateUserIdentity = (clientId, overrides = {}) => {
    const key = 'fascinate-collab-user-session';
    let stored = null;

    try {
        stored = JSON.parse(sessionStorage.getItem(key));
    } catch {
        stored = null;
    }

    const fallbackName = `User ${String(clientId).slice(-4)}`;
    const fallbackColor = `hsl(${clientId % 360}, 70%, 55%)`;

    const name = overrides.name || stored?.name || fallbackName;
    const color = overrides.color || stored?.color || fallbackColor;

    try {
        sessionStorage.setItem(key, JSON.stringify({ name, color }));
    } catch {
        // Ignore storage errors.
    }

    return { id: clientId, name, color };
};