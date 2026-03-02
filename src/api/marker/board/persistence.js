import { STORAGE_KEYS } from './constants.js';
import { safeParse, saveToStorage } from './utils.js';

/**
 * Loads windows from local storage.
 * @returns {Array<object>} The loaded windows.
 */
export const loadWindows = () => safeParse(localStorage.getItem(STORAGE_KEYS.windows), []);

/**
 * Loads groups from local storage.
 * @returns {Array<object>} The loaded groups.
 */
export const loadGroups = () => safeParse(localStorage.getItem(STORAGE_KEYS.groups), []);

/**
 * Loads the active group from local storage.
 * @returns {string|null} The ID of the active group.
 */
export const loadActiveGroup = () => localStorage.getItem(STORAGE_KEYS.activeGroup) || null;

/**
 * Persists the marker board state to local storage.
 * @param {Array<object>} windows - The windows to persist.
 * @param {Array<object>} groups - The groups to persist.
 * @param {string|null} activeGroupId - The ID of the active group.
 */
export const persist = (windows, groups, activeGroupId) => {
    saveToStorage(STORAGE_KEYS.windows, windows);
    saveToStorage(STORAGE_KEYS.groups, groups);
    if (activeGroupId !== null) {
        localStorage.setItem(STORAGE_KEYS.activeGroup, activeGroupId);
    } else {
        localStorage.removeItem(STORAGE_KEYS.activeGroup);
    }
};