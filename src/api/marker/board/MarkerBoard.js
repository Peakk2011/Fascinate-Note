import { DEFAULT_WINDOW_SIZE } from './constants.js';
import { htmlToText, truncateText } from './utils.js';
import { loadWindows, loadGroups, loadActiveGroup, persist } from './persistence.js';
import { refreshAllPreviews, ensureCurrentWindow } from './preview.js';
import { WindowManager } from '../window/WindowManager.js';
// import { WindowFactory } from '../window/WindowFactory.js';
import { GroupManager } from '../group/GroupManager.js';
import { MissionView } from '../mission/MissionView.js';
import { getFontSize, getCurrentNoteId } from '../../noteStore.js';

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
        
        this.toolbar = document.createElement('div');
        this.toolbar.className = 'marker-toolbar';
        this.toolbar.innerHTML = `
            <button class="marker-toolbar-btn" data-action="new-note">New Note</button>
            <select class="marker-group-select" aria-label="Marker group"></select>
            <button class="marker-toolbar-btn" data-action="new-group">New Group</button>
        `;
        this.container.appendChild(this.toolbar);
        
        this.bottomBar = document.createElement('div');
        this.bottomBar.className = 'marker-bottombar';
        this.bottomBar.innerHTML = `
            <button class="marker-bottom-btn" data-action="clear-all" title="Clear all windows">🗑️</button>
            <button class="marker-bottom-btn" data-action="mission-view" title="Mission Control">☰</button>
        `;
        this.container.appendChild(this.bottomBar);
    }
    
    /**
     * Sets up event listeners for the marker board.
     */
    setupEventListeners() {
        this.toolbar.addEventListener('click', (e) => this.handleToolbarClick(e));
        this.toolbar.addEventListener('change', (e) => this.handleToolbarChange(e));
        this.bottomBar.addEventListener('click', (e) => this.handleBottomBarClick(e));
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }
    
    /**
     * Handles clicks on the toolbar.
     * @param {MouseEvent} e - The click event.
     */
    handleToolbarClick(e) {
        const button = e.target.closest('.marker-toolbar-btn');
        if (!button) return;
        
        if (button.dataset.action === 'new-note') {
            this.createNewWindow();
        } else if (button.dataset.action === 'new-group') {
            this.groupManager.createNewGroup();
        }
    }
    
    /**
     * Handles changes on the toolbar.
     * @param {Event} e - The change event.
     */
    handleToolbarChange(e) {
        const select = e.target.closest('.marker-group-select');
        if (!select) return;
        this.setActiveGroup(select.value || null);
    }
    
    /**
     * Handles clicks on the bottom bar.
     * @param {MouseEvent} e - The click event.
     */
    handleBottomBarClick(e) {
        const btn = e.target.closest('.marker-bottom-btn');
        if (!btn) return;
        
        if (btn.dataset.action === 'clear-all') {
            this.clearAllWindows();
        } else if (btn.dataset.action === 'mission-view') {
            this.missionView.toggle();
        }
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
        
        const data = this.windowManager.createWindowData({
            x: coords.x - DEFAULT_WINDOW_SIZE.width / 2,
            y: coords.y - DEFAULT_WINDOW_SIZE.height / 2,
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
        this.toolbar.remove();
        this.bottomBar.remove();
        this.layer.remove();
        this.missionView.destroy();
        window.removeEventListener('keydown', this.handleKeyDown);
    }
}