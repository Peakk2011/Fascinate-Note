import { getFontSize } from '../../noteStore.js';
import { MIN_WINDOW_SIZE, PLACEHOLDER_TEXT } from '../board/constants.js';

export class WindowFactory {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.board = windowManager.board;
    }
    
    createWindowElement(data) {
        const element = document.createElement('div');
        element.className = 'marker-window';
        element.dataset.id = data.id;
        this.updateStyles(element, data);
        
        // Header
        const header = this.createHeader(data);
        
        // Content
        const content = this.createContent(data);
        
        // Resize handle
        const resizeHandle = this.createResizeHandle();
        
        element.appendChild(header);
        element.appendChild(content);
        element.appendChild(resizeHandle);
        
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
        
        const badge = document.createElement('span');
        badge.className = 'marker-window-group';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'marker-window-close';
        closeButton.type = 'button';
        closeButton.setAttribute('title', 'Delete window');
        closeButton.textContent = '×';
        
        header.appendChild(title);
        header.appendChild(badge);
        header.appendChild(closeButton);
        
        return header;
    }
    
    createContent(data) {
        const content = document.createElement('div');
        content.className = 'marker-window-content';
        content.contentEditable = 'false';
        content.spellcheck = false;
        content.style.fontSize = `${getFontSize(16)}px`;
        content.style.overflow = 'auto';
        content.style.flex = '1';
        
        const isEmpty = !data.content || data.content.trim() === '';
        if (isEmpty) {
            content.textContent = '';
            content.dataset.placeholder = PLACEHOLDER_TEXT;
            content.classList.add('is-placeholder');
        } else {
            content.textContent = data.content;
            content.classList.remove('is-placeholder');
        }
        
        return content;
    }
    
    createResizeHandle() {
        const handle = document.createElement('div');
        handle.className = 'marker-window-resize';
        return handle;
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
        const closeButton = element.querySelector('.marker-window-close');
        const content = element.querySelector('.marker-window-content');
        const resizeHandle = element.querySelector('.marker-window-resize');
        
        // Title events
        title.addEventListener('dblclick', () => {
            title.readOnly = false;
            title.focus();
            title.select();
        });
        
        title.addEventListener('focus', () => {
            this.windowManager.setActiveWindow(data.id);
        });
        
        title.addEventListener('blur', () => {
            title.readOnly = true;
        });
        
        title.addEventListener('input', () => {
            data.title = title.value.trim() || 'Untitled';
            if (data.noteId) updateNote(data.noteId, { title: data.title });
            persist(this.windowManager.windows, this.board.groups, this.board.activeGroupId);
        });
        
        // Close button
        closeButton.addEventListener('pointerdown', e => e.stopPropagation());
        closeButton.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            this.windowManager.removeWindowById(data.id);
        });
        
        // Window click/drag
        let clickStart = null;
        
        element.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            if (e.target.closest('.marker-window-resize')) return;
            if (e.target.closest('.marker-window-close')) return;
            
            clickStart = { x: e.clientX, y: e.clientY };
            const toggle = e.metaKey || e.ctrlKey || e.shiftKey;
            this.windowManager.selectWindow(data.id, { toggle });
        });
        
        element.addEventListener('pointerup', e => {
            if (!clickStart) return;
            
            const dx = Math.abs(e.clientX - clickStart.x);
            const dy = Math.abs(e.clientY - clickStart.y);
            clickStart = null;
            
            if (dx < 5 && dy < 5 && !this.windowManager.drag.state && !this.board.missionView?.isActive()) {
                if (data.noteId && this.windowManager.onOpenNote) {
                    this.windowManager.onOpenNote(data.noteId);
                }
            }
        });
        
        // Header drag
        const header = element.querySelector('.marker-window-header');
        header.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            if (e.target.closest('.marker-window-close')) return;
            
            const titleInput = e.target.closest('.marker-window-title');
            if (titleInput && titleInput.readOnly === false) return;
            if (this.board.missionView?.isActive()) return;
            
            if (!titleInput) {
                e.preventDefault();
            } else if (titleInput.readOnly) {
                titleInput.blur();
            }
            
            this.windowManager.bringToFront(data.id);
            this.windowManager.setActiveWindow(data.id);
            
            const coords = this.windowManager.getCanvasCoords(e);
            this.windowManager.drag.start(data.id, coords, element);
        });
        
        // Resize events
        resizeHandle.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            resizeHandle.setPointerCapture(e.pointerId);
            this.windowManager.resize.start(data.id, e, element);
        });
    }
}