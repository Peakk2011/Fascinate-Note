import { persist } from '../board/persistence.js';
import { getState } from '../utils/config.js';

export class MissionDrag {
    constructor(missionView) {
        this.missionView = missionView;
        this.windowManager = missionView.windowManager;
        this.board = missionView.board;
        this.container = missionView.container;
    }
    
    attachToWindow(win, element) {
        const handler = (e) => this.startDrag(e, win, element);
        element.addEventListener('pointerdown', handler, true);
        
        // Store for cleanup
        if (!element._missionDragHandler) {
            element._missionDragHandler = handler;
        }
    }
    
    startDrag(e, data, element) {
        if (!this.missionView.isActive()) return;
        if (e.button !== 0) return;
        if (e.target.closest('.marker-window-close')) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        const ac = new AbortController();
        const { signal } = ac;
        const cleanup = () => ac.abort();
        
        const { dx: baseDx = 0, dy: baseDy = 0, scale = 1 } = element._missionTransform || {};
        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const containerRect = this.container.getBoundingClientRect();
        let isDragging = false;
        let isDismissing = false;
        let clickStartTime = Date.now();
        
        element.style.transition = 'none';
        
        const onMove = (ev) => {
            const deltaX = ev.clientX - startClientX;
            const deltaY = ev.clientY - startClientY;
            
            if (!isDragging && Math.abs(deltaX) < 4 && Math.abs(deltaY) < 4) return;
            isDragging = true;
            
            const currentY = ev.clientY - containerRect.top;
            
            if (currentY < 50) {
                isDismissing = true;
                const progress = Math.max(0, Math.min(1, 1 - currentY / 50));
                const dismissScale = scale * (0.3 + progress * 0.7);
                element.style.transform = `translate(${baseDx + deltaX}px, ${baseDy + deltaY}px) scale(${dismissScale})`;
                element.style.opacity = String(progress);
            } else {
                isDismissing = false;
                element.style.transform = `translate(${baseDx + deltaX}px, ${baseDy + deltaY}px) scale(${scale})`;
                element.style.opacity = '1';
            }
        };
        
        const onUp = (ev) => {
            cleanup();
            
            const dragDuration = Date.now() - clickStartTime;
            const deltaX = Math.abs(ev.clientX - startClientX);
            const deltaY = Math.abs(ev.clientY - startClientY);
            
            if (!isDragging && deltaX < 4 && deltaY < 4 && dragDuration < 300) {
                this.missionView.exit(() => {
                    this.centerWindow(data, element);
                    if (data.noteId && this.missionView.onOpenNote) {
                        this.missionView.onOpenNote(data.noteId);
                    }
                });
                return;
            }
            
            if (isDismissing) {
                element.style.transition = 'transform 200ms ease-in, opacity 200ms ease-in';
                element.style.opacity = '0';
                element.style.transform = `translate(${baseDx}px, ${-containerRect.height}px) scale(${scale * 0.3})`;
                setTimeout(() => {
                    this.windowManager.removeWindowById(data.id);
                }, 210);
            } else if (isDragging) {
                element.style.transition = 'transform 320ms cubic-bezier(0.2, 0, 0, 1)';
                element.style.transform = `translate(${baseDx}px, ${baseDy}px) scale(${scale})`;
                element.style.opacity = '1';
            }
        };
        
        window.addEventListener('pointermove', onMove, { signal });
        window.addEventListener('pointerup', onUp, { signal });
        window.addEventListener('pointercancel', cleanup, { signal });
    }
    
    centerWindow(data, element) {
        const containerRect = this.container.getBoundingClientRect();
        const state = getState();
        const scale = state?.scale || 1;
        const panX = state?.panX || 0;
        const panY = state?.panY || 0;
        const boardW = state?.canvasWidth || containerRect.width;
        const boardH = state?.canvasHeight || containerRect.height;

        // Convert viewport center into board coordinates under current pan/zoom.
        const targetX = ((containerRect.width * 0.5) - panX) / scale - (data.width * 0.5);
        const targetY = ((containerRect.height * 0.5) - panY) / scale - (data.height * 0.5);

        const maxX = Math.max(0, boardW - data.width);
        const maxY = Math.max(0, boardH - data.height);

        data.x = Math.max(0, Math.min(maxX, targetX));
        data.y = Math.max(0, Math.min(maxY, targetY));
        
        const el = this.windowManager.windowMap.get(data.id);
        if (el) {
            el.style.transition = 'none';
            el.style.left = `${data.x}px`;
            el.style.top = `${data.y}px`;
            el.style.transform = '';
            el.style.opacity = '';
        }
        
        const winIndex = this.windowManager.windows.findIndex(w => w.id === data.id);
        if (winIndex !== -1) {
            this.windowManager.windows[winIndex] = data;
        }
        
        this.windowManager.bringToFront(data.id);
        
        persist(this.windowManager.windows, this.board.groups, this.board.activeGroupId);
    }
}