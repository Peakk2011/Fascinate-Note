/**
 * URL preview card system - preview fetcher & card updater
 * @module urlPreview/scanner/fetcher
 */

import { normalizeHttpUrl, isYouTubeUrl, resolvePreview } from '../utils.js';
import { createInlineEditor }                             from '../card.js';

export const createFetcher = (editor, state) => {
    if (!editor || !state) return null;

    // Fetch preview

    const fetchUrlPreview = async (url, urlSpan, wrapper, titleElement, thumbElement) => {
        if (!state.enabled) return;

        const normalizedUrl = normalizeHttpUrl(url);
        if (!normalizedUrl) return;

        const requestId = state.nextRequestId();
        state.latestRequestId.set(urlSpan, requestId);

        let timeoutId       = null;
        let timeoutSignal   = null;
        let timeoutListener = null;

        try {
            const previousController = state.requestControllers.get(urlSpan);
            if (previousController) previousController.abort();

            const controller = new AbortController();
            state.requestControllers.set(urlSpan, controller);
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

            if (state.latestRequestId.get(urlSpan) !== requestId) return;
            if (!state.urlCardMap.has(urlSpan)) return;

            titleElement.textContent = preview.title;

            const providerName = String(preview.providerName || '').toLowerCase();
            const isYouTube    = providerName.includes('youtube') || isYouTubeUrl(normalizedUrl);
            const badge        = wrapper.querySelector('.link-card-badge');

            if (badge) badge.style.display = isYouTube ? 'flex' : 'none';
            wrapper.dataset.provider = isYouTube ? 'youtube' : '';

            if (preview.image) {
                const normalizedImage = normalizeHttpUrl(preview.image);

                if (normalizedImage) {
                    const img = document.createElement('img');
                    img.src = normalizedImage;
                    img.alt = 'Preview thumbnail';

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
                if (state.latestRequestId.get(urlSpan) !== requestId) return;
                if (!state.urlCardMap.has(urlSpan)) return;

                titleElement.textContent = 'Preview timed out';
                thumbElement.innerHTML   = '<div class="thumb-placeholder"></div>';
                wrapper.dataset.previewStatus = 'error';
                return;
            }

            if (state.latestRequestId.get(urlSpan) !== requestId) return;
            if (!state.urlCardMap.has(urlSpan)) return;

            console.warn(`Failed to process preview for ${normalizedUrl}:`, error);

            let fallbackTitle = normalizedUrl;
            try { fallbackTitle = new URL(normalizedUrl).hostname; } catch {}

            titleElement.textContent = fallbackTitle;
            thumbElement.innerHTML   = '<div class="thumb-placeholder"></div>';
            wrapper.dataset.previewStatus = 'error';
        } finally {
            if (timeoutId) clearTimeout(timeoutId);

            if (timeoutSignal && timeoutListener) {
                timeoutSignal.removeEventListener('abort', timeoutListener);
            }
        }
    };

    // Card URL update

    const updateCardUrl = async (urlSpan, newUrl) => {
        const cardData = state.urlCardMap.get(urlSpan);
        if (!cardData || !urlSpan.isConnected) return;

        const openLink      = cardData.wrapper.querySelector('a[target="_blank"]');
        const rawUrl        = String(newUrl || '').trim();
        const normalizedUrl = normalizeHttpUrl(rawUrl);

        const oldStored     = cardData.wrapper.dataset.url || '';
        const oldNormalized = normalizeHttpUrl(oldStored);

        if (oldNormalized && oldNormalized !== normalizedUrl) {
            state.processedUrls.delete(oldNormalized);
        }

        if (normalizedUrl) {
            state.processedUrls.add(normalizedUrl);
        } else if (oldStored && !oldNormalized) {
            state.processedUrls.delete(oldStored);
        }

        cardData.wrapper.dataset.url = normalizedUrl || rawUrl;

        const isYouTube = isYouTubeUrl(normalizedUrl || rawUrl);
        cardData.wrapper.dataset.provider = isYouTube ? 'youtube' : '';

        if (cardData.badge) {
            cardData.badge.style.display = isYouTube ? 'flex' : 'none';
        }

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

        if (!normalizedUrl) {
            state.lastRequestedUrl.delete(urlSpan);
            cardData.title.textContent = 'Invalid URL';
            cardData.thumb.innerHTML   = '<div class="thumb-placeholder"></div>';
            return;
        }

        if (state.lastRequestedUrl.get(urlSpan) === normalizedUrl) return;
        state.lastRequestedUrl.set(urlSpan, normalizedUrl);

        cardData.title.textContent = 'Loading preview...';
        await fetchUrlPreview(normalizedUrl, urlSpan, cardData.wrapper, cardData.title, cardData.thumb);
    };

    // Inline URL editor

    const openInlineUrlEditor = (urlSpan, wrapper) => {
        if (!urlSpan || !wrapper) return;

        const currentUrl = urlSpan.textContent.trim();

        const input = createInlineEditor(
            currentUrl,
            (newUrl) => {
                urlSpan.textContent = newUrl;
                updateCardUrl(urlSpan, newUrl);
            },
            () => {}
        );

        if (!input) return;
        wrapper.appendChild(input);
        input.focus();
        input.select();
    };

    return { fetchUrlPreview, updateCardUrl, openInlineUrlEditor };
};