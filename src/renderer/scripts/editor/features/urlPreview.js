/**
 * URL preview card system
 * @module urlPreview
 */

/** Regular expression to match HTTP/HTTPS URLs */
const URL_REGEX = /https?:\/\/[^\s\)\]\>]+/gi;

/** Debounce delay for URL scanning (ms) */
const SCAN_DELAY_DEFAULT = 350;
const SCAN_DELAY_MUTATION = 400;
const SCAN_DELAY_INITIAL = 500;
const SCAN_IDLE_TIMEOUT = 800;

// Utility Functions

/**
 * Fetches a URL preview using a resolver service (noembed.com)
 * @param {string} url - URL to get a preview for
 * @returns {Promise<{title: string, image: string|null}>} Preview data
 */
const resolvePreview = async (url) => {
    try {
        new URL(url);
    } catch {
        throw new Error('Invalid URL format');
    }
    
    const encoded = encodeURIComponent(url);

    try {
        const res = await fetch(`https://noembed.com/embed?url=${encoded}`);
        if (res.ok) {
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return {
                title: data.title || url,
                image: data.thumbnail_url || null,
            };
        }
        throw new Error(`Response not OK: ${res.status}`);
    } catch (e) {
        console.warn(`Preview service failed for ${url}:`, e);
        // Fallback to hostname
        const u = new URL(url);
        return { title: u.hostname, image: null };
    }
};

// DOM Creation Functions

/**
 * Creates a link preview card element
 * @param {string} url - URL for the card
 * @param {Function} sanitizeText - Sanitization function
 * @returns {{wrapper: HTMLElement, thumb: HTMLElement, title: HTMLElement}}
 */
const createCardElement = (url, sanitizeText) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'link-card animate-appear';
    wrapper.draggable = true;

    const thumb = document.createElement('div');
    thumb.className = 'link-card-thumb';
    thumb.innerHTML = '<div class="thumb-placeholder"></div>';

    const body = document.createElement('div');
    body.className = 'link-card-body';
    
    const title = document.createElement('div');
    title.className = 'link-card-title';
    title.textContent = url;

    const actions = document.createElement('div');
    actions.className = 'link-card-actions';
    
    const openLink = document.createElement('a');
    openLink.href = url;
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.textContent = 'Open';
    actions.appendChild(openLink);

    body.appendChild(title);
    body.appendChild(actions);
    wrapper.appendChild(thumb);
    wrapper.appendChild(body);

    // Hidden element for accessibility/drag data
    const hiddenUrl = document.createElement('span');
    hiddenUrl.className = 'link-card-url-source';
    hiddenUrl.textContent = url;
    hiddenUrl.setAttribute('aria-hidden', 'true');
    hiddenUrl.style.position = 'absolute';
    hiddenUrl.style.left = '-9999px';
    wrapper.appendChild(hiddenUrl);

    // Enable dragging with URL data
    wrapper.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', url);
    });

    return { wrapper, thumb, title };
};

/**
 * Creates an inline URL editor input element
 * @param {string} currentUrl - Current URL value
 * @param {Function} onSave - Callback when saving
 * @param {Function} onCancel - Callback when canceling
 * @returns {HTMLInputElement}
 */
const createInlineEditor = (currentUrl, onSave, onCancel) => {
    const input = document.createElement('input');
    input.type = 'url';
    input.value = currentUrl;
    input.className = 'inline-url-editor';
    
    const handleSave = () => {
        const newUrl = input.value.trim();
        if (newUrl) {
            onSave(newUrl);
        }
        input.remove();
    };

    input.addEventListener('blur', handleSave);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            onCancel();
            input.remove();
        }
    });

    return input;
};

// URL Preview System Controller

/**
 * Initializes URL preview system for an editor
 * @param {HTMLElement} editor - The contenteditable element
 * @param {Function} sanitizeText - Sanitization function
 * @returns {{destroy: Function}} Controller object with destroy method
 */
export const initURLPreviewSystem = (editor, sanitizeText) => {
    // State Management

    /** Maps URL span elements to their card data */
    const urlCardMap = new WeakMap();
    
    /** Tracks processed URLs to prevent duplicates */
    const processedUrls = new Set();
    
    /** Timer for debounced URL scanning */
    let scanTimer = null;
    let idleHandle = null;
    let ignoreMutations = false;
    let isScanning = false;
    const pendingScanRoots = new Set();

    // Mutation Observer
    const mutationObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                for (const removedNode of mutation.removedNodes) {
                    if (removedNode.nodeType === Node.ELEMENT_NODE && removedNode.matches?.('.link-url-text')) {
                        const cardData = urlCardMap.get(removedNode);
                        if (cardData) {
                            cardData.wrapper.remove();
                            urlCardMap.delete(removedNode);
                            const url = cardData.wrapper.querySelector('.link-card-url-source')?.textContent;
                            if(url) processedUrls.delete(url);
                        }
                    }
                }
            }
        }

        if (ignoreMutations) {
            return;
        }

        let shouldSchedule = false;

        for (const mutation of mutations) {
            if (mutation.type === 'characterData') {
                enqueueScanRoot(mutation.target);
                shouldSchedule = true;
                continue;
            }

            if (mutation.type === 'childList') {
                if (mutation.target !== editor) {
                    enqueueScanRoot(mutation.target);
                }
                mutation.addedNodes.forEach((node) => {
                    enqueueScanRoot(node);
                });
                shouldSchedule = true;
            }
        }

        if (shouldSchedule) {
            scheduleScan(SCAN_DELAY_MUTATION);
        }
    });

    // URL Scanning & Card Creation

    /**
     * Schedules a URL scan with debouncing
     * @param {number} delay - Delay in milliseconds
     */
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
        pendingScanRoots.add(root);
    };

    const scheduleScan = (delay = SCAN_DELAY_DEFAULT) => {
        if (scanTimer) {
            clearTimeout(scanTimer);
        }

        if (idleHandle && typeof cancelIdleCallback === 'function') {
            cancelIdleCallback(idleHandle);
            idleHandle = null;
        }

        scanTimer = setTimeout(() => {
            const runScan = () => {
                idleHandle = null;
                processPendingScans();
            };

            if (typeof requestIdleCallback === 'function') {
                idleHandle = requestIdleCallback(runScan, { timeout: SCAN_IDLE_TIMEOUT });
            } else {
                runScan();
            }
        }, delay);
    };

    /**
     * Scans for URLs in text nodes and replaces them with preview cards.
     * This version uses a TreeWalker to safely traverse and modify the DOM,
     * preventing the infinite loops and performance issues of the previous implementation.
     */
    const scanForURLs = (root = editor) => {
        if (!root || !editor.contains(root)) return;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                // Reject nodes that are already part of a link or card
                if (node.parentElement?.closest('.link-url-text, .link-card')) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Reject nodes that don't contain a URL using a non-global regex test
                if (!new RegExp(URL_REGEX.source, 'g').test(node.textContent)) {
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

            const text = node.textContent;
            const URL_REGEX_EXEC = new RegExp(URL_REGEX.source, 'gi');
            let match;
            let lastIndex = 0;
            let fragment = null;

            while ((match = URL_REGEX_EXEC.exec(text))) {
                if (!fragment) fragment = document.createDocumentFragment();
                const url = match[0];
                const index = match.index;

                // Append text before the URL
                if (index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
                }

                if (processedUrls.has(url)) {
                    fragment.appendChild(document.createTextNode(url));
                } else {
                    const urlSpan = createUrlSpan(url);
                    const cardWrapper = insertUrlSpanAndCard(url, urlSpan);
                    fragment.appendChild(urlSpan);
                    fragment.appendChild(cardWrapper);
                    processedUrls.add(url);
                }
                lastIndex = URL_REGEX_EXEC.lastIndex;
            }

            if (fragment) {
                // Append any remaining text after the last URL
                if (lastIndex < text.length) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                }
                // Replace the original text node with the new fragment
                node.parentNode.replaceChild(fragment, node);
            }
        }
    };

    const processPendingScans = () => {
        if (isScanning || pendingScanRoots.size === 0) return;

        isScanning = true;
        ignoreMutations = true;

        try {
            const roots = Array.from(pendingScanRoots);
            pendingScanRoots.clear();

            for (const root of roots) {
                scanForURLs(root);
            }
        } finally {
            isScanning = false;
            Promise.resolve().then(() => {
                ignoreMutations = false;
            });
        }
    };

    /**
     * Creates a new URL span element
     * @param {string} url - URL text
     * @returns {HTMLElement}
     */
    const createUrlSpan = (url) => {
        const span = document.createElement('span');
        span.className = 'link-url-text';
        span.textContent = url;
        span.contentEditable = 'true';

        span.addEventListener('input', () => {
            const newUrl = span.textContent.trim();
            updateCardUrl(span, newUrl);
        });

        return span;
    };

    /**
     * Creates a preview card, associates it with the URL span, and fetches the preview.
     * @param {string} url - The URL for the card.
     * @param {HTMLElement} urlSpan - The span element for the URL.
     * @returns {HTMLElement} The card wrapper element.
     */
    const insertUrlSpanAndCard = (url, urlSpan) => {
        // Create card
        const { wrapper, thumb, title } = createCardElement(url, sanitizeText);
        urlCardMap.set(urlSpan, { wrapper, thumb, title });

        // Add double-click editor
        wrapper.addEventListener('dblclick', () => {
            openInlineUrlEditor(urlSpan, wrapper);
        });

        // Fetch preview data
        fetchUrlPreview(url, urlSpan, wrapper, title, thumb);
        return wrapper;
    };

    /**
     * Fetches and displays URL preview metadata
     * @param {string} url - URL to fetch
     * @param {HTMLElement} urlSpan - The span element for the URL.
     * @param {HTMLElement} wrapper - The card's wrapper element.
     * @param {HTMLElement} titleElement - Title element to update
     * @param {HTMLElement} thumbElement - Thumbnail element to update
     */
    const fetchUrlPreview = async (url, urlSpan, wrapper, titleElement, thumbElement) => {
        try {
            const preview = await resolvePreview(url);

            titleElement.textContent = preview.title;

            if (preview.image) {
                thumbElement.innerHTML = `<img src="${sanitizeText(
                    preview.image
                )}" alt="Preview thumbnail"/>`;
            } else {
                thumbElement.innerHTML = '<div class="thumb-placeholder"></div>';
            }
        } catch (error) {
            console.warn(`Failed to process preview for ${url}:`, error);
            // On failure, remove the card and revert the span to a simple text node
            if (wrapper.parentNode) {
                const textNode = document.createTextNode(urlSpan.textContent);
                urlSpan.parentNode.replaceChild(textNode, urlSpan);
                wrapper.remove();
                urlCardMap.delete(urlSpan);
                processedUrls.delete(url);
            }
        }
    };

    /**
     * Updates card URL when span content changes
     * @param {HTMLElement} urlSpan - URL span element
     * @param {string} newUrl - New URL value
     */
    const updateCardUrl = async (urlSpan, newUrl) => {
        const cardData = urlCardMap.get(urlSpan);
        if (!cardData) return;

        // Find the original URL to remove it from processedUrls
        const oldUrl = cardData.wrapper.querySelector('.link-card-url-source')?.textContent;
        if (oldUrl && oldUrl !== newUrl) {
            processedUrls.delete(oldUrl);
        }
        // Add the new URL, even if it's the same, to ensure it's tracked
        processedUrls.add(newUrl);

        const hiddenUrlElement = cardData.wrapper.querySelector('.link-card-url-source');
        if (hiddenUrlElement) {
            hiddenUrlElement.textContent = newUrl;
        }

        const openLink = cardData.wrapper.querySelector('a[target="_blank"]');
        if (openLink) {
            openLink.href = newUrl;
        }

        await fetchUrlPreview(newUrl, urlSpan, cardData.wrapper, cardData.title, cardData.thumb);
    };

    /**
     * Opens inline editor for URL modification
     * @param {HTMLElement} urlSpan - URL span element
     * @param {HTMLElement} wrapper - Card wrapper element
     */
    const openInlineUrlEditor = (urlSpan, wrapper) => {
        const currentUrl = urlSpan.textContent.trim();
        
        const input = createInlineEditor(
            currentUrl,
            (newUrl) => {
                urlSpan.textContent = newUrl;
                updateCardUrl(urlSpan, newUrl);
            },
            () => {} // Cancel callback
        );

        wrapper.appendChild(input);
        input.focus();
        input.select();
    };

    // Event Handlers

    /**
     * Handles input events for URL scanning
     */
    const handleInputForURLs = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount) {
            const range = selection.getRangeAt(0);
            enqueueScanRoot(range.startContainer);
        } else {
            enqueueScanRoot(editor);
        }
        scheduleScan();
    };

    // Initialization

    // Set up mutation observer
    mutationObserver.observe(editor, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // Register event listeners
    editor.addEventListener('input', handleInputForURLs);

    // Initial scan
    enqueueScanRoot(editor);
    scheduleScan(SCAN_DELAY_INITIAL);

    // Public API

    /**
     * Cleanup function to remove URL preview system
     */
    const destroy = () => {
        // Remove event listeners
        editor.removeEventListener('input', handleInputForURLs);

        // Disconnect observer
        mutationObserver.disconnect();

        // Clear timers
        if (scanTimer) {
            clearTimeout(scanTimer);
        }
        if (idleHandle && typeof cancelIdleCallback === 'function') {
            cancelIdleCallback(idleHandle);
        }

        // Remove all cards
        editor.querySelectorAll('.link-card').forEach((card) => card.remove());
        editor.querySelectorAll('.link-url-text').forEach((span) => {
            const textNode = document.createTextNode(span.textContent);
            span.parentNode.replaceChild(textNode, span);
        });

        // Clear maps and sets
        processedUrls.clear();
        pendingScanRoots.clear();

        console.log('URL preview system destroyed');
    };

    return { destroy };
};

export default initURLPreviewSystem;
