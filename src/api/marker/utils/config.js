import { fetchJSON } from '@fJson';

/**
 * @typedef {Object} WorkspaceConfig
 * @property {Object} constants                 - Workspace constants
 * @property {Object} canvas                    - Canvas default settings
 */

/**
 * @typedef {Object} GlobalState
 * @property {number} devicePixelRatio          - Device pixel ratio
 * @property {number} dpr                       - Cached device pixel ratio getter
 * @property {number} scale                     - Canvas zoom scale
 * @property {number} panX                      - Canvas pan X offset
 * @property {number} panY                      - Canvas pan Y offset
 * @property {boolean} isInitialized            - Initialization status
 * @property {HTMLCanvasElement|null} canvas    - Main canvas element
 * @property {CanvasRenderingContext2D|null} ctx - Main canvas 2D context
 * @property {HTMLElement|null} canvasContainer - Container for the canvas
 * @property {SVGElement|null} svg              - SVG overlay for annotations/tools
 * @property {SVGGElement|null} svgGroup        - Group within the SVG overlay
 * @property {number} canvasWidth               - Current width of the canvas
 * @property {number} canvasHeight              - Current height of the canvas
 * @property {number} lastMouseX                - Last recorded mouse X position
 * @property {number} lastMouseY                - Last recorded mouse Y position
 */

/**
 * @typedef {Object} ConfigurationResult
 * @property {Readonly<WorkspaceConfig>} config - Frozen configuration object
 * @property {GlobalState} globalState          - Mutable global state
 */

/**
 * @type {WorkspaceConfig|null}
 */
let config = null;

/**
 * @type {GlobalState|null}
 */
let globalState = null;

/**
 * @type {Promise<ConfigurationResult>|null}
 */
let loadingPromise = null;

/**
 * Loads configuration files and initializes global state
 * @async
 * @returns {Promise<ConfigurationResult>} Configuration and global state
 * @throws {Error} If configuration files fail to load
 */
export const loadConfiguration = async () => {
    if (loadingPromise) {
        return loadingPromise;
    }

    // Return cached result if already loaded
    if (config && globalState) {
        return { config, globalState };
    }

    loadingPromise = (async () => {
        try {
            const results = await Promise.all([
                fetchJSON('api/marker/data/workspace_config.json', {
                    cache: true,
                    cacheTTL: 600000,
                    retry: 2
                }),
                fetchJSON('api/marker/data/workspace_state.json', {
                    cache: true,
                    cacheTTL: 600000,
                    retry: 2
                })
            ]);

            config = Object.freeze(results[0]); // Prevent accidental mutations
            globalState = results[1];

            globalState.devicePixelRatio = window.devicePixelRatio || 1;
            globalState.scale = 1;
            globalState.panX = 0;
            globalState.panY = 0;
            globalState.isInitialized = false;
            globalState.isMissionActive = false;

            // Cache devicePixelRatio to avoid repeated property access
            Object.defineProperty(globalState, 'dpr', {
                get: () => globalState.devicePixelRatio,
                configurable: false,
                enumerable: true
            });

            // Freeze config deeply to enable V8 optimizations
            deepFreeze(config);

            return { config, globalState };
        } catch (error) {
            console.error('Failed to load configuration:', error);
            loadingPromise = null; // Reset on error to allow retry
            throw error;
        }
    })();

    return loadingPromise;
};

/**
 * Deep freezes an object and all its nested properties
 * @template T
 * @param {T} obj - Object to freeze
 * @returns {Readonly<T>} Deeply frozen object
 */
const deepFreeze = (obj) => {
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (obj[prop] !== null
            && (typeof obj[prop] === 'object' || typeof obj[prop] === 'function')
            && !Object.isFrozen(obj[prop])) {
            deepFreeze(obj[prop]);
        }
    });
    return obj;
};

/**
 * Gets the frozen configuration object
 * @returns {Readonly<WorkspaceConfig>|null} Configuration object or null if not loaded
 */
export const getConfig = () => config;

/**
 * Gets the mutable global state object
 * @returns {GlobalState|null} Global state object or null if not initialized
 */
export const getState = () => globalState;

/**
 * Checks if configuration is loaded and ready
 * @returns {boolean} True if both config and state are initialized
 */
export const isReady = () => config !== null && globalState !== null;

/**
 * Waits for configuration to be loaded
 * @async
 * @returns {Promise<ConfigurationResult>} Resolves when configuration is ready
 */
export const waitForReady = async () => {
    if (isReady()) {
        return { config, globalState };
    }
    return loadConfiguration();
};

/**
 * Updates global state with new values
 * @param {Partial<GlobalState>} updates - Partial state updates to apply
 * @returns {void}
 * @throws {Error} If state is not initialized
 */
export const updateState = (updates) => {
    if (!globalState) {
        throw new Error(
            'Cannot update state: configuration not loaded. Call loadConfiguration() first.'
        );
    }
    Object.assign(globalState, updates);
};
