import {
    loadConfiguration,
    getState,
    updateState,
    getConfig
} from './utils/config.js';

// note storage integration for marker windows
import {
    createNote,
    getNoteById,
    updateNote,
    deleteNote,
    getCurrentNoteId
} from '../../renderer/scripts/note/noteStore.js';

const STORAGE_KEYS = {
    windows: 'markerWindows',
    groups: 'markerGroups'
};

const CURRENT_WINDOW_ID = 'current-note';
const DEFAULT_WINDOW_SIZE = { width: 320, height: 200 };
const MIN_WINDOW_SIZE = { width: 220, height: 140 };

const safeParse = (value, fallback) => {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const saveToStorage = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Ignore storage errors.
    }
};

const loadWindows = () => safeParse(localStorage.getItem(STORAGE_KEYS.windows), []);
const loadGroups = () => safeParse(localStorage.getItem(STORAGE_KEYS.groups), []);

const createId = () => {
    // crypto.randomUUID() is available in modern browsers

    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `win_${crypto.randomUUID()}`;
    }

    // Timestamp + random bytes
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 15);
    return `win_${timestamp}_${random}`;
};

const migrateWindows = (windows) => {
    windows.forEach((win) => {
        if (!win.hasOwnProperty('noteId')) {
            win.noteId = null; // will be populated lazily by refreshWindowPreview
        }
    });
};

// Update title/content preview for a single window based on its note
const refreshWindowPreview = (win) => {
    if (!win.noteId) {
        const note = createNote({ title: win.title || 'New Note' });
        win.noteId = note.id;
    }
    const note = getNoteById(win.noteId);
    if (note) {
        win.title = note.title || win.title;
        win.content = truncateText(htmlToText(note.html), 260);
    }
};

// Convenience helper to update all windows at once
const refreshAllPreviews = (windows) => {
    windows.forEach(refreshWindowPreview);
};

const sanitizeText = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/\s+/g, ' ').trim();
};

const htmlToText = (html) => {
    const holder = document.createElement('div');
    holder.innerHTML = html || '';
    return sanitizeText(holder.textContent || '');
};

const truncateText = (text, max = 220) => {
    if (text.length <= max) return text;
    return `${text.slice(0, max).trim()}…`;
};

const getGroupById = (groups, id) => groups.find((group) => group.id === id);

const randomColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 60%)`;
};

const ensureCurrentWindow = (windows) => {
    const existing = windows.find((item) => item.id === CURRENT_WINDOW_ID);
    if (existing) {
        existing.isCurrent = true;
        existing.title = existing.title || 'Current Notes';
        // make sure it has a linked note id
        if (!existing.noteId) {
            existing.noteId = getCurrentNoteId();
        }
        return existing;
    }

    const current = {
        id: CURRENT_WINDOW_ID,
        title: 'Current Notes',
        content: '',
        x: 360,
        y: 260,
        width: 360,
        height: 220,
        color: '#7aa5ff',
        groupId: null,
        isCurrent: true,
        noteId: getCurrentNoteId()
    };
    windows.unshift(current);
    return current;
};

/**
 * @param {Object} options
 * @param {HTMLElement} options.container
 * @param {Function} options.getCanvasCoords
 * @param {{ show: Function, hide: Function } | null} options.groupModal
 * @param {Function|null} [options.onOpenNote] - Callback to open a note in the editor.
 * @param {Function|null} [options.onReturnToEditor] - Callback to return to the editor from current view.
 */
export const initMarkerBoard = ({
    container,
    getCanvasCoords,
    groupModal = null,
    onOpenNote = null,
    onReturnToEditor = null
} = {}) => {
    if (!container) return null;

    const layer = document.createElement('div');
    layer.className = 'marker-layer';
    container.appendChild(layer);

    const toolbar = document.createElement('div');
    toolbar.className = 'marker-toolbar';
    toolbar.innerHTML = `
        <button class="marker-toolbar-btn" data-action="new-note">New Note</button>
        <select class="marker-group-select" aria-label="Marker group"></select>
        <button class="marker-toolbar-btn" data-action="new-group">New Group</button>
    `;
    container.appendChild(toolbar);

    // bottom navigation bar for extra controls
    const bottomBar = document.createElement('div');
    bottomBar.className = 'marker-bottombar';
    bottomBar.innerHTML = `
        <button class="marker-bottom-btn" data-action="clear-all" title="Clear all windows">🗑️</button>
        <button class="marker-bottom-btn" data-action="mission-view" title="Show all windows">☰</button>
    `;
    container.appendChild(bottomBar);

    let windows = loadWindows();
    let groups = loadGroups();

    // make sure every stored window has an associated note id and up-to-date preview
    migrateWindows(windows);
    refreshAllPreviews(windows);

    ensureCurrentWindow(windows);

    const windowMap = new Map();
    const selectedIds = new Set();
    let dragState = null;
    let createState = null;

    // bring a window to the top of the z-order / DOM order
    const bringToFront = (id) => {
        const idx = windows.findIndex(w => w.id === id);
        if (idx === -1) return;
        const [win] = windows.splice(idx, 1);
        windows.push(win);
        const el = windowMap.get(id);
        if (el && el.parentNode) {
            el.parentNode.appendChild(el);
        }
        persist();
        if (missionOverlay) updateMissionOverlay();
    };

    const removeWindowById = (id) => {
        const idx = windows.findIndex(w => w.id === id);
        if (idx === -1) return;
        const [removed] = windows.splice(idx, 1);
        const el = windowMap.get(id);
        if (el) el.remove();
        windowMap.delete(id);
        if (removed.noteId) {
            deleteNote(removed.noteId);
        }
        persist();
        if (missionOverlay) updateMissionOverlay();
    };

    const persist = () => {
        saveToStorage(STORAGE_KEYS.windows, windows);
        saveToStorage(STORAGE_KEYS.groups, groups);
    };

    const updateToolbarGroups = () => {
        const select = toolbar.querySelector('.marker-group-select');
        if (!select) return;
        select.innerHTML = '';

        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.textContent = 'No Group';
        select.appendChild(noneOption);

        groups.forEach((group) => {
            const opt = document.createElement('option');
            opt.value = group.id;
            opt.textContent = group.name;
            select.appendChild(opt);
        });
    };

    const updateWindowStyles = (element, data) => {
        element.style.left = `${data.x}px`;
        element.style.top = `${data.y}px`;
        element.style.width = `${data.width}px`;
        element.style.height = `${data.height}px`;
        element.style.setProperty('--marker-window-color', data.color || '#7aa5ff');

        if (data.isCurrent) {
            element.classList.add('is-current');
        } else {
            element.classList.remove('is-current');
        }
    };

    const updateGroupBadge = (element, groupId) => {
        const badge = element.querySelector('.marker-window-group');
        if (!badge) return;

        if (!groupId) {
            badge.textContent = '';
            badge.classList.remove('show');
            badge.style.removeProperty('--marker-group-color');
            return;
        }

        const group = getGroupById(groups, groupId);
        badge.textContent = group?.name || 'Group';
        badge.style.setProperty('--marker-group-color', group?.color || '#7aa5ff');
        badge.classList.add('show');
    };

    const updateSelectionStyles = () => {
        windowMap.forEach((element, id) => {
            element.classList.toggle('is-selected', selectedIds.has(id));
        });
    };

    const clearSelection = () => {
        selectedIds.clear();
        updateSelectionStyles();
    };

    const selectWindow = (id, { toggle } = {}) => {
        if (!id) return;
        if (toggle) {
            if (selectedIds.has(id)) {
                selectedIds.delete(id);
            } else {
                selectedIds.add(id);
            }
        } else {
            selectedIds.clear();
            selectedIds.add(id);
            bringToFront(id);
        }
        updateSelectionStyles();
    };

    const createWindowElement = (data) => {
        const element = document.createElement('div');
        element.className = 'marker-window';
        element.dataset.id = data.id;
        updateWindowStyles(element, data);

        const header = document.createElement('div');
        header.className = 'marker-window-header';

        const title = document.createElement('input');
        title.className = 'marker-window-title';
        title.type = 'text';
        title.value = data.title || 'Untitled';
        title.spellcheck = false;
        title.autocomplete = 'off';
        title.readOnly = Boolean(data.isCurrent);

        const badge = document.createElement('span');
        badge.className = 'marker-window-group';

        const colorButton = document.createElement('button');
        colorButton.className = 'marker-window-color';
        colorButton.type = 'button';
        colorButton.setAttribute('title', 'Change color');

        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.className = 'marker-window-color-input';
        colorInput.value = data.color || '#7aa5ff';

        const closeButton = document.createElement('button');
        closeButton.className = 'marker-window-close';
        closeButton.type = 'button';
        closeButton.setAttribute('title', 'Close');
        closeButton.textContent = '×';

        colorButton.appendChild(colorInput);
        header.appendChild(title);
        header.appendChild(badge);
        header.appendChild(colorButton);
        header.appendChild(closeButton);

        const content = document.createElement('div');
        content.className = 'marker-window-content';
        // windows act as previews only; editing happens in the main editor
        content.contentEditable = 'false';
        content.spellcheck = false;
        content.textContent = data.content || '';

        element.appendChild(header);
        element.appendChild(content);

        updateGroupBadge(element, data.groupId);

        title.addEventListener('input', () => {
            data.title = title.value.trim() || 'Untitled';
            if (data.noteId) {
                updateNote(data.noteId, { title: data.title });
            }
            persist();
            if (missionOverlay) updateMissionOverlay();
        });

        colorButton.addEventListener('click', (e) => {
            e.preventDefault();
            colorInput.click();
        });

        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            removeWindowById(data.id);
        });

        colorInput.addEventListener('input', () => {
            data.color = colorInput.value;
            updateWindowStyles(element, data);
            persist();
            if (missionOverlay) updateMissionOverlay();
        });


        // track click vs drag for opening notes
        let clickStart = null;
        element.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            clickStart = { x: e.clientX, y: e.clientY };

            // selection logic
            if (!e.target.closest('.marker-window-color-input') &&
                !e.target.closest('.marker-window-color') &&
                !e.target.closest('.marker-window-close')) {
                const toggle = e.metaKey || e.ctrlKey || e.shiftKey;
                selectWindow(data.id, { toggle });
            }
        });

        element.addEventListener('pointerup', (e) => {
            if (!clickStart) return;
            const dx = Math.abs(e.clientX - clickStart.x);
            const dy = Math.abs(e.clientY - clickStart.y);
            clickStart = null;
            // treat as open if click without movement and not part of a drag
            if (dx < 5 && dy < 5 && !dragState) {
                if (data.id === CURRENT_WINDOW_ID) {
                    if (onReturnToEditor) {
                        // simple zoom-out animation then invoke callback
                        const anim = container.animate([
                            { transform: 'scale(1)' },
                            { transform: 'scale(0.8)' }
                        ], { duration: 250, easing: 'ease-in-out' });
                        anim.finished.then(() => onReturnToEditor());
                    }
                } else {
                    if (data.noteId && onOpenNote) {
                        onOpenNote(data.noteId);
                    } else if (!data.noteId) {
                        console.warn(`Window ${data.id} has no noteId; note may have failed to created`);
                    }
                }
            }
        });

        header.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            // ignore clicks on controls
            if (e.target.closest('.marker-window-color')) return;
            if (e.target.closest('.marker-window-close')) return;
            // if user clicked the title input and it's editable, let them type instead of dragging
            const titleEl = e.target.closest('.marker-window-title');
            if (titleEl && !titleEl.readOnly) {
                return;
            }

            e.preventDefault();
            bringToFront(data.id);
            const coords = getCanvasCoords(e);
            dragState = {
                id: data.id,
                offsetX: coords.x - data.x,
                offsetY: coords.y - data.y
            };

            element.classList.add('is-dragging');
            window.addEventListener('pointermove', onDragMove);
            window.addEventListener('pointerup', onDragEnd);
        });

        return element;
    };

    const syncWindowElement = (data) => {
        // keep text/preview in sync with note if possible
        refreshWindowPreview(data);
        let element = windowMap.get(data.id);
        if (!element) {
            element = createWindowElement(data);
            windowMap.set(data.id, element);
            layer.appendChild(element);
        } else {
            const title = element.querySelector('.marker-window-title');
            const content = element.querySelector('.marker-window-content');
            if (title && title.value !== data.title) {
                title.value = data.title || 'Untitled';
            }
            if (content && !data.isCurrent) {
                content.textContent = data.content || '';
            }
        }
        updateWindowStyles(element, data);
        updateGroupBadge(element, data.groupId);
        return element;
    };

    const rebuildWindows = () => {
        layer.innerHTML = '';
        windowMap.clear();
        windows.forEach((win) => {
            const element = createWindowElement(win);
            windowMap.set(win.id, element);
            layer.appendChild(element);
        });
        updateSelectionStyles();
    };

    const applyGroupToSelection = (groupId) => {
        if (selectedIds.size === 0) return;
        windows.forEach((win) => {
            if (!selectedIds.has(win.id)) return;
            win.groupId = groupId || null;
            const element = windowMap.get(win.id);
            if (element) {
                updateGroupBadge(element, win.groupId);
            }
        });
        persist();
    };

    /**
     * Called by groupModal.onConfirm — adds group to state and applies to selection
     * @param {string} name
     */
    const addGroup = (name) => {
        const group = {
            id: createId(),
            name: name.trim().slice(0, 36),
            color: randomColor()
        };
        groups.push(group);
        updateToolbarGroups();

        const select = toolbar.querySelector('.marker-group-select');
        if (select) select.value = group.id;

        applyGroupToSelection(group.id);
        persist();
    };

    /**
     * Opens the group modal if available
     */
    const createNewGroup = () => {
        if (groupModal) {
            groupModal.show();
        } else {
            console.warn('[MarkerBoard] groupModal not provided');
        }
    };

    const createWindowData = ({ x, y, width, height } = {}) => {
        const note = createNote({ title: 'New Note' });
        if (!note?.id) {
            console.error('Failed to create note for window - aborting window creation');
            return null;
        }
        
        // Store only the noteId (reference), never the note object
        const data = {
            id: createId(),
            title: note.title || 'New Note',
            content: '',
            x: x ?? 320,
            y: y ?? 240,
            width: width ?? DEFAULT_WINDOW_SIZE.width,
            height: height ?? DEFAULT_WINDOW_SIZE.height,
            color: randomColor(),
            groupId: null,
            isCurrent: false,
            noteId: note.id
        };
        windows.push(data);
        return data;
    };

    const createWindowAt = (coords) => {
        const data = createWindowData({
            x: coords.x - DEFAULT_WINDOW_SIZE.width / 2,
            y: coords.y - DEFAULT_WINDOW_SIZE.height / 2
        });
        const element = syncWindowElement(data);
        persist();
        if (missionOverlay) updateMissionOverlay();
        selectWindow(data.id);
        return element;
    };

    const onDragMove = (e) => {
        if (!dragState) return;
        const coords = getCanvasCoords(e);
        const data = windows.find((item) => item.id === dragState.id);
        if (!data) return;

        data.x = coords.x - dragState.offsetX;
        data.y = coords.y - dragState.offsetY;

        const element = windowMap.get(data.id);
        if (element) {
            updateWindowStyles(element, data);
        }
    };

    const onDragEnd = () => {
        if (!dragState) return;
        const element = windowMap.get(dragState.id);
        if (element) {
            element.classList.remove('is-dragging');
        }
        dragState = null;
        persist();
        window.removeEventListener('pointermove', onDragMove);
        window.removeEventListener('pointerup', onDragEnd);
    };

    // create* handlers disabled intentionally; window creation now exclusively
    // triggered via toolbar button. definitions retained for reference but not used.
    
    /*
    const onCreateMove = (e) => {
        if (!createState) return;
        const coords = getCanvasCoords(e);
        const startX = createState.startX;
        const startY = createState.startY;
        const width = Math.abs(coords.x - startX);
        const height = Math.abs(coords.y - startY);
        const x = Math.min(startX, coords.x);
        const y = Math.min(startY, coords.y);

        createState.ghost.style.left = `${x}px`;
        createState.ghost.style.top = `${y}px`;
        createState.ghost.style.width = `${Math.max(width, 6)}px`;
        createState.ghost.style.height = `${Math.max(height, 6)}px`;
    };

    const onCreateEnd = (e) => {
        if (!createState) return;
        const coords = getCanvasCoords(e);
        const startX = createState.startX;
        const startY = createState.startY;
        const width = Math.abs(coords.x - startX);
        const height = Math.abs(coords.y - startY);
        const x = Math.min(startX, coords.x);
        const y = Math.min(startY, coords.y);

        createState.ghost.remove();
        createState = null;

        const finalWidth = Math.max(width, MIN_WINDOW_SIZE.width);
        const finalHeight = Math.max(height, MIN_WINDOW_SIZE.height);
        const data = createWindowData({
            x: width < MIN_WINDOW_SIZE.width ? x - MIN_WINDOW_SIZE.width / 2 : x,
            y: height < MIN_WINDOW_SIZE.height ? y - MIN_WINDOW_SIZE.height / 2 : y,
            width: finalWidth,
            height: finalHeight
        });
        syncWindowElement(data);
        persist();
        selectWindow(data.id);

        window.removeEventListener('pointermove', onCreateMove);
        window.removeEventListener('pointerup', onCreateEnd);
    };
    */

    // onLayerPointerDown and associated create* handlers are intentionally
    // disabled in the current design. window creation is triggered exclusively
    // via the toolbar button, so the functions have been removed to avoid
    // dead code and potential reference errors.

    const refreshCurrentNote = (html) => {
        const current = ensureCurrentWindow(windows);
        current.noteId = getCurrentNoteId();
        const preview = truncateText(htmlToText(html), 260);
        current.content = preview || 'Current note is empty.';
        const element = syncWindowElement(current);
        const content = element?.querySelector('.marker-window-content');
        if (content) {
            content.textContent = current.content;
        }
        persist();
    };

    const toolbarClickHandler = (e) => {
        const button = e.target.closest('.marker-toolbar-btn');
        if (!button) return;
        const action = button.dataset.action;

        if (action === 'new-note') {
            const rect = container.getBoundingClientRect();
            const centerEvent = {
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
            };
            const coords = getCanvasCoords(centerEvent);
            const data = createWindowData({
                x: coords.x - DEFAULT_WINDOW_SIZE.width / 2,
                y: coords.y - DEFAULT_WINDOW_SIZE.height / 2
            });
            if (data) {
                const el = syncWindowElement(data);
                persist();
                if (missionOverlay) updateMissionOverlay();
                selectWindow(data.id);
            }
            return;
        } else if (action === 'new-group') {
            createNewGroup();
        }
    };

    const toolbarSelectHandler = (e) => {
        const select = e.target.closest('.marker-group-select');
        if (!select) return;
        applyGroupToSelection(select.value);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            clearSelection();
        }
    };

    toolbar.addEventListener('click', toolbarClickHandler);
    toolbar.addEventListener('change', toolbarSelectHandler);
    bottomBar.addEventListener('click', bottomBarClickHandler);
    // drag-to-create windows has been disabled per design requirements
    // layer.addEventListener('pointerdown', onLayerPointerDown);
    window.addEventListener('keydown', handleKeyDown);

    // mission control overlay state
    let missionOverlay = null;

    const updateMissionOverlay = () => {
        if (!missionOverlay) return;
        missionOverlay.innerHTML = '';
        windows.forEach((win) => {
            const card = document.createElement('div');
            card.className = 'mission-card';
            card.dataset.id = win.id;
            card.innerHTML = `
                <div class="mission-title">${win.title}</div>
                <button class="mission-close" title="Close window">×</button>
            `;
            missionOverlay.appendChild(card);

            // tap card to open
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                if (win.id === CURRENT_WINDOW_ID) {
                    onReturnToEditor && onReturnToEditor();
                } else if (win.noteId) {
                    onOpenNote && onOpenNote(win.noteId);
                }
                hideMissionView();
            });

            const closeBtn = card.querySelector('.mission-close');
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeWindowById(win.id);
                updateMissionOverlay();
            });

            // swipe up to close
            let startY = null;
            card.addEventListener('pointerdown', (e) => {
                startY = e.clientY;
                card.setPointerCapture(e.pointerId);
            });
            card.addEventListener('pointermove', (e) => {
                if (startY !== null) {
                    const dy = e.clientY - startY;
                    if (dy < -50) {
                        removeWindowById(win.id);
                        updateMissionOverlay();
                        startY = null;
                    }
                }
            });
            card.addEventListener('pointerup', (e) => {
                startY = null;
                card.releasePointerCapture(e.pointerId);
            });
            card.addEventListener('pointercancel', () => {
                startY = null;
            });
        });
    };

    const showMissionView = () => {
        if (missionOverlay) return;
        missionOverlay = document.createElement('div');
        missionOverlay.className = 'marker-mission-overlay';
        missionOverlay.addEventListener('click', hideMissionView);
        document.body.appendChild(missionOverlay);
        updateMissionOverlay();
    };

    const hideMissionView = () => {
        if (!missionOverlay) return;
        missionOverlay.remove();
        missionOverlay = null;
    };

    function bottomBarClickHandler(e) {
        const btn = e.target.closest('.marker-bottom-btn');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'clear-all') {
            // delete windows
            windows.slice()
                .filter(w => w.id !== CURRENT_WINDOW_ID)
                .forEach(w => removeWindowById(w.id));
        } else if (action === 'mission-view') {
            showMissionView();
        }
    }

    updateToolbarGroups();
    rebuildWindows();

    return {
        layer,
        toolbar,
        refreshCurrentNote,
        refreshAllNotes: () => {
            refreshAllPreviews(windows);
            rebuildWindows();
        },
        addGroup,
        destroy() {
            toolbar.removeEventListener('click', toolbarClickHandler);
            toolbar.removeEventListener('change', toolbarSelectHandler);
            bottomBar.removeEventListener('click', bottomBarClickHandler);
            window.removeEventListener('pointermove', onDragMove);
            window.removeEventListener('pointerup', onDragEnd);

            // create handlers were never attached
            window.removeEventListener('keydown', handleKeyDown);
            toolbar.remove();
            bottomBar.remove();
            layer.remove();
            hideMissionView();
        }
    };
};