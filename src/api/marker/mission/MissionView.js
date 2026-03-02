import { MissionLayout } from './MissionLayout.js';
import { MissionDrag } from './MissionDrag.js';

export class MissionView {
    constructor({ board, container, layer, windows, windowManager, onOpenNote }) {
        this.board = board;
        this.container = container;
        this.layer = layer;
        this.windows = windows;
        this.windowManager = windowManager;
        this.onOpenNote = onOpenNote;
        
        this.overlay = null;
        this.layout = new MissionLayout(this);
        this.drag = new MissionDrag(this);
    }
    
    isActive() {
        return this.overlay !== null;
    }
    
    toggle() {
        this.isActive() ? this.exit() : this.enter();
    }
    
    enter() {
        if (this.overlay) return;
        
        this.overlay = document.createElement('div');
        this.overlay.className = 'marker-mission-overlay';
        this.container.insertBefore(this.overlay, this.layer);
        
        const visible = this.board.getVisibleWindows().filter(w => this.windowManager.windowMap.has(w.id));
        
        if (visible.length === 0) {
            this.cleanup();
            return;
        }
        
        this.layout.layoutWindows(visible);
        
        this.overlay.addEventListener('pointerdown', (e) => {
            if (e.target === this.overlay) {
                this.exit();
            }
        });
        
        // Attach drag handlers to windows
        visible.forEach(win => {
            const el = this.windowManager.windowMap.get(win.id);
            if (el) {
                this.drag.attachToWindow(win, el);
            }
        });
    }
    
    exit(onDone) {
        if (!this.overlay) {
            onDone?.();
            return;
        }
        
        const visible = this.board.getVisibleWindows().filter(w => this.windowManager.windowMap.has(w.id));
        let pending = visible.length;
        
        if (pending === 0) {
            this.cleanup();
            onDone?.();
            return;
        }
        
        visible.forEach(win => {
            const el = this.windowManager.windowMap.get(win.id);
            if (!el) {
                if (--pending === 0) {
                    this.cleanup();
                    onDone?.();
                }
                return;
            }
            
            el.style.transition = 'transform 300ms cubic-bezier(0.4, 0, 1, 1), opacity 300ms ease';
            el.style.transform = '';
            el.style.opacity = '';
            
            let handled = false;
            const handleEnd = () => {
                if (handled) return;
                handled = true;
                el.removeEventListener('transitionend', handleEnd);
                el.style.transition = '';
                el.style.transformOrigin = '';
                el.classList.remove('is-mission');
                delete el._missionTransform;
                
                if (--pending === 0) {
                    this.cleanup();
                    onDone?.();
                }
            };
            
            el.addEventListener('transitionend', handleEnd);
            setTimeout(() => handleEnd(), 400);
        });
    }
    
    cleanup() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
    
    destroy() {
        this.cleanup();
    }
}