/**
 * URL preview card system - scanner entry (wires submodules)
 * @module urlPreview/scanner
 */

import { SCAN_DELAY_INITIAL } from '../constants.js';
import { createState }      from './state.js';
import { createObserver }   from './observer.js';
import { createDomScanner } from './domScanner.js';
import { createFetcher }    from './fetcher.js';
import { createEvents }     from './events.js';

export const initScanner = (editor, _sanitizeText) => {
    if (!editor) return null;

    const state = createState(editor);
    if (!state) return null;

    // fetcher needs state only
    const fetcher = createFetcher(editor, state);
    if (!fetcher) return null;

    const { fetchUrlPreview, updateCardUrl } = fetcher;

    // domScanner needs fetchUrlPreview + state
    const domScanner = createDomScanner(editor, state, fetchUrlPreview);
    if (!domScanner) return null;

    const { processPendingScans } = domScanner;

    // Wire updateCardUrl back into state so scheduleUrlUpdate can call it
    state.onUrlUpdate = (urlSpan, newUrl) => updateCardUrl(urlSpan, newUrl);

    // observer needs processPendingScans
    const observer = createObserver(editor, state, processPendingScans);
    if (!observer) return null;

    const { mutationObserver, enqueueScanRoot, scheduleScan } = observer;

    // events needs enqueueScanRoot + scheduleScan
    const events = createEvents(editor, state, enqueueScanRoot, scheduleScan);
    if (!events) return null;

    const { attach, detach } = events;

    // Enable / disable

    const setEnabled = (next) => {
        state.enabled = Boolean(next);

        if (!state.enabled) {
            detach(mutationObserver);
            state.clearUrlUpdateTimers();

            if (state.scanTimer) {
                clearTimeout(state.scanTimer);
                state.scanTimer = null;
            }

            if (state.idleHandle && typeof cancelIdleCallback === 'function') {
                cancelIdleCallback(state.idleHandle);
                state.idleHandle = null;
            }

            state.pendingScanRoots.clear();
            state.processedUrls.clear();
            return;
        }

        attach(mutationObserver);
        enqueueScanRoot(editor);
        scheduleScan(SCAN_DELAY_INITIAL);
    };

    // Destroy

    const destroy = () => {
        state.enabled = false;

        detach(mutationObserver);
        state.clearUrlUpdateTimers();
        mutationObserver.disconnect();

        if (state.scanTimer) clearTimeout(state.scanTimer);

        if (state.idleHandle && typeof cancelIdleCallback === 'function') {
            cancelIdleCallback(state.idleHandle);
        }

        editor.querySelectorAll('.link-card').forEach((card) => card.remove());

        editor.querySelectorAll('.link-url-text').forEach((span) => {
            const textNode = document.createTextNode(span.textContent);
            span.parentNode.replaceChild(textNode, span);
        });

        state.processedUrls.clear();
        state.pendingScanRoots.clear();

        console.log('URL preview system destroyed');
    };

    // Initialize as enabled
    setEnabled(true);

    return { destroy, setEnabled };
};

export default initScanner;