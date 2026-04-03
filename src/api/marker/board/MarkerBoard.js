import { DEFAULT_WINDOW_SIZE } from './constants.js';
import { htmlToText, truncateText } from './utils.js';
import { loadWindows, loadGroups, loadActiveGroup, persist } from './persistence.js';
import { refreshAllPreviews, ensureCurrentWindow } from './preview.js';
import { WindowManager } from '../window/WindowManager.js';
// import { WindowFactory } from '../window/WindowFactory.js';
import { GroupManager } from '../group/GroupManager.js';
import { MissionView } from '../mission/MissionView.js';
import { getFontSize, getCurrentNoteId } from '../sharedNoteStore.js';
import { getState } from '../utils/config.js';
import { createMarkerContextMenu } from '../window/contextMenu.js';

/**
 * Manages the marker board, including windows, groups, and interactions.
 */
export class MarkerBoard {
    /**
     * Creates an instance of MarkerBoard.
     * @param {object} options - The options for the marker board.
     * @param {HTMLElement} options.container - The container element for the board.
     * @param {function} options.getCanvasCoords - Function to get canvas coordinates.
     * @param {object} [options.groupModal=null] - The group modal instance.
     * @param {function} [options.onOpenNote=null] - Callback for when a note is opened.
     * @param {function} [options.onReturnToEditor=null] - Callback for returning to the editor.
     */
    constructor({
        container,
        getCanvasCoords,
        groupModal = null, 
        onOpenNote = null,
        onReturnToEditor = null,
    }) {
        this.container = container;
        this.getCanvasCoords = getCanvasCoords;
        this.groupModal = groupModal;
        this.onOpenNote = onOpenNote;
        this.onReturnToEditor = onReturnToEditor;

        this.windows = [];
        this.groups = [];
        this.activeGroupId = null;
        this.windowManager = null;
        this.groupManager = null;
        this.missionView = null;

        this.init();
    }

    /**
     * Initializes the marker board.
     */
    init() {
        // Load data
        this.windows = loadWindows();
        this.groups = loadGroups();
        this.activeGroupId = loadActiveGroup();

        // Migrate and prepare
        ensureCurrentWindow(this.windows);
        refreshAllPreviews(this.windows);

        // Create DOM elements
        this.createDOMElements();

        // Initialize managers
        this.windowManager = new WindowManager({
            board: this,
            container: this.layer,
            windows: this.windows,
            getCanvasCoords: this.getCanvasCoords,
            onOpenNote: this.onOpenNote
        });

        createMarkerContextMenu({
            onItemClick: (command, windowId) => this.handleContextMenuClick(command, windowId)
        });

        this.groupManager = new GroupManager({
            board: this,
            windows: this.windows,
            groups: this.groups,
            windowManager: this.windowManager
        });

        this.missionView = new MissionView({
            board: this,
            container: this.container,
            layer: this.layer,
            windows: this.windows,
            windowManager: this.windowManager,
            onOpenNote: this.onOpenNote
        });

        // Setup event listeners
        this.setupEventListeners();

        // Initial render
        this.windowManager.rebuildWindows();
        this.groupManager.updateToolbarGroups();
        this.applyVisibility();
        this.updateMissionControlStatus();

        // Save initial state
        persist(this.windows, this.groups, this.activeGroupId);
    }

    /**
     * Creates the DOM elements for the marker board.
     */
    createDOMElements() {
        this.layer = document.createElement('div');
        this.layer.className = 'marker-layer';
        this.container.appendChild(this.layer);
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modKey = isMac ? '⌘' : 'Ctrl';

        this.bottomBar = document.createElement('div');
        this.bottomBar.className = 'marker-bottombar';
        this.bottomBar.innerHTML = `
            <button class="marker-toolbar-btn" data-action="new-note">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 5V19M19 12H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="marker-group-control">
                <button class="marker-group-trigger" type="button" aria-haspopup="menu" aria-expanded="false">All Notes</button>
                <div class="marker-group-menu" role="menu" aria-hidden="true"></div>
            </div>
            <button class="marker-toolbar-btn" data-action="new-group">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9.31818 4H4.68182C4.30526 4 4 4.30526 4 4.68182V9.31818C4 9.69474 4.30526 10 4.68182 10H9.31818C9.69474 10 10 9.69474 10 9.31818V4.68182C10 4.30526 9.69474 4 9.31818 4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M18.3182 4H13.6818C13.3053 4 13 4.30526 13 4.68182V9.31818C13 9.69474 13.3053 10 13.6818 10H18.3182C18.6947 10 19 9.69474 19 9.31818V4.68182C19 4.30526 18.6947 4 18.3182 4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M9.31818 14H4.68182C4.30526 14 4 14.3053 4 14.6818V19.3182C4 19.6947 4.30526 20 4.68182 20H9.31818C9.69474 20 10 19.6947 10 19.3182V14.6818C10 14.3053 9.69474 14 9.31818 14Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M17 13H15V16H12V18H15V21H17V18H20V16H17V13Z" fill="currentColor"/>
                </svg>
            </button>
            <button class="marker-toolbar-btn marker-bottom-btn" data-action="clear-all" title="Clear all windows">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8.1813 18.2945C8.32719 19.2745 9.16866 20 10.1595 20H13.8405C14.8313 20 15.6728 19.2745 15.8187 18.2945L17.1584 9.29448C17.3383 8.08596 16.4021 7 15.1802 7H8.81976C7.59792 7 6.66166 8.08596 6.84156 9.29448L8.1813 18.2945ZM8.11036 10.3288C7.90718 9.10973 8.84726 8 10.0831 8H13.9139C15.1508 8 16.0911 9.11144 15.8863 10.3312L14.7199 17.2765C14.5602 18.2271 13.7453 18.9286 12.7816 18.945L11.279 18.9706C10.2886 18.9875 9.43503 18.2768 9.27217 17.2997L8.11036 10.3288Z" fill="currentColor" stroke="currentColor" stroke-width="0.5"/>
                    <path d="M6.35 3.69922C5.88056 3.69922 5.5 4.07978 5.5 4.54922C5.5 5.01866 5.88056 5.39922 6.35 5.39922H17.65C18.1194 5.39922 18.5 5.01866 18.5 4.54922C18.5 4.07978 18.1194 3.69922 17.65 3.69922H6.35Z" fill="currentColor"/>
                </svg>
            </button>
            <button class="marker-toolbar-btn marker-bottom-btn marker-bottom-btn--with-key" data-action="mission-view" title="Mission Control">
                <div>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 5H6C5.44772 5 5 5.44772 5 6C5 6.55228 5.44772 7 6 7H18C18.5523 7 19 6.55228 19 6C19 5.44772 18.5523 5 18 5Z" fill="currentColor"/>
                        <path d="M18 11H6C5.44772 11 5 11.4477 5 12C5 12.5523 5.44772 13 6 13H18C18.5523 13 19 12.5523 19 12C19 11.4477 18.5523 11 18 11Z" fill="currentColor"/>
                        <path d="M18 17H6C5.44772 17 5 17.4477 5 18C5 18.5523 5.44772 19 6 19H18C18.5523 19 19 18.5523 19 18C19 17.4477 18.5523 17 18 17Z" fill="currentColor"/>
                    </svg>
                </div>
                <span class="marker-toolbar-status" aria-hidden="true"></span>
            </button>
        `;
        this.container.appendChild(this.bottomBar);

        this.zoomIndicator = document.createElement('div');
        this.zoomIndicator.className = 'marker-zoom-indicator';
        this.zoomIndicator.textContent = '100%';
        this.container.appendChild(this.zoomIndicator);

        this.missionInfo = document.createElement('div');
        this.missionInfo.className = 'marker-mission-info';
        this.missionInfo.textContent = 'Drag ↑ to close';
        this.container.appendChild(this.missionInfo);
    }

    /**
     * Sets up event listeners for the marker board.
     */
    setupEventListeners() {
        this.handleBottomBarClickBound = (e) => this.handleBottomBarClick(e);
        this.handleKeyDownBound = (e) => this.handleKeyDown(e);

        this.bottomBar.addEventListener('click', this.handleBottomBarClickBound);
        this.handleOutsidePointerDown = (e) => {
            if (!this.bottomBar?.contains(e.target)) {
                this.closeGroupMenu();
            }
        };
        window.addEventListener('pointerdown', this.handleOutsidePointerDown);
        window.addEventListener('keydown', this.handleKeyDownBound);
    }

    /**
     * Handles clicks on the toolbar.
     * @param {MouseEvent} e - The click event.
     */
    handleBottomBarClick(e) {
        const groupTrigger = e.target.closest('.marker-group-trigger');
        if (groupTrigger) {
            this.toggleGroupMenu();
            return;
        }

        const groupOption = e.target.closest('.marker-group-option');
        if (groupOption) {
            const deleteButton = e.target.closest('.marker-group-delete');
            if (deleteButton) {
                e.preventDefault();
                e.stopPropagation();
                const groupId = groupOption.dataset.groupId || null;
                if (groupId) {
                    this.groupManager.removeGroup(groupId);
                }
                return;
            }

            e.preventDefault();
            this.setActiveGroup(groupOption.dataset.groupId || null);
            this.closeGroupMenu();
            return;
        }

        const button = e.target.closest('.marker-toolbar-btn');
        if (button?.dataset.action === 'new-note') {
            this.createNewWindow();
            return;
        }
        if (button?.dataset.action === 'new-group') {
            this.groupManager.createNewGroup();
            return;
        }

        const btn = e.target.closest('.marker-bottom-btn');
        if (!btn) return;

        if (btn.dataset.action === 'clear-all') {
            this.clearAllWindows();
        } else if (btn.dataset.action === 'mission-view') {
            if (!this.hasMissionContent()) {
                this.shakeBottomBar();
                return;
            }
            this.missionView.toggle();
        }
    }

    /**
     * Handles context menu item clicks.
     * @param {string} command - The command from the context menu.
     * @param {string} windowId - The ID of the window.
     */
    handleContextMenuClick(command, windowId) {
        console.log(`Context menu command: ${command}, windowId: ${windowId}`);
        switch (command) {
            case 'pin-window':
                this.toggleWindowPin(windowId);
                break;
            case 'add-comment':
                // To be implemented in Phase 3
                this.createComment(windowId);
                break;
        }
    }

    /**
     * Toggles the pinned state of a window.
     * @param {string} windowId - The ID of the window to pin/unpin.
     */
    toggleWindowPin(windowId) {
        const win = this.windows.find(w => w.id === windowId);
        if (!win) return;

        win.isPinned = !win.isPinned;
        this.windowManager.reorderForPinning();
        persist(this.windows, this.groups, this.activeGroupId);
    }

    /**
     * Creates a new comment window.
     * @param {string} forWindowId - The ID of the window the comment is for.
     */
    createComment(forWindowId) {
        const sourceWindow = this.windows.find(w => w.id === forWindowId);
        if (!sourceWindow) {
            console.warn(`Source window not found for comment creation: ${forWindowId}`);
            return;
        }

        const gap = 20;
        const newX = sourceWindow.x + sourceWindow.width + gap;
        const newY = sourceWindow.y;

        const data = this.windowManager.data.createCommentData({
            x: newX,
            y: newY,
            groupId: sourceWindow.groupId
        });

        if (data) {
            const el = this.windowManager.sync.syncWindowElement(data);
            persist(this.windows, this.groups, this.activeGroupId);
            this.applyVisibility();
            this.windowManager.selectWindow(data.id);

            const contentEl = el?.querySelector('.marker-window-content');
            if (contentEl) {
                contentEl.focus({ preventScroll: true });
                const range = document.createRange();
                range.selectNodeContents(contentEl);
                range.collapse(false);
                const selection = window.getSelection();
                selection?.removeAllRanges();
                selection?.addRange(range);
            }
        }
    }

    toggleGroupMenu() {
        const control = this.bottomBar.querySelector('.marker-group-control');
        if (!control) return;
        const isOpen = control.classList.contains('is-open');
        if (isOpen) {
            this.closeGroupMenu();
            return;
        }
        control.classList.add('is-open');
        const trigger = control.querySelector('.marker-group-trigger');
        const menu = control.querySelector('.marker-group-menu');
        trigger?.setAttribute('aria-expanded', 'true');
        menu?.setAttribute('aria-hidden', 'false');
    }

    closeGroupMenu() {
        const control = this.bottomBar?.querySelector('.marker-group-control');
        if (!control) return;
        control.classList.remove('is-open');
        const trigger = control.querySelector('.marker-group-trigger');
        const menu = control.querySelector('.marker-group-menu');
        trigger?.setAttribute('aria-expanded', 'false');
        menu?.setAttribute('aria-hidden', 'true');
    }

    setBottomBarHidden(hidden) {
        if (!this.bottomBar) return;
        if (hidden) {
            this.closeGroupMenu();
        }
        this.bottomBar.classList.toggle('is-hidden', hidden);
    }

    getMissionControlButton() {
        return this.bottomBar?.querySelector('[data-action="mission-view"]') || null;
    }

    getMinimizedWindows() {
        const scoped = this.activeGroupId === null
            ? this.windows
            : this.windows.filter(w => w.groupId === this.activeGroupId);
        return scoped.filter(w => w.isMinimized);
    }

    updateMissionControlStatus() {
        const status = this.getMissionControlButton()?.querySelector('.marker-toolbar-status');
        if (!status) return;
        const count = this.getMinimizedWindows().length;
        status.textContent = count > 0 ? `${count}` : '';
        status.classList.toggle('is-visible', count > 0);
    }

    hasMissionContent() {
        return this.getVisibleWindows().length > 0 || this.getMinimizedWindows().length > 0;
    }

    updateMissionInfoText() {
        if (!this.missionInfo) return;
        const visibleCount = this.getVisibleWindows().length;
        const minimizedCount = this.getMinimizedWindows().length;

        if (visibleCount === 0 && minimizedCount > 0) {
            this.missionInfo.textContent = 'Click below to restore';
            return;
        }

        this.missionInfo.textContent = 'Drag ↑ to close';
    }

    pulseBottomBar(mode = 'minimize') {
        if (!this.bottomBar) return;
        this.bottomBar.classList.remove('is-minimize-reacting', 'is-restore-reacting', 'is-denied');
        
        void this.bottomBar.offsetWidth;
        this.bottomBar.classList.add(mode === 'restore' ? 'is-restore-reacting' : 'is-minimize-reacting');
        
        clearTimeout(this.bottomBarPulseTimeout);
        
        this.bottomBarPulseTimeout = setTimeout(() => {
            this.bottomBar?.classList.remove('is-minimize-reacting', 'is-restore-reacting');
        }, 745);
    }

    shakeBottomBar() {
        if (!this.bottomBar) return;
        this.bottomBar.classList.remove('is-minimize-reacting', 'is-restore-reacting', 'is-denied');
        void this.bottomBar.offsetWidth;
        this.bottomBar.classList.add('is-denied');
        clearTimeout(this.bottomBarShakeTimeout);
        this.bottomBarShakeTimeout = setTimeout(() => {
            this.bottomBar?.classList.remove('is-denied');
        }, 420);
    }

    animateWindowMinimize(win, element) {
        const target = this.getMissionControlButton();
        if (!target || !element) {
            this.pulseBottomBar('minimize');
            return Promise.resolve();
        }

        const sourceRect = element.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const animationMs = 520;
        const actions = element.querySelector('.marker-window-actions');
        const ghost = element.cloneNode(true);
        ghost.classList.add('marker-window-transition-ghost', 'is-minimizing');

        ghost.style.left = `${sourceRect.left}px`;
        ghost.style.top = `${sourceRect.top}px`;
        ghost.style.width = `${sourceRect.width}px`;
        ghost.style.height = `${sourceRect.height}px`;
        ghost.style.transition = `
            left ${animationMs}ms cubic-bezier(0.18, 0.88, 0.24, 1),
            top ${animationMs}ms cubic-bezier(0.18, 0.88, 0.24, 1),
            scale ${animationMs}ms cubic-bezier(0.18, 0.88, 0.24, 1),
            opacity 150ms ease ${Math.round(animationMs * 0.68)}ms,
            filter ${Math.round(animationMs * 0.88)}ms ease
        `;
        
        document.body.appendChild(ghost);
        actions?.classList.add('is-minimizing');
        element.style.visibility = 'hidden';

        this.pulseBottomBar('minimize');

        return new Promise(resolve => {
            requestAnimationFrame(() => {
                ghost.style.left = `${targetRect.left + ((targetRect.width - sourceRect.width) * 0.5)}px`;
                ghost.style.top = `${targetRect.top + ((targetRect.height - sourceRect.height) * 0.5) + 1}px`;
                ghost.style.scale = '0.12';
                ghost.style.opacity = '0';
                ghost.style.filter = 'blur(18px)';
            });

            window.setTimeout(() => {
                actions?.classList.remove('is-minimizing');
                ghost.remove();
                resolve();
            }, animationMs + 40);
        });
    }

    animateWindowRestore(win, element) {
        if (!element) return;

        const animationMs = 340;

        element.classList.add('is-restoring');
        element.style.removeProperty('visibility');
        element.style.opacity = '0';
        element.style.filter = 'blur(24px)';
        element.style.scale = '0.72';
        element.style.willChange = 'opacity, filter, scale';

        this.pulseBottomBar('restore');

        void element.offsetWidth;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                element.style.opacity = '1';
                element.style.filter = 'blur(0)';
                element.style.scale = '1';
            });
        });

        window.setTimeout(() => {
            element.classList.remove('is-restoring');
            element.style.removeProperty('opacity');
            element.style.removeProperty('filter');
            element.style.removeProperty('scale');
            element.style.removeProperty('will-change');
        }, animationMs);
    }

    /**
     * Handles keydown events.
     * @param {KeyboardEvent} e - The keydown event.
     */
    handleKeyDown(e) {
        const isModKey = e.ctrlKey || e.metaKey;

        if (isModKey) {
            if (e.code === 'KeyT' || e.code === 'KeyN') {
                e.preventDefault();
                this.createNewWindow();
                return;
            }

            if (e.code === 'KeyW') {
                e.preventDefault();
                const activeId = this.windowManager.selection.activeWindowId;
                if (activeId) {
                    this.windowManager.removeWindowById(activeId);
                }
                return;
            }

            // Command Palatte
            if (isModKey && e.code === 'keyK') {
                e.preventDefault();
                this.onOpenCommandPalette();
                return;
            }

            if (e.code === 'Digit3' || e.code === 'Digit4' || e.code === 'Digit5') {
                e.preventDefault();
                if (!this.hasMissionContent()) {
                    this.shakeBottomBar();
                    return;
                }
                this.missionView.toggle();
                return;
            }
        }
        if (e.key === 'Escape') {
            if (this.missionView.isActive()) {
                this.missionView.exit();
            } else {
                this.windowManager.clearSelection();
            }
        }
    }

    /**
     * Creates a new window on the board.
     */
    createNewWindow() {
        const rect = this.container.getBoundingClientRect();
        const coords = this.getCanvasCoords({
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
        });
        const gap = parseFloat(getComputedStyle(document.documentElement).fontSize || '16') * 0.8;
        const position = this.findAvailableWindowPosition(
            coords.x - DEFAULT_WINDOW_SIZE.width / 2,
            coords.y - DEFAULT_WINDOW_SIZE.height / 2,
            DEFAULT_WINDOW_SIZE.width,
            DEFAULT_WINDOW_SIZE.height,
            gap
        );

        const data = this.windowManager.createWindowData({
            x: position.x,
            y: position.y,
            groupId: this.activeGroupId
        });

        if (data) {
            this.windowManager.syncWindowElement(data);
            persist(this.windows, this.groups, this.activeGroupId);
            this.applyVisibility();
            this.windowManager.selectWindow(data.id);
        }
    }

    /**
     * Adds a new group by name.
     * @param {string} name - Group name.
     */
    addGroup(name) {
        if (!name || typeof name !== 'string') return;
        this.groupManager?.addGroup(name);
    }

    findAvailableWindowPosition(baseX, baseY, width, height, gap) {
        const state = getState();
        const boardW = state?.canvasWidth || 7680;
        const boardH = state?.canvasHeight || 4320;
        const maxX = Math.max(0, boardW - width);
        const maxY = Math.max(0, boardH - height);
        const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
        const intersects = (ax, ay, bx, by) =>
            ax < bx + width &&
            ax + width > bx &&
            ay < by + height &&
            ay + height > by;
        const isOccupied = (x, y) =>
            this.windows.some(win => intersects(x, y, win.x, win.y));

        const cx = clamp(baseX, 0, maxX);
        const cy = clamp(baseY, 0, maxY);
        if (!isOccupied(cx, cy)) return { x: cx, y: cy };

        const maxRing = 40;
        for (let ring = 1; ring <= maxRing; ring++) {
            for (let oy = -ring; oy <= ring; oy++) {
                for (let ox = -ring; ox <= ring; ox++) {
                    if (Math.abs(ox) !== ring && Math.abs(oy) !== ring) continue;
                    const x = clamp(cx + (ox * gap), 0, maxX);
                    const y = clamp(cy + (oy * gap), 0, maxY);
                    if (!isOccupied(x, y)) return { x, y };
                }
            }
        }
        return { x: cx, y: cy };
    }

    /**
     * Clears all windows from the board.
     */
    clearAllWindows() {
        const toRemove = [...this.windows];
        const last = toRemove[toRemove.length - 1];

        toRemove.forEach(w => {
            if (w.id === last.id) {
                this.windowManager.removeWindowById(w.id);
            } else {
                this.windowManager.removeWindowImmediate(w.id);
            }
        });
    }

    /**
     * Sets the active group.
     * @param {string|null} groupId - The ID of the group to set as active.
     */
    setActiveGroup(groupId) {
        this.activeGroupId = groupId || null;
        persist(this.windows, this.groups, this.activeGroupId);
        this.applyVisibility();
        this.groupManager.updateToolbarGroups();
    }

    /**
     * Applies visibility to windows based on the active group.
     */
    applyVisibility() {
        const visible = new Set(this.getVisibleWindows().map(w => w.id));
        this.windowManager.windowMap.forEach((el, id) => {
            el.style.display = visible.has(id) ? '' : 'none';
        });
        this.updateMissionControlStatus();
    }

    /**
     * Gets the visible windows based on the active group.
     * @returns {Array<object>} The visible windows.
     */
    getVisibleWindows() {
        const scoped = this.activeGroupId === null
            ? this.windows
            : this.windows.filter(w => w.groupId === this.activeGroupId);
        return scoped.filter(w => !w.isMinimized);
    }

    /**
     * Refreshes the content of the current note.
     * @param {string} html - The HTML content of the note.
     */
    refreshCurrentNote(html) {
        const currentNoteId = getCurrentNoteId();
        const win = this.windows.find(w => w.noteId === currentNoteId);
        if (!win) return;

        win.content = truncateText(htmlToText(html), 260);

        const el = this.windowManager.windowMap.get(win.id);
        if (!el) return;

        const contentEl = el.querySelector('.marker-window-content');
        if (!contentEl) return;

        const isEmpty = !win.content.trim();
        contentEl.textContent = isEmpty ? '' : win.content;
        contentEl.classList.toggle('is-placeholder', isEmpty);
        persist(this.windows, this.groups, this.activeGroupId);
    }

    /**
     * Refreshes all note previews.
     */
    refreshAllNotes() {
        refreshAllPreviews(this.windows);
        this.windowManager.rebuildWindows();
    }

    /**
     * Syncs the font size of all windows.
     */
    syncFontSize() {
        const fontSize = getFontSize(16);
        this.windowManager.windowMap.forEach(el => {
            const contentEl = el.querySelector('.marker-window-content');
            if (contentEl) contentEl.style.fontSize = `${fontSize}px`;
        });
    }

    /**
     * Destroys the marker board and cleans up resources.
     */
    destroy() {
        window.removeEventListener('pointerdown', this.handleOutsidePointerDown);
        this.bottomBar.removeEventListener('click', this.handleBottomBarClickBound);
        clearTimeout(this.bottomBarPulseTimeout);
        clearTimeout(this.bottomBarShakeTimeout);
        this.bottomBar.remove();
        this.zoomIndicator?.remove();
        this.missionInfo?.remove();
        this.layer.remove();
        this.missionView.destroy();
        window.removeEventListener('keydown', this.handleKeyDownBound);
    }
}