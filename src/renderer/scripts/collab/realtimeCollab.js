import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { ensureConfig } from '@collab-impl/config';
import { getOrCreateUserIdentity } from '@collab-impl/identity';
import { createOverlay } from '@collab-impl/overlay';
import { createCursorRenderer } from '@collab-impl/cursors';
import { createAwarenessScheduler } from '@collab-impl/awareness';
import { createHtmlSync } from '@collab-impl/sync';

/**
 * Initialize realtime collaboration for a contenteditable element.
 * Uses Y.Text for character-level merging and awareness for cursors.
 * 
 * @param {HTMLElement} editor
 * @param {{
 *      serverUrl?: string,
 *      room?: string,
 *      mapName?: string,
 *      debounceMs?: number,
 *      connectionTimeoutMs?: number,
 *      autoDisableOnFail?: boolean,
 *      userName?: string,
 *      userColor?: string
 * }} options
 * @returns {{destroy: () => void, doc: Y.Doc, provider: WebsocketProvider}}
 */
export const initRealtimeCollab = (editor, options = {}) => {
    if (!editor) {
        return { destroy() { } };
    }

    const config = ensureConfig(options);
    const doc = new Y.Doc();
    const provider = new WebsocketProvider(
        config.serverUrl,
        config.room,
        doc,
        {
            connect: true
        }
    );

    const ytext = doc.getText(config.mapName);
    const awareness = provider.awareness;

    let destroyed = false;
    let hasConnected = false;
    let disableTimer = null;

    const overlayState = createOverlay(editor);

    const identity = getOrCreateUserIdentity(doc.clientID, {
        name: options.userName,
        color: options.userColor
    });

    awareness.setLocalStateField('user', identity);

    const cursorRenderer = createCursorRenderer({
        editor,
        overlayState,
        awareness,
        doc,
        isDestroyed: () => destroyed
    });

    const scheduleRender = cursorRenderer.scheduleRender;

    const awarenessScheduler = createAwarenessScheduler({
        editor,
        awareness,
        scheduleRender,
        isDestroyed: () => destroyed
    });

    const scheduleAwarenessUpdate = awarenessScheduler.scheduleAwarenessUpdate;

    const sync = createHtmlSync({
        editor,
        ytext,
        doc,
        debounceMs: config.debounceMs,
        isDestroyed: () => destroyed,
        onRemoteApplied: scheduleAwarenessUpdate
    });

    const { schedulePush, handleTextUpdate, handleSync } = sync;

    ytext.observe(handleTextUpdate);

    const disableCollab = (reason) => {
        if (destroyed) return;

        if (config.autoDisableOnFail) {
            console.warn(`Realtime collab disabled (${reason}).`);
            api.destroy();
        }
    };

    if (typeof provider.on === 'function') {
        provider.on('sync', handleSync);

        provider.on('status', ({ status }) => {
            if (status === 'connected') {
                hasConnected = true;
                if (disableTimer) {
                    clearTimeout(disableTimer);
                    disableTimer = null;
                }
            }
        });
    }

    if (typeof awareness.on === 'function') {
        awareness.on('change', () => {
            scheduleRender();
        });
    }

    editor.addEventListener('input', schedulePush);
    editor.addEventListener('paste', schedulePush);
    editor.addEventListener('cut', schedulePush);
    editor.addEventListener('blur', schedulePush);
    editor.addEventListener('keyup', scheduleAwarenessUpdate);
    editor.addEventListener('mouseup', scheduleAwarenessUpdate);
    editor.addEventListener('focus', scheduleAwarenessUpdate);
    editor.addEventListener('scroll', scheduleRender, { passive: true });

    document.addEventListener('selectionchange', scheduleAwarenessUpdate);
    window.addEventListener('resize', scheduleRender);

    if (config.autoDisableOnFail && config.connectionTimeoutMs > 0) {
        disableTimer = setTimeout(() => {
            if (!hasConnected) {
                disableCollab('server-unreachable');
            }
        }, config.connectionTimeoutMs);
    }

    const api = {
        doc,
        provider,
        destroy() {
            destroyed = true;

            sync.destroy();
            awarenessScheduler.destroy();
            cursorRenderer.destroy();

            if (disableTimer) {
                clearTimeout(disableTimer);
                disableTimer = null;
            }

            editor.removeEventListener('input', schedulePush);
            editor.removeEventListener('paste', schedulePush);
            editor.removeEventListener('cut', schedulePush);
            editor.removeEventListener('blur', schedulePush);
            editor.removeEventListener('keyup', scheduleAwarenessUpdate);
            editor.removeEventListener('mouseup', scheduleAwarenessUpdate);
            editor.removeEventListener('focus', scheduleAwarenessUpdate);
            editor.removeEventListener('scroll', scheduleRender);

            document.removeEventListener('selectionchange', scheduleAwarenessUpdate);
            window.removeEventListener('resize', scheduleRender);

            ytext.unobserve(handleTextUpdate);

            if (overlayState) {
                overlayState.overlay.remove();
            }

            if (provider && typeof provider.destroy === 'function') {
                provider.destroy();
            } else if (provider && typeof provider.disconnect === 'function') {
                provider.disconnect();
            }

            doc.destroy();
        }
    };

    return api;
};