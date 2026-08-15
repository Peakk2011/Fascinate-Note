import { noteFeaturesConfig } from './noteConfig.js';
import {
    autoSaveTimeout,
    currentFontSize,
    setAutoSaveTimeout,
    setCurrentFontSize,
    lastMainProcessSaveTime,
    setLastMainProcessSaveTime,
    addEventListenerTracker
} from './state.js';

import {
    createNote,
    getCurrentNote,
    getCurrentNoteId,
    getNoteById,
    getFontSize,
    setCurrentNoteId,
    setFontSize,
    updateNote
} from './noteStore.js';

// const ensureCurrentNote = () => {
//     let current = getCurrentNote();
//     if (!current) {
//         current = createNote();
//         if (current?.id) {
//             setCurrentNoteId(current.id);
//         }
//     }
//     return current;
// };

/**
 * Creates a function to update the status indicator UI.
 * @param {{statusText: HTMLElement, saveIndicator: HTMLElement}} els - An object containing the status text and save indicator DOM elements.
 * @returns {function(string, string|null=): void} A function that takes a statusType ('typing', 'saving', 'saved', 'error')
 * and an optional customText to update the UI.
 */
export const createSetStatus = (els) => {
    let lastSavedText = '';
    return (
        statusType,
        customText = null
    ) => {
        const hasConfig = statusType in noteFeaturesConfig.status;
        const statusConfig = noteFeaturesConfig.status[statusType];

        if (!hasConfig && !customText) {
            console.warn(`Unknown status: ${statusType}`);
            return;
        }

        if (statusType === 'idle' && customText == null) {
            if (lastSavedText) {
                els.statusText.textContent = lastSavedText;
            }
            els.saveIndicator.className = `dot ${statusType}`;
            return;
        }

        const text = customText ?? (statusConfig ?? '');
        els.statusText.textContent = text;
        els.saveIndicator.className = `dot ${statusType}`;

        if (statusType === 'saved' && text) {
            lastSavedText = text;
        }
    };
};

/**
 * Creates a function to load data into the editor.
 * @param {{textarea: HTMLTextAreaElement}} els - An object containing the textarea element.
 * @param {function} setStatus - The function created by `createSetStatus` to update the UI status.
 * @returns {function(): Promise<void>} An async function that loads its
 * corresponding text and font size into the textarea.
 */
export const createLoadData = (els, setStatus) => {
    return async () => {
        try {
            const currentNoteId = getCurrentNoteId();
            let currentNote = currentNoteId ? getNoteById(currentNoteId) : null;
            
            // only create a new note if truly no current note exists
            if (!currentNote && !currentNoteId) {
                currentNote = createNote();
                if (currentNote?.id) {
                    setCurrentNoteId(currentNote.id);
                }
            }
            
            if (!currentNote) {
                console.warn('No note available to load; creating fallback');
                currentNote = createNote();
                if (currentNote?.id) {
                    setCurrentNoteId(currentNote.id);
                }
            }
            
            const html = currentNote?.html || '';
            const fontSize = getFontSize(noteFeaturesConfig.defaultFontSize);

            els.textarea.innerHTML = html;
            setCurrentFontSize(fontSize);
            els.textarea.style.fontSize = `${fontSize}px`;
        } catch (error) {
            console.error('Error loading data:', error);
            setStatus('error', 'Failed to load');
            throw error;
        }
    };
};

/**
 * Creates a function to load a file from disk.
 * @param {{textarea: HTMLTextAreaElement}} els - An object containing the textarea element.
 * @param {function} setStatus - The function created by `createSetStatus`.
 * @returns {function(): Promise<void>} An async function that opens a file dialog and loads the selected file.
 */
export const createLoadFile = (els, setStatus) => {
    return async () => {
        try {
            if (!window.electronAPI?.showOpenDialog || !window.electronAPI?.readFile) {
                setStatus('error', 'File loading not available');
                return;
            }

            const result = await window.electronAPI.showOpenDialog({
                title: 'Load Note File',
                properties: ['openFile'],
                filters: [
                    { name: 'Text Files', extensions: ['txt', 'md', 'html'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });

            if (result.canceled || !result.filePaths.length) {
                return; // User canceled
            }

            const filePath = result.filePaths[0];
            const fileResult = await window.electronAPI.readFile(filePath);

            if (!fileResult.success) {
                setStatus('error', 'Failed to read file');
                return;
            }

            let content = fileResult.content;
            
            // Convert file content to HTML based on extension
            const extension = filePath.split('.').pop()?.toLowerCase();
            if (extension === 'txt') {
                // Convert plain text to HTML with line breaks
                content = content.replace(/\n/g, '<br>');
            } else if (extension === 'md') {
                // Basic markdown to HTML conversion (simple)
                content = content
                    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
                    .replace(/\*(.*)\*/gim, '<em>$1</em>')
                    .replace(/\n/g, '<br>');
            }
            // HTML files are loaded as-is

            els.textarea.innerHTML = content;
            setStatus('saved', 'File loaded');
        } catch (error) {
            console.error('Error loading file:', error);
            setStatus('error', 'Failed to load file');
            throw error;
        }
    };
};

/**
 * Creates a function to save the current state of the editor.
 * @param {{textarea: HTMLTextAreaElement}} els - An object containing the textarea element.
 * @param {function} setStatus - The function created by `createSetStatus`.
 * @returns {function(): Promise<void>} An async function that saves the textarea's content and current font size
 * to the in-memory `editorContent` object.
 */
export const createSaveData = (els, setStatus) => {
    return async () => {
        try {
            const html = els.textarea.innerHTML;
            const currentId = getCurrentNoteId();
            let savedHtml = html;

            if (currentId) {
                const updated = updateNote(currentId, { html });
                if (updated?.html) {
                    savedHtml = updated.html;
                }
            } else {
                const note = createNote({ html });
                if (note?.id) {
                    setCurrentNoteId(note.id);
                }
                if (note?.html) {
                    savedHtml = note.html;
                }
            }

            // Keep Marker previews in sync with editor saves.
            if (window.__workspaceApi) {
                window.__workspaceApi.refreshCurrentNote?.(savedHtml);
            }

            setFontSize(currentFontSize);

            setStatus(
                'saved',
                `Saved ${new Date().toLocaleTimeString('th-Th')}`
            );

            // clear the message after a short delay by switching to 'idle' state
            setTimeout(() => setStatus('idle'), 1000);

        } catch (error) {
            console.error('Error saving:', error);
            setStatus('error');
            throw error;
        }
    }
};

/**
 * Creates a set of functions for handling zoom functionality (in, out, reset).
 * @param {{textarea: HTMLTextAreaElement}} els - An object containing the textarea element.
 * @param {function(): Promise<void>} saveData - The function created by `createSaveData` to persist changes.
 * @returns {{zoomIn: function(): Promise<void>, zoomOut: function(): Promise<void>, resetZoom: function(): Promise<void>}}
 * An object containing `zoomIn`, `zoomOut`, and `resetZoom` async functions.
 */
export const createZoomHandlers = (els, saveData) => {
    const zoomIn = async () => {
        try {
            if (currentFontSize < noteFeaturesConfig.maxFontSize) {
                const newSize = currentFontSize + noteFeaturesConfig.fontStep;
                setCurrentFontSize(newSize);
                els.textarea.style.fontSize = `${newSize}px`;
                await saveData();
            }
        } catch (error) {
            console.error('Error zooming in:', error);
            throw error;
        }
    };

    const zoomOut = async () => {
        try {
            if (currentFontSize > noteFeaturesConfig.minFontSize) {
                const newSize = currentFontSize - noteFeaturesConfig.fontStep;
                setCurrentFontSize(newSize);
                els.textarea.style.fontSize = `${newSize}px`;
                await saveData();
            }
        } catch (error) {
            console.error('Error zooming out:', error);
            throw error;
        }
    };

    const resetZoom = async () => {
        try {
            setCurrentFontSize(noteFeaturesConfig.defaultFontSize);
            els.textarea.style.fontSize = `${noteFeaturesConfig.defaultFontSize}px`;
            await saveData();
        } catch (error) {
            console.error('Error resetting zoom:', error);
            throw error;
        }
    };

    return {
        zoomIn,
        zoomOut,
        resetZoom
    };
};

/**
 * Creates a function that triggers a debounced auto-save.
 * @param {function} setStatus - The function created by `createSetStatus`.
 * @param {function(): Promise<void>} saveData - The function created by `createSaveData`.
 * @returns {function(): void} A function that should be called on user input. It clears any pending
 * save, sets the status to 'typing', and schedules a new save after a configured delay.
 */
export const createTriggerAutoSave = (setStatus, saveData) => {
    let idleHandle = null;
    let throttleTimer = null;

    return () => {
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
            setAutoSaveTimeout(null);
        }
        setStatus('typing');

        if (throttleTimer) {
            clearTimeout(throttleTimer);
            throttleTimer = null;
        }

        if (idleHandle) {
            if (typeof cancelIdleCallback === 'function') {
                cancelIdleCallback(idleHandle);
            } else {
                clearTimeout(idleHandle);
            }
            idleHandle = null;
        }

        const runSave = async () => {
            setStatus('saving');
            try {
                await saveData();
                setLastMainProcessSaveTime(Date.now());
            } catch (error) {
                console.error('Auto-save failed:', error);
            }
        };

        const scheduleIdleSave = () => {
            if (typeof requestIdleCallback === 'function') {
                idleHandle = requestIdleCallback(
                    () => {
                        idleHandle = null;
                        runSave();
                    },
                    {
                        timeout: noteFeaturesConfig.autoSaveIdleTimeout || 1000
                    }
                );
            } else {
                idleHandle = setTimeout(() => {
                    idleHandle = null;
                    runSave();
                }, 0);
            }
        };

        const timeout = setTimeout(() => {
            const now = Date.now();
            const sinceLastSave = now - lastMainProcessSaveTime;
            const throttleDelay = Math.max(
                0,
                noteFeaturesConfig.mainProcessSaveThrottle - sinceLastSave
            );

            if (throttleDelay > 0) {
                throttleTimer = setTimeout(() => {
                    throttleTimer = null;
                    scheduleIdleSave();
                }, throttleDelay);
            } else {
                scheduleIdleSave();
            }
        }, noteFeaturesConfig.autoSaveDelay);

        setAutoSaveTimeout(timeout);
    };
};

// Helper to create a debounced input handler.
const debouncedInputHandler = (triggerAutoSave) => {
    let debounceTimer = null;
    return (e) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            triggerAutoSave();
        }, 200);
    };
};

/**
 * Sets up all necessary event listeners for the note editor.
 * This includes input handling for auto-save and keyboard/mouse shortcuts for zooming.
 * @param {{textarea: HTMLTextAreaElement}} els - An object containing the textarea element.
 * @param {function(): void} triggerAutoSave - The auto-save trigger function.
 * @param {function(): Promise<void>} zoomIn - The zoom-in function.
 * @param {function(): Promise<void>} zoomOut - The zoom-out function.
 * @param {function(): Promise<void>} resetZoom - The zoom-reset function.
 */
export const setupEventListeners = (
    els,
    triggerAutoSave,
    zoomIn,
    zoomOut,
    resetZoom
) => {
    const inputHandler = debouncedInputHandler(triggerAutoSave);
    els.textarea.addEventListener('input', inputHandler);

    addEventListenerTracker(
        els.textarea,
        'input',
        inputHandler
    );

    const keydownHandler = async (e) => {
        if (e.ctrlKey || e.metaKey) {
            try {
                const key = typeof e.key === 'string' ? e.key : '';
                const code = e.code;
                const isZoomIn = code === 'Equal' || code === 'NumpadAdd' || key === '=' || key === '+';
                const isZoomOut = code === 'Minus' || code === 'NumpadSubtract' || key === '-' || key === '_';
                const isReset = code === 'Digit0' || code === 'Numpad0' || key === '0';

                if (isZoomIn) {
                    e.preventDefault();
                    await zoomIn();
                } else if (isZoomOut) {
                    e.preventDefault();
                    await zoomOut();
                } else if (isReset) {
                    e.preventDefault();
                    await resetZoom();
                }
            } catch (error) {
                console.error('Keyboard shortcut error:', error);
            }
        }
    };

    document.addEventListener(
        'keydown', keydownHandler
    );

    addEventListenerTracker(
        document,
        'keydown',
        keydownHandler
    );

    // Mouse wheel zoom
    const wheelHandler = async (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();

            try {
                e.deltaY < 0 ? await zoomIn() : await zoomOut();
            } catch (error) {
                console.error('Wheel zoom error:', error);
            }
        }
    };

    els.textarea.addEventListener(
        'wheel', wheelHandler,
        { passive: false }
    );

    addEventListenerTracker(
        els.textarea,
        'wheel',
        wheelHandler
    );
};