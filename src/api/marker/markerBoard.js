import {
    createNote,
    getNoteById,
    updateNote,
    deleteNote,
    getCurrentNoteId,
    getFontSize
} from '../../renderer/scripts/note/noteStore.js';

const STORAGE_KEYS = {
    windows: 'markerWindows',
    groups: 'markerGroups',
    activeGroup: 'markerActiveGroup'
};

const CURRENT_WINDOW_ID = 'current-note';
const DEFAULT_WINDOW_SIZE = { width: 300, height: 240 };
const MIN_WINDOW_SIZE = { width: 220, height: 140 };
const PLACEHOLDER_TEXT = 'Click to open and edit this note';

// Utilities

const safeParse = (value, fallback) => {
    if (!value) return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
};

const saveToStorage = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
};

const loadWindows = () => safeParse(localStorage.getItem(STORAGE_KEYS.windows), []);
const loadGroups = () => safeParse(localStorage.getItem(STORAGE_KEYS.groups), []);
const loadActiveGroup = () => localStorage.getItem(STORAGE_KEYS.activeGroup) || null;

const createId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `win_${crypto.randomUUID()}`;
    }
    return `win_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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
    return `${[...text].slice(0, max).join('').trim()}…`;
};

const getGroupById = (groups, id) => groups.find((g) => g.id === id);
const randomColor = () => `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`;

// Migration & preview

const migrateWindows = (windows) => {
    windows.forEach((win) => {
        if (!Object.prototype.hasOwnProperty.call(win, 'noteId')) win.noteId = null;
        // all windows are equal — remove isCurrent flag from storage if needed
    });
};

const refreshWindowPreview = (win) => {
    if (!win.noteId) {
        const note = createNote({ title: win.title || 'New Note' });
        win.noteId = note?.id ?? null;
    }
    if (!win.noteId) return;
    const note = getNoteById(win.noteId);
    if (note) {
        win.title = note.title || win.title;
        win.content = truncateText(htmlToText(note.html), 260);
    }
};

const refreshAllPreviews = (windows) => windows.forEach(refreshWindowPreview);

// Ensure current window
// current-note is now equal to every other window — it can be renamed and deleted.
// The only special thing: it starts with the active editor note linked.

const ensureCurrentWindow = (windows) => {
    if (windows.length > 0) return; // only create if no windows at all
    const note = createNote({ title: 'Current Notes' });
    const current = {
        id: CURRENT_WINDOW_ID,
        title: 'Current Notes',
        content: '',
        x: 360, y: 260,
        width: 360, height: 220,
        color: '#7aa5ff',
        groupId: null,
        isCurrent: false,
        noteId: note?.id ?? getCurrentNoteId()
    };
    windows.unshift(current);
};

// Main

export const initMarkerBoard = ({
    container,
    getCanvasCoords,
    groupModal = null,
    onOpenNote = null,
    onReturnToEditor = null
} = {}) => {
    if (!container) return null;

    // DOM

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

    const bottomBar = document.createElement('div');
    bottomBar.className = 'marker-bottombar';
    bottomBar.innerHTML = `
        <button class="marker-bottom-btn" data-action="clear-all" title="Clear all windows">🗑️</button>
        <button class="marker-bottom-btn" data-action="mission-view" title="Mission Control">☰</button>
    `;
    container.appendChild(bottomBar);

    // State

    let windows = loadWindows();
    let groups = loadGroups();
    let activeGroupId = loadActiveGroup();
    let missionOverlay = null;
    let activeWindowId = null;
    let _closingInProgress = false; // race condition guard

    migrateWindows(windows);
    refreshAllPreviews(windows);
    ensureCurrentWindow(windows);

    const windowMap = new Map();
    const selectedIds = new Set();
    let dragState = null;
    let resizeState = null;

    // Persistence

    const persist = () => {
        saveToStorage(STORAGE_KEYS.windows, windows);
        saveToStorage(STORAGE_KEYS.groups, groups);
        if (activeGroupId !== null) {
            localStorage.setItem(STORAGE_KEYS.activeGroup, activeGroupId);
        } else {
            localStorage.removeItem(STORAGE_KEYS.activeGroup);
        }
    };

    persist();

    // Group filtering

    const getVisibleWindows = () => {
        if (activeGroupId === null) return windows;
        return windows.filter((w) => w.groupId === activeGroupId);
    };

    const setActiveGroup = (groupId) => {
        activeGroupId = groupId || null;
        persist();
        applyVisibility();
        updateToolbarGroups();
    };

    const applyVisibility = () => {
        const visible = new Set(getVisibleWindows().map((w) => w.id));
        windowMap.forEach((el, id) => {
            el.style.display = visible.has(id) ? '' : 'none';
        });
    };

    // Toolbar groups

    const updateToolbarGroups = () => {
        const select = toolbar.querySelector('.marker-group-select');
        if (!select) return;
        select.innerHTML = '';

        const noneOpt = document.createElement('option');
        noneOpt.value = '';
        noneOpt.textContent = 'All Notes';
        select.appendChild(noneOpt);

        groups.forEach((group) => {
            const opt = document.createElement('option');
            opt.value = group.id;
            opt.textContent = group.name;
            select.appendChild(opt);
        });

        select.value = activeGroupId || '';
    };

    // Window styles

    const updateWindowStyles = (element, data) => {
        element.style.left = `${data.x}px`;
        element.style.top = `${data.y}px`;
        element.style.width = `${data.width}px`;
        element.style.height = `${data.height}px`;
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

    // Active window

    const setActiveWindow = (id) => {
        if (activeWindowId === id) return;
        if (activeWindowId) windowMap.get(activeWindowId)?.classList.remove('is-active');
        activeWindowId = id;
        if (id) windowMap.get(id)?.classList.add('is-active');
    };

    // Font size

    const getEditorFontSize = () => getFontSize(16);

    const syncAllFontSizes = () => {
        windowMap.forEach((el) => {
            const contentEl = el.querySelector('.marker-window-content');
            if (contentEl) contentEl.style.fontSize = `${getEditorFontSize()}px`;
        });
    };

    // Selection

    const updateSelectionStyles = () => {
        windowMap.forEach((element, id) => {
            element.classList.toggle('is-selected', selectedIds.has(id));
        });
    };

    const clearSelection = () => {
        selectedIds.clear();
        updateSelectionStyles();
    };

    const bringToFront = (id) => {
        const idx = windows.findIndex((w) => w.id === id);
        if (idx === -1) return;
        const [win] = windows.splice(idx, 1);
        windows.push(win);
        const el = windowMap.get(id);
        if (el?.parentNode) el.parentNode.appendChild(el);
        persist();
    };

    const selectWindow = (id, { toggle } = {}) => {
        if (!id) return;
        if (toggle) {
            selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id);
        } else {
            selectedIds.clear();
            selectedIds.add(id);
            bringToFront(id);
        }
        setActiveWindow(id);
        updateSelectionStyles();
    };

    // Remove

    const removeWindowById = (id) => {
        if (_closingInProgress) return;
        const idx = windows.findIndex((w) => w.id === id);
        if (idx === -1) return;

        const [removed] = windows.splice(idx, 1);
        const el = windowMap.get(id);
        windowMap.delete(id);

        if (el) {
            el.style.transition = 'opacity 180ms ease, transform 180ms ease';
            el.style.opacity = '0';
            el.style.transform = (el.style.transform || '') + ' scale(0.88)';
            setTimeout(() => el.remove(), 200);
        }

        if (removed.noteId) deleteNote(removed.noteId);

        // If no windows left — go back to editor and create fresh window on next open
        if (windows.length === 0) {
            _closingInProgress = true;
            persist();
            // small delay so animation plays
            setTimeout(() => {
                _closingInProgress = false;
                onReturnToEditor?.();
            }, 220);
            return;
        }

        persist();
    };

    // Create window element

    const createWindowElement = (data) => {
        const element = document.createElement('div');
        element.className = 'marker-window';
        element.dataset.id = data.id;
        updateWindowStyles(element, data);

        // Header
        const header = document.createElement('div');
        header.className = 'marker-window-header';

        const title = document.createElement('input');
        title.className = 'marker-window-title';
        title.type = 'text';
        title.value = data.title || 'Untitled';
        title.spellcheck = false;
        title.autocomplete = 'off';
        title.readOnly = false; // all windows are editable

        const badge = document.createElement('span');
        badge.className = 'marker-window-group';

        const closeButton = document.createElement('button');
        closeButton.className = 'marker-window-close';
        closeButton.type = 'button';
        closeButton.setAttribute('title', 'Delete window');
        closeButton.textContent = '×';

        header.appendChild(title);
        header.appendChild(badge);
        header.appendChild(closeButton);

        // Content — shows preview text, placeholder if empty
        const content = document.createElement('div');
        content.className = 'marker-window-content';
        content.contentEditable = 'false';
        content.spellcheck = false;
        content.style.fontSize = `${getEditorFontSize()}px`;
        content.style.overflow = 'auto';
        content.style.flex = '1';

        const isEmpty = !data.content || data.content.trim() === '';
        if (isEmpty) {
            content.textContent = '';
            content.dataset.placeholder = PLACEHOLDER_TEXT;
            content.classList.add('is-placeholder');
        } else {
            content.textContent = data.content;
            content.classList.remove('is-placeholder');
        }

        // Resize handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'marker-window-resize';

        element.appendChild(header);
        element.appendChild(content);
        element.appendChild(resizeHandle);

        updateGroupBadge(element, data.groupId);

        // Title events

        title.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            selectWindow(data.id);
        });

        title.addEventListener('pointerup', (e) => {
            e.stopPropagation();
        });

        title.addEventListener('focus', () => {
            setActiveWindow(data.id);
        });

        title.addEventListener('input', () => {
            data.title = title.value.trim() || 'Untitled';
            if (data.noteId) updateNote(data.noteId, { title: data.title });
            persist();
        });

        // Close button

        closeButton.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
        });

        closeButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeWindowById(data.id);
        });

        // Window body click/drag

        let clickStart = null;

        element.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('.marker-window-resize')) return;
            if (e.target.closest('.marker-window-title')) return;
            if (e.target.closest('.marker-window-close')) return;
            clickStart = { x: e.clientX, y: e.clientY };
            const toggle = e.metaKey || e.ctrlKey || e.shiftKey;
            selectWindow(data.id, { toggle });
        });

        element.addEventListener('pointerup', (e) => {
            if (!clickStart) return;
            const dx = Math.abs(e.clientX - clickStart.x);
            const dy = Math.abs(e.clientY - clickStart.y);
            clickStart = null;
            if (dx < 5 && dy < 5 && !dragState && !missionOverlay) {
                if (data.noteId && onOpenNote) {
                    onOpenNote(data.noteId);
                } else if (!data.noteId) {
                    console.warn(`[MarkerBoard] Window ${data.id} has no noteId`);
                }
            }
        });

        // Drag header (normal mode only)

        header.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('.marker-window-close')) return;
            if (e.target.closest('.marker-window-title')) return;
            if (missionOverlay) return; // mission drag handled below

            e.preventDefault();
            bringToFront(data.id);
            setActiveWindow(data.id);

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

        // Mission drag — whole window draggable, capture phase

        element.addEventListener('pointerdown', (e) => {
            if (!missionOverlay) return;
            if (e.button !== 0) return;
            if (e.target.closest('.marker-window-close')) return;
            e.preventDefault();
            e.stopPropagation();
            startMissionDrag(e, data, element);
        }, true);

        // Resize

        resizeHandle.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            resizeHandle.setPointerCapture(e.pointerId);
            resizeState = {
                id: data.id,
                startX: e.clientX,
                startY: e.clientY,
                startW: data.width,
                startH: data.height
            };
            element.classList.add('is-resizing');
        });

        resizeHandle.addEventListener('pointermove', (e) => {
            if (!resizeState || resizeState.id !== data.id) return;
            data.width = Math.max(MIN_WINDOW_SIZE.width, resizeState.startW + (e.clientX - resizeState.startX));
            data.height = Math.max(MIN_WINDOW_SIZE.height, resizeState.startH + (e.clientY - resizeState.startY));
            updateWindowStyles(element, data);
        });

        resizeHandle.addEventListener('pointerup', () => {
            if (!resizeState || resizeState.id !== data.id) return;
            resizeState = null;
            element.classList.remove('is-resizing');
            persist();
        });

        resizeHandle.addEventListener('pointercancel', () => {
            if (!resizeState || resizeState.id !== data.id) return;
            resizeState = null;
            element.classList.remove('is-resizing');
        });

        return element;
    };

    // Sync & rebuild

    const syncWindowElement = (data) => {
        refreshWindowPreview(data);
        let element = windowMap.get(data.id);
        if (!element) {
            element = createWindowElement(data);
            windowMap.set(data.id, element);
            layer.appendChild(element);
        } else {
            const titleEl = element.querySelector('.marker-window-title');
            const contentEl = element.querySelector('.marker-window-content');
            if (titleEl && titleEl.value !== data.title) titleEl.value = data.title || 'Untitled';
            if (contentEl) {
                const isEmpty = !data.content || data.content.trim() === '';
                if (isEmpty) {
                    contentEl.textContent = '';
                    contentEl.classList.add('is-placeholder');
                } else {
                    contentEl.textContent = data.content;
                    contentEl.classList.remove('is-placeholder');
                }
                contentEl.style.fontSize = `${getEditorFontSize()}px`;
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
            const el = createWindowElement(win);
            windowMap.set(win.id, el);
            layer.appendChild(el);
        });
        updateSelectionStyles();
        applyVisibility();
    };

    // Groups

    const applyGroupToSelection = (groupId) => {
        if (selectedIds.size === 0) return;
        windows.forEach((win) => {
            if (!selectedIds.has(win.id)) return;
            win.groupId = groupId || null;
            const el = windowMap.get(win.id);
            if (el) updateGroupBadge(el, win.groupId);
        });
        persist();
    };

    const addGroup = (name) => {
        const group = {
            id: createId(),
            name: name.trim().slice(0, 36),
            color: randomColor()
        };
        groups.push(group);
        applyGroupToSelection(group.id);
        setActiveGroup(group.id);
        persist();
    };

    const createNewGroup = () => {
        if (groupModal) {
            groupModal.show();
        } else {
            console.warn('[MarkerBoard] groupModal not provided');
        }
    };

    // Window data factory

    const createWindowData = ({ x, y, width, height } = {}) => {
        const note = createNote({ title: 'New Note' });
        if (!note?.id) {
            console.error('[MarkerBoard] Failed to create note — aborting');
            return null;
        }
        const data = {
            id: createId(),
            title: note.title || 'New Note',
            content: '',
            x: x ?? 320, y: y ?? 240,
            width: width ?? DEFAULT_WINDOW_SIZE.width,
            height: height ?? DEFAULT_WINDOW_SIZE.height,
            color: randomColor(),
            groupId: activeGroupId,
            isCurrent: false,
            noteId: note.id
        };
        windows.push(data);
        return data;
    };

    // Drag (normal canvas)

    const onDragMove = (e) => {
        if (!dragState) return;
        const coords = getCanvasCoords(e);
        const data = windows.find((item) => item.id === dragState.id);
        if (!data) return;
        data.x = coords.x - dragState.offsetX;
        data.y = coords.y - dragState.offsetY;
        const el = windowMap.get(data.id);
        if (el) updateWindowStyles(el, data);
    };

    const onDragEnd = () => {
        if (!dragState) return;
        windowMap.get(dragState.id)?.classList.remove('is-dragging');
        dragState = null;
        persist();
        window.removeEventListener('pointermove', onDragMove);
        window.removeEventListener('pointerup', onDragEnd);
    };

    // Refresh current note content

    const refreshCurrentNote = (html) => {
        // Update the window whose noteId matches the current editor note
        const currentNoteId = getCurrentNoteId();
        const win = windows.find((w) => w.noteId === currentNoteId);
        if (!win) return;

        const preview = truncateText(htmlToText(html), 260);
        win.content = preview || '';
        const element = syncWindowElement(win);
        const contentEl = element?.querySelector('.marker-window-content');
        if (contentEl) {
            const isEmpty = !win.content || win.content.trim() === '';
            if (isEmpty) {
                contentEl.textContent = '';
                contentEl.classList.add('is-placeholder');
            } else {
                contentEl.textContent = win.content;
                contentEl.classList.remove('is-placeholder');
            }
        }
        persist();
    };

    // Mission Control

    const enterMissionView = () => {
        if (missionOverlay) return;

        // Overlay sits BEHIND layer (lower z-index) — just a backdrop for click-to-exit
        // layer keeps pointer-events so windows remain draggable
        missionOverlay = document.createElement('div');
        missionOverlay.className = 'marker-mission-overlay';
        // insert before layer so layer is on top
        container.insertBefore(missionOverlay, layer);

        const visible = getVisibleWindows().filter((w) => windowMap.has(w.id));
        if (visible.length === 0) { cleanupMission(); return; }

        layoutMissionWindows(visible);

        missionOverlay.addEventListener('pointerdown', (e) => {
            // only dismiss if click landed directly on backdrop (not bubbled from window)
            if (e.target === missionOverlay) exitMissionView();
        });
    };

    const layoutMissionWindows = (visible) => {
        const count = visible.length;
        const padding = 20;
        const containerW = container.offsetWidth;
        const containerH = container.offsetHeight;
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const cellW = (containerW - padding * (cols + 1)) / cols;
        const cellH = (containerH - padding * (rows + 1)) / rows;

        visible.forEach((win, i) => {
            const el = windowMap.get(win.id);
            if (!el) return;

            const col = i % cols;
            const row = Math.floor(i / cols);
            const scale = Math.min(cellW / win.width, cellH / win.height, 1);
            const scaledW = win.width * scale;
            const scaledH = win.height * scale;
            const cellLeft = padding + col * (cellW + padding);
            const cellTop = padding + row * (cellH + padding);
            const targetX = cellLeft + (cellW - scaledW) / 2;
            const targetY = cellTop + (cellH - scaledH) / 2;

            const dx = targetX - win.x;
            const dy = targetY - win.y;

            el._missionTransform = { dx, dy, scale };

            el.style.transition = 'transform 380ms cubic-bezier(0.2, 0, 0, 1)';
            el.style.transformOrigin = '0 0';
            el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
            el.classList.add('is-mission');
        });
    };

    // Mission drag-to-dismiss
    // Triggered from pointerdown on ANY part of the window (not just header)
    // Uses window-level listeners to avoid setPointerCapture conflicts

    const startMissionDrag = (e, data, element) => {
        const { dx: baseDx = 0, dy: baseDy = 0, scale = 1 } = element._missionTransform || {};
        const startClientX = e.clientX;
        const startClientY = e.clientY;
        const containerRect = container.getBoundingClientRect();
        let isDragging = false;
        let isDismissing = false;

        // Remove transition immediately so drag is instant
        element.style.transition = 'none';

        const onMove = (ev) => {
            const deltaX = ev.clientX - startClientX;
            const deltaY = ev.clientY - startClientY;

            // Only start drag after small threshold to avoid interfering with clicks
            if (!isDragging && Math.abs(deltaX) < 4 && Math.abs(deltaY) < 4) return;
            isDragging = true;

            // Scale shrinks as window approaches top of container (0 at top, 1 at bottom)
            const currentY = ev.clientY - containerRect.top;
            const progress = Math.max(0, Math.min(1, 1 - currentY / containerRect.height));
            const dismissScale = scale * (1 - progress * 0.4);

            element.style.transform = `translate(${baseDx + deltaX}px, ${baseDy + deltaY}px) scale(${dismissScale})`;
            // opacity stays 1 as requested
            element.style.opacity = '1';

            isDismissing = currentY < 0;
        };

        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);

            if (!isDragging) {
                // It was a click — open the note
                const win = windows.find((w) => w.id === data.id);
                if (win?.noteId && onOpenNote) {
                    exitMissionView(() => onOpenNote(win.noteId));
                }
                return;
            }

            if (isDismissing) {
                element.style.transition = 'transform 200ms ease-in, opacity 200ms ease-in';
                element.style.opacity = '0';
                element.style.transform = `translate(${baseDx}px, ${-containerRect.height}px) scale(${scale * 0.5})`;
                setTimeout(() => {
                    exitMissionView(() => removeWindowById(data.id));
                }, 210);
            } else {
                // Snap back to grid position with transition
                element.style.transition = 'transform 320ms cubic-bezier(0.2, 0, 0, 1)';
                element.style.transform = `translate(${baseDx}px, ${baseDy}px) scale(${scale})`;
                element.style.opacity = '1';
            }
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    };

    // Mission exit

    const exitMissionView = (onDone) => {
        if (!missionOverlay) { onDone?.(); return; }

        // layer.removeEventListener('pointerup', onMissionWindowClick);

        const visible = getVisibleWindows().filter((w) => windowMap.has(w.id));
        let pending = visible.length;

        if (pending === 0) { cleanupMission(); onDone?.(); return; }

        visible.forEach((win) => {
            const el = windowMap.get(win.id);
            if (!el) { if (--pending === 0) { cleanupMission(); onDone?.(); } return; }

            el.style.transition = 'transform 300ms cubic-bezier(0.4, 0, 1, 1), opacity 300ms ease';
            el.style.transform = '';
            el.style.opacity = '';

            const handleEnd = () => {
                el.removeEventListener('transitionend', handleEnd);
                el.style.transition = '';
                el.style.transformOrigin = '';
                el.classList.remove('is-mission');
                delete el._missionTransform;
                if (--pending === 0) { cleanupMission(); onDone?.(); }
            };

            el.addEventListener('transitionend', handleEnd);
            setTimeout(() => {
                if (el.classList.contains('is-mission')) handleEnd();
            }, 400);
        });
    };

    const cleanupMission = () => {
        if (missionOverlay) { missionOverlay.remove(); missionOverlay = null; }
    };

    // Toolbar & bottom bar

    const toolbarClickHandler = (e) => {
        const button = e.target.closest('.marker-toolbar-btn');
        if (!button) return;
        const action = button.dataset.action;

        if (action === 'new-note') {
            const rect = container.getBoundingClientRect();
            const coords = getCanvasCoords({
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
            });
            const data = createWindowData({
                x: coords.x - DEFAULT_WINDOW_SIZE.width / 2,
                y: coords.y - DEFAULT_WINDOW_SIZE.height / 2
            });
            if (data) {
                syncWindowElement(data);
                persist();
                applyVisibility();
                selectWindow(data.id);
            }
        } else if (action === 'new-group') {
            createNewGroup();
        }
    };

    const toolbarSelectHandler = (e) => {
        const select = e.target.closest('.marker-group-select');
        if (!select) return;
        setActiveGroup(select.value || null);
    };

    const bottomBarClickHandler = (e) => {
        const btn = e.target.closest('.marker-bottom-btn');
        if (!btn) return;
        const action = btn.dataset.action;

        if (action === 'clear-all') {
            windows.slice().forEach((w) => removeWindowById(w.id));
        } else if (action === 'mission-view') {
            missionOverlay ? exitMissionView() : enterMissionView();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            if (missionOverlay) { exitMissionView(); return; }
            clearSelection();
        }
    };

    // Boot

    toolbar.addEventListener('click', toolbarClickHandler);
    toolbar.addEventListener('change', toolbarSelectHandler);
    bottomBar.addEventListener('click', bottomBarClickHandler);
    window.addEventListener('keydown', handleKeyDown);

    updateToolbarGroups();
    rebuildWindows();

    // Public API

    return {
        layer,
        toolbar,
        refreshCurrentNote,
        refreshAllNotes() {
            refreshAllPreviews(windows);
            rebuildWindows();
        },
        syncFontSize() {
            syncAllFontSizes();
        },
        addGroup,
        destroy() {
            toolbar.removeEventListener('click', toolbarClickHandler);
            toolbar.removeEventListener('change', toolbarSelectHandler);
            bottomBar.removeEventListener('click', bottomBarClickHandler);
            window.removeEventListener('pointermove', onDragMove);
            window.removeEventListener('pointerup', onDragEnd);
            window.removeEventListener('keydown', handleKeyDown);
            if (missionOverlay) cleanupMission();
            toolbar.remove();
            bottomBar.remove();
            layer.remove();
        }
    };
};