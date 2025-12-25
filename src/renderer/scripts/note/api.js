/**
 * Note features configuration and settings
 * @type {import('./noteConfig.js').NoteFeaturesConfig}
 */
import { noteFeaturesConfig } from './noteConfig.js';

/**
 * State management utilities and trackers for note features
 */
import {
    /**
     * Current font size value in pixels
     * @type {number}
     */
    currentFontSize,
    
    /**
     * Clears all tracked event listeners to prevent memory leaks
     * @type {() => void}
     */
    clearEventListeners,
    
    /**
     * Timeout ID for auto-save debouncing
     * @type {number | null}
     */
    autoSaveTimeout,
    
    /**
     * Adds an event listener to the tracking system for cleanup
     * @type {(target: EventTarget, event: string, handler: EventListener) => void}
     */
    addEventListenerTracker
} from './state.js';

/**
 * Handler creation functions and event setup utilities
 */
import {
    /**
     * Creates a status update function
     * @type {(elements: NoteElements) => (message: string, type: 'success' | 'error' | 'saving') => void}
     */
    createSetStatus,
    
    /**
     * Creates a data loading function
     * @type {(elements: NoteElements, setStatus: StatusSetter) => () => Promise<void>}
     */
    createLoadData,
    
    /**
     * Creates a data saving function
     * @type {(elements: NoteElements, setStatus: StatusSetter) => () => Promise<void>}
     */
    createSaveData,
    
    /**
     * Creates zoom control handlers
     * @type {(elements: NoteElements, saveData: () => Promise<void>) => ZoomHandlers}
     */
    createZoomHandlers,
    
    /**
     * Creates an auto-save trigger function with debouncing
     * @type {(setStatus: StatusSetter, saveData: () => Promise<void>) => () => void}
     */
    createTriggerAutoSave,
    
    /**
     * Sets up all event listeners for note features
     * @type {(elements: NoteElements, triggerAutoSave: () => void, zoomIn: () => void, zoomOut: () => void, resetZoom: () => void) => void}
     */
    setupEventListeners
} from './notehandlers.js';

/**
 * @typedef {Object} NoteElements
 * @property {HTMLTextAreaElement} textarea - The main textarea element for note content
 * @property {HTMLElement} saveIndicator - Element showing save status indicator
 * @property {HTMLElement} statusText - Element displaying status messages
 */

/**
 * @typedef {(message: string, type: 'success' | 'error' | 'saving') => void} StatusSetter
 * Function that updates the status display with a message and type
 */

/**
 * @typedef {Object} ZoomHandlers
 * @property {() => void} zoomIn - Increases the font size
 * @property {() => void} zoomOut - Decreases the font size
 * @property {() => void} resetZoom - Resets the font size to default
 */

/**
 * @typedef {Object} NoteFeaturesAPI
 * @property {() => Promise<void>} loadData - Loads note data from storage
 * @property {() => Promise<void>} saveData - Saves current note data to storage
 * @property {() => void} zoomIn - Increases the editor font size
 * @property {() => void} zoomOut - Decreases the editor font size
 * @property {() => void} resetZoom - Resets the editor font size to default
 * @property {() => number} getCurrentFontSize - Returns the current font size value
 * @property {() => void} cleanup - Cleans up event listeners and timers to prevent memory leaks
 */

/**
 * Initializes note features with auto-save functionality and zoom controls
 * Provides a complete note-taking interface with automatic saving and font size management
 * 
 * **Singleton Pattern:** Only one instance can be initialized at a time to prevent conflicts
 * 
 * **Features:**
 * - Auto-save with debouncing to reduce storage writes
 * - Font size zoom controls (in/out/reset)
 * - Automatic data persistence to browser storage
 * - Status indicator for save operations
 * - Cleanup utilities for proper resource management
 * - Before unload protection to prevent data loss
 * 
 * **Lifecycle:**
 * 1. Validates required DOM elements exist
 * 2. Creates handler functions for all features
 * 3. Sets up event listeners with cleanup tracking
 * 4. Loads initial data asynchronously
 * 5. Registers before unload save protection
 * 6. Returns API object for programmatic control
 * 
 * @async
 * @function noteFeatures
 * @param {string} [textareaId='autoSaveTextarea'] - The ID of the textarea element for note input
 * @param {string} [saveIndicatorId='saveIndicator'] - The ID of the element displaying save status icon
 * @param {string} [statusTextId='statusText'] - The ID of the element displaying status messages
 * @returns {Promise<NoteFeaturesAPI|null>} A promise that resolves to the note features API object, or null if initialization fails or already initialized
 * @throws {Error} Throws if required DOM elements are not found in the document
 */
export const noteFeatures = async (
    textareaId = 'autoSaveTextarea',
    saveIndicatorId = 'saveIndicator',
    statusTextId = 'statusText'
) => {
    /**
     * Global flag preventing duplicate initialization
     * Stored on window object to persist across module reloads
     * @type {boolean}
     */
    if (window.__noteFeaturesInitialized) {
        console.warn('noteFeatures already initialized - skipping duplicate init');
        return null;
    }

    /**
     * Mark as initialized to prevent duplicate instances
     */
    window.__noteFeaturesInitialized = true;
    
    try {
        /**
         * Collection of DOM elements required for note features
         * All elements must exist or an error will be thrown
         * @type {NoteElements}
         */
        const els = {
            textarea: document.getElementById(textareaId),
            saveIndicator: document.getElementById(saveIndicatorId),
            statusText: document.getElementById(statusTextId)
        };

        /**
         * Validates that all required DOM elements exist
         * Throws descriptive error if any element is missing
         */
        if (!els.textarea || !els.saveIndicator || !els.statusText) {
            throw new Error('Note.js: Required elements not found');
        }

        /**
         * Status setter function for updating UI feedback
         * @type {StatusSetter}
         */
        const setStatus = createSetStatus(els);
        
        /**
         * Data loading function with error handling
         * @type {() => Promise<void>}
         */
        const loadData = createLoadData(els, setStatus);
        
        /**
         * Data saving function with status updates
         * @type {() => Promise<void>}
         */
        const saveData = createSaveData(els, setStatus);
        
        /**
         * Zoom control handlers object
         * @type {ZoomHandlers}
         */
        const { zoomIn, zoomOut, resetZoom } = createZoomHandlers(els, saveData);
        
        /**
         * Auto-save trigger function with debouncing
         * @type {() => void}
         */
        const triggerAutoSave = createTriggerAutoSave(setStatus, saveData);

        /**
         * Sets up all event listeners with cleanup tracking
         * Registers listeners for textarea input, keyboard shortcuts, and zoom controls
         */
        setupEventListeners(
            els,
            triggerAutoSave,
            zoomIn,
            zoomOut,
            resetZoom
        );

        /**
         * Defers initial data load to next microtask
         * Prevents blocking the main initialization flow
         * Errors are caught and logged but don't fail initialization
         */
        queueMicrotask(() => {
            loadData().catch(error => {
                console.error('Error loading default data:', error);
            });
        });

        /**
         * Handler for saving data before the window unloads
         * Ensures data is persisted even if user closes tab/window
         * @async
         * @function beforeUnloadHandler
         * @returns {Promise<void>}
         */
        const beforeUnloadHandler = async () => {
            try {
                await saveData();
            } catch (error) {
                console.error('Error saving before unload:', error);
            }
        };

        /**
         * Registers the before unload handler
         * Ensures data is saved when user navigates away or closes window
         */
        window.addEventListener(
            'beforeunload',
            beforeUnloadHandler
        );

        /**
         * Tracks the beforeunload listener for cleanup
         * Allows proper removal during cleanup to prevent memory leaks
         */
        addEventListenerTracker(
            window,
            'beforeunload',
            beforeUnloadHandler
        );

        /**
         * Cleanup function that removes all event listeners and clears timers
         * Should be called when destroying the note features instance
         * Prevents memory leaks and ensures clean teardown
         * @function cleanup
         * @returns {void}
         */
        const cleanup = () => {
            clearEventListeners();
            clearTimeout(autoSaveTimeout);
        };

        /**
         * Returns the public API object for controlling note features
         * All methods are bound to the current instance and closure scope
         * @type {NoteFeaturesAPI}
         */
        return {
            loadData,
            saveData,
            zoomIn,
            zoomOut,
            resetZoom,
            getCurrentFontSize: () => currentFontSize,
            cleanup
        };
    } catch (error) {
        /**
         * Logs initialization errors and returns null
         * Prevents app crash while signaling initialization failure
         */
        console.error('Failed to initialize note features:', error);
        return null;
    }
};