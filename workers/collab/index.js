import { routePartykitRequest } from 'partyserver';
import { YServer } from 'y-partyserver';
import { loadDocument, saveDocument } from './persistence.js';

export class CollabRoom extends YServer {
    static callbackOptions = { debounceWait: 700, debounceMaxWait: 3000 };

    // Serialize snapshots so an older save can never overwrite a newer save.
    saveQueue = Promise.resolve();

    async onLoad() {
        await loadDocument(this.ctx.storage, this.document);
    }

    onSave() {
        const save = this.saveQueue.then(() => saveDocument(this.ctx.storage, this.document));
        this.saveQueue = save.catch(() => {});
        this.ctx.waitUntil(save);
        return save;
    }

    async onClose(connection, code, reason, wasClean) {
        super.onClose(connection, code, reason, wasClean);
        // Flush the final edit even if everyone leaves before the debounce fires.
        if (Array.from(this.getConnections()).length === 0) await this.onSave();
    }

    onRequest() {
        return new Response('WebSocket connection required', { status: 426 });
    }
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (request.method === 'GET' && url.pathname === '/health') {
            return Response.json({ status: 'ok', service: 'fascinate-collab' });
        }
        return await routePartykitRequest(request, env)
            || new Response('Not found', { status: 404 });
    }
};
