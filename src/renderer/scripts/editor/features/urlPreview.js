/**
 * URL preview card system
 * @module urlPreview
 */

/** Regular expression to match HTTP/HTTPS URLs */
const URL_REGEX = /https?:\/\/[^\s\)\]\>]+/gi;
const URL_REGEX_TEST = /https?:\/\/[^\s\)\]\>]+/i;

const SCAN_DELAY_DEFAULT = 350;
const SCAN_DELAY_MUTATION = 400;
const SCAN_DELAY_INITIAL = 500;
const SCAN_IDLE_TIMEOUT = 800;
const URL_UPDATE_DEBOUNCE = 400;

// Normalize and validate HTTP/HTTPS URLs
const normalizeHttpUrl = (rawUrl) => {
    if (!rawUrl) return null;
    const trimmed = String(rawUrl).trim();
    if (!trimmed || /\s/.test(trimmed)) return null;

    try {
        const normalizedInput = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
        const parsed = new URL(normalizedInput);

        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.href;
        }
    } catch {}

    return null;
};

const isYouTubeUrl = (url) => {
    const normalized = normalizeHttpUrl(url);
    if (!normalized) return false;

    try {
        const host = new URL(normalized).hostname.toLowerCase();

        return host === 'youtu.be' ||
            host.endsWith('youtube.com') ||
            host.endsWith('youtube-nocookie.com');
    } catch {
        return false;
    }
};

// Fetch URL preview metadata from noembed.com
const resolvePreview = async (url, signal) => {
    const normalizedUrl = normalizeHttpUrl(url);
    
    if (!normalizedUrl) {
        throw new Error('Invalid or unsupported URL format');
    }

    const encoded = encodeURIComponent(normalizedUrl);
    const parsed = new URL(normalizedUrl);

    try {
        const res = await fetch(`https://noembed.com/embed?url=${encoded}`, { signal });
        if (res.ok) {
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            return {
                title: data.title || parsed.hostname,
                image: data.thumbnail_url || null,
                providerName: data.provider_name || ''
            };
        }
        throw new Error(`Response not OK: ${res.status}`);
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        console.warn(`Preview service failed for ${normalizedUrl}:`, e);
        
        // Fallback to hostname
        return { title: parsed.hostname, image: null, providerName: '' };
    }
};

// Create preview card element
const createCardElement = (url) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'link-card animate-appear';
    wrapper.draggable = true;

    wrapper.contentEditable = 'false';
    wrapper.setAttribute('contenteditable', 'false');

    const thumb = document.createElement('div');
    thumb.className = 'link-card-thumb';

    thumb.innerHTML = '<div class="thumb-placeholder" contenteditable="false"></div>';
    thumb.setAttribute('contenteditable', 'false');

    const body = document.createElement('div');
    body.className = 'link-card-body';
    
    const title = document.createElement('div');
    title.className = 'link-card-title';

    title.textContent = 'Loading preview...';
    title.setAttribute('contenteditable', 'false');

    const badge = document.createElement('div');
    badge.className = 'link-card-badge';

    badge.textContent = 'YouTube';
    badge.setAttribute('aria-hidden', 'true');
    const isYouTube = isYouTubeUrl(url);
    
    badge.style.display = isYouTube ? 'flex' : 'none';
    wrapper.dataset.provider = isYouTube ? 'youtube' : '';

    const openLink = document.createElement('a');
    openLink.className = 'link-card-open';
    openLink.contentEditable = 'false';
    openLink.setAttribute('contenteditable', 'false');
    const normalizedUrl = normalizeHttpUrl(url);

    if (normalizedUrl) {
        openLink.href = normalizedUrl;
    } else {
        openLink.removeAttribute('href');
        openLink.setAttribute('aria-disabled', 'true');
        openLink.tabIndex = -1;
    }

    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.textContent = 'Open';

    openLink.setAttribute('aria-label', `Open link preview for ${normalizedUrl || url}`);

    body.appendChild(title);
    body.appendChild(openLink);
    wrapper.appendChild(thumb);

    wrapper.appendChild(body);
    wrapper.appendChild(badge);

    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', `Link preview for ${url}`);

    // Store URL for internal tracking
    wrapper.dataset.url = url;

    // Enable drag with URL data
    wrapper.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', wrapper.dataset.url || url);
    });

    return { wrapper, thumb, title, badge };
};

// Create inline URL editor
const createInlineEditor = (currentUrl, onSave, onCancel) => {
    const input = document.createElement('input');
    input.type = 'url';
    input.value = currentUrl;
    input.className = 'inline-url-editor';

    let didSubmit = false;
    
    const handleSave = () => {
        const newUrl = input.value.trim();

        if (newUrl) {
            onSave(newUrl);
        }

        input.remove();
    };

    // Auto-save on blur if valid URL
    input.addEventListener('blur', () => {
        if (didSubmit) return;

        const nextValue = input.value.trim();
        const normalized = normalizeHttpUrl(nextValue);
        
        if (normalized) {
            onSave(normalized);
        } else {
            onCancel();
        }

        input.remove();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            didSubmit = true;
            handleSave();
        } else if (e.key === 'Escape') {
            onCancel();
            input.remove();
        }
    });

    return input;
};

// Initialize URL preview system
export const initURLPreviewSystem = (editor, sanitizeText) => {
    // State maps
    const urlCardMap = new WeakMap();
    const processedUrls = new Set();
    const urlUpdateTimers = new WeakMap();
    const lastRequestedUrl = new WeakMap();
    const requestControllers = new WeakMap();
    const latestRequestId = new WeakMap();
    let previewRequestCounter = 0;
    
    // State flags
    let scanTimer = null;
    let idleHandle = null;
    let ignoreMutations = false;
    let isScanning = false;
    let enabled = true;
    let isActive = false;
    const pendingScanRoots = new Set();

    // Cleanup all resources for a URL span
    const cleanupUrlSpan = (urlSpan) => {
        if (!urlSpan) return;

        // Clear timers
        const timer = urlUpdateTimers.get(urlSpan);
        if (timer) {
            clearTimeout(timer);
            urlUpdateTimers.delete(urlSpan);
        }

        // Abort in-flight requests
        const controller = requestControllers.get(urlSpan);
        if (controller) {
            controller.abort();
            requestControllers.delete(urlSpan);
        }

        // Clear request tracking
        lastRequestedUrl.delete(urlSpan);
        latestRequestId.delete(urlSpan);

        // Remove card and cleanup URL tracking
        const cardData = urlCardMap.get(urlSpan);
        if (cardData && cardData.wrapper) {

            if (cardData.wrapper.parentNode) {
                cardData.wrapper.remove();
            }
            
            const storedUrl = cardData.wrapper.dataset.url;
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
        const rawUrl = urlSpan.textContent?.trim();
        const normalizedRaw = normalizeHttpUrl(rawUrl);
        if (normalizedRaw) {
            processedUrls.delete(normalizedRaw);
            
            // Find and remove orphaned cards
            const allCards = editor.querySelectorAll('.link-card');

            allCards.forEach(card => {
                const storedUrl = card.dataset?.url;
                if (normalizeHttpUrl(storedUrl) === normalizedRaw) {
                    card.remove();
                }
            });
        } else if (rawUrl) {
            processedUrls.delete(rawUrl);
        }
    };

    // Mutation observer to track DOM changes
    const mutationObserver = new MutationObserver((mutations) => {
        // First pass: cleanup removed nodes
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                for (const removedNode of mutation.removedNodes) {
                    if (!removedNode || !removedNode.querySelectorAll) continue;

                    const spans = [];

                    if (removedNode.nodeType === Node.ELEMENT_NODE && 
                        removedNode.matches?.('.link-url-text')) {
                        spans.push(removedNode);
                    }

                    removedNode
                        .querySelectorAll('.link-url-text')
                        .forEach((span) => spans.push(span));

                    spans.forEach(cleanupUrlSpan);
                    
                    // Cleanup orphaned cards
                    if (removedNode.nodeType === Node.ELEMENT_NODE && 
                        removedNode.matches?.('.link-card')) {
                        const url = removedNode.dataset?.url;

                        if (url) {
                            const normalized = normalizeHttpUrl(url);
                            if (normalized) processedUrls.delete(normalized);
                        }
                    }
                }
            }
        }

        if (ignoreMutations || !enabled) return;

        // Second pass: schedule scans for changes
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

    // Resolve appropriate scan root element
    const resolveScanRoot = (node) => {
        if (!node) return null;

        let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        if (!el || !editor.contains(el)) return null;

        // Skip if already inside URL span or card
        if (el.closest?.('.link-url-text, .link-card')) return null;

        // Find nearest block element
        const block = el.closest?.('p, div, li, blockquote, pre, h1, h2, h3, h4, h5, h6, ul, ol');
        if (block && editor.contains(block) && !block.closest?.('.link-url-text, .link-card')) {
            return block;
        }

        return el;
    };

    // Add node to pending scan queue
    const enqueueScanRoot = (node) => {
        const root = resolveScanRoot(node);

        if (!root) return;
        pendingScanRoots.add(root);
    };

    // Schedule URL scan with debouncing
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

    // Scan for URLs in text nodes
    const scanForURLs = (root = editor) => {
        if (!root || !editor.contains(root)) return;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                // Skip nodes inside URL spans or cards
                if (node.parentElement?.closest('.link-url-text, .link-card')) {
                    return NodeFilter.FILTER_REJECT;
                }

                // Skip nested contenteditable
                const editableRoot = node.parentElement?.closest('[contenteditable="true"]');

                if (editableRoot && editableRoot !== editor) {
                    return NodeFilter.FILTER_REJECT;
                }

                // Quick check for URLs
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

            const text = node.textContent;
            const URL_REGEX_EXEC = new RegExp(URL_REGEX.source, 'gi');

            let match;
            let lastIndex = 0;
            let fragment = null;

            while ((match = URL_REGEX_EXEC.exec(text))) {
                if (!fragment) fragment = document.createDocumentFragment();
                
                const url = match[0];
                const index = match.index;
                const normalizedUrl = normalizeHttpUrl(url);

                // Add text before URL
                if (index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
                }

                // Handle URL
                if (!normalizedUrl) {
                    // Invalid URL - keep as text
                    fragment.appendChild(document.createTextNode(url));
                } else if (processedUrls.has(normalizedUrl)) {
                    // Duplicate URL - keep as text
                    fragment.appendChild(document.createTextNode(url));
                } else {
                    // Create URL span and card
                    const urlSpan = createUrlSpan(url);
                    const cardWrapper = insertUrlSpanAndCard(url, urlSpan);

                    fragment.appendChild(urlSpan);
                    fragment.appendChild(cardWrapper);
                    processedUrls.add(normalizedUrl);
                }
                
                lastIndex = URL_REGEX_EXEC.lastIndex;
            }

            if (fragment) {
                // Add remaining text
                if (lastIndex < text.length) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                }
                // Replace original text node
                node.parentNode.replaceChild(fragment, node);
            }
        }
    };

    // Process all pending scans
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
            
            // Use microtask or setTimeout fallback
            if (typeof queueMicrotask === 'function') {
                queueMicrotask(() => { ignoreMutations = false; });
            } else {
                setTimeout(() => { ignoreMutations = false; }, 0);
            }
        }
    };

    // Schedule URL update with debouncing
    const scheduleUrlUpdate = (urlSpan) => {
        if (!urlSpan) return;

        const existing = urlUpdateTimers.get(urlSpan);

        if (existing) {
            clearTimeout(existing);
        }

        const timer = setTimeout(() => {
            urlUpdateTimers.delete(urlSpan);
            updateCardUrl(urlSpan, urlSpan.textContent);
        }, URL_UPDATE_DEBOUNCE);

        urlUpdateTimers.set(urlSpan, timer);
    };

    // Clear all update timers
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

    // Create URL span element
    const createUrlSpan = (url) => {
        const span = document.createElement('span');
        span.className = 'link-url-text';
        span.textContent = url;
        span.contentEditable = 'true';

        span.addEventListener('input', () => {
            // If span is empty, cleanup
            const content = span.textContent.trim();
            if (!content) {
                cleanupUrlSpan(span);
                span.remove();
            } else {
                scheduleUrlUpdate(span);
            }
        });

        return span;
    };

    // Create and insert URL span with card
    const insertUrlSpanAndCard = (url, urlSpan) => {
        const { wrapper, thumb, title, badge } = createCardElement(url);
        urlCardMap.set(urlSpan, { wrapper, thumb, title, badge });

        // Fetch preview data after DOM insertion
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

    // Fetch and display URL preview
    const fetchUrlPreview = async (url, urlSpan, wrapper, titleElement, thumbElement) => {
        if (!enabled) return;
        
        const normalizedUrl = normalizeHttpUrl(url);
        if (!normalizedUrl) return;

        const requestId = ++previewRequestCounter;
        latestRequestId.set(urlSpan, requestId);

        let timeoutId = null;
        let timeoutSignal = null;
        let timeoutListener = null;

        try {
            // Abort previous request
            const previousController = requestControllers.get(urlSpan);

            if (previousController) {
                previousController.abort();
            }

            const controller = new AbortController();
            requestControllers.set(urlSpan, controller);
            wrapper.dataset.previewStatus = 'loading';

            if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
                timeoutSignal = AbortSignal.timeout(10000);
                
                if (typeof AbortSignal.any !== 'function') {
                    timeoutListener = () => controller.abort();
                    timeoutSignal.addEventListener('abort', timeoutListener, { once: true });
                }
            } else {
                timeoutId = setTimeout(() => controller.abort(), 10000);
            }

            const combinedSignal = timeoutSignal && typeof AbortSignal.any === 'function'
                ? AbortSignal.any([controller.signal, timeoutSignal])
                : controller.signal;

            const preview = await resolvePreview(normalizedUrl, combinedSignal);
            
            // Check if this is still the latest request
            if (latestRequestId.get(urlSpan) !== requestId) return;
            if (!urlCardMap.has(urlSpan)) return;

            titleElement.textContent = preview.title;

            const providerName = String(preview.providerName || '').toLowerCase();
            const isYouTube = providerName.includes('youtube') || isYouTubeUrl(normalizedUrl);
            const badge = wrapper.querySelector('.link-card-badge');

            if (badge) {
                badge.style.display = isYouTube ? 'flex' : 'none';
            }
            wrapper.dataset.provider = isYouTube ? 'youtube' : '';

            // Handle thumbnail
            if (preview.image) {
                const normalizedImage = normalizeHttpUrl(preview.image);
                
                if (normalizedImage) {
                    const img = document.createElement('img');

                    img.src = normalizedImage;
                    img.alt = 'Preview thumbnail';
                    
                    // Handle image load errors
                    img.onerror = () => {
                        console.warn('Image failed to load:', normalizedImage);
                        thumbElement.innerHTML = '<div class="thumb-placeholder"></div>';
                    };
                    
                    thumbElement.innerHTML = '';
                    thumbElement.appendChild(img);
                } else {
                    thumbElement.innerHTML = '<div class="thumb-placeholder"></div>';
                }
            } else {
                thumbElement.innerHTML = '<div class="thumb-placeholder"></div>';
            }

            wrapper.dataset.previewStatus = 'ok';
        } catch (error) {
            if (error?.name === 'AbortError') {
                if (latestRequestId.get(urlSpan) !== requestId) return;
                if (!urlCardMap.has(urlSpan)) return;
            
                titleElement.textContent = 'Preview timed out';
                thumbElement.innerHTML = '<div class="thumb-placeholder"></div>';
                wrapper.dataset.previewStatus = 'error';
                return;
            }
            
            if (latestRequestId.get(urlSpan) !== requestId) return;
            if (!urlCardMap.has(urlSpan)) return;

            console.warn(`Failed to process preview for ${normalizedUrl}:`, error);
            
            // Fallback to hostname
            let fallbackTitle = normalizedUrl;
            
            try {
                fallbackTitle = new URL(normalizedUrl).hostname;
            } catch {}
            
            titleElement.textContent = fallbackTitle;
            thumbElement.innerHTML = '<div class="thumb-placeholder"></div>';
            wrapper.dataset.previewStatus = 'error';
        } finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            if (timeoutSignal && timeoutListener) {
                timeoutSignal.removeEventListener('abort', timeoutListener);
            }
        }
    };

    // Update card when URL changes
    const updateCardUrl = async (urlSpan, newUrl) => {
        const cardData = urlCardMap.get(urlSpan);
        if (!cardData || !urlSpan.isConnected) return;

        const openLink = cardData.wrapper.querySelector('a[target="_blank"]');

        const rawUrl = String(newUrl || '').trim();
        const normalizedUrl = normalizeHttpUrl(rawUrl);

        // Update processed URLs
        const oldStored = cardData.wrapper.dataset.url || '';
        const oldNormalized = normalizeHttpUrl(oldStored);

        if (oldNormalized && oldNormalized !== normalizedUrl) {
            processedUrls.delete(oldNormalized);
        }

        if (normalizedUrl) {
            processedUrls.add(normalizedUrl);
        } else if (oldStored && !oldNormalized) {
            processedUrls.delete(oldStored);
        }

        cardData.wrapper.dataset.url = normalizedUrl || rawUrl;
        const isYouTube = isYouTubeUrl(normalizedUrl || rawUrl);
        cardData.wrapper.dataset.provider = isYouTube ? 'youtube' : '';
        if (cardData.badge) {
            cardData.badge.style.display = isYouTube ? 'flex' : 'none';
        }

        // Update open link
        if (openLink) {
            if (normalizedUrl) {
                openLink.href = normalizedUrl;
                openLink.removeAttribute('aria-disabled');
                openLink.removeAttribute('tabindex');
            } else {
                openLink.removeAttribute('href');
                openLink.setAttribute('aria-disabled', 'true');
                openLink.tabIndex = -1;
            }
        }

        // Handle invalid URL
        if (!normalizedUrl) {
            lastRequestedUrl.delete(urlSpan);
            cardData.title.textContent = 'Invalid URL';
            cardData.thumb.innerHTML = '<div class="thumb-placeholder"></div>';
            return;
        }

        // Skip if URL unchanged
        if (lastRequestedUrl.get(urlSpan) === normalizedUrl) return;
        lastRequestedUrl.set(urlSpan, normalizedUrl);

        cardData.title.textContent = 'Loading preview...';

        // Fetch new preview
        await fetchUrlPreview(normalizedUrl, urlSpan, cardData.wrapper, cardData.title, cardData.thumb);
    };

    // Open inline URL editor
    const openInlineUrlEditor = (urlSpan, wrapper) => {
        const currentUrl = urlSpan.textContent.trim();
        
        const input = createInlineEditor(
            currentUrl,
            (newUrl) => {
                urlSpan.textContent = newUrl;
                updateCardUrl(urlSpan, newUrl);
            },
            () => {}
        );

        wrapper.appendChild(input);
        input.focus();
        input.select();
    };

    const isSelectionInsideCard = () => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return false;
        const node = selection.getRangeAt(0).startContainer;
        const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        return Boolean(element?.closest?.('.link-card'));
    };

    const handleBeforeInput = (event) => {
        if (!enabled) return;
        if (event?.target?.closest?.('.link-card') || isSelectionInsideCard()) {
            event.preventDefault();
        }
    };

    const handleKeyDownForCard = (event) => {
        if (!enabled) return;
        if (!isSelectionInsideCard()) return;

        const blockedKeys = ['Backspace', 'Delete', 'Enter'];
        if (blockedKeys.includes(event.key)) {
            event.preventDefault();
        }
    };

    // Handle input events
    const handleInputForURLs = () => {
        if (!enabled) return;

        const selection = window.getSelection();
        if (selection && selection.rangeCount) {
            const range = selection.getRangeAt(0);
            enqueueScanRoot(range.startContainer);
        } else {
            enqueueScanRoot(editor);
        }
        scheduleScan();
    };

    const handlePasteForURLs = () => {
        if (!enabled) return;
        setTimeout(() => {
            const selection = window.getSelection();
            if (selection?.rangeCount) {
                enqueueScanRoot(selection.getRangeAt(0).startContainer);
            } else {
                enqueueScanRoot(editor);
            }
            scheduleScan();
        }, 0);
    };

    // Attach event listeners and observer
    const attach = () => {
        if (isActive) return;

        mutationObserver.observe(editor, {
            childList: true,
            subtree: true,
            characterData: true
        });

        editor.addEventListener('beforeinput', handleBeforeInput);
        editor.addEventListener('keydown', handleKeyDownForCard);
        editor.addEventListener('input', handleInputForURLs);
        editor.addEventListener('paste', handlePasteForURLs);
        isActive = true;
    };

    // Detach event listeners and observer
    const detach = () => {
        if (!isActive) return;

        editor.removeEventListener('beforeinput', handleBeforeInput);
        editor.removeEventListener('keydown', handleKeyDownForCard);
        editor.removeEventListener('input', handleInputForURLs);
        editor.removeEventListener('paste', handlePasteForURLs);
        mutationObserver.disconnect();
        isActive = false;
    };

    // Enable or disable the system
    const setEnabled = (next) => {
        enabled = Boolean(next);

        if (!enabled) {
            detach();
            clearUrlUpdateTimers();

            if (scanTimer) {
                clearTimeout(scanTimer);
                scanTimer = null;
            }
            if (idleHandle && typeof cancelIdleCallback === 'function') {
                cancelIdleCallback(idleHandle);
                idleHandle = null;
            }

            pendingScanRoots.clear();
            processedUrls.clear();
            return;
        }

        attach();
        enqueueScanRoot(editor);
        scheduleScan(SCAN_DELAY_INITIAL);
    };

    // Initialize as enabled
    setEnabled(true);

    // Cleanup and destroy
    const destroy = () => {
        enabled = false;

        detach();
        clearUrlUpdateTimers();
        mutationObserver.disconnect();

        if (scanTimer) {
            clearTimeout(scanTimer);
        }
        if (idleHandle && typeof cancelIdleCallback === 'function') {
            cancelIdleCallback(idleHandle);
        }

        // Remove all cards
        editor.querySelectorAll('.link-card').forEach((card) => card.remove());
        
        // Convert URL spans back to text
        editor.querySelectorAll('.link-url-text').forEach((span) => {
            const textNode = document.createTextNode(span.textContent);
            span.parentNode.replaceChild(textNode, span);
        });

        processedUrls.clear();
        pendingScanRoots.clear();

        console.log('URL preview system destroyed');
    };

    return { destroy, setEnabled };
};

export default initURLPreviewSystem;