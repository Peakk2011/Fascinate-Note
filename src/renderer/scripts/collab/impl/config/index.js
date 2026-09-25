export const DEFAULTS = {
    serverUrl: '',
    room: 'fascinate-notes',
    mapName: 'note',
    debounceMs: 120,
    connectionTimeoutMs: 2000,
    autoDisableOnFail: true
};

export const ensureConfig = (options = {}) => {
    const config = {
        ...DEFAULTS,
        ...(options || {})
    };

    if (!config.serverUrl) {
        const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        config.serverUrl = isLocalHost
            ? 'http://127.0.0.1:8787'
            : window.location.origin;
    }
    if (!config.room) config.room = DEFAULTS.room;
    if (!config.mapName) config.mapName = DEFAULTS.mapName;

    if (!Number.isFinite(config.debounceMs)) {
        config.debounceMs = DEFAULTS.debounceMs;
    }
    if (!Number.isFinite(config.connectionTimeoutMs)) {
        config.connectionTimeoutMs = DEFAULTS.connectionTimeoutMs;
    }
    if (typeof config.autoDisableOnFail !== 'boolean') {
        config.autoDisableOnFail = DEFAULTS.autoDisableOnFail;
    }

    return config;
};