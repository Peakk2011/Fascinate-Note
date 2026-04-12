import { getFontSize, updateNote } from '../sharedNoteStore.js';
import { PLACEHOLDER_TEXT } from '../board/constants.js';
import { persist } from '../board/persistence.js';
import { hasRenderableContent } from '../board/utils.js';
import { getState } from '../utils/config.js';
import { focusWindowAtScale } from '../controllers/zoomPan.js';
import { showContextMenu } from './contextMenu.js';

export class WindowFactory {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.board = windowManager.board;
    }

    syncTitleInlineWidth(titleEl) {
        if (!titleEl) return;
        const raw = typeof titleEl.value === 'string' ? titleEl.value : '';
        const text = raw.trim() || 'Untitled';
        const windowEl = titleEl.closest('.marker-window');
        if (!windowEl) return;

        const windowWidth = windowEl.offsetWidth;
        const maxWidthPx = windowWidth * 0.4; // 40% of window width
        const minWidthPx = 4 * 14.5; // 4ch at 14.5px font-size
        const widthPx = Math.min(Math.max(text.length * 14.5, minWidthPx), maxWidthPx);

        titleEl.style.width = `${widthPx}px`;
        titleEl.style.maxWidth = `${maxWidthPx}px`;
    }

    createWindowElement(data) {
        const element = document.createElement('div');
        element.className = 'marker-window';

        if (data.type === 'comment') {
            element.classList.add('is-comment-stickie');
        }

        element.dataset.id = data.id;
        this.updateStyles(element, data);

        // Header
        const header = this.createHeader(data);

        // Content
        const content = this.createContent(data);

        // Resize handle
        const resizeHandle = this.createResizeHandle();
        const lodPreview = this.createLodPreview(data);

        element.appendChild(header);
        element.appendChild(content);
        element.appendChild(resizeHandle);
        element.appendChild(lodPreview);

        this.updateGroupBadge(element, data.groupId);
        this.attachEvents(element, data);

        return element;
    }

    createHeader(data) {
        const header = document.createElement('div');
        header.className = 'marker-window-header';

        const title = document.createElement('input');
        title.className = 'marker-window-title';
        title.type = 'text';
        title.value = data.title || 'Untitled';
        title.spellcheck = false;
        title.autocomplete = 'off';
        title.readOnly = true;
        this.syncTitleInlineWidth(title);

        const badge = document.createElement('span');
        badge.className = 'marker-window-group';

        const actions = document.createElement('div');
        actions.className = 'marker-window-actions';

        const closeButton = document.createElement('button');
        closeButton.className = 'marker-window-close';
        closeButton.type = 'button';
        closeButton.setAttribute('title', 'Delete window');
        closeButton.textContent = '×';

        if (data.type !== 'comment') {
            const minimizeButton = document.createElement('button');
            minimizeButton.className = 'marker-window-minimize';
            minimizeButton.type = 'button';
            minimizeButton.setAttribute('title', 'Minimize window');
            minimizeButton.textContent = '−';
            actions.appendChild(minimizeButton);
        }
        actions.appendChild(closeButton);
        header.appendChild(title);
        header.appendChild(badge);
        header.appendChild(actions);

        return header;
    }

    createContent(data) {
        const content = document.createElement('div');
        content.className = 'marker-window-content';
        content.spellcheck = false;
        content.style.fontSize = `${getFontSize(16)}px`;
        content.style.overflow = 'auto';
        content.style.flex = '1';

        if (data.type === 'comment') {
            content.contentEditable = 'true';
            const isEmpty = !data.content || data.content.trim() === '';
            if (isEmpty) {
                content.textContent = '';
                content.dataset.placeholder = 'Add Comment...';
                content.classList.add('is-placeholder');
            } else {
                content.textContent = data.content;
                content.classList.remove('is-placeholder');
            }
        } else {
            content.contentEditable = 'false';
            const previewHtml = typeof data.previewHtml === 'string'
                ? data.previewHtml
                : '';
            const isEmpty = !hasRenderableContent(previewHtml);
            if (isEmpty) {
                content.innerHTML = '';
                content.dataset.placeholder = PLACEHOLDER_TEXT;
                content.classList.add('is-placeholder');
            } else {
                content.innerHTML = previewHtml;
                content.classList.remove('is-placeholder');
            }
        }

        return content;
    }

    createResizeHandle() {
        const handle = document.createElement('div');
        handle.className = 'marker-window-resize';
        return handle;
    }

    createLodPreview(data) {
        const wrapper = document.createElement('div');
        wrapper.className = 'marker-window-lod';
        wrapper.innerHTML = `
            <!-- <img class="marker-window-lod-icon" src="/marker/starindcl.svg" alt="" /> -->
            <picture class="marker-window-lod-icon">
                <source srcset="./assets/marker/starindcl-dark.svg" media="(prefers-color-scheme: dark)" />
                <img src="./assets/marker/starindcl.svg" alt="" />
            </picture>
            <div class="marker-window-lod-title">${data.title || 'Untitled'}</div>
        `;
        return wrapper;
    }

    updateStyles(element, data) {
        element.style.left = `${data.x}px`;
        element.style.top = `${data.y}px`;
        element.style.width = `${data.width}px`;
        element.style.height = `${data.height}px`;
    }

    updateGroupBadge(element, groupId) {
        const badge = element.querySelector('.marker-window-group');
        if (!badge) return;

        if (!groupId) {
            badge.textContent = '';
            badge.classList.remove('show');
            badge.style.removeProperty('--marker-group-color');
            return;
        }

        const group = this.board.groups.find(g => g.id === groupId);
        badge.textContent = group?.name || 'Group';
        badge.style.setProperty('--marker-group-color', group?.color || '#7aa5ff');
        badge.classList.add('show');
    }

    attachEvents(element, data) {
        const title = element.querySelector('.marker-window-title');
        const minimizeButton = element.querySelector('.marker-window-minimize');
        const closeButton = element.querySelector('.marker-window-close');
        const content = element.querySelector('.marker-window-content');
        const resizeHandle = element.querySelector('.marker-window-resize');
        const beginWindowDrag = (e) => {
            this.windowManager.bringToFront(data.id);
            this.windowManager.setActiveWindow(data.id);

            const coords = this.windowManager.getCanvasCoords(e);
            this.windowManager.drag.start(data.id, coords, element);
        };

        const startWindowDrag = (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('.marker-window-close')) return;
            if (e.target.closest('.marker-window-minimize')) return;
            if (e.target.closest('.marker-window-resize')) return;
            if (this.board.missionView?.isActive()) return;

            const titleInput = e.target.closest('.marker-window-title');
            if (titleInput) return;

            e.preventDefault();
            beginWindowDrag(e);
        };

        // Title events
        const startTitleEdit = () => {
            if (!title.readOnly) return;
            title.readOnly = false;
            title.focus();
            title.select();
        };

        title.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            this.windowManager.selectWindow(data.id);
        });

        title.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            startTitleEdit();
        });

        title.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            startTitleEdit();
        });

        title.addEventListener('focus', () => {
            this.windowManager.setActiveWindow(data.id);
        });

        title.addEventListener('blur', () => {
            title.readOnly = true;
            this.syncTitleInlineWidth(title);
        });

        title.addEventListener('input', () => {
            data.title = title.value.trim() || 'Untitled';
            this.syncTitleInlineWidth(title);
            if (data.noteId) updateNote(data.noteId, { title: data.title });
            persist(this.windowManager.windows, this.board.groups, this.board.activeGroupId);
        });

        title.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                title.blur();
            }
        });

        minimizeButton?.addEventListener('pointerdown', e => e.stopPropagation());

        minimizeButton?.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            this.windowManager.minimizeWindowById(data.id);
        });

        // Close button
        closeButton.addEventListener('pointerdown', e => e.stopPropagation());
        
        closeButton.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            this.windowManager.removeWindowById(data.id);
        });

        // Content editing for comments
        if (data.type === 'comment') {
            content.addEventListener('input', () => {
                data.content = content.textContent;
                const isEmpty = !data.content || data.content.trim() === '';
                if (isEmpty) {
                    content.textContent = '';
                }
                content.classList.toggle('is-placeholder', isEmpty);
                persist(this.windowManager.windows, this.board.groups, this.board.activeGroupId);
            });
        }

        // Window click/drag
        let clickStart = null;

        element.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            if (e.target.closest('.marker-window-resize')) return;
            if (e.target.closest('.marker-window-close')) return;
            if (e.target.closest('.marker-window-minimize')) return;

            clickStart = { x: e.clientX, y: e.clientY };
            
            const toggle = e.metaKey || e.ctrlKey || e.shiftKey;
            this.windowManager.selectWindow(data.id, { toggle });
        });

        if (data.type === 'comment') {
            element.addEventListener('pointerdown', (e) => {
                if (e.target.closest('.marker-window-content')) return;
                startWindowDrag(e);
            });
        }

        element.addEventListener('pointerup', e => {
            if (!clickStart) return;

            if (e.target.closest('.marker-window-title')) {
                clickStart = null;
                return;
            }

            const dx = Math.abs(e.clientX - clickStart.x);
            const dy = Math.abs(e.clientY - clickStart.y);
            clickStart = null;

            if (dx < 5 && dy < 5 && !this.windowManager.drag.state && !this.board.missionView?.isActive()) {
                if (data.type === 'comment') return;
                const state = getState();
                
                if ((state?.scale || 1) <= 0.4) {
                    e.preventDefault();
                    e.stopPropagation();
                    focusWindowAtScale(data, 1);
                    return;
                }

                if (data.noteId && this.windowManager.onOpenNote) {
                    this.windowManager.onOpenNote(data.noteId);
                }
            }
        });

        // Header drag
        const header = element.querySelector('.marker-window-header');

        header.addEventListener('pointerdown', startWindowDrag);

        header.addEventListener('contextmenu', (e) => {
            if (data.type === 'comment') return;
            showContextMenu({
                event: e,
                windowId: data.id,
                isPinned: !!data.isPinned
            });
        });

        // Resize events
        resizeHandle.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;

            e.preventDefault();
            e.stopPropagation();

            resizeHandle.setPointerCapture(e.pointerId);

            this.windowManager.resize.start(
                data.id,
                e,
                element
            );
        });
    }
}