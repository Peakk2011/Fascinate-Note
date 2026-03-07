import { MissionLayout } from './MissionLayout.js';
import { MissionDrag } from './MissionDrag.js';
import { getState, updateState } from '../utils/config.js';
import { updateViewTransform } from '../core/canvas.js';

export class MissionView {
    constructor({ board, container, layer, windows, windowManager, onOpenNote }) {
        this.board = board;
        this.container = container;
        this.layer = layer;
        this.windows = windows;
        this.windowManager = windowManager;
        this.onOpenNote = onOpenNote;
        
        this.overlay = null;
        this.handleOverlayPointerDown = null;
        this.handleLayerPointerDown = null;
        this.isExiting = false;
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
        if (this.overlay || this.isExiting) return;

        const state = getState();
        if (state) {
            if (state.zoomState && state.zoomState.animationFrame !== null) {
                cancelAnimationFrame(state.zoomState.animationFrame);
                state.zoomState.animationFrame = null;
                state.zoomState.isAnimating = false;
            }

            const rect = this.container.getBoundingClientRect();
            const centerWorldX = ((rect.width * 0.5) - state.panX) / state.scale;
            const centerWorldY = ((rect.height * 0.5) - state.panY) / state.scale;
            state.scale = 1;
            state.panX = (rect.width * 0.5) - centerWorldX;
            state.panY = (rect.height * 0.5) - centerWorldY;

            const minPanX = rect.width - state.canvasWidth;
            const minPanY = rect.height - state.canvasHeight;
            state.panX = Math.min(0, Math.max(minPanX, state.panX));
            state.panY = Math.min(0, Math.max(minPanY, state.panY));

            if (state.zoomState) {
                state.zoomState.currentScale = 1;
                state.zoomState.targetScale = 1;
                state.zoomState.currentPanX = state.panX;
                state.zoomState.currentPanY = state.panY;
                state.zoomState.targetPanX = state.panX;
                state.zoomState.targetPanY = state.panY;
            }

            updateViewTransform();
        }
        updateState({ isMissionActive: true });
        this.board.missionInfo?.classList.add('is-visible');
        
        this.overlay = document.createElement('div');
        this.overlay.className = 'marker-mission-overlay';
        this.container.insertBefore(this.overlay, this.layer);
        
        const visible = this.board.getVisibleWindows().filter(w => this.windowManager.windowMap.has(w.id));
        
        if (visible.length === 0) {
            this.cleanup();
            return;
        }

        this.board.setBottomBarHidden?.(true);
        
        this.layout.layoutWindows(visible);
        
        this.handleOverlayPointerDown = (e) => {
            if (e.target === this.overlay) {
                this.exit();
            }
        };
        this.overlay.addEventListener('pointerdown', this.handleOverlayPointerDown);

        this.handleLayerPointerDown = (e) => {
            if (e.target === this.layer) {
                this.exit();
            }
        };
        this.layer.addEventListener('pointerdown', this.handleLayerPointerDown);
        
        // Attach drag handlers to windows
        visible.forEach(win => {
            const el = this.windowManager.windowMap.get(win.id);
            if (el) {
                this.drag.attachToWindow(win, el);
            }
        });
    }
    
    exit(onDone) {
        if (this.isExiting) return;

        if (!this.overlay) {
            this.cleanup();
            onDone?.();
            return;
        }

        this.isExiting = true;
        
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
        if (this.handleLayerPointerDown) {
            this.layer.removeEventListener('pointerdown', this.handleLayerPointerDown);
            this.handleLayerPointerDown = null;
        }
        if (this.overlay) {
            if (this.handleOverlayPointerDown) {
                this.overlay.removeEventListener('pointerdown', this.handleOverlayPointerDown);
                this.handleOverlayPointerDown = null;
            }
            this.overlay.remove();
            this.overlay = null;
        }
        updateState({ isMissionActive: false });
        this.board.missionInfo?.classList.remove('is-visible');
        this.board.setBottomBarHidden?.(false);
        this.isExiting = false;
    }
    
    destroy() {
        this.cleanup();
    }
}
