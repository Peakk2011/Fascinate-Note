// YProvider expects a host and a separate protocol, not a WebSocket URL.
export const resolveCollabEndpoint = (serverUrl) => {
    const value = String(serverUrl || '').trim();
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)
        || url.username || url.password || url.search || url.hash
        || url.pathname !== '/') {
        throw new Error('Collaboration server must be an HTTP(S) or WS(S) origin without a path');
    }

    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    // Public endpoints always use TLS. Explicit TLS also works for local testing.
    const secure = !local || ['https:', 'wss:'].includes(url.protocol);
    return { host: url.host, protocol: secure ? 'wss' : 'ws' };
};
