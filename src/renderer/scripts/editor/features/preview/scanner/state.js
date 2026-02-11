/**
 * URL preview card system - scanner state
 * @module urlPreview/scanner/state
 */

import { normalizeHttpUrl } from '../utils.js';

export const createState = (editor) => {
    if (!editor) return null;

    // State maps
    const urlCardMap         = new WeakMap();
    const processedUrls      = new Set();
    const urlUpdateTimers    = new WeakMap();
    const lastRequestedUrl   = new WeakMap();
    const requestControllers = new WeakMap();
    const latestRequestId    = new WeakMap();
    let   previewRequestCounter = 0;

    // State flags 
    let scanTimer       = null;
    let idleHandle      = null;
    let ignoreMutations = false;
    let isScanning      = false;
    let enabled         = true;
    let isActive        = false;
    const pendingScanRoots = new Set();

    // Cleanup

    const cleanupUrlSpan = (urlSpan) => {
        if (!urlSpan) return;

        const timer = urlUpdateTimers.get(urlSpan);
        if (timer) {
            clearTimeout(timer);
            urlUpdateTimers.delete(urlSpan);
        }

        const controller = requestControllers.get(urlSpan);
        if (controller) {
            controller.abort();
            requestControllers.delete(urlSpan);
        }

        lastRequestedUrl.delete(urlSpan);
        latestRequestId.delete(urlSpan);

        const cardData = urlCardMap.get(urlSpan);
        if (cardData && cardData.wrapper) {
            if (cardData.wrapper.parentNode) {
                cardData.wrapper.remove();
            }

            const storedUrl        = cardData.wrapper.dataset.url;
            const normalizedStored = normalizeHttpUrl(storedUrl);

            if (normalizedStored) {
                processedUrls.delete(normalizedStored);
            } else if (storedUrl) {
                processedUrls.delete(storedUrl);
            }

            urlCardMap.delete(urlSpan);
            return;
        }

        // Fallback: cleanup by span content
        const rawUrl        = urlSpan.textContent?.trim();
        const normalizedRaw = normalizeHttpUrl(rawUrl);

        if (normalizedRaw) {
            processedUrls.delete(normalizedRaw);

            editor.querySelectorAll('.link-card').forEach((card) => {
                const storedUrl = card.dataset?.url;
                if (normalizeHttpUrl(storedUrl) === normalizedRaw) {
                    card.remove();
                }
            });
        } else if (rawUrl) {
            processedUrls.delete(rawUrl);
        }
    };

    const clearUrlUpdateTimers = () => {
        editor.querySelectorAll('.link-url-text').forEach((span) => {
            const timer = urlUpdateTimers.get(span);
            if (timer) {
                clearTimeout(timer);
                urlUpdateTimers.delete(span);
            }

            const controller = requestControllers.get(span);
            if (controller) {
                controller.abort();
                requestControllers.delete(span);
            }

            latestRequestId.delete(span);
            lastRequestedUrl.delete(span);
        });
    };

    return {
        // Maps
        urlCardMap,
        processedUrls,
        urlUpdateTimers,
        lastRequestedUrl,
        requestControllers,
        latestRequestId,
        get previewRequestCounter()  { return previewRequestCounter; },
        nextRequestId()              { return ++previewRequestCounter; },

        // Flags (getters/setters so modules share same ref)
        get scanTimer()       { return scanTimer; },
        set scanTimer(v)      { scanTimer = v; },
        get idleHandle()      { return idleHandle; },
        set idleHandle(v)     { idleHandle = v; },
        get ignoreMutations() { return ignoreMutations; },
        set ignoreMutations(v){ ignoreMutations = v; },
        get isScanning()      { return isScanning; },
        set isScanning(v)     { isScanning = v; },
        get enabled()         { return enabled; },
        set enabled(v)        { enabled = v; },
        get isActive()        { return isActive; },
        set isActive(v)       { isActive = v; },
        pendingScanRoots,

        // Cleanup
        cleanupUrlSpan,
        clearUrlUpdateTimers,
    };
};