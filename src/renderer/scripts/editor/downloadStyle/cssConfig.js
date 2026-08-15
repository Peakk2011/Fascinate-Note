// CSS config for downloading HTML in Fascinate Note
import { base } from './styles/base.js';
import { elements } from './styles/elements.js';
import { table } from './styles/table.js';
import { linkCard } from './styles/linkCard.js';
import { theme } from './theme/colors.js';
import { themeStyles } from './theme/themeStyles.js';

/**
 * @typedef {import('./theme/colors.js').ThemeMode} ThemeMode
 * @typedef {import('./theme/colors.js').ThemeColors} ThemeColors
 */

/**
 * @typedef {Object} downloadMarkupsContent
 * @property {string} styles - Complete CSS string
 * @property {Record<ThemeMode, ThemeColors>} theme - Theme colors
 */

/** @type {downloadMarkupsContent} */
export const downloadMarkupsContent = {
    styles: base + elements + table + linkCard +
        `@media (prefers-color-scheme: dark) { ${themeStyles('dark')} }`,
    theme,
};