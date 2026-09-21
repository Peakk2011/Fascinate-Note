import * as Y from 'yjs';

// Keep individual values below Durable Object KV's 128 KiB limit.
const CHUNK_SIZE = 64 * 1024;
const MANIFEST = 'document:manifest';
const chunkKey = (index) => `document:chunk:${index}`;

export const loadDocument = async (storage, document) => {
    const manifest = await storage.get(MANIFEST);
    if (!manifest) return;
    const update = new Uint8Array(manifest.byteLength);
    for (let index = 0; index < manifest.chunks; index++) {
        const chunk = await storage.get(chunkKey(index));
        if (!(chunk instanceof Uint8Array)
            || chunk.length !== Math.min(CHUNK_SIZE, update.length - index * CHUNK_SIZE)) {
            throw new Error('Stored collaboration document is incomplete');
        }
        update.set(chunk, index * CHUNK_SIZE);
    }
    Y.applyUpdate(document, update);
};

export const saveDocument = async (storage, document) => {
    const update = Y.encodeStateAsUpdate(document);
    const chunks = Math.ceil(update.byteLength / CHUNK_SIZE);
    // Readers see either the complete previous snapshot or the complete new one.
    await storage.transaction(async (transaction) => {
        const previous = await transaction.get(MANIFEST);
        for (let index = 0; index < chunks; index++) {
            await transaction.put(chunkKey(index), update.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
        }
        for (let index = chunks; index < (previous?.chunks || 0); index++) {
            await transaction.delete(chunkKey(index));
        }
        await transaction.put(MANIFEST, { chunks, byteLength: update.byteLength });
    });
};
