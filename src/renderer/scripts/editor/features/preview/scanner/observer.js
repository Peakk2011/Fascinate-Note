/**
 * URL preview card system - mutation observer & scan scheduler
 * @module urlPreview/scanner/observer
 */

import { SCAN_DELAY_DEFAULT, SCAN_DELAY_MUTATION, SCAN_IDLE_TIMEOUT } from '../constants.js';
import { normalizeHttpUrl } from '../utils.js';

export const createObserver = (editor, state, processPendingScans) => {
    if (!editor || !state || typeof processPendingScans !== 'function') return null;

    // Scan root helpers 

    const resolveScanRoot = (node) => {
        if (!node) return null;

        let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        if (!el || !editor.contains(el)) return null;

        if (el.closest?.('.link-url-text, .link-card')) return null;

        const block = el.closest?.('p, div, li, blockquote, pre, h1, h2, h3, h4, h5, h6, ul, ol');
        if (block && editor.contains(block) && !block.closest?.('.link-url-text, .link-card')) {
            return block;
        }

        return el;
    };

    const enqueueScanRoot = (node) => {
        const root = resolveScanRoot(node);
        if (!root) return;
        state.pendingScanRoots.add(root);
    };

    // Scan scheduling

    const scheduleScan = (delay = SCAN_DELAY_DEFAULT) => {
        if (state.scanTimer) clearTimeout(state.scanTimer);

        if (state.idleHandle && typeof cancelIdleCallback === 'function') {
            cancelIdleCallback(state.idleHandle);
            state.idleHandle = null;
        }

        state.scanTimer = setTimeout(() => {
            const runScan = () => {
                state.idleHandle = null;
                processPendingScans();
            };

            if (typeof requestIdleCallback === 'function') {
                state.idleHandle = requestIdleCallback(runScan, { timeout: SCAN_IDLE_TIMEOUT });
            } else {
                runScan();
            }
        }, delay);
    };

    // Mutation observer 

    const mutationObserver = new MutationObserver((mutations) => {
        // First pass: cleanup removed nodes
        for (const mutation of mutations) {
            if (mutation.type !== 'childList' || mutation.removedNodes.length === 0) continue;

            for (const removedNode of mutation.removedNodes) {
                if (!removedNode || !removedNode.querySelectorAll) continue;

                const spans = [];

                if (
                    removedNode.nodeType === Node.ELEMENT_NODE &&
                    removedNode.matches?.('.link-url-text')
                ) {
                    spans.push(removedNode);
                }

                removedNode.querySelectorAll('.link-url-text').forEach((s) => spans.push(s));
                spans.forEach(state.cleanupUrlSpan);

                // Cleanup orphaned cards
                if (
                    removedNode.nodeType === Node.ELEMENT_NODE &&
                    removedNode.matches?.('.link-card')
                ) {
                    const url = removedNode.dataset?.url;
                    if (url) {
                        const normalized = normalizeHttpUrl(url);
                        if (normalized) state.processedUrls.delete(normalized);
                    }
                }
            }
        }

        if (state.ignoreMutations || !state.enabled) return;

        // Second pass: schedule scans for changes
        let shouldSchedule = false;

        for (const mutation of mutations) {
            if (mutation.type === 'characterData') {
                enqueueScanRoot(mutation.target);
                shouldSchedule = true;
                continue;
            }

            if (mutation.type === 'childList') {
                if (mutation.target !== editor) enqueueScanRoot(mutation.target);
                mutation.addedNodes.forEach((node) => enqueueScanRoot(node));
                shouldSchedule = true;
            }
        }

        if (shouldSchedule) {
            scheduleScan(SCAN_DELAY_MUTATION);
        }
    });

    return { mutationObserver, enqueueScanRoot, scheduleScan };
};