/**
 * URL preview card system - constants
 * @module urlPreview/constants
 */

export const URL_REGEX        = /https?:\/\/[^\s\)\]\>]+/gi;
export const URL_REGEX_TEST   = /https?:\/\/[^\s\)\]\>]+/i;

export const SCAN_DELAY_DEFAULT  = 350;
export const SCAN_DELAY_MUTATION = 400;
export const SCAN_DELAY_INITIAL  = 500;
export const SCAN_IDLE_TIMEOUT   = 800;
export const URL_UPDATE_DEBOUNCE = 400;