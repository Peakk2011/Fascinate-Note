/**
 * URL preview card system - DOM scanner
 * @module urlPreview/scanner/domScanner
 */

import { URL_REGEX, URL_REGEX_TEST, URL_UPDATE_DEBOUNCE } from '../constants.js';
import { normalizeHttpUrl } from '../utils.js';
import { createCardElement } from '../card.js';

export const createDomScanner = (editor, state, fetchUrlPreview) => {
    if (!editor || !state || typeof fetchUrlPreview !== 'function') return null;

    // URL span

    const scheduleUrlUpdate = (urlSpan) => {
        if (!urlSpan) return;

        const existing = state.urlUpdateTimers.get(urlSpan);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
            state.urlUpdateTimers.delete(urlSpan);
            // updateCardUrl is wired in after init — call via state hook
            state.onUrlUpdate?.(urlSpan, urlSpan.textContent);
        }, URL_UPDATE_DEBOUNCE);

        state.urlUpdateTimers.set(urlSpan, timer);
    };

    const createUrlSpan = (url) => {
        if (!url) return null;

        const span           = document.createElement('span');
        span.className       = 'link-url-text';
        span.textContent     = url;
        span.contentEditable = 'true';

        span.addEventListener('input', () => {
            const content = span.textContent.trim();
            if (!content) {
                state.cleanupUrlSpan(span);
                span.remove();
            } else {
                scheduleUrlUpdate(span);
            }
        });

        return span;
    };

    const insertUrlSpanAndCard = (url, urlSpan) => {
        if (!url || !urlSpan) return null;

        const cardData = createCardElement(url);
        if (!cardData) return null;

        const { wrapper, thumb, title, badge } = cardData;
        state.urlCardMap.set(urlSpan, { wrapper, thumb, title, badge });

        const schedulePreviewFetch = () => {
            fetchUrlPreview(url, urlSpan, wrapper, title, thumb);
        };

        if (typeof queueMicrotask === 'function') {
            queueMicrotask(schedulePreviewFetch);
        } else {
            setTimeout(schedulePreviewFetch, 0);
        }

        return wrapper;
    };

    // Scan

    const scanForURLs = (root = editor) => {
        if (!root || !editor.contains(root)) return;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (node.parentElement?.closest('.link-url-text, .link-card')) {
                    return NodeFilter.FILTER_REJECT;
                }

                const editableRoot = node.parentElement?.closest('[contenteditable="true"]');
                if (editableRoot && editableRoot !== editor) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (!URL_REGEX_TEST.test(node.textContent)) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            },
        });

        const nodes = [];
        let n;
        while ((n = walker.nextNode())) nodes.push(n);

        for (const node of nodes) {
            if (!node.isConnected) continue;

            const text           = node.textContent;
            const URL_REGEX_EXEC = new RegExp(URL_REGEX.source, 'gi');

            let match;
            let lastIndex = 0;
            let fragment  = null;

            while ((match = URL_REGEX_EXEC.exec(text))) {
                if (!fragment) fragment = document.createDocumentFragment();

                const url           = match[0];
                const index         = match.index;
                const normalizedUrl = normalizeHttpUrl(url);

                if (index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
                }

                if (!normalizedUrl) {
                    // Invalid URL keep as plain text
                    fragment.appendChild(document.createTextNode(url));
                } else if (state.processedUrls.has(normalizedUrl)) {
                    // Already tracked keep as plain text to avoid duplication
                    fragment.appendChild(document.createTextNode(url));
                } else {
                    const urlSpan    = createUrlSpan(url);
                    const cardWrapper = insertUrlSpanAndCard(url, urlSpan);

                    fragment.appendChild(urlSpan);
                    fragment.appendChild(cardWrapper);
                    state.processedUrls.add(normalizedUrl);
                }

                lastIndex = URL_REGEX_EXEC.lastIndex;
            }

            if (fragment) {
                if (lastIndex < text.length) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                }
                node.parentNode.replaceChild(fragment, node);
            }
        }
    };

    const processPendingScans = () => {
        if (state.isScanning || state.pendingScanRoots.size === 0) return;

        state.isScanning      = true;
        state.ignoreMutations = true;

        try {
            const roots = Array.from(state.pendingScanRoots);
            state.pendingScanRoots.clear();

            for (const root of roots) {
                scanForURLs(root);
            }
        } finally {
            state.isScanning = false;

            if (typeof queueMicrotask === 'function') {
                queueMicrotask(() => { state.ignoreMutations = false; });
            } else {
                setTimeout(() => { state.ignoreMutations = false; }, 0);
            }
        }
    };

    return { scanForURLs, processPendingScans };
};