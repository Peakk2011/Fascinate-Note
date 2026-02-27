/**
 * @namespace Mint
 * @description Minimal Mintkit exports for Fascinate Notes.
 */

import { injectHTML } from './injection/html/index.js';
import { injectCSS } from './injection/css/index.js';
import { injectTitle } from './injection/title/index.js';
import { inject } from './injection/unified/index.js';
import { get, include } from './loader/index.js';

// Export minimal APIs
export { injectHTML, injectCSS, injectTitle, inject, get, include };

export const Mint = {
    injectHTML,
    injectCSS,
    injectTitle,
    inject,
    get,
    include
};

// Global availability (optional)
if (typeof window !== 'undefined') {
    window.Mintkit = Mint;
    window.Mint = Mint; // Shorter alias
}