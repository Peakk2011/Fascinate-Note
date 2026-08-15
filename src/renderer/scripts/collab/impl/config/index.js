export const DEFAULTS = {
    serverUrl: 'ws://localhost:1234',
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

    if (!config.serverUrl) config.serverUrl = DEFAULTS.serverUrl;
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