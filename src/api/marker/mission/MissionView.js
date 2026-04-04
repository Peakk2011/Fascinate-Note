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
        this.mask = null;
        this.handleOverlayPointerDown = null;
        this.handleLayerPointerDown = null;
        this.isExiting = false;
        this.minimizedPanel = null;
        this.minimizedPanelAbort = null;
        this.minimizedSelectionIds = new Set();
        this.isShiftSelecting = false;
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
        this.board.updateMissionInfoText?.();
        this.board.missionInfo?.classList.add('is-visible');
        
        this.overlay = document.createElement('div');
        this.overlay.className = 'marker-mission-overlay';
        this.container.insertBefore(this.overlay, this.layer);

        const visible = this.board.getVisibleWindows().filter(w => this.windowManager.windowMap.has(w.id));
        const minimized = this.board.getMinimizedWindows();

        this.mask = document.createElement('div');
        this.mask.className = 'marker-mission-mask';
        this.mask.classList.toggle('is-hidden', minimized.length <= 1);
        this.container.insertBefore(this.mask, this.layer);

        if (visible.length === 0 && minimized.length === 0) {
            this.cleanup();
            return;
        }

        this.board.setBottomBarHidden?.(true);
        
        if (visible.length > 0) {
            this.layout.layoutWindows(visible);
        }
        this.renderMinimizedPanel(minimized);
        
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

        if (this.minimizedPanel) {
            pending += 1;
            this.minimizedPanel.classList.add('is-leaving');
            setTimeout(() => {
                if (--pending === 0) {
                    this.cleanup();
                    onDone?.();
                }
            }, 280);
        }
        
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
                el.classList.remove('is-mission-single');
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
        this.mask?.remove();
        this.mask = null;
        this.minimizedPanelAbort?.abort();
        this.minimizedPanelAbort = null;
        this.minimizedSelectionIds.clear();
        this.isShiftSelecting = false;
        this.minimizedPanel?.remove();
        this.minimizedPanel = null;
        updateState({ isMissionActive: false });
        this.board.missionInfo?.classList.remove('is-visible');
        this.board.setBottomBarHidden?.(false);
        this.isExiting = false;
    }

    renderMinimizedPanel(minimized) {
        this.minimizedPanel?.remove();
        this.minimizedPanel = null;

        if (!minimized.length) return;

        const panel = document.createElement('div');
        panel.className = 'marker-minimized-panel';
        panel.innerHTML = `
            <div class="marker-minimized-title">Minimized</div>
            <div class="marker-minimized-list"></div>
        `;

        const list = panel.querySelector('.marker-minimized-list');
        panel.classList.toggle('is-single-item', minimized.length <= 1);
        this.minimizedPanelAbort?.abort();
        this.minimizedPanelAbort = new AbortController();
        const { signal } = this.minimizedPanelAbort;

        const isScrollableElement = (element) => {
            if (!element) return false;

            const overflowY = window.getComputedStyle(element).overflowY;
            const canScrollY = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';

            return (
                canScrollY &&
                (element.scrollHeight - element.clientHeight) > 1
            );
        };
        
        const getScrollContainer = () => {
            if (isScrollableElement(panel)) return panel;
            if (isScrollableElement(list)) return list;
            return panel;
        };

        panel.addEventListener('wheel', (e) => {
            if (this.isShiftSelecting || e.shiftKey) {
                const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
                if (delta !== 0) {
                    const scrollContainer = getScrollContainer();
                    e.preventDefault();
                    scrollContainer.scrollTop += delta;
                }
            }
            
            e.stopPropagation();
        }, { passive: false, signal });

        window.addEventListener('keydown', (e) => {
            if (e.key !== 'Shift') return;
            this.isShiftSelecting = true;
            panel.classList.add('is-multi-selecting');
        }, { signal });

        window.addEventListener('keyup', (e) => {
            if (e.key !== 'Shift') return;
            const restoreIds = [...this.minimizedSelectionIds];
            this.isShiftSelecting = false;
            panel.classList.remove('is-multi-selecting');

            if (!restoreIds.length) return;

            this.minimizedSelectionIds.clear();
            panel.querySelectorAll('.marker-minimized-item.is-selected').forEach(item => {
                item.classList.remove('is-selected');
            });
            this.windowManager.restoreWindowsByIds(restoreIds);
        }, { signal });

        minimized.forEach(win => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'marker-minimized-item';
            item.dataset.windowId = win.id;
            
            item.innerHTML = `
                <span class="marker-minimized-item-title">${win.title || 'Untitled'}</span>
                <span class="marker-minimized-item-state">minimized</span>
            `;
            
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey || this.isShiftSelecting) {
                    if (this.minimizedSelectionIds.has(win.id)) {
                        this.minimizedSelectionIds.delete(win.id);
                        item.classList.remove('is-selected');
                 
                    } else {
                        this.minimizedSelectionIds.add(win.id);
                        item.classList.add('is-selected');
                    }
                 
                    return;
                }
                this.windowManager.restoreWindowById(win.id);
            });
            list?.appendChild(item);
        });

        this.container.appendChild(panel);
        this.minimizedPanel = panel;
        this.setupMinimizedPanelPerspective(panel, list, signal);
    }

    setupMinimizedPanelPerspective(panel, list, signal) {
        if (!panel || !list) return;

        let frame = null;
        
        const isScrollableElement = (element) => {
            if (!element) return false;

            const overflowY = window.getComputedStyle(element).overflowY;
            const canScrollY = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';

            return (
                canScrollY &&
                (element.scrollHeight - element.clientHeight) > 1
            );
        };
        
        const getScrollContainer = () => {
            if (isScrollableElement(panel)) return panel;
            if (isScrollableElement(list)) return list;
            return panel;
        };
        
        const getItems = () => [...list.querySelectorAll('.marker-minimized-item')];
        
        const getViewportMetrics = () => {
            const scrollContainer = getScrollContainer();
            const scrollRect = scrollContainer.getBoundingClientRect();

            return {
                scrollContainer,
                viewportTop: scrollRect.top,
                viewportBottom: scrollRect.bottom,
                viewportCenterY: scrollRect.top + (scrollRect.height * 0.5)
            };
        };
        
        const getAnchorIndex = (items, metrics) => {
            if (!items.length) return -1;

            if (metrics.scrollContainer.scrollTop <= 1) {
                return 0;
            }

            let anchorIndex = 0;
            let smallestDistance = Number.POSITIVE_INFINITY;

            items.forEach((item, index) => {
                const rect = item.getBoundingClientRect();
                const isVisible = rect.bottom > metrics.viewportTop && rect.top < metrics.viewportBottom;
                if (!isVisible) return;

                const itemCenterY = rect.top + (rect.height * 0.5);
                const distance = Math.abs(itemCenterY - metrics.viewportCenterY);

                if (distance < smallestDistance) {
                    smallestDistance = distance;
                    anchorIndex = index;
                }
            });

            return anchorIndex;
        };
        
        const getScaleForDistance = (distanceFromAnchor) => {
            const scaleStops = [1, 0.92, 0.84, 0.77, 0.72];
            return scaleStops[Math.min(distanceFromAnchor, scaleStops.length - 1)];
        };
        
        const update = () => {
            frame = null;
            const items = getItems();
            if (!items.length) return;

            const metrics = getViewportMetrics();
            const anchorIndex = getAnchorIndex(items, metrics);

            items.forEach((item, index) => {
                const distanceFromAnchor = Math.abs(index - anchorIndex);
                const scale = getScaleForDistance(distanceFromAnchor);
                item.style.setProperty('--marker-minimized-item-scale', scale.toFixed(3));
            });
        };

        const scheduleUpdate = () => {
            if (frame !== null) return;
            frame = requestAnimationFrame(update);
        };

        panel.addEventListener('scroll', scheduleUpdate, { passive: true, signal });
        list.addEventListener('scroll', scheduleUpdate, { passive: true, signal });
        window.addEventListener('resize', scheduleUpdate, { passive: true, signal });
        requestAnimationFrame(update);
    }
    
    destroy() {
        this.cleanup();
    }
}
