// src/api/marker/window/WindowManager.js
import { WindowFactory } from './WindowFactory.js';
import { WindowDrag } from './WindowDrag.js';
import { WindowResize } from './WindowResize.js';
import { WindowSelection } from './WindowSelection.js';
import { WindowSync } from './WindowSync.js';
import { WindowData } from './WindowData.js';
import { persist } from '../board/persistence.js';
import { MIN_WINDOW_SIZE } from '../board/constants.js';
import { deleteNote } from '../sharedNoteStore.js';

export class WindowManager {
    constructor({ board, container, windows, getCanvasCoords, onOpenNote }) {
        this.board = board;
        this.container = container;
        this.windows = windows;
        this.getCanvasCoords = getCanvasCoords;
        this.onOpenNote = onOpenNote;
        
        this.windowMap = new Map();
        this.closingIds = new Set();
        
        this.drag = new WindowDrag(this);
        this.resize = new WindowResize(this);
        this.selection = new WindowSelection(this);
        this.sync = new WindowSync(this);
        this.data = new WindowData(this);
        this.factory = new WindowFactory(this);
    }
    
    rebuildWindows() {
        const currentIds = new Set(this.windows.map(w => w.id));
        
        this.windowMap.forEach((el, id) => {
            if (!currentIds.has(id)) {
                el.remove();
                this.windowMap.delete(id);
            }
        });
        
        this.windows.forEach(win => this.sync.syncWindowElement(win));
        this.selection.updateSelectionStyles();
        this.board.applyVisibility();
    }
    
    bringToFront(id) {
        const idx = this.windows.findIndex(w => w.id === id);
        if (idx === -1) return;
        
        const [win] = this.windows.splice(idx, 1);
        this.windows.push(win);
        
        const el = this.windowMap.get(id);
        if (el?.parentNode) el.parentNode.appendChild(el);
        
        this.reorderForPinning();
        persist(this.windows, this.board.groups, this.board.activeGroupId);
    }

    reorderForPinning() {
        const normal = this.windows.filter(w => !w.isPinned);
        const pinned = this.windows.filter(w => w.isPinned);
        const ordered = normal.concat(pinned);

        // Preserve array identity used by the board.
        this.windows.splice(0, this.windows.length, ...ordered);

        // Re-append DOM nodes to reflect z-order.
        ordered.forEach(w => {
            const el = this.windowMap.get(w.id);
            if (el?.parentNode) el.parentNode.appendChild(el);
        });
    }
    
    removeWindowById(id) {
        if (this.closingIds.has(id)) return;
        this.closingIds.add(id);
        
        const idx = this.windows.findIndex(w => w.id === id);
        if (idx === -1) {
            this.closingIds.delete(id);
            return;
        }
        
        const [removed] = this.windows.splice(idx, 1);
        const el = this.windowMap.get(id);
        this.windowMap.delete(id);
        
        if (el) {
            el.style.transition = 'opacity 180ms ease, transform 180ms ease';
            el.style.opacity = '0';
            el.style.transform = (el.style.transform || '') + ' scale(0.88)';
            setTimeout(() => {
                el.remove();
                this.closingIds.delete(id);
            }, 200);
        } else {
            this.closingIds.delete(id);
        }
        
        if (removed.noteId) deleteNote(removed.noteId);
        
        if (this.windows.length === 0) {
            persist(this.windows, this.board.groups, this.board.activeGroupId);
            setTimeout(() => this.board.onReturnToEditor?.(), 220);
            return;
        }
        
        persist(this.windows, this.board.groups, this.board.activeGroupId);
    }
    
    removeWindowImmediate(id) {
        const idx = this.windows.findIndex(w => w.id === id);
        let removed = null;
        
        if (idx !== -1) {
            [removed] = this.windows.splice(idx, 1);  // เก็บค่า removed ที่นี่
            if (removed.noteId) deleteNote(removed.noteId);
        }
        
        const el = this.windowMap.get(id);
        this.windowMap.delete(id);
        
        if (el) el.remove();
    }
    
    setActiveWindow(id) {
        if (this.selection.activeWindowId === id) return;
        
        if (this.selection.activeWindowId) {
            this.windowMap.get(this.selection.activeWindowId)?.classList.remove('is-active');
        }
        
        this.selection.activeWindowId = id;
        
        if (id) {
            this.windowMap.get(id)?.classList.add('is-active');
        }
    }
    
    selectWindow(id, options = {}) {
        this.selection.selectWindow(id, options);
    }
    
    clearSelection() {
        this.selection.clearSelection();
    }
    
    createWindowData(options) {
        return this.data.createWindowData(options);
    }
    
    syncWindowElement(data) {
        return this.sync.syncWindowElement(data);
    }
}
