// This file part from renderer (frontend)

/**
 * @typedef {Object} NoteFeaturesConfig
 * @property {number} minFontSize - Min font size
 * @property {number} maxFontSize - Max font size
 * @property {number} defaultFontSize - Default font size
 * @property {number} fontStep - Font size step
 * @property {number} autoSaveDelay - Auto-save delay (ms)
 * @property {number} autoSaveIdleTimeout - Max wait for idle save (ms)
 * @property {number} mainProcessSaveThrottle - Throttle for saving to main process (ms)
 * @property {Object} status - Status texts
 */

/** @type {NoteFeaturesConfig} */

export const noteFeaturesConfig = {
    minFontSize: 8,
    maxFontSize: 128,
    defaultFontSize: 14.5,
    fontStep: 2,
    autoSaveDelay: 2000,
    autoSaveIdleTimeout: 1200,
    mainProcessSaveThrottle: 4000,
    status: {
        typing: 'Typing...',
        saving: 'Saving...',
        saved: 'Saved',
        error: 'Error saving'
    }  
};