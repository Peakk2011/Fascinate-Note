/**
 * URL preview card system - card DOM factory
 * @module urlPreview/card
 */

import { normalizeHttpUrl, isYouTubeUrl } from './utils.js';

// Create preview card element
export const createCardElement = (url) => {
    if (!url) return null;

    const wrapper = document.createElement('div');
    wrapper.className  = 'link-card animate-appear';
    wrapper.draggable  = true;
    wrapper.contentEditable = 'false';
    wrapper.setAttribute('contenteditable', 'false');
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', `Link preview for ${url}`);

    const thumb = document.createElement('div');
    thumb.className = 'link-card-thumb';
    thumb.setAttribute('contenteditable', 'false');
    thumb.innerHTML = '<div class="thumb-placeholder" contenteditable="false"></div>';

    const body  = document.createElement('div');
    body.className = 'link-card-body';

    const title = document.createElement('div');
    title.className  = 'link-card-title';
    title.textContent = 'Loading preview...';
    title.setAttribute('contenteditable', 'false');

    const badge = document.createElement('div');
    badge.className = 'link-card-badge';
    badge.textContent = 'YouTube';
    badge.setAttribute('aria-hidden', 'true');

    const isYouTube = isYouTubeUrl(url);
    badge.style.display      = isYouTube ? 'flex' : 'none';
    wrapper.dataset.provider = isYouTube ? 'youtube' : '';

    const openLink = document.createElement('a');
    openLink.className       = 'link-card-open';
    openLink.contentEditable = 'false';
    openLink.setAttribute('contenteditable', 'false');
    openLink.target = '_blank';
    openLink.rel    = 'noopener noreferrer';
    openLink.textContent = 'Open';

    const normalizedUrl = normalizeHttpUrl(url);
    if (normalizedUrl) {
        openLink.href = normalizedUrl;
    } else {
        openLink.removeAttribute('href');
        openLink.setAttribute('aria-disabled', 'true');
        openLink.tabIndex = -1;
    }
    openLink.setAttribute('aria-label', `Open link preview for ${normalizedUrl || url}`);

    body.appendChild(title);
    body.appendChild(openLink);
    wrapper.appendChild(thumb);
    wrapper.appendChild(body);
    wrapper.appendChild(badge);

    // Store URL for internal tracking
    wrapper.dataset.url = url;

    // Enable drag with URL data
    wrapper.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', wrapper.dataset.url || url);
    });

    return { wrapper, thumb, title, badge };
};

// Create inline URL editor
export const createInlineEditor = (currentUrl, onSave, onCancel) => {
    if (typeof onSave !== 'function' || typeof onCancel !== 'function') return null;

    const input  = document.createElement('input');
    input.type   = 'url';
    input.value  = currentUrl || '';
    input.className = 'inline-url-editor';

    let didSubmit = false;

    const handleSave = () => {
        const newUrl = input.value.trim();
        if (newUrl) onSave(newUrl);
        input.remove();
    };

    // Auto-save on blur if valid URL
    input.addEventListener('blur', () => {
        if (didSubmit) return;

        const nextValue  = input.value.trim();
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