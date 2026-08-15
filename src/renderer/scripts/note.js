/**
 * Central export module for note-related features and configuration
 * Aggregates and re-exports note functionality from various submodules
 * @module noteFeatures
 */

/**
 * Configuration object containing settings and options for note features
 * Includes theme settings, editor preferences, and feature toggles
 * @type {import('./note/noteConfig.js').NoteFeaturesConfig}
 */
export { noteFeaturesConfig } from './note/noteConfig.js';

/**
 * API object providing methods for interacting with note features
 * Contains functions for creating, updating, deleting, and managing notes
 * @type {import('./note/api.js').NoteFeatures}
 */
export { noteFeatures } from './note/api.js';

/**
 * The current font size value for the note editor
 * Represents the active font size setting in pixels or relative units
 * @type {number}
 */
export {
    currentFontSize
} from './note/state.js';