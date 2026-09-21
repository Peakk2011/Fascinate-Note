import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import YProvider from 'y-partyserver/provider';
import WebSocket from 'ws';
import { resolveCollabEndpoint } from '../../src/renderer/scripts/collab/impl/config/endpoint.js';

test('public origins always use WSS and loopback supports local development', () => {
    for (const input of ['https://notes.workers.dev', 'ws://notes.workers.dev', 'notes.workers.dev']) {
        assert.deepEqual(resolveCollabEndpoint(input), { host: 'notes.workers.dev', protocol: 'wss' });
    }
    for (const host of ['localhost:8787', '127.0.0.1:8787', '[::1]:8787']) {
        assert.deepEqual(resolveCollabEndpoint(`http://${host}/`), { host, protocol: 'ws' });
    }
    assert.equal(resolveCollabEndpoint('https://localhost:8787').protocol, 'wss');
});

test('invalid endpoints fail before creating a connection', () => {
    for (const input of ['', 'file:///tmp/server', 'https://user:pass@example.com',
        'https://example.com/room', 'https://example.com?token=secret', 'https://example.com/#room']) {
        assert.throws(() => resolveCollabEndpoint(input));
    }
});

test('provider uses the Worker binding route and keeps leading zeroes in room codes', () => {
    const endpoint = resolveCollabEndpoint('https://notes.workers.dev');
    const doc = new Y.Doc();
    const provider = new YProvider(endpoint.host, '001234', doc, {
        protocol: endpoint.protocol, party: 'collab-room', connect: false,
        disableBc: true, WebSocketPolyfill: WebSocket
    });
    try {
        assert.equal(provider.url, 'wss://notes.workers.dev/parties/collab-room/001234');
    } finally {
        provider.destroy();
        doc.destroy();
    }
});
