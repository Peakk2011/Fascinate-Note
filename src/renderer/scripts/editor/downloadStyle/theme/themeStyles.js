import { theme } from './colors.js';

/**
 * Generate CSS for theme
 * @param {import('./colors.js').ThemeMode} mode
 * @returns {string}
 */
export const themeStyles = (mode) => {
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
            color: ${colors.linkCardText};
            fill: ${colors.linkCardText};
        }

        .link-url-text {
            color: ${colors.linkCardText};
            border-bottom: solid 1px ${colors.linkCardText};
            border-bottom-color: color-mix(in srgb, ${colors.linkCardText} 65%, transparent);
        }
    `;
};