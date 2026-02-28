/** @typedef {'light' | 'dark'} ThemeMode */

/**
 * @typedef {Object} ThemeColors
 * @property {string} text
 * @property {string} background
 * @property {string} muted
 * @property {string} border
 * @property {string} codeBg
 * @property {string} headingBorder
 * @property {string} links
 * @property {string} linkMenuBackground
 * @property {string} linkMenuShadow
 * @property {string} linkCardText
 * @property {string} linkCardBorder
 * @property {string} linkCardButtonBackground
 * @property {string} linkCardHoverBackground
 */

/** @type {Record<ThemeMode, ThemeColors>} */
export const theme = {
    light: {
        text: '#000',
        background: '#fcfffc',
        muted: '#666',
        border: '#a7a6a3',
        codeBg: '#eae9e5',
        headingBorder: '#a7a6a3',
        links: 'rgb(50, 50, 153)',

        linkMenuBackground: 'hsl(0, 0%, 97%)',
        linkMenuShadow:
            '0 12px 24px rgba(0, 0, 0, 0.05), 0 24px 48px rgba(0, 0, 0, 0.06)',
        linkCardText: '#0f0f0f',
        linkCardBorder: 'hsl(0, 0%, 88%)',
        linkCardButtonBackground: 'hsl(0, 0%, 95%)',
        linkCardHoverBackground: 'hsl(200, 20%, 93%)',
    },
    dark: {
        text: '#f4f4f4',
        background: '#0f0f0f',
        muted: '#999',
        border: '#343434',
        codeBg: '#1f1f1f',
        headingBorder: '#333',
        links: 'hsla(240, 85%, 69%, 1)',

        linkMenuBackground: 'hsla(0, 0%, 7.5%, 0.820)',
        linkMenuShadow:
            '0px 24px 38px hsla(0, 0%, 0%, 0.14), 0px 9px 46px hsla(0, 0%, 0%, 0.12), 0px 11px 15px hsla(0, 0%, 0%, 0.20)',
        linkCardText: '#ffffff',
        linkCardBorder: 'hsl(0, 0%, 20%)',
        linkCardButtonBackground: 'hsl(0, 0%, 10%)',
        linkCardHoverBackground: 'hsl(120, 7%, 85%)',
    },
};

if (!theme.light || !theme.dark) {
    throw new Error('Theme configuration is missing');
}