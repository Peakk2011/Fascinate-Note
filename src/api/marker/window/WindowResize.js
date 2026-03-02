import { persist } from '../board/persistence.js';
import { MIN_WINDOW_SIZE } from '../board/constants.js';

export class WindowResize {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.state = null;
    }
    
    start(id, e, element) {
        const data = this.windowManager.windows.find(w => w.id === id);
        if (!data) return;
        
        this.state = {
            id,
            startX: e.clientX,
            startY: e.clientY,
            startW: data.width,
            startH: data.height
        };
        
        element.classList.add('is-resizing');
        
        const handle = e.target;
        handle.addEventListener('pointermove', this.handleMove);
        handle.addEventListener('pointerup', this.handleEnd);
        handle.addEventListener('pointercancel', this.handleEnd);
    }
    
    handleMove = (e) => {
        if (!this.state) return;
        
        const data = this.windowManager.windows.find(w => w.id === this.state.id);
        if (!data) return;
        
        data.width = Math.max(MIN_WINDOW_SIZE.width, this.state.startW + (e.clientX - this.state.startX));
        data.height = Math.max(MIN_WINDOW_SIZE.height, this.state.startH + (e.clientY - this.state.startY));
        
        const el = this.windowManager.windowMap.get(data.id);
        if (el) {
            el.style.width = `${data.width}px`;
            el.style.height = `${data.height}px`;
        }
    }
    
    handleEnd = (e) => {
        if (!this.state) return;
        
        const el = this.windowManager.windowMap.get(this.state.id);
        if (el) el.classList.remove('is-resizing');
        
        this.state = null;
        persist(this.windowManager.windows, this.windowManager.board.groups, this.windowManager.board.activeGroupId);
        
        const handle = e.target;
        handle.removeEventListener('pointermove', this.handleMove);
        handle.removeEventListener('pointerup', this.handleEnd);
        handle.removeEventListener('pointercancel', this.handleEnd);
    }
}