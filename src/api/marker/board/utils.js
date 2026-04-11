import { STORAGE_KEYS } from './constants.js';

/**
 * Safely parses a JSON string.
 * @param {string} value - The string to parse.
 * @param {*} fallback - The fallback value if parsing fails.
 * @returns {*} The parsed object or the fallback value.
 */
export const safeParse = (value, fallback) => {
    if (!value) return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
};

/**
 * Saves a value to local storage.
 * @param {string} key - The key to save the value under.
 * @param {*} value - The value to save.
 */
export const saveToStorage = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
};

/**
 * Creates a unique ID for a window.
 * @returns {string} A unique ID.
 */
export const createId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return `win_${crypto.randomUUID()}`;
    }
    return `win_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Sanitizes text by removing extra whitespace.
 * @param {string} text - The text to sanitize.
 * @returns {string} The sanitized text.
 */
export const sanitizeText = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/\s+/g, ' ').trim();
};

/**
 * Converts HTML to plain text.
 * @param {string} html - The HTML to convert.
 * @returns {string} The plain text.
 */
export const htmlToText = (html) => {
    const holder = document.createElement('div');
    holder.innerHTML = html || '';
    return sanitizeText(holder.textContent || '');
};

const BLOCKED_TAGS = new Set([
    'script',
    'style',
    'link',
    'meta',
    'base',
    'object',
    'embed'
]);

const URL_ATTRS = new Set(['href', 'src', 'xlink:href']);
const RICH_MEDIA_SELECTOR = 'img,video,audio,iframe,svg,canvas,table,blockquote,pre,hr';

const isSafeUrl = (value) => {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (normalized.startsWith('javascript:') || normalized.startsWith('vbscript:')) {
        return false;
    }
    if (normalized.startsWith('data:') && !normalized.startsWith('data:image/')) {
        return false;
    }
    return true;
};

/**
 * Sanitizes HTML before showing it in Marker preview windows.
 * It removes executable tags/events and strips unsafe URLs.
 * @param {string} html - Raw note html.
 * @returns {string} Safe html for preview rendering.
 */
export const sanitizePreviewHtml = (html) => {
    if (typeof html !== 'string' || !html.trim()) return '';

    const template = document.createElement('template');
    template.innerHTML = html;
    const removeQueue = [];
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);

    while (walker.nextNode()) {
        const element = /** @type {HTMLElement} */ (walker.currentNode);
        const tagName = element.tagName.toLowerCase();

        if (BLOCKED_TAGS.has(tagName)) {
            removeQueue.push(element);
            continue;
        }

        [...element.attributes].forEach((attr) => {
            const name = attr.name.toLowerCase();

            if (name.startsWith('on') || name === 'srcdoc') {
                element.removeAttribute(attr.name);
                return;
            }

            if (!URL_ATTRS.has(name)) return;
            if (!isSafeUrl(attr.value)) {
                element.removeAttribute(attr.name);
            }
        });

        if (tagName === 'a' && element.getAttribute('href')) {
            element.setAttribute('rel', 'noopener noreferrer');
            if (!element.getAttribute('target')) {
                element.setAttribute('target', '_blank');
            }
        }
    }

    removeQueue.forEach((node) => node.remove());
    return template.innerHTML;
};

/**
 * Checks whether sanitized html has visible renderable content.
 * @param {string} html - Already sanitized html.
 * @returns {boolean} true when content should be shown instead of placeholder.
 */
export const hasRenderableContent = (html) => {
    if (typeof html !== 'string' || !html.trim()) return false;

    const holder = document.createElement('div');
    holder.innerHTML = html;
    if (sanitizeText(holder.textContent || '').length > 0) return true;
    return Boolean(holder.querySelector(RICH_MEDIA_SELECTOR));
};

/**
 * Truncates text to a maximum length.
 * @param {string} text - The text to truncate.
 * @param {number} [max=220] - The maximum length.
 * @returns {string} The truncated text.
 */
export const truncateText = (text, max = 220) => {
    if (text.length <= max) return text;
    return `${[...text].slice(0, max).join('').trim()}…`;
};

/**
 * Gets a group by its ID.
 * @param {Array<object>} groups - The array of groups.
 * @param {string} id - The ID of the group to get.
 * @returns {object|undefined} The group object, or undefined if not found.
 */
export const getGroupById = (groups, id) => groups.find(g => g.id === id);

/**
 * Generates a random HSL color tuned for current theme mode.
 * - Dark mode: brighter accent colors for strong contrast
 * - Light mode: deeper colors to avoid washed-out labels
 * @returns {string} A random HSL color string.
 */
export const randomColor = () => {
    const hue = Math.floor(Math.random() * 360);
    const darkMode = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (darkMode) {
        // brighter, high-visibility accents on dark surfaces
        const saturation = 82 + Math.floor(Math.random() * 12); // 82-93
        const lightness = 66 + Math.floor(Math.random() * 10);  // 66-75
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    // deeper accents for better contrast on light surfaces
    const saturation = 72 + Math.floor(Math.random() * 12); // 72-83
    const lightness = 34 + Math.floor(Math.random() * 10);  // 34-43
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/**
 * Gets the canvas coordinates from a mouse event.
 * @param {MouseEvent} e - The mouse event.
 * @returns {{x: number, y: number}} The canvas coordinates.
 */
export const getCanvasCoords = (e) => {
    // This should be implemented based on your canvas coordinate system
    return { x: e.clientX, y: e.clientY };
};