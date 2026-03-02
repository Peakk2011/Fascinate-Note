import { persist } from '../board/persistence.js';

export class WindowDrag {
    constructor(windowManager) {
        this.windowManager = windowManager;
        this.state = null;
    }
    
    start(id, coords, element) {
        const data = this.windowManager.windows.find(w => w.id === id);
        if (!data) return;
        
        this.state = {
            id,
            offsetX: coords.x - data.x,
            offsetY: coords.y - data.y
        };
        
        element.classList.add('is-dragging');
        
        window.addEventListener('pointermove', this.handleMove);
        window.addEventListener('pointerup', this.handleEnd);
        window.addEventListener('pointercancel', this.handleEnd);
    }
    
    handleMove = (e) => {
        if (!this.state) return;
        
        const coords = this.windowManager.getCanvasCoords(e);
        const data = this.windowManager.windows.find(w => w.id === this.state.id);
        if (!data) return;
        
        data.x = coords.x - this.state.offsetX;
        data.y = coords.y - this.state.offsetY;
        
        const el = this.windowManager.windowMap.get(data.id);
        if (el) {
            el.style.left = `${data.x}px`;
            el.style.top = `${data.y}px`;
        }
    }
    
    handleEnd = () => {
        if (!this.state) return;
        
        const el = this.windowManager.windowMap.get(this.state.id);
        if (el) el.classList.remove('is-dragging');
        
        this.state = null;
        persist(this.windowManager.windows, this.windowManager.board.groups, this.windowManager.board.activeGroupId);
        
        window.removeEventListener('pointermove', this.handleMove);
        window.removeEventListener('pointerup', this.handleEnd);
        window.removeEventListener('pointercancel', this.handleEnd);
    }
}