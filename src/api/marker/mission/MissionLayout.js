import { getState } from '../utils/config.js';

export class MissionLayout {
    constructor(missionView) {
        this.missionView = missionView;
        this.board = missionView.board;
        this.windowManager = missionView.windowManager;
    }
    
    layoutWindows(visible) {
        const count = visible.length;
        const containerW = this.board.container.offsetWidth;
        const containerH = this.board.container.offsetHeight;
        const state = getState();
        const viewScale = state?.scale || 1;
        const viewPanX = state?.panX || 0;
        const viewPanY = state?.panY || 0;
        
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        
        const gridWidth = containerW * 0.8;
        const gridHeight = containerH * 0.8;
        
        const startX = (containerW - gridWidth) / 2;
        const startY = (containerH - gridHeight) / 2;
        
        const gap = 20;
        
        const cellWidth = (gridWidth - (gap * (cols - 1))) / cols;
        const cellHeight = (gridHeight - (gap * (rows - 1))) / rows;
        
        visible.forEach((win, index) => {
            const el = this.windowManager.windowMap.get(win.id);
            if (!el) return;
            
            const col = index % cols;
            const row = Math.floor(index / cols);
            
            // Mission layout targets viewport space; compensate current board zoom.
            const scaleW = cellWidth / (win.width * viewScale);
            const scaleH = cellHeight / (win.height * viewScale);
            const scale = Math.min(scaleW, scaleH, 0.95);
            
            const scaledW = win.width * scale;
            const scaledH = win.height * scale;
            
            const cellX = startX + col * (cellWidth + gap);
            const cellY = startY + row * (cellHeight + gap);
            const targetX = cellX + (cellWidth - scaledW) / 2;
            const targetY = cellY + (cellHeight - scaledH) / 2;
            
            const dx = ((targetX - viewPanX) / viewScale) - win.x;
            const dy = ((targetY - viewPanY) / viewScale) - win.y;
            
            el._missionTransform = { dx, dy, scale };
            
            el.style.transition = 'transform 400ms cubic-bezier(0.25, 0.1, 0.25, 1)';
            el.style.transformOrigin = '0 0';
            el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
            el.classList.add('is-mission');
        });
    }
}