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
    wrapper.tabIndex   = 0;
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

    // Create corner-only resize handles for active preview cards
    ['nw', 'ne', 'se', 'sw'].forEach((pos) => {
        const handle = document.createElement('div');
        handle.className = `link-card-handle ${pos}`;
        handle.dataset.handle = pos;
        handle.setAttribute('aria-hidden', 'true');
        handle.contentEditable = 'false';
        wrapper.appendChild(handle);
    });

    let resizeState = null;

    const onPointerMove = (event) => {
        if (!resizeState) return;

        const dx = event.clientX - resizeState.startX;
        const dy = event.clientY - resizeState.startY;
        const aspectRatio = 16 / 9;
        const minWidth = 220;
        const minHeight = Math.round(minWidth * 9 / 16);

        const parent = wrapper.parentElement;
        const maxWidth = parent ? Math.max(minWidth, parent.clientWidth - 24) : Infinity;
        const maxHeight = parent ? Math.max(minHeight, parent.clientHeight - 24) : Infinity;

        const xSign = resizeState.handle.includes('w') ? -1 : 1;
        const ySign = resizeState.handle.includes('n') ? -1 : 1;

        const widthFromX = resizeState.startWidth + dx * xSign;
        const widthFromY = (resizeState.startHeight + dy * ySign) * aspectRatio;
        let nextWidth = Math.max(minWidth, Math.min(maxWidth, Math.max(widthFromX, widthFromY)));
        let nextHeight = Math.max(minHeight, Math.round(nextWidth / aspectRatio));

        if (nextHeight > maxHeight) {
            nextHeight = maxHeight;
            nextWidth = Math.round(maxHeight * aspectRatio);
        }

        wrapper.style.width = `${nextWidth}px`;
        wrapper.style.height = `${nextHeight}px`;
    };

    const onPointerUp = () => {
        if (!resizeState) return;
        wrapper.classList.remove('is-resizing');
        resizeState = null;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
    };

    wrapper.addEventListener('pointerdown', (event) => {
        const resizeHandle = event.target.closest('.link-card-handle');
        if (resizeHandle && event.button === 0) {
            event.preventDefault();
            event.stopPropagation();

            wrapper.focus();
            wrapper.classList.add('is-resizing');

            const rect = wrapper.getBoundingClientRect();
            const handle = resizeHandle.dataset.handle || 'se';
            resizeState = {
                startX: event.clientX,
                startY: event.clientY,
                startWidth: rect.width,
                startHeight: rect.height,
                handle,
            };

            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            return;
        }

        if (!event.target.closest('a')) {
            wrapper.focus();
        }
    });

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