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
    constructor({ container, getCanvasCoords, groupModal = null, onOpenNote = null, onReturnToEditor = null }) {
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

        this.bottomBar = document.createElement('div');
        this.bottomBar.className = 'marker-bottombar';
        this.bottomBar.innerHTML = `
            <button class="marker-toolbar-btn" data-action="new-note">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clip-path="url(#clip0_1621_23)">
                    <path d="M20 13.1429H13.1429V20H10.8571V13.1429H4V10.8571H10.8571V4H13.1429V10.8571H20V13.1429Z" fill="black"/>
                    </g>
                    <defs>
                    <clipPath id="clip0_1621_23">
                    <rect width="24" height="24" fill="white"/>
                    </clipPath>
                    </defs>
                </svg>
            </button>
            <div class="marker-group-control">
                <button class="marker-group-trigger" type="button" aria-haspopup="menu" aria-expanded="false">All Notes</button>
                <div class="marker-group-menu" role="menu" aria-hidden="true"></div>
            </div>
            <button class="marker-toolbar-btn" data-action="new-group">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clip-path="url(#clip0_1621_17)">
                    <path d="M3 3H11V11H3V3ZM13 3H21V11H13V3ZM3 13H11V21H3V13ZM18 13H16V16H13V18H16V21H18V18H21V16H18V13Z" fill="black"/>
                    </g>
                    <defs>
                    <clipPath id="clip0_1621_17">
                    <rect width="24" height="24" fill="white"/>
                    </clipPath>
                    </defs>
                </svg>
            </button>
            <button class="marker-toolbar-btn marker-bottom-btn" data-action="clear-all" title="Clear all windows">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clip-path="url(#clip0_1621_13)">
                    <path d="M8 21H16L18 6H6L8 21ZM8.5 8H15.5L14.2703 18.8571H9.72033L8.5 8Z" fill="black"/>
                    <path d="M4 3V5H20V3H4Z" fill="black"/>
                    </g>
                    <defs>
                    <clipPath id="clip0_1621_13">
                    <rect width="24" height="24" fill="white"/>
                    </clipPath>
                    </defs>
                </svg>
            </button>
            <button class="marker-toolbar-btn marker-bottom-btn" data-action="mission-view" title="Mission Control">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="5" y="5" width="14" height="2" fill="black"/>
                    <rect x="5" y="11" width="14" height="2" fill="black"/>
                    <rect x="5" y="17" width="14" height="2" fill="black"/>
                </svg>
            </button>
        `;
        this.container.appendChild(this.bottomBar);

        this.zoomIndicator = document.createElement('div');
        this.zoomIndicator.className = 'marker-zoom-indicator';
        this.zoomIndicator.textContent = '100%';
        this.container.appendChild(this.zoomIndicator);

        this.missionInfo = document.createElement('div');
        this.missionInfo.className = 'marker-mission-info';
        this.missionInfo.textContent = 'Drag the windows to top to close and press ESC to exit';
        this.container.appendChild(this.missionInfo);
    }

    /**
     * Sets up event listeners for the marker board.
     */
    setupEventListeners() {
        this.bottomBar.addEventListener('click', (e) => this.handleBottomBarClick(e));
        this.handleOutsidePointerDown = (e) => {
            if (!this.bottomBar?.contains(e.target)) {
                this.closeGroupMenu();
            }
        };
        window.addEventListener('pointerdown', this.handleOutsidePointerDown);
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
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
            this.missionView.toggle();
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

    /**
     * Handles keydown events.
     * @param {KeyboardEvent} e - The keydown event.
     */
    handleKeyDown(e) {
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
    }

    /**
     * Gets the visible windows based on the active group.
     * @returns {Array<object>} The visible windows.
     */
    getVisibleWindows() {
        if (this.activeGroupId === null) return this.windows;
        return this.windows.filter(w => w.groupId === this.activeGroupId);
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
        this.bottomBar.remove();
        this.zoomIndicator?.remove();
        this.missionInfo?.remove();
        this.layer.remove();
        this.missionView.destroy();
        window.removeEventListener('keydown', this.handleKeyDown);
    }
}