// CSS config for downloading HTML in Fascinate Note
import { WebElements, Design } from '../../../../framework/units.js';

const { spacing, borderRadius } = WebElements;
const { designConfig } = Design;

/**
 * @typedef {'light' | 'dark'} ThemeMode
 */

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

const linkCardShared = {
    blur: '8px',
    zoomBtnBorderRadius: '100vmax',
    zoomBtnHoverColor: '#000000',
    zoomBtnHoverWeight: '500',
};

/** @type {Record<ThemeMode, ThemeColors>} */
const theme = {
    light: {
        text: '#000',
        background: '#fcfffc',
        muted: '#666',
        border: '#a7a6a3',
        codeBg: '#eae9e5',
        headingBorder: '#a7a6a3',
        links: 'rgb(50, 50, 153)',

        // Link card
        linkMenuBackground: 'hsl(0, 0%, 97%)', // = --ctx-menu-bg
        linkMenuShadow:
            '0 12px 24px rgba(0, 0, 0, 0.05), 0 24px 48px rgba(0, 0, 0, 0.06)', // = --ctx-menu-shadow (light)
        linkCardText: '#0f0f0f', // = --theme-fg (light)
        linkCardBorder: 'hsl(0, 0%, 88%)', // = --theme-border (light)
        linkCardButtonBackground: 'hsl(0, 0%, 95%)', // = --PrimaryButtonsColors (light)
        linkCardHoverBackground: 'hsl(200, 20%, 93%)', // = --theme-accent (light)
    },
    dark: {
        text: '#f4f4f4',
        background: '#0f0f0f',
        muted: '#999',
        border: '#343434',
        codeBg: '#1f1f1f',
        headingBorder: '#333',
        links: 'hsla(240, 85%, 69%, 1)',

        // Link card
        linkMenuBackground: 'hsla(0, 0%, 7.5%, 0.820)', // = --ctx-menu-bg
        linkMenuShadow:
            '0px 24px 38px hsla(0, 0%, 0%, 0.14), 0px 9px 46px hsla(0, 0%, 0%, 0.12), 0px 11px 15px hsla(0, 0%, 0%, 0.20)', // = --ctx-menu-shadow (dark)
        linkCardText: '#ffffff', // = --theme-fg (dark)
        linkCardBorder: 'hsl(0, 0%, 20%)', // = --theme-border (dark)
        linkCardButtonBackground: 'hsl(0, 0%, 10%)', // = --PrimaryButtonsColors (dark)
        linkCardHoverBackground: 'hsl(120, 7%, 85%)', // = --theme-accent (dark)
    },
};

/**
 * Generate CSS for theme
 * @param {ThemeMode} mode
 * @returns {string}
 */
const themeStyles = (mode) => {
    const colors = theme[mode];
    
    return `
        body {
            color: ${colors.text};
            background: ${colors.background};
        }

        h1, h2 {
            border-bottom-color: ${colors.headingBorder};
        }

        a {
            color: ${colors.links};
        }

        a:hover, a:focus {
            color: ${colors.muted};
        }

        code, pre {
            background: ${colors.codeBg};
        }

        blockquote {
            border-left-color: ${colors.border};
            color: ${colors.muted};
        }

        hr {
            border-top-color: ${colors.border};
        }

        th, td {
            border-color: ${colors.border};
        }

        th {
            background: ${colors.codeBg};
        }

        .link-card,
        .link-card-badge {
            background: ${colors.linkMenuBackground};
        }

        .link-card {
            box-shadow: ${colors.linkMenuShadow};
        }

        .link-card:hover {
            box-shadow:
                ${colors.linkMenuShadow},
                0 4px 12px rgba(0, 0, 0, .08),
                0 16px 40px rgba(0, 0, 0, .12);
        }

        .link-card-thumb {
            box-shadow: ${colors.linkMenuShadow};
            border: ${colors.linkCardBorder} solid 1px;
            outline: ${colors.linkCardBorder} solid 1px;
        }

        .link-card-title {
            color: ${colors.linkCardText};
        }

        .link-card-badge {
            color: ${colors.linkCardText};
            border: ${colors.linkCardBorder} solid 1px;
            outline: ${colors.linkCardBorder} solid 1px;
        }

        .link-card-open {
            background-color: ${colors.linkCardButtonBackground};
            box-shadow: ${colors.linkMenuShadow};
            border: ${colors.linkCardBorder} solid 1px;
            outline: ${colors.linkCardBorder} solid 1px;
            color: ${colors.linkCardText};
        }

        .link-card-open:hover {
            background-color: ${colors.linkCardHoverBackground};
            color: ${linkCardShared.zoomBtnHoverColor};
            fill: ${linkCardShared.zoomBtnHoverColor};
            font-weight: ${linkCardShared.zoomBtnHoverWeight};
        }

        .link-url-text {
            color: ${colors.linkCardText};
            border-bottom: solid 1px ${colors.linkCardText};
            border-bottom-color: color-mix(in srgb, ${colors.linkCardText} 65%, transparent);
        }
    `;
};

/**
 * @typedef {Object} downloadMarkupsContent
 * @property {string} styles - Complete CSS string
 * @property {Record<ThemeMode, ThemeColors>} theme - Theme colors
 */

/** @type {downloadMarkupsContent} */
export const downloadMarkupsContent = {
    styles: `
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&family=Anuphan:wght@400;600;700&display=swap');

        *, *::before, *::after {
            box-sizing: ${designConfig.boxSizing || 'border-box'};
            margin: 0;
            padding: 0;
        }

        html {
            -webkit-text-size-adjust: ${designConfig.textSizeAdjust};
        }

        body {
            font-family: "Inter Tight", "Leelawadee UI", system-ui, sans-serif;
            letter-spacing: ${designConfig.letterSpacing};
            line-height: ${designConfig.lineHeight};
            -webkit-font-smoothing: ${designConfig.fontSmoothingWebkit};
            -moz-osx-font-smoothing: ${designConfig.fontSmoothingMoz};
            text-rendering: ${designConfig.textRendering};
            max-width: 750px;
            margin: 0 auto;
            padding: ${spacing[6]};
            color: ${theme.light.text};
            background: ${theme.light.background};
        }

        @media (max-width: 768px) {
            body {
                max-width: 100%;
                padding: ${spacing[6]};
            }
        }

        div,
        p,
        span {
            font-family: "Inter Tight", "Leelawadee UI", system-ui, sans-serif;
            letter-spacing: ${designConfig.letterSpacing};
        }

        h1, h2, h3, h4, h5, h6 {
            font-family: 'Inter Tight', 'Anuphan', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin-top: ${spacing[4]};
            margin-bottom: ${spacing[4]};
            font-weight: 600;
            line-height: ${designConfig.headingLineHeight};
            letter-spacing: ${designConfig.letterSpacing};
        }

        h1 { font-size: 27.9px; }   
        h2 { font-size: 21.75px; }  
        h3 { font-size: 16.965px; } 
        h4 { font-size: 14.5px; }   
        h5 { font-size: 14.5px; }   
        h6 { font-size: 14.5px; }   

        a {
            color: ${theme.light.links};
            text-decoration: ${designConfig.textDecorationNone};
            transition: color 150ms ease;
            border-bottom: solid 1px currentColor;
        }

        a:hover, a:focus {
            color: ${theme.light.muted};
        }

        code {
            background: ${theme.light.codeBg};
            padding: ${spacing[0.5]} ${spacing[1]};
            border-radius: ${borderRadius.sm};
            font-family: Consolas, Monaco, 'Courier New', monospace;
            font-size: 0.95em;
        }

        pre {
            background: ${theme.light.codeBg};
            padding: ${spacing[4]};
            border-radius: ${borderRadius.md};
            overflow-x: auto;
            margin: 0 0 ${spacing[6]};
        }

        pre code {
            background: ${designConfig.backgroundNone};
            padding: 0;
            border-radius: 0;
        }

        blockquote {
            border-left: 4px solid ${theme.light.border};
            margin: 0 0 ${spacing[6]};
            padding-left: ${spacing[4]};
            color: ${theme.light.muted};
            font-style: italic;
        }

        ul, ol {
            margin: ${spacing[4]} 0 ${spacing[6]} ${spacing[6]};
            padding: 0;
        }

        li {
            margin-bottom: ${spacing[2]};
        }

        li > ul, li > ol {
            margin-top: ${spacing[2]};
        }

        hr {
            border: ${designConfig.borderNone};
            border-top: 1px solid ${theme.light.border};
        }

        table {
            border-collapse: ${designConfig.borderCollapse};
            width: 100%;
            margin-bottom: ${spacing[6]};
        }

        th, td {
            border: 1px solid ${theme.light.border};
            padding: ${spacing[2]} ${spacing[3]};
            text-align: left;
        }

        th {
            background: ${theme.light.codeBg};
            font-weight: 600;
        }

        img, video, audio, iframe, embed, object {
            max-width: 100%;
            height: ${designConfig.heightAuto};
            display: ${designConfig.displayBlock};
            margin: ${spacing[4]} auto;
        }

        input[type="checkbox"],
        input[type="radio"] {
            width: ${spacing[4]};
            height: ${spacing[4]};
            margin-right: ${spacing[2]};
            transform: translateY(1.5px);
        }

        figcaption {
            font-size: 0.875rem;
            text-align: center;
            margin-top: ${spacing[2]};
            font-style: italic;
        }

        .link-card {
            display: flex;
            align-items: center;
            flex-direction: column;

            background: ${theme.light.linkMenuBackground};
            backdrop-filter: blur(${linkCardShared.blur});
            box-shadow: ${theme.light.linkMenuShadow};
            transition: transform 160ms ease, box-shadow 160ms ease;
            cursor: default;
            user-select: none;
            margin: 1.5rem 0;
            margin-bottom: 4rem;

            width: 220px;
            position: relative;
            pointer-events: auto;
        }

        .link-card:hover {
            box-shadow:
                ${theme.light.linkMenuShadow},
                0 4px 12px rgba(0, 0, 0, .08),
                0 16px 40px rgba(0, 0, 0, .12);
        }

        .link-card-thumb {
            width: 100%;
            aspect-ratio: 16 / 9;
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;

            box-shadow: ${theme.light.linkMenuShadow};
            border: ${theme.light.linkCardBorder} solid 1px;
            outline: ${theme.light.linkCardBorder} solid 1px;
            pointer-events: none;
        }

        .link-card-thumb img {
            width: 100%;
            height: 100%;
            aspect-ratio: 16 / 9;
            object-fit: cover;
            pointer-events: none;
        }

        .link-card-body {
            display: flex;
            /* flex-direction: column; */
            justify-content: space-between;
            align-items: center;
            width: 100%;
            pointer-events: auto;
            user-select: none;
        }

        .link-card-title {
            font-weight: 600;
            font-size: 1rem;
            margin-top: 0.5rem;
            color: ${theme.light.linkCardText};
            white-space: nowrap;
            text-overflow: ellipsis;
            overflow: hidden;

            pointer-events: none;
            user-select: none;
            display: none;
        }

        .link-card-badge {
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 2px 8px;
            border-radius: 999px;
            background: ${theme.light.linkMenuBackground};
            color: ${theme.light.linkCardText};
            font-size: 0.72rem;
            font-weight: 600;
            text-transform: uppercase;
            border: ${theme.light.linkCardBorder} solid 1px;
            outline: ${theme.light.linkCardBorder} solid 1px;
            backdrop-filter: blur(6px);
            pointer-events: none;
            user-select: none;
        }

        .link-card-open {
            padding: 1rem 0.8rem;
            line-height: 0;
            border-radius: ${linkCardShared.zoomBtnBorderRadius};
            background-color: ${theme.light.linkCardButtonBackground};
            box-shadow: ${theme.light.linkMenuShadow};
            border: ${theme.light.linkCardBorder} solid 1px;
            outline: ${theme.light.linkCardBorder} solid 1px;
            color: ${theme.light.linkCardText};
            width: fit-content;
            display: inline-block;
            text-align: center;
            font-weight: 500;
            letter-spacing: -0.2px;

            cursor: pointer;
            pointer-events: auto;
            text-decoration: none;
            display: inline-block;
            align-self: flex-start;
            user-select: none;

            position: absolute;
            bottom: -40px;
            left: 0;
        }

        .link-card-open:hover {
            background-color: ${theme.light.linkCardHoverBackground};
            cursor: pointer;
            color: ${linkCardShared.zoomBtnHoverColor};
            fill: ${linkCardShared.zoomBtnHoverColor};
            font-weight: ${linkCardShared.zoomBtnHoverWeight};
        }

        .link-card-open {
            color: ${theme.light.linkCardText};
            font-size: 0.85rem;
        }

        .link-card-url-source {
            display: none;
        }

        .link-url-text {
            color: ${theme.light.linkCardText};
            cursor: text;
            border-bottom: solid 1px ${theme.light.linkCardText};
            border-bottom-color: color-mix(in srgb, ${theme.light.linkCardText} 65%, transparent);
            font-weight: 500;
            letter-spacing: -0.4px;
            pointer-events: none;
            user-select: none;
        }

        .inline-url-editor {
            border: 1px solid rgba(0, 0, 0, 0.08);
            padding: 4px 6px;
            border-radius: 6px;
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
            pointer-events: auto;
        }

        @media (prefers-color-scheme: dark) {
            ${themeStyles('dark')}
        }
    `,
    
    theme,
};

// Check validation
if (!theme.light || !theme.dark) {
    throw new Error('Theme configuration is missing');
}
