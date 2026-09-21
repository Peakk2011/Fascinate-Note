import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import * as Y from 'yjs';
import YProvider from 'y-partyserver/provider';
import WebSocket from 'ws';

const waitFor = async (predicate, message) => {
    const deadline = Date.now() + 10000;
    while (!predicate()) {
        if (Date.now() > deadline) throw new Error(message);
        await delay(25);
    }
};

test('Worker syncs peers, isolates rooms, and restores large and empty documents after restart',
    { timeout: 90000 }, async () => {
        const directory = await mkdtemp(join(tmpdir(), 'fascinate-collab-test-'));
        process.env.WRANGLER_SEND_METRICS = 'false';
        process.env.XDG_CONFIG_HOME = join(directory, 'config');
        const { unstable_dev } = await import('wrangler');
        let worker;
        const clients = new Set();
        const start = async () => {
            worker = await unstable_dev(resolve('workers/collab/index.js'), {
                config: resolve('workers/collab/wrangler.jsonc'),
                ip: '127.0.0.1', port: 0, inspectorPort: 0,
                local: true, persist: true, persistTo: join(directory, 'storage'),
                logLevel: 'error',
                experimental: { disableExperimentalWarning: true, disableDevRegistry: true, watch: false }
            });
        };
        const connect = async (room) => {
            const doc = new Y.Doc();
            const provider = new YProvider(`127.0.0.1:${worker.port}`, room, doc, {
                party: 'collab-room', protocol: 'ws', disableBc: true,
                WebSocketPolyfill: WebSocket
            });
            const client = { doc, provider, text: doc.getText('note') };
            clients.add(client);
            await waitFor(() => provider.synced, 'Client did not sync');
            return client;
        };
        const close = (client) => {
            client.provider.destroy();
            client.doc.destroy();
            clients.delete(client);
        };
        try {
            await start();
            assert.equal((await (await worker.fetch('/health')).json()).status, 'ok');
            assert.equal((await worker.fetch('/missing')).status, 404);
            assert.equal((await worker.fetch('/parties/collab-room/001234')).status, 426);

            const owner = await connect('001234');
            const guest = await connect('001234');
            const otherRoom = await connect('654321');
            owner.text.insert(0, 'Hello');
            await waitFor(() => guest.text.toString() === 'Hello', 'Owner edits did not reach guest');
            guest.text.insert(5, ' สวัสดี');
            await waitFor(() => owner.text.toString() === 'Hello สวัสดี', 'Guest edits did not reach owner');
            assert.equal(otherRoom.text.length, 0);
            owner.provider.awareness.setLocalStateField('user', { name: 'Owner' });
            await waitFor(() => Array.from(guest.provider.awareness.getStates().values())
                .some((state) => state.user?.name === 'Owner'), 'Awareness did not reach guest');

            // More than the single-value KV limit; this must survive a cold start.
            const content = 'โน้ต 📝 '.repeat(20000);
            owner.doc.transact(() => {
                owner.text.delete(0, owner.text.length);
                owner.text.insert(0, content);
            });
            await waitFor(() => guest.text.toString() === content, 'Large document did not sync');
            close(owner);
            await waitFor(() => !guest.provider.awareness.getStates().has(owner.doc.clientID),
                'Departed user remained in awareness');
            close(guest);
            close(otherRoom);
            await delay(1200);
            await worker.stop();
            worker = null;

            await start();
            const restored = await connect('001234');
            assert.equal(restored.text.toString(), content);
            const isolated = await connect('654321');
            assert.equal(isolated.text.length, 0);
            close(isolated);

            // Deletion must replace the previous large snapshot, including stale chunks.
            restored.text.delete(0, restored.text.length);
            await delay(1000);
            close(restored);
            await delay(200);
            await worker.stop();
            worker = null;
            await start();
            const empty = await connect('001234');
            assert.equal(empty.text.length, 0);
        } finally {
            for (const client of clients) close(client);
            if (worker) await worker.stop();
            await rm(directory, { recursive: true, force: true });
        }
    });
